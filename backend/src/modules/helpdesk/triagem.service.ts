import prisma from '../../config/database';
import {
  generateProtocolo,
  sendWhatsAppMessage,
  sanitizePhoneNumber,
} from '../integrations/whatsapp/whatsapp.service';
import {
  ensureHelpdeskConfigs,
  getEtapaConfig,
  buildMessageVars,
  interpolate,
  sendStageAutoMessage,
} from './helpdesk.service';
import { classifyLocal } from './classificador';

const timersAtivos = new Map<string, NodeJS.Timeout>();
const followupEnviado = new Set<string>();
const processando = new Set<string>();

function clearTimer(ticketId: string) {
  const t = timersAtivos.get(ticketId);
  if (t) {
    clearTimeout(t);
    timersAtivos.delete(ticketId);
  }
}

function marcarFollowupEnviado(ticketId: string) {
  followupEnviado.add(ticketId);
}

export function triagemJaIniciada(ticketId: string): boolean {
  return timersAtivos.has(ticketId) || processando.has(ticketId);
}

export function cancelarTriagem(ticketId: string) {
  clearTimer(ticketId);
  processando.delete(ticketId);
  followupEnviado.delete(ticketId);
}

export function triagemFollowupEnviado(ticketId: string): boolean {
  return followupEnviado.has(ticketId);
}

export async function iniciarOuResetarTriagem(ticketId: string) {
  await ensureHelpdeskConfigs();
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { messages: { orderBy: { sentAt: 'asc' } } },
  });
  if (!ticket) return;
  if (ticket.protocolo) {
    cancelarTriagem(ticketId);
    return;
  }

  clearTimer(ticketId);

  const avaliacao = await tentarClassificar(ticket.messages);
  console.log(`[Triagem] ticket=${ticketId} avaliacao=`, avaliacao);
  if (avaliacao?.categoria && avaliacao.categoria !== 'outro') {
    await moverParaFilaComProtocolo(ticketId, avaliacao.categoria, avaliacao.assunto);
    return;
  }

  const config = await getEtapaConfig('triagem');
  const minutos = config?.tempoInatividadeMin && config.tempoInatividadeMin > 0
    ? config.tempoInatividadeMin
    : 5;
  const ms = minutos * 60 * 1000;
  console.log(`[Triagem] ticket=${ticketId} sem categoria, aguardando ${minutos}min para follow-up`);

  const handle = setTimeout(async () => {
    timersAtivos.delete(ticketId);
    if (followupEnviado.has(ticketId)) return;
    const t = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!t || t.protocolo || t.status === 'fechado') return;
    await enviarFollowUp(ticketId);
  }, ms);

  timersAtivos.set(ticketId, handle);
}

async function tentarClassificar(messages: { content: string | null; fromMe: boolean }[]): Promise<{ categoria: string; assunto: string } | null> {
  const textoCliente = messages
    .filter((m) => !m.fromMe)
    .map((m) => m.content || '')
    .join(' ')
    .trim();
  console.log(`[Triagem] tentarClassificar textoCliente="${textoCliente.slice(0, 100)}"`);
  if (!textoCliente) return null;

  const categoria = classifyLocal(textoCliente, [
    'suporte_tecnico',
    'duvida_faturamento',
    'solicitacao_mudanca',
    'treinamento',
    'reclamacao',
    'orcamento',
    'agendamento',
  ]);
  console.log(`[Triagem] classifyLocal retornou: ${categoria}`);
  if (categoria === 'outro') return null;
  return { categoria, assunto: textoCliente.slice(0, 80) };
}

async function moverParaFilaComProtocolo(ticketId: string, categoria: string, assunto: string) {
  if (processando.has(ticketId)) return;
  processando.add(ticketId);
  try {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket || ticket.protocolo) {
      cancelarTriagem(ticketId);
      return;
    }
    const protocolo = await generateProtocolo();
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { protocolo, categoria, etapa: 'fila', assunto: ticket.assunto || assunto },
    });
    await prisma.ticketStageEvent.create({
      data: {
        ticketId,
        etapaAnterior: 'triagem',
        etapaNova: 'fila',
        origem: 'automatico',
        mensagemEnviada: true,
      },
    });
    clearTimer(ticketId);
    followupEnviado.delete(ticketId);
    sendStageAutoMessage(ticketId, 'fila').catch((e) =>
      console.warn('[Triagem] Falha ao enviar autoMessage da fila:', e?.message || e)
    );
  } catch (err: any) {
    console.error('[Triagem] Erro ao mover para fila:', err?.message || err);
  } finally {
    processando.delete(ticketId);
  }
}

async function enviarFollowUp(ticketId: string) {
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { client: true },
    });
    if (!ticket || !ticket.contactPhone || ticket.protocolo || ticket.status === 'fechado') return;

    const config = await getEtapaConfig('triagem');
    const template = config?.mensagemFollowup;
    if (!template) return;

    const vars = buildMessageVars({
      contactName: ticket.contactName,
      clientName: ticket.client?.razaoSocial,
    });
    const mensagem = interpolate(template, vars);
    const phone = sanitizePhoneNumber(ticket.contactPhone).replace(/@c\.us$/i, '');
    const result = await sendWhatsAppMessage(phone, mensagem);
    if (result.success) {
      await prisma.message.create({
        data: { ticketId, fromMe: true, content: mensagem },
      });
      marcarFollowupEnviado(ticketId);
      console.log(`[Triagem] Follow-up enviado para ticket ${ticketId}`);
    }
  } catch (err: any) {
    console.error('[Triagem] Erro ao enviar follow-up:', err?.message || err);
  }
}
