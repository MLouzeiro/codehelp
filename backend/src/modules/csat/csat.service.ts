import prisma from '../../config/database';
import { env } from '../../config/env';
import { logAction } from '../audit/audit.service';
import {
  STATUS_FECHADO_CSAT,
  ETAPAS_ENCERRADAS,
  EVALUATION_AGUARDANDO_CONFIRMACAO,
  EVALUATION_AGUARDANDO_DESCRICAO,
} from '../helpdesk/constants';

const CSAT_DELAY_MINUTOS = 30;
const CSAT_NEGATIVO_LIMITE = 2;

export async function enviarCsatImediatamente(ticketId: string): Promise<void> {
  console.log(`[EVALUATION] ticketId=${ticketId} event=INICIAR_ENVIO_IMEDIATO`);
  try {
    const { finalizarAtendimento } = await import('../helpdesk/flow.service');
    await finalizarAtendimento(ticketId);
  } catch (err: any) {
    console.error(`[EVALUATION] ticketId=${ticketId} event=ENVIO_IMEDIATO_ERRO error=${err?.message}`, err);
  }
}

export interface AgendamentoResult {
  criado: boolean;
  csat: any;
}

export async function agendarCsat(ticketId: string): Promise<AgendamentoResult> {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new Error('Ticket nao encontrado');
  if (![...STATUS_FECHADO_CSAT].includes(ticket.status) && ![...ETAPAS_ENCERRADAS].includes(ticket.etapa)) {
    return { criado: false, csat: null };
  }
  const existente = await prisma.cSATResposta.findUnique({ where: { ticketId } });
  if (existente) return { criado: false, csat: existente };
  const csat = await prisma.cSATResposta.create({
    data: {
      ticketId,
      tokenResposta: crypto.randomUUID(),
      enviadoEm: null,
    },
  });
  return { criado: true, csat };
}

const CSAT_DEFAULT_MESSAGE = `Olá! 👋\n\nSeu atendimento foi concluído.\n\nPor favor, avalie sua experiência:\n\n1 - Péssimo\n2 - Ruim\n3 - Regular\n4 - Bom\n5 - Excelente\n\nResponda com o *número* (1 a 5).\nOu acesse: {{url}}\n\nObrigado pelo feedback! 🙏\n\nEquipe Codemed`;

export function montarMensagemCsat(token: string, baseUrl?: string): string {
  const url = baseUrl
    ? `${baseUrl}/csat/${token}`
    : `${env.appUrl}/csat/${token}`;
  return CSAT_DEFAULT_MESSAGE.replace(/\{\{url\}\}/g, url);
}

export async function montarMensagemCsatCustomizada(token: string): Promise<string> {
  const url = `${env.appUrl}/csat/${token}`;

  try {
    const config = await prisma.helpdeskConfig.findUnique({ where: { slug: 'csat' } });
    const customMsg = (config as any)?.mensagemCsat;
    if (customMsg) {
      return customMsg.replace(/\{\{url\}\}/g, url);
    }
  } catch {}

  return CSAT_DEFAULT_MESSAGE.replace(/\{\{url\}\}/g, url);
}

export interface EnviarResult {
  enviado: boolean;
  erro?: string;
  csat: any;
}

