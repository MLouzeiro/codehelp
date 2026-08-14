import prisma from '../../config/database';
import { enviarMensagemCsat } from '../csat/csat.service';
import {
  EVALUATION_AGUARDANDO,
  EVALUATION_CANCELADA,
  EVALUATION_RESPONDIDA,
  EVALUATION_STATES,
  STATUS_ENCERRADO,
  ETAPAS_ENCERRADAS,
} from './constants';

export {
  EVALUATION_AGUARDANDO,
  EVALUATION_RESPONDIDA,
  EVALUATION_CANCELADA,
  EVALUATION_STATES,
  STATUS_ENCERRADO,
  ETAPAS_ENCERRADAS,
};

export type EvaluationStatus = (typeof EVALUATION_STATES)[number] | null;

export const MENSAGEM_AVALIACAO_OBRIGADO =
  'Obrigado pela sua avaliação! 💙\n\nSua opinião é muito importante para continuarmos melhorando nosso atendimento. 🙏';

export interface TicketCsat {
  csat: any;
  ticket: any;
}

function normalizePhone(phone: string): string {
  return (phone || '').replace(/[^\d]/g, '').slice(-11);
}

// ── Extração de nota da avaliação ───────────────────────────────────────
// Aceita: "rating_3" (ID interativo lista), "avaliacao_3" (ID legado),
//         "3", "3 - Bom", "⭐ 3"
export function extrairNotaAvaliacao(text: string): number | null {
  if (!text) return null;
  const t = text.trim();
  const comRating = t.match(/^rating_([1-5])$/i);
  if (comRating) return parseInt(comRating[1], 10);
  const comId = t.match(/^avaliacao_([1-5])$/i);
  if (comId) return parseInt(comId[1], 10);
  const lista = t.match(/^([1-5])\s*[-–—.:]?\s*/);
  if (lista) return parseInt(lista[1], 10);
  const estrela = t.match(/^⭐\s*([1-5])\b/);
  if (estrela) return parseInt(estrela[1], 10);
  return null;
}

// ── Buscas de contexto ─────────────────────────────────────────────────

export async function buscarTicketAtivo(phone: string, jid?: string | null): Promise<any | null> {
  return prisma.ticket.findFirst({
    where: {
      OR: [
        ...(jid ? [{ contactJid: jid }] : []),
        { contactPhone: phone },
      ],
      // Ticket encerrado NUNCA é reaberto: filtra tanto por status quanto por
      // etapa concluída/descartada (defesa dupla — mesmo se o status for
      // reativado indevidamente, a etapa ainda impede a reabertura).
      status: { notIn: [...STATUS_ENCERRADO] },
      etapa: { notIn: [...ETAPAS_ENCERRADAS] },
    },
    orderBy: { createdAt: 'desc' },
  });
}

// CSAT pendente (avaliação ainda não respondida e efetivamente enviada).
// Exclui tickets com avaliação cancelada (evaluationStatus = cancelado) para
// não tratar mensagens futuras como resposta de uma avaliação abandonada.
export async function buscarCsatPendente(phone: string, jid?: string | null): Promise<TicketCsat | null> {
  const phoneDigits = normalizePhone(phone);
  const csat = await prisma.cSATResposta.findFirst({
    where: {
      respondidoEm: null,
      enviadoEm: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      ticket: {
        OR: [
          ...(jid ? [{ contactJid: jid }] : []),
          { contactPhone: phone },
          { contactPhone: `${phoneDigits}` },
        ],
        AND: [
          { OR: [{ evaluationStatus: null }, { evaluationStatus: EVALUATION_AGUARDANDO }] },
        ],
      },
    },
    include: { ticket: true },
    orderBy: { enviadoEm: 'desc' },
  });
  return csat ? { csat, ticket: (csat as any).ticket } : null;
}

