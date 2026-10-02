import prisma from '../../../config/database';
import { env } from '../../../config/env';
import { logAudit } from '../../audit/audit.service';

const RECOVERY_MIN_AGE_MS = 60_000;
const RECOVERY_GRACE_MS = 5 * 60_000;
const MIN_DOWNTIME_MS = 60_000;

export interface JanelaRecuperacao {
  sessionId: string;
  startedAt: Date;
  downtimeMs: number;
  recuperadas: number;
  duplicadas: number;
  erros: number;
  timer: NodeJS.Timeout;
}

export interface DecisaoProcessamento {
  processar: boolean;
  recovered: boolean;
  motivo: string;
}

const janelas = new Map<string, JanelaRecuperacao>();
const reconexoes = new Map<string, number>();

function formatarDuracao(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  const minutos = Math.floor(ms / 60_000);
  if (minutos < 60) return `${minutos}min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto > 0 ? `${horas}h${resto}min` : `${horas}h`;
}

export function marcarReconectado(sessionId: string): number {
  const now = Date.now();
  reconexoes.set(sessionId, now);
  return now;
}

export function obterReconexao(sessionId: string): number | undefined {
  return reconexoes.get(sessionId);
}

export function ordenarCronologicamente<T>(items: T[], getTimestamp: (item: T) => number): T[] {
  return [...items].sort((a, b) => (getTimestamp(a) || 0) - (getTimestamp(b) || 0));
}

export function decidirProcessamento(params: {
  type: string;
  messageTimestampSec: number;
  reconnectedAtMs?: number;
  maxAgeHours?: number;
}): DecisaoProcessamento {
  if (params.type !== 'notify' && params.type !== 'append') {
    return { processar: false, recovered: false, motivo: `tipo '${params.type}' nao suportado` };
  }

  if (!env.whatsappRecoveryEnabled) {
    if (params.type !== 'notify') {
      return { processar: false, recovered: false, motivo: 'recuperacao desabilitada' };
    }
    return { processar: true, recovered: false, motivo: 'tempo real (recuperacao desabilitada)' };
  }

  const maxAgeMs = (params.maxAgeHours ?? env.whatsappRecoveryMaxAgeHours) * 3_600_000;
  const tsMs = (params.messageTimestampSec || 0) * 1000;
  const referencia = params.reconnectedAtMs ?? Date.now();

  if (params.type === 'append') {
    if (!tsMs) {
      return { processar: false, recovered: true, motivo: 'lote offline sem timestamp descartado' };
    }
    if (referencia - tsMs > maxAgeMs) {
      return { processar: false, recovered: true, motivo: 'lote offline fora da janela de recuperacao' };
    }
    return { processar: true, recovered: true, motivo: 'mensagem offline recebida na reconexao' };
  }

  if (tsMs && params.reconnectedAtMs && params.reconnectedAtMs - tsMs > RECOVERY_MIN_AGE_MS) {
    return { processar: true, recovered: true, motivo: 'mensagem anterior a reconexao' };
  }

  return { processar: true, recovered: false, motivo: 'mensagem em tempo real' };
}

export async function registrarEventoConexao(
  sessionId: string,
  status: 'connected' | 'disconnected',
  motivo?: string,
): Promise<number | null> {
  try {
    const now = new Date();
    const existing = await prisma.whatsAppSession.findFirst({ where: { session: sessionId } });

    if (status === 'disconnected') {
      if (existing) {
        await prisma.whatsAppSession.update({
          where: { id: existing.id },
          data: { connected: false, lastDisconnectedAt: now },
        });
      } else {
        await prisma.whatsAppSession.create({
          data: { session: sessionId, connected: false, lastDisconnectedAt: now },
        });
      }
      console.log(
        `[WhatsAppRecovery] WhatsApp desconectado provider=baileys instance=${sessionId} dataHora=${now.toISOString()} motivo=${motivo || 'desconhecido'}`,
      );
      await logAudit({
        modulo: 'whatsapp',
        entidade: 'whatsapp_session',
        entidadeId: sessionId,
        acao: 'conexao_desconectada',
        descricao: `WhatsApp desconectado (instance=${sessionId}, motivo=${motivo || 'desconhecido'})`,
        origem: 'whatsapp-recovery',
        resultado: 'sucesso',
        severity: 'baixa',
        metadata: { sessionId, motivo: motivo || 'desconhecido', dataHora: now.toISOString() },
      });
      return null;
    }

    let downtimeMs: number | null = null;
    if (existing) {
      const referencia = existing.lastDisconnectedAt || (existing.connected ? existing.updatedAt : existing.lastConnectedAt);
      if (referencia) downtimeMs = now.getTime() - referencia.getTime();
      await prisma.whatsAppSession.update({
        where: { id: existing.id },
        data: { connected: true, lastConnectedAt: now },
      });
    } else {
      await prisma.whatsAppSession.create({
        data: { session: sessionId, connected: true, lastConnectedAt: now },
      });
    }

    const tempoOffline = downtimeMs != null ? formatarDuracao(downtimeMs) : 'desconhecido';
    console.log(
      `[WhatsAppRecovery] WhatsApp reconectado provider=baileys instance=${sessionId} dataHora=${now.toISOString()} tempoOffline=${tempoOffline}`,
    );
    await logAudit({
      modulo: 'whatsapp',
      entidade: 'whatsapp_session',
      entidadeId: sessionId,
      acao: 'conexao_reconectada',
      descricao: `WhatsApp reconectado (instance=${sessionId}, tempo offline=${tempoOffline})`,
      origem: 'whatsapp-recovery',
      resultado: 'sucesso',
      severity: 'baixa',
      metadata: { sessionId, downtimeMs, tempoOffline, dataHora: now.toISOString() },
    });
    return downtimeMs;
  } catch (err: any) {
    console.error(
      `[WhatsAppRecovery] Falha ao registrar evento de conexao instance=${sessionId} status=${status} motivo=${err?.message || err}`,
    );
    return null;
  }
}

export function iniciarJanelaRecuperacao(sessionId: string, downtimeMs: number | null): void {
  if (!env.whatsappRecoveryEnabled) return;
  if (downtimeMs == null || downtimeMs < MIN_DOWNTIME_MS) return;

  const anterior = janelas.get(sessionId);
  if (anterior) clearTimeout(anterior.timer);

  const fim = new Date();
  const inicio = new Date(fim.getTime() - downtimeMs);
  const timer = setTimeout(() => finalizarJanelaRecuperacao(sessionId), RECOVERY_GRACE_MS);
  timer.unref?.();

  janelas.set(sessionId, {
    sessionId,
    startedAt: fim,
    downtimeMs,
    recuperadas: 0,
    duplicadas: 0,
    erros: 0,
    timer,
  });

  console.log(
    `[WhatsAppRecovery] Iniciando recuperacao instance=${sessionId} periodo=${inicio.toISOString()} -> ${fim.toISOString()} duracao=${formatarDuracao(downtimeMs)}`,
  );
  logAudit({
    modulo: 'whatsapp',
    entidade: 'whatsapp_session',
    entidadeId: sessionId,
    acao: 'recuperacao_iniciada',
    descricao: `RECOVERY_STARTED periodo=${inicio.toISOString()} -> ${fim.toISOString()} duracao=${formatarDuracao(downtimeMs)}`,
    origem: 'whatsapp-recovery',
    resultado: 'sucesso',
    severity: 'baixa',
    metadata: { sessionId, downtimeMs, inicio: inicio.toISOString(), fim: fim.toISOString() },
  }).catch(() => {});
}

export function finalizarJanelaRecuperacao(sessionId: string): void {
  const janela = janelas.get(sessionId);
  if (!janela) return;
  clearTimeout(janela.timer);
  janelas.delete(sessionId);

  console.log(
    `[WhatsAppRecovery] Recuperacao concluida instance=${sessionId} recuperadas=${janela.recuperadas} duplicadasIgnoradas=${janela.duplicadas} erros=${janela.erros}`,
  );
  logAudit({
    modulo: 'whatsapp',
    entidade: 'whatsapp_session',
    entidadeId: sessionId,
    acao: 'recuperacao_concluida',
    descricao: `RECOVERY_COMPLETED recuperadas=${janela.recuperadas} duplicadas=${janela.duplicadas} erros=${janela.erros}`,
    origem: 'whatsapp-recovery',
    resultado: janela.erros > 0 ? 'parcial' : 'sucesso',
    severity: 'baixa',
    metadata: {
      sessionId,
      recuperadas: janela.recuperadas,
      duplicadas: janela.duplicadas,
      erros: janela.erros,
      downtimeMs: janela.downtimeMs,
    },
  }).catch(() => {});
}

export function obterJanela(sessionId: string): JanelaRecuperacao | undefined {
  return janelas.get(sessionId);
}

export function notaRecuperada(sessionId?: string): void {
  const janela = sessionId ? janelas.get(sessionId) : undefined;
  if (janela) janela.recuperadas++;
}

export function notaDuplicada(sessionId?: string, messageId?: string): void {
  const janela = sessionId ? janelas.get(sessionId) : undefined;
  if (janela) janela.duplicadas++;
  console.log(`[WhatsAppRecovery] Mensagem ja existente message_id=${messageId || '-'} acao=ignorada`);
}

export function notaErro(sessionId?: string, messageId?: string, err?: unknown): void {
  const janela = sessionId ? janelas.get(sessionId) : undefined;
  if (janela) janela.erros++;
  const erro = err as any;
  console.error(
    `[WhatsAppRecovery] Falha na recuperacao message_id=${messageId || '-'} motivo=${erro?.message || erro} stack=${erro?.stack || '-'}`,
  );
}
