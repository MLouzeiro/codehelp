import prisma from '../../config/database';

export type SlaStatus = 'ok' | 'alerta_75' | 'alerta_90' | 'violado' | 'concluido';

export interface SlaInfo {
  totalMinutos: number;
  restantesMinutos: number;
  percentualConsumido: number;
  status: SlaStatus;
  pausado: boolean;
  pausadoDesde: Date | null;
  pausadoTotalMin: number;
  dentroJanelaComercial: boolean;
  fonte: 'prioridade' | 'fila' | 'default';
}

export const SLA_DEFAULT_MINUTOS = 240;

export async function calcularSlaTotalMinutos(args: {
  prioridade?: string | null;
  idFila?: string | null;
}): Promise<{ minutos: number; fonte: 'prioridade' | 'fila' | 'default' }> {
  if (args.prioridade) {
    const sla = await prisma.sLAConfig.findFirst({ where: { prioridade: args.prioridade } });
    if (sla && sla.ativo) {
      return { minutos: sla.slaMinutosResolucao, fonte: 'prioridade' };
    }
  }
  if (args.idFila) {
    const fila = await prisma.fila.findUnique({ where: { id: args.idFila } });
    if (fila && fila.ativo) {
      return { minutos: fila.slaMinutos, fonte: 'fila' };
    }
  }
  return { minutos: SLA_DEFAULT_MINUTOS, fonte: 'default' };
}

function diffMinutos(a: Date, b: Date): number {
  return Math.max(0, Math.floor((a.getTime() - b.getTime()) / 60000));
}

export function calcularSlaRestanteMinutos(args: {
  dataAbertura: Date;
  slaTotalMinutos: number;
  slaPausadoEm: Date | null;
  slaPausadoTotalMin: number;
  agora?: Date;
}): { restantes: number; percentual: number; consumido: number; pausado: boolean; pausaAtualMin: number } {
  const agora = args.agora || new Date();
  const emPausa = !!args.slaPausadoEm;
  const pausaAtualMin = emPausa ? diffMinutos(agora, args.slaPausadoEm!) : 0;
  const pausaTotalEfetiva = args.slaPausadoTotalMin + pausaAtualMin;
  const consumidoBruto = diffMinutos(agora, args.dataAbertura);
  const consumido = Math.max(0, consumidoBruto - pausaTotalEfetiva);
  const restantes = Math.max(0, args.slaTotalMinutos - consumido);
  const percentual = args.slaTotalMinutos > 0 ? (consumido / args.slaTotalMinutos) * 100 : 0;
  return { restantes, percentual, consumido, pausado: emPausa, pausaAtualMin };
}

export function getSlaStatus(percentual: number, ticketFinalizado: boolean): SlaStatus {
  if (ticketFinalizado) return 'concluido';
  if (percentual >= 100) return 'violado';
  if (percentual >= 90) return 'alerta_90';
  if (percentual >= 75) return 'alerta_75';
  return 'ok';
}

export async function getSlaInfo(ticketId: string, agora?: Date): Promise<SlaInfo | null> {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return null;
  return getSlaInfoFromTicket(ticket, agora);
}

export function getSlaInfoFromTicket(ticket: any, agora?: Date): SlaInfo {
  const slaTotal = ticket.slaTotalMinutos || SLA_DEFAULT_MINUTOS;
  const finalizado = ['fechado', 'cancelado', 'concluido'].includes(ticket.status) ||
                     ['concluido', 'descartado'].includes(ticket.etapa);
  const calc = calcularSlaRestanteMinutos({
    dataAbertura: ticket.dataAbertura,
    slaTotalMinutos: slaTotal,
    slaPausadoEm: ticket.slaPausadoEm,
    slaPausadoTotalMin: ticket.slaPausadoTotalMin || 0,
    agora,
  });
  return {
    totalMinutos: slaTotal,
    restantesMinutos: calc.restantes,
    percentualConsumido: Math.round(calc.percentual * 100) / 100,
    status: getSlaStatus(calc.percentual, finalizado),
    pausado: calc.pausado,
    pausadoDesde: ticket.slaPausadoEm,
    pausadoTotalMin: ticket.slaPausadoTotalMin || 0,
    dentroJanelaComercial: true,
    fonte: ticket.idFila ? 'fila' : (ticket.prioridade ? 'prioridade' : 'default'),
  };
}

interface AlertaGerado {
  ticketId: string;
  status: 'alerta_75' | 'alerta_90' | 'violado';
  destinatarioId: string;
  mensagem: string;
}

export async function processarAlertasSLA(agora?: Date): Promise<AlertaGerado[]> {
  const tickets = await prisma.ticket.findMany({
    where: {
      status: { in: ['aberto', 'em_atendimento', 'pendente', 'escalonado'] },
      etapa: { notIn: ['concluido', 'descartado'] },
    },
    include: { assignee: { select: { id: true } } },
  });
  const gerados: AlertaGerado[] = [];
  for (const t of tickets) {
    const info = getSlaInfoFromTicket(t, agora);
    if (info.status !== 'alerta_75' && info.status !== 'alerta_90' && info.status !== 'violado') {
      continue;
    }
    if (!t.assigneeId) continue;
    const tipoNotif =
      info.status === 'violado' ? 'sla_violado' :
      info.status === 'alerta_90' ? 'sla_90' : 'sla_75';
    const jaExiste = await prisma.notificacao.findFirst({
      where: { ticketId: t.id, tipo: tipoNotif, createdAt: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) } },
    });
    if (jaExiste) continue;
    const minutosTexto = info.restantesMinutos > 0 ? `${info.restantesMinutos} min restantes` : 'SLA violado';
    const mensagem =
      info.status === 'violado'
        ? `SLA violado no ticket ${t.protocolo || t.id.slice(0, 8)} - ${minutosTexto}`
        : `Alerta de SLA (${info.status}) no ticket ${t.protocolo || t.id.slice(0, 8)} - ${minutosTexto}`;
    await prisma.notificacao.create({
      data: {
        tipo: tipoNotif,
        mensagem,
        destinatarioId: t.assigneeId,
        ticketId: t.id,
        dados: JSON.stringify({ percentual: info.percentualConsumido, restantes: info.restantesMinutos }),
      },
    });
    gerados.push({ ticketId: t.id, status: info.status as 'alerta_75' | 'alerta_90' | 'violado', destinatarioId: t.assigneeId, mensagem });
  }
  return gerados;
}

export async function atribuirSlaAoTicket(ticketId: string): Promise<number> {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return 0;
  const { minutos } = await calcularSlaTotalMinutos({
    prioridade: ticket.prioridade,
    idFila: ticket.idFila,
  });
  if (ticket.slaTotalMinutos === minutos) return minutos;
  await prisma.ticket.update({
    where: { id: ticketId },
    data: { slaTotalMinutos: minutos },
  });
  return minutos;
}