// Abandona uma avaliação pendente: cliente enviou mensagem que não é resposta
// de avaliação e não deve ficar preso no fluxo. Marca o ticket como cancelado
// e limpa o estado do bot. A avaliação em si deixa de ser considerada pendente.
export async function abandonarAvaliacaoPendente(phone: string, csat: any): Promise<void> {
  await prisma.ticket
    .update({
      where: { id: csat.ticketId },
      data: { evaluationStatus: EVALUATION_CANCELADA },
    })
    .catch((e: any) =>
      console.warn(`[FLOW] erro ao cancelar avaliacao ticketId=${csat.ticketId}: ${e?.message}`)
    );
  console.log(`[EVALUATION] evaluationId=${csat.id} ticketId=${csat.ticketId} event=ABANDONADA motivo=nova_mensagem`);
  const { setWhatsAppConversationState } = await import('../integrations/whatsapp/whatsapp-message-handler');
  setWhatsAppConversationState(phone, 'IDLE');
}

// ── Encerramento de atendimento (idempotente) ──────────────────────────
// Fluxo: mensagem de encerramento (já enviada pelo chamador via stage auto-message)
//   → cria CSAT → envia avaliação → ticket evaluationStatus=aguardando
// NÃO reenvia: se CSAT já enviado ou já respondido.

// Limpa o estado in-memory do bot (AWAITING_CSAT/AWAITING_DEPARTMENT) para
// que uma nova mensagem do cliente seja interpretada corretamente (novo ticket).
async function resetBotState(phone?: string | null): Promise<void> {
  if (!phone) return;
  try {
    const { setWhatsAppConversationState } = await import('../integrations/whatsapp/whatsapp-message-handler');
    setWhatsAppConversationState(phone, 'IDLE');
  } catch {}
}

export async function finalizarAtendimento(ticketId: string): Promise<boolean> {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    console.warn(`[FLOW] ticket nao encontrado ticketId=${ticketId} event=FINALIZAR`);
    return false;
  }

  if (ticket.evaluationStatus === EVALUATION_RESPONDIDA) {
    console.log(`[FLOW] ticketId=${ticketId} event=FINALIZAR_SKIP motivo=avaliacao_ja_respondida`);
    await resetBotState(ticket.contactPhone);
    return false;
  }

  const existente = await prisma.cSATResposta.findUnique({ where: { ticketId } });
  if (existente?.respondidoEm) {
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { evaluationStatus: EVALUATION_RESPONDIDA },
    });
    console.log(`[FLOW] ticketId=${ticketId} event=FINALIZAR_SKIP motivo=csat_ja_respondido`);
    await resetBotState(ticket.contactPhone);
    return false;
  }

  // Persiste o estado "aguardando avaliação" ANTES do envio (fonte de verdade no banco)
  await prisma.ticket.update({
    where: { id: ticketId },
    data: { evaluationStatus: EVALUATION_AGUARDANDO },
  });
  console.log(`[FLOW] ticketId=${ticketId} event=TICKET_AGUARDANDO_AVALIACAO`);

  let csat = existente;
  if (!csat) {
    try {
      csat = await prisma.cSATResposta.create({
        data: { ticketId, tokenResposta: crypto.randomUUID(), enviadoEm: null },
      });
      console.log(`[EVALUATION] ticketId=${ticketId} event=CREATED evaluationId=${csat.id}`);
    } catch (err: any) {
      if (err?.code === 'P2002') {
        // Corrida: avaliação já criada por outro processo
        csat = await prisma.cSATResposta.findUnique({ where: { ticketId } });
        console.log(`[EVALUATION] ticketId=${ticketId} event=CREATED_DUPLICADO evaluationId=${csat?.id}`);
      } else {
        console.error(`[EVALUATION] ticketId=${ticketId} event=CREATE_ERROR error=${err?.message}`, err);
        throw err;
      }
    }
  }

  if (!csat) {
    console.error(`[EVALUATION] ticketId=${ticketId} event=CREATE_ERROR error=csat_indisponivel`);
    return false;
  }

  if (existente?.enviadoEm && !csat.respondidoEm) {
    // Já enviada e aguardando — não duplicar mensagem
    console.log(`[EVALUATION] ticketId=${ticketId} evaluationId=${csat.id} event=SEND_SKIP motivo=ja_enviada`);
    return true;
  }

  const resultado = await enviarMensagemCsat(csat.id);
  console.log(`[EVALUATION] ticketId=${ticketId} evaluationId=${csat.id} event=MESSAGE_RESULT enviado=${resultado.enviado}`);
  return !!resultado.enviado;
}