export async function enviarMensagemCsat(csatId: string): Promise<EnviarResult> {
  const csat = await prisma.cSATResposta.findUnique({
    where: { id: csatId },
    include: { ticket: true },
  });
  if (!csat) return { enviado: false, erro: 'CSAT nao encontrado', csat: null };
  if (!csat.ticket.contactPhone) {
    return { enviado: false, erro: 'Ticket sem telefone', csat };
  }

  // Idempotência: nunca reenviar avaliação já respondida ou já enviada
  if (csat.respondidoEm) {
    return { enviado: false, erro: 'CSAT ja respondido', csat };
  }
  if (csat.enviadoEm) {
    console.log(`[EVALUATION] evaluationId=${csat.id} ticketId=${csat.ticketId} event=SEND_SKIP motivo=ja_enviada`);
    return { enviado: true, csat };
  }

  try {
    const ticket = csat.ticket as any;
    const phone = ticket.contactPhone.replace(/[^\d]/g, '');
    const jid = ticket.contactJid || undefined;
    const connectionId = ticket.whatsappConnectionId || undefined;

    const corpo =
      `Olá! 👋\n\nSeu atendimento foi concluído com sucesso.\n\n` +
      `Gostaríamos de saber como foi sua experiência.\n\n` +
      `Como você avalia nosso atendimento?`;

    // Lista interativa (clickável) com rowIds rating_1..rating_5.
    // O handler extrai a nota via extrairNotaAvaliacao (aceita "rating_N").
    const { enviarListaInterativa, montarFallbackTexto } = await import('../integrations/whatsapp/whatsapp-message-service');

    const sections = [
      {
        title: 'Avalie nosso atendimento',
        rows: [
          { id: 'rating_1', title: '⭐ 1 - Péssimo' },
          { id: 'rating_2', title: '⭐ 2 - Ruim' },
          { id: 'rating_3', title: '⭐ 3 - Regular' },
          { id: 'rating_4', title: '⭐ 4 - Bom' },
          { id: 'rating_5', title: '⭐ 5 - Excelente' },
        ],
      },
    ];

    const result = await enviarListaInterativa(phone, {
      title: 'Avalie o atendimento',
      description: corpo,
      sections,
      connectionId,
      jid,
    });
    console.log(
      `[EVALUATION] ticketId=${ticket.id} evaluationId=${csat.id} event=MESSAGE_SENT ` +
      `sucesso=${result.success} tipo=${result.usedFallback ? 'texto' : 'interativo'}`,
    );

    if (result.success) {
      const agora = new Date();
      await prisma.cSATResposta.update({
        where: { id: csatId },
        data: { enviadoEm: agora },
      });
      // Registra no histórico a mensagem efetivamente exibida ao cliente
      const textoRegistrado = result.usedFallback
        ? montarFallbackTexto({ title: 'Avalie o atendimento', description: corpo, sections })
        : `${corpo}\n\n⭐ 1 Péssimo • 2 Ruim • 3 Regular • 4 Bom • 5 Excelente`;
      await prisma.message.create({
        data: {
          ticketId: csat.ticketId,
          fromMe: true,
          content: textoRegistrado,
          source: 'bot',
        },
      }).catch(() => {});
      // Estado auxiliar in-memory (fonte de verdade principal fica no banco via CSAT pendente)
      try {
        const { setWhatsAppConversationState } = await import('../integrations/whatsapp/whatsapp-message-handler');
        setWhatsAppConversationState(ticket.contactPhone, 'AWAITING_CSAT');
      } catch {}
      return { enviado: true, csat: { ...csat, enviadoEm: agora } };
    }
    console.warn(
      `[EVALUATION] ticketId=${ticket.id} evaluationId=${csat.id} event=SEND_ERROR error=${result.error}`,
    );
    return { enviado: false, erro: result.error, csat };
  } catch (err: any) {
    console.error(`[EVALUATION] evaluationId=${csatId} event=SEND_EXCEPTION error=${err?.message}`);
    return { enviado: false, erro: err?.message, csat };
  }
}

function montarTextoAvaliacaoFallback(corpo: string): string {
  return `${corpo}\n\n1 - Péssimo\n2 - Ruim\n3 - Regular\n4 - Bom\n5 - Excelente\n\nResponda com o *número* (1 a 5).`;
}

export interface RespostaInput {
  nota: number;
  comentario?: string | null;
}

export async function responderCsat(token: string, input: RespostaInput) {
  console.log(`[CSAT] responderCsat chamado com token=${token}, nota=${input.nota}`);
  if (input.nota < 1 || input.nota > 5) {
    throw new Error('Nota deve ser entre 1 e 5');
  }
  const csat = await prisma.cSATResposta.findUnique({
    where: { tokenResposta: token },
    include: { ticket: true },
  });
  if (!csat) {
    console.warn(`[CSAT] Token invalido: ${token}`);
    throw new Error('Token invalido');
  }
  if (csat.respondidoEm) {
    console.warn(`[CSAT] CSAT ja respondido: ${csat.id}`);
    throw new Error('CSAT ja respondido');
  }
  if (csat.ticket?.evaluationStatus === 'cancelado') {
    console.warn(`[CSAT] CSAT cancelado previamente: ${csat.id}`);
    throw new Error('Avaliação cancelada');
  }
  console.log(`[EVALUATION] CSAT encontrado: ${csat.id}, atualizando respondidoEm...`);
  const updated = await prisma.cSATResposta.update({
    where: { id: csat.id },
    data: {
      nota: input.nota,
      comentario: input.comentario ?? null,
      respondidoEm: new Date(),
    },
  });
  console.log(`[EVALUATION] evaluationId=${csat.id} ticketId=${csat.ticketId} event=ANSWER_SAVED nota=${input.nota} respondidoEm=${updated.respondidoEm}`);
  await prisma.ticket.update({
    where: { id: csat.ticketId },
    data: {
      satisfacao: input.nota,
      dataCSAT: new Date(),
      evaluationStatus: 'respondido',
    },
  });
  console.log(`[TICKET] ticketId=${csat.ticketId} event=ENCERRADO_APOS_AVALIACAO nota=${input.nota}`);
  if (input.nota <= CSAT_NEGATIVO_LIMITE) {
    await notificarCsatNegativo(csat.ticketId, input.nota, input.comentario);
  }
  await logAction({
    acao: 'csat_receber',
    entidade: 'CSATResposta',
    entidadeId: csat.id,
    detalhes: { ticketId: csat.ticketId, nota: input.nota, negativo: input.nota <= CSAT_NEGATIVO_LIMITE },
  });
  return updated;
}

