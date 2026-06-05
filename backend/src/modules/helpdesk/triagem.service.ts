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
import { montarBoasVindas } from './menu';

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

export async function enviarMenuInicial(ticketId: string) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket || !ticket.contactPhone) return;
  const texto = await montarBoasVindas(ticket.contactName || '');
  const phone = sanitizePhoneNumber(ticket.contactPhone).replace(/@c\.us$/i, '');
  const result = await sendWhatsAppMessage(phone, texto);
  if (result.success) {
    await prisma.message.create({
      data: { ticketId, fromMe: true, content: texto },
    });
    console.log(`[Fila] Saudacao enviada para ticket ${ticketId}`);
  } else {
    console.warn(`[Fila] Falha ao enviar saudacao: ${result.error}`);
  }
}

export async function iniciarOuResetarTriagem(ticketId: string) {
  await ensureHelpdeskConfigs();
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return;
  if (ticket.protocolo || ticket.etapa !== 'fila') {
    cancelarTriagem(ticketId);
    return;
  }

  clearTimer(ticketId);

  const config = await getEtapaConfig('fila');
  const minutos = config?.tempoInatividadeMin && config.tempoInatividadeMin > 0
    ? config.tempoInatividadeMin
    : 5;
  const ms = minutos * 60 * 1000;
  console.log(`[Fila] ticket=${ticketId} em fila, follow-up agendado em ${minutos}min`);

  const handle = setTimeout(async () => {
    timersAtivos.delete(ticketId);
    if (followupEnviado.has(ticketId)) return;
    const t = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!t || t.protocolo || t.etapa !== 'fila' || t.status === 'fechado') return;
    await enviarFollowUp(ticketId);
  }, ms);

  timersAtivos.set(ticketId, handle);
}

export async function abrirChamadoPorAtendente(
  ticketId: string,
  atendenteId: string,
  dados: {
    assunto: string;
    categoria?: string;
    prioridade?: string;
    tipo?: string;
    observacoes?: string;
  }
) {
  if (processando.has(ticketId)) {
    return { ok: false, error: 'Ticket sendo processado, tente novamente' };
  }
  processando.add(ticketId);
  try {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) return { ok: false, error: 'Ticket nao encontrado' };
    if (ticket.protocolo) {
      return { ok: false, error: 'Ticket ja triado', ticket };
    }
    if (!dados.assunto || !dados.assunto.trim()) {
      return { ok: false, error: 'Assunto obrigatorio' };
    }

    const protocolo = await generateProtocolo();
    const etapaNova = 'em_atendimento';
    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        protocolo,
        assunto: dados.assunto.trim(),
        categoria: dados.categoria || ticket.categoria,
        prioridade: dados.prioridade || ticket.prioridade || 'media',
        tipo: dados.tipo || ticket.tipo,
        observacoes: dados.observacoes?.trim() || ticket.observacoes,
        etapa: etapaNova,
        status: 'em_andamento',
        assigneeId: atendenteId,
        dataInicioAtendimento: new Date(),
      },
    });
    await prisma.ticketStageEvent.create({
      data: {
        ticketId,
        etapaAnterior: ticket.etapa || 'fila',
        etapaNova,
        origem: 'manual',
        mensagemEnviada: true,
        usuarioId: atendenteId,
      },
    });
    clearTimer(ticketId);
    followupEnviado.delete(ticketId);
    sendStageAutoMessage(ticketId, etapaNova).catch((e) =>
      console.warn('[Fila] Falha ao enviar autoMessage em_atendimento:', e?.message || e)
    );
    console.log(`[Fila] Chamado aberto, ticket ${ticketId} protocolo ${protocolo}`);
    return { ok: true, ticket: updated };
  } catch (err: any) {
    console.error('[Fila] Erro ao abrir chamado:', err?.message || err);
    return { ok: false, error: 'Erro ao abrir chamado' };
  } finally {
    processando.delete(ticketId);
  }
}

export async function transferirTicket(
  ticketId: string,
  deUsuarioId: string,
  paraUsuarioId: string,
  motivo?: string
) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return { ok: false, error: 'Ticket nao encontrado' };
  if (!ticket.protocolo) return { ok: false, error: 'Ticket ainda nao foi triado' };

  const updated = await prisma.ticket.update({
    where: { id: ticketId },
    data: { assigneeId: paraUsuarioId },
  });
  await prisma.ticketStageEvent.create({
    data: {
      ticketId,
      etapaAnterior: ticket.etapa,
      etapaNova: ticket.etapa,
      origem: 'transferencia',
      usuarioId: deUsuarioId,
      mensagemAutomatica: motivo || `Transferido de ${deUsuarioId} para ${paraUsuarioId}`,
    },
  });
  return { ok: true, ticket: updated };
}

async function enviarFollowUp(ticketId: string) {
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { client: true },
    });
    if (!ticket || !ticket.contactPhone || ticket.protocolo || ticket.status === 'fechado') return;
    if (ticket.etapa !== 'fila') return;

    const config = await getEtapaConfig('fila');
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
      followupEnviado.add(ticketId);
      console.log(`[Fila] Follow-up enviado para ticket ${ticketId}`);
    }
  } catch (err: any) {
    console.error('[Fila] Erro ao enviar follow-up:', err?.message || err);
  }
}