// ── Encerramento canônico de ticket ────────────────────────────────────
// FASE 2 da refatoração: centraliza o fechamento/descarte manual e o
// encerramento por IA. Antes cada chamador duplicava o update do ticket,
// a criação de TicketStageEvent e o bookkeeping de dataFechamento/dataConclusao.

export interface EncerrarTicketParams {
  status: string;
  etapa: string;
  usuarioId?: string | null;
  origem?: string;
  mensagemAutomatica?: string;
  dataFechamento?: boolean;
  dataConclusao?: boolean;
  dataResolucao?: boolean;
  extra?: Record<string, unknown>;
  finalizarCsat?: boolean;
  criarStageEvent?: boolean;
}

export async function encerrarTicket(ticketId: string, params: EncerrarTicketParams): Promise<{ ok: boolean; error?: string; ticket?: any }> {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return { ok: false, error: 'Ticket não encontrado' };

  const agora = new Date();
  const data: any = {
    status: params.status,
    etapa: params.etapa,
    ...(params.usuarioId !== undefined ? { usuarioId: params.usuarioId } : {}),
    ...(params.dataFechamento ? { dataFechamento: agora } : {}),
    ...(params.dataConclusao ? { dataConclusao: agora } : {}),
    ...(params.dataResolucao ? { dataResolucao: agora } : {}),
    ...(params.extra || {}),
  };

  const updated = await prisma.ticket.update({ where: { id: ticketId }, data });

  if (params.criarStageEvent !== false) {
    await prisma.ticketStageEvent.create({
      data: {
        ticketId,
        etapaAnterior: ticket.etapa,
        etapaNova: params.etapa,
        origem: params.origem || 'manual',
        usuarioId: params.usuarioId ?? null,
        mensagemAutomatica: params.mensagemAutomatica,
      },
    });
  }

  if (params.finalizarCsat) {
    await finalizarAtendimento(ticketId).catch((e) =>
      console.warn('[FLOW] Falha ao finalizar atendimento (avaliacao):', e?.message || e)
    );
  }

  return { ok: true, ticket: updated };
}

// ── Registro de resposta da avaliação ──────────────────────────────────
// ⚠️ CRITICAL BUSINESS RULE — encerramento pós-avaliação.
// Valida, salva nota/comentário, marca respondido, garante o estado fechado
// do ticket (Ticket=CLOSED independente do resultado do envio de mensagem),
// limpa o contexto do bot e registra stage event. Idempotente: se a avaliação
// já foi respondida, NÃO reprocessa (proteção contra clique duplo/webhook dup).

export interface FinalizarAvaliacaoResult {
  ok: boolean;
  jaFinalizado?: boolean;
  error?: string;
}