async function notificarCsatNegativo(ticketId: string, nota: number, comentario?: string | null) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { assignee: { select: { id: true } } },
  });
  if (!ticket) return;
  const destinatarios = new Set<string>();
  if (ticket.assigneeId) destinatarios.add(ticket.assigneeId);
  const supervisores = await prisma.user.findMany({
    where: { role: { in: ['gerente', 'supervisor', 'admin'] }, active: true },
    select: { id: true },
  });
  for (const s of supervisores) destinatarios.add(s.id);
  for (const userId of destinatarios) {
    await prisma.notificacao.create({
      data: {
        tipo: 'csat_negativo',
        mensagem: `CSAT negativo (${nota} estrela${nota > 1 ? 's' : ''}) no ticket ${ticket.protocolo || ticket.id.slice(0, 8)}`,
        destinatarioId: userId,
        ticketId: ticket.id,
        dados: JSON.stringify({ nota, comentario: comentario || '' }),
      },
    });
  }
}

export interface ProcessarResult {
  agendados: number;
  enviados: number;
  erros: number;
}

export async function processarAgendamentosCsat(): Promise<ProcessarResult> {
  const agora = new Date();
  const limite = new Date(agora.getTime() - CSAT_DELAY_MINUTOS * 60 * 1000);
  const ticketsElegiveis = await prisma.ticket.findMany({
    where: {
      AND: [
        {
          OR: [
            { status: { in: [...STATUS_FECHADO_CSAT] } },
            { etapa: { in: [...ETAPAS_ENCERRADAS] } },
          ],
        },
        {
          // Nunca mandar CSAT automático para ticket aguardando confirmação de
          // resolução (SIM/NÃO) — o envio acontece após a resposta do cliente.
          // `notIn` exclui NULL no SQL, então inclui-se evaluationStatus nulo
          // explicitamente (tickets legados encerrados antes da confirmação).
          OR: [
            { evaluationStatus: null },
            { evaluationStatus: { notIn: [EVALUATION_AGUARDANDO_CONFIRMACAO, EVALUATION_AGUARDANDO_DESCRICAO] } },
          ],
        },
        { dataFechamento: { lte: limite } },
        { csatResposta: null },
      ],
    },
    include: { csatResposta: true },
    take: 50,
  });
  let agendados = 0;
  let enviados = 0;
  let erros = 0;
  for (const t of ticketsElegiveis) {
    if (t.csatResposta) continue;
    const { criado, csat } = await agendarCsat(t.id);
    if (criado) {
      agendados++;
      const result = await enviarMensagemCsat(csat.id);
      if (result.enviado) {
        enviados++;
      } else {
        erros++;
        console.warn(`[CSAT] Falha ao enviar mensagem para ticket ${t.id}: ${result.erro}`);
      }
    }
  }

  // Retry CSATs that were created but never sent (enviadoEm is null)
  const csatsNaoEnviados = await prisma.cSATResposta.findMany({
    where: {
      enviadoEm: null,
      respondidoEm: null,
      ticket: {
        OR: [
          { status: { in: [...STATUS_FECHADO_CSAT] } },
          { etapa: { in: [...ETAPAS_ENCERRADAS] } },
        ],
      },
    },
    include: { ticket: true },
    take: 20,
  });
  for (const csat of csatsNaoEnviados) {
    const result = await enviarMensagemCsat(csat.id);
    if (result.enviado) {
      enviados++;
    } else {
      erros++;
      console.warn(`[CSAT] Retry falhou para csat ${csat.id}: ${result.erro}`);
    }
  }

  return { agendados, enviados, erros };
}

export interface EstatisticasCsat {
  totalEnviados: number;
  totalRespondidos: number;
  percentualResposta: number;
  mediaNotas: number;
  distribuicao: Record<1 | 2 | 3 | 4 | 5, number>;
  negativos: number;
  periodoInicio?: Date;
  periodoFim?: Date;
}

export async function getEstatisticasCsat(periodoInicio?: Date, periodoFim?: Date): Promise<EstatisticasCsat> {
  const where: any = {};
  if (periodoInicio || periodoFim) {
    where.enviadoEm = {};
    if (periodoInicio) where.enviadoEm.gte = periodoInicio;
    if (periodoFim) where.enviadoEm.lte = periodoFim;
  }
  const [enviados, respondidos, notas, negativos] = await Promise.all([
    prisma.cSATResposta.count({ where }),
    prisma.cSATResposta.count({ where: { ...where, respondidoEm: { not: null } } }),
    prisma.cSATResposta.findMany({
      where: { ...where, nota: { not: null } },
      select: { nota: true },
    }),
    prisma.cSATResposta.count({ where: { ...where, nota: { lte: CSAT_NEGATIVO_LIMITE } } }),
  ]);
  const soma = notas.reduce((acc, n) => acc + (n.nota || 0), 0);
  const mediaNotas = notas.length > 0 ? Math.round((soma / notas.length) * 100) / 100 : 0;
  const distribuicao: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const n of notas) {
    if (n.nota && n.nota >= 1 && n.nota <= 5) {
      distribuicao[n.nota as 1 | 2 | 3 | 4 | 5]++;
    }
  }
  return {
    totalEnviados: enviados,
    totalRespondidos: respondidos,
    percentualResposta: enviados > 0 ? Math.round((respondidos / enviados) * 10000) / 100 : 0,
    mediaNotas,
    distribuicao,
    negativos,
    periodoInicio,
    periodoFim,
  };
}
