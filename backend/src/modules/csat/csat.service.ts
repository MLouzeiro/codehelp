import prisma from '../../config/database';
import { env } from '../../config/env';
import { logAction } from '../audit/audit.service';

const CSAT_DELAY_MINUTOS = 30;
const CSAT_NEGATIVO_LIMITE = 2;

export async function enviarCsatImediatamente(ticketId: string): Promise<void> {
  console.log(`[CSAT] Iniciando envio imediato para ticket ${ticketId}`);
  try {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      console.warn(`[CSAT] Ticket ${ticketId} nao encontrado`);
      return;
    }
    if (!ticket.contactPhone) {
      console.warn(`[CSAT] Ticket ${ticketId} sem telefone`);
      return;
    }
    console.log(`[CSAT] Ticket encontrado: ${ticket.contactPhone}, status: ${ticket.status}`);

    const existente = await prisma.cSATResposta.findUnique({ where: { ticketId } });
    if (existente) {
      if (existente.enviadoEm) {
        console.log(`[CSAT] CSAT ja existe e enviado para ticket ${ticketId}`);
        return;
      }
      // CSAT exists but was never sent — resend it
      console.log(`[CSAT] CSAT existe mas nao enviado para ticket ${ticketId}, reenviando...`);
      const resultado = await enviarMensagemCsat(existente.id);
      console.log(`[CSAT] Resultado reenvio:`, resultado);
      if (!resultado.enviado) {
        console.warn(`[CSAT] Falha ao reenviar CSAT para ticket ${ticketId}: ${resultado.erro}`);
      }
      return;
    }

    const csat = await prisma.cSATResposta.create({
      data: {
        ticketId,
        tokenResposta: crypto.randomUUID(),
        enviadoEm: null,
      },
    });
    console.log(`[CSAT] CSAT criado: ${csat.id}`);

    const resultado = await enviarMensagemCsat(csat.id);
    console.log(`[CSAT] Resultado envio:`, resultado);
    if (!resultado.enviado) {
      console.warn(`[CSAT] Falha ao enviar CSAT imediatamente para ticket ${ticketId}: ${resultado.erro}`);
    }
  } catch (err: any) {
    console.error(`[CSAT] Erro ao enviar CSAT imediatamente:`, err);
  }
}

export interface AgendamentoResult {
  criado: boolean;
  csat: any;
}

export async function agendarCsat(ticketId: string): Promise<AgendamentoResult> {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new Error('Ticket nao encontrado');
  if (!['fechado', 'cancelado', 'resolvido'].includes(ticket.status) && !['concluido', 'descartado'].includes(ticket.etapa)) {
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

const CSAT_DEFAULT_MESSAGE = `Olá! 👋\n\nSeu atendimento foi concluído.\n\nPor favor, avalie sua experiência:\n\n• 1 - Péssimo\n• 2 - Ruim\n• 3 - Regular\n• 4 - Bom\n• 5 - Excelente\n\nResponda com o *número* (1 a 5).\nOu acesse: {{url}}\n\nObrigado pelo feedback! 🙏\n\nEquipe Codemed`;

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
  try {
    const { sendWhatsAppMessage } = await import('../integrations/whatsapp/whatsapp.service');
    const csatText = [
      `Olá! 👋`,
      ``,
      `Seu atendimento foi concluído com sucesso.`,
      ``,
      `Por favor, avalie sua experiência respondendo com um número de 1 a 5:`,
      ``,
      `*1* - Péssimo`,
      `*2* - Ruim`,
      `*3* - Regular`,
      `*4* - Bom`,
      `*5* - Excelente`,
      ``,
      `Responda com o *número* (1 a 5).`,
      `Ou acesse: ${env.appUrl}/csat/${csat.tokenResposta}`,
      ``,
      `Obrigado pelo feedback! 🙏`,
    ].join('\n');
    console.log(`[CSAT] Enviando mensagem de avaliação para ${csat.ticket.contactPhone}`);
    const result = await sendWhatsAppMessage(
      csat.ticket.contactPhone,
      csatText,
      (csat.ticket as any).whatsappConnectionId || undefined,
      (csat.ticket as any).contactJid || undefined,
    );
    console.log(`[CSAT] Resultado envio:`, result);

    if (result.success) {
      await prisma.cSATResposta.update({
        where: { id: csatId },
        data: { enviadoEm: new Date() },
      });
      await prisma.message.create({
        data: {
          ticketId: csat.ticketId,
          fromMe: true,
          content: csatText,
          source: 'bot',
        },
      }).catch(() => {});
      return { enviado: true, csat: { ...csat, enviadoEm: new Date() } };
    }
    return { enviado: false, erro: result.error, csat };
  } catch (err: any) {
    console.error(`[CSAT] Erro ao enviar mensagem:`, err);
    return { enviado: false, erro: err?.message, csat };
  }
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
  console.log(`[CSAT] CSAT encontrado: ${csat.id}, atualizando respondidoEm...`);
  const updated = await prisma.cSATResposta.update({
    where: { id: csat.id },
    data: {
      nota: input.nota,
      comentario: input.comentario ?? null,
      respondidoEm: new Date(),
    },
  });
  console.log(`[CSAT] CSAT respondido com sucesso: ${csat.id}, nota=${input.nota}, respondidoEm=${updated.respondidoEm}`);
  await prisma.ticket.update({
    where: { id: csat.ticketId },
    data: { satisfacao: input.nota, dataCSAT: new Date() },
  });
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
      OR: [
        { status: { in: ['fechado', 'cancelado', 'resolvido'] } },
        { etapa: { in: ['concluido', 'descartado'] } },
      ],
      dataFechamento: { lte: limite },
      csatResposta: null,
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
          { status: { in: ['fechado', 'cancelado', 'resolvido'] } },
          { etapa: { in: ['concluido', 'descartado'] } },
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