export async function finalizeTicketAfterEvaluation(
  phone: string,
  csat: any,
  nota: number,
  comentario?: string | null,
): Promise<FinalizarAvaliacaoResult> {
  console.log(`[EVALUATION] evaluationId=${csat.id} ticketId=${csat.ticketId} event=ANSWER_RECEIVED score=${nota}`);

  // Idempotência: avaliação já respondida não é processada de novo (clique
  // duplo, webhook duplicado). Estado do ticket é a fonte de verdade.
  const existente = await prisma.cSATResposta.findUnique({
    where: { id: csat.id },
    select: { id: true, respondidoEm: true },
  });
  if (existente?.respondidoEm) {
    console.log(`[EVALUATION] evaluationId=${csat.id} ticketId=${csat.ticketId} event=ANSWER_SKIP motivo=ja_respondida`);
    return { ok: true, jaFinalizado: true };
  }

  const { responderCsat } = await import('../csat/csat.service');

  try {
    await responderCsat(csat.tokenResposta, { nota, comentario });
  } catch (err: any) {
    console.warn(`[EVALUATION] evaluationId=${csat.id} ticketId=${csat.ticketId} event=ANSWER_REJEITADA error=${err?.message}`);
    return { ok: false, error: err?.message };
  }

  await prisma.ticket.update({
    where: { id: csat.ticketId },
    data: { evaluationStatus: EVALUATION_RESPONDIDA },
  });
  console.log(`[EVALUATION] evaluationId=${csat.id} ticketId=${csat.ticketId} event=ANSWER_SAVED score=${nota}`);

  // Garante que o ticket permanece encerrado (status/etapa finais), mesmo que
  // o estado tenha sido revertido indevidamente antes da avaliação.
  const ticketFinal = await prisma.ticket.findUnique({
    where: { id: csat.ticketId },
    select: { status: true, etapa: true },
  });
  if (ticketFinal && ![...STATUS_ENCERRADO].includes(ticketFinal.status) && ![...ETAPAS_ENCERRADAS].includes(ticketFinal.etapa)) {
    await prisma.ticket.update({
      where: { id: csat.ticketId },
      data: { status: 'fechado', etapa: 'concluido', dataFechamento: new Date(), dataConclusao: new Date() },
    });
    await prisma.ticketStageEvent.create({
      data: {
        ticketId: csat.ticketId,
        etapaAnterior: ticketFinal.etapa,
        etapaNova: 'concluido',
        origem: 'automatico',
        mensagemAutomatica: 'Encerrado apos resposta de avaliacao',
      },
    }).catch(() => {});
    console.log(`[TICKET] ticketId=${csat.ticketId} event=REAPLICADO_ENCERRAMENTO motivo=avaliacao_respondida`);
  }

  // Limpa o contexto do bot (não continuar interpretando mensagens como avaliação)
  await resetBotState(phone);
  console.log(`[CONVERSATION] phone=${normalizePhone(phone)} event=BOT_STATE_RESET motivo=avaliacao_respondida`);
  return { ok: true };
}

// Compat: alias mantido para chamadores existentes.
export async function registrarRespostaAvaliacao(phone: string, csat: any, nota: number, comentario?: string | null): Promise<boolean> {
  const r = await finalizeTicketAfterEvaluation(phone, csat, nota, comentario);
  return r.ok;
}

export async function cancelarAvaliacoesNaoEnviadas(phone: string, jid?: string | null): Promise<void> {
  const phoneDigits = normalizePhone(phone);
  const pendentes = await prisma.cSATResposta.findMany({
    where: {
      enviadoEm: null,
      respondidoEm: null,
      ticket: {
        OR: [
          ...(jid ? [{ contactJid: jid }] : []),
          { contactPhone: phone },
          { contactPhone: `${phoneDigits}` },
        ],
      },
    },
    select: { id: true, ticketId: true },
  });
  for (const p of pendentes) {
    // Apenas o status do ticket muda para "cancelado"; a CSAT não é marcada como
    // respondida (não polui métricas) e deixa de ser considerada pendente.
    await prisma.ticket.update({
      where: { id: p.ticketId },
      data: { evaluationStatus: EVALUATION_CANCELADA },
    }).catch((e: any) =>
      console.warn(`[FLOW] erro ao cancelar status ticketId=${p.ticketId}: ${e?.message}`)
    );
  }
}

// ── Helpers de mensagem ────────────────────────────────────────────────

export async function enviarMensagemObrigadoAvaliacao(
  chatId: string,
  sendMessage: (to: string, msg: string) => Promise<{ success: boolean; error?: string }>,
): Promise<void> {
  await sendMessage(chatId, MENSAGEM_AVALIACAO_OBRIGADO).catch(() => {});
}