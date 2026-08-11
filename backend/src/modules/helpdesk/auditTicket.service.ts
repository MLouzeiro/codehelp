import prisma from '../../config/database';
import { logAction } from '../audit/audit.service';

// ══════════════════════════════════════════════════════════════════
// ── TYPES ──────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════

export type TicketEventType =
  | 'created' | 'message_sent' | 'message_received'
  | 'stage_changed' | 'assignee_changed' | 'priority_changed'
  | 'sla_started' | 'sla_paused' | 'sla_resumed' | 'sla_breached' | 'sla_completed'
  | 'ai_classified' | 'ai_responded' | 'ai_evaluated'
  | 'note_added' | 'escalated' | 'merged' | 'reopened' | 'closed';

export interface CreateEventInput {
  ticketId: string;
  tipo: TicketEventType;
  descricao?: string;
  dados?: Record<string, any>;
  usuarioId?: string;
  isSystem?: boolean;
  isAi?: boolean;
  mensagemId?: string;
  metadata?: Record<string, any>;
}

export interface TicketMetricsData {
  tempoTotalMin: number;
  tempoPrimeiraRespostaMin?: number;
  tempoPrimeiraRespostaIaMin?: number;
  tempoPrimeiraRespostaHumMin?: number;
  tempoEmAtendimentoMin: number;
  tempoAguardandoClienteMin: number;
  tempoAguardandoTerceiroMin: number;
  tempoFilaMin: number;
  tempoResolucaoIaMin?: number;
  tempoResolucaoHumanoMin?: number;
  tempoLeadTimeMin: number;
  tempoUtilMin: number;
  tempoCorridoMin: number;
  tempoForaExpedienteMin: number;
  tempoParadoMin: number;
  totalMensagens: number;
  mensagensCliente: number;
  mensagensAgente: number;
  mensagensBot: number;
  totalReaberturas: number;
  totalEscalonamentos: number;
  slaPrazoMinutos?: number;
  slaConsumidoMinutos: number;
  slaRestanteMinutos: number;
  slaPercentualConsumido: number;
  slaStatus?: string;
  csatNota?: number;
  csatRespondido: boolean;
  resolvidoPorIa: boolean;
  iaConfiancaMedia?: number;
  iaTotalInteracoes: number;
  iaCustoTotalUsd: number;
  iaCustoTotalBrl: number;
  primeiraRespostaEm?: Date;
  ultimoAtendimentoEm?: Date;
}

// ══════════════════════════════════════════════════════════════════
// ── EVENT LOGGING ──────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════

export async function logTicketEvent(input: CreateEventInput) {
  return prisma.ticketEvent.create({
    data: {
      ticketId: input.ticketId,
      tipo: input.tipo,
      descricao: input.descricao,
      dados: input.dados ? JSON.stringify(input.dados) : undefined,
      usuarioId: input.usuarioId,
      isSystem: input.isSystem ?? false,
      isAi: input.isAi ?? false,
      mensagemId: input.mensagemId,
      metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
    },
  });
}

export async function getTicketEvents(
  ticketId: string,
  options?: { tipo?: TicketEventType; limit?: number; offset?: number }
) {
  const where: any = { ticketId };
  if (options?.tipo) where.tipo = options.tipo;

  return prisma.ticketEvent.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    take: options?.limit ?? 100,
    skip: options?.offset ?? 0,
    include: { usuario: { select: { id: true, name: true, avatar: true } } },
  });
}

// ══════════════════════════════════════════════════════════════════
// ── TIMELINE ───────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════

export async function addTimelineEntry(input: {
  ticketId: string;
  etapa: string;
  dataEntrada: Date;
  dataSaida?: Date;
  responsavelAnteriorId?: string;
  responsavelNovoId?: string;
  motivoMudanca?: string;
  isPaused?: boolean;
  pausaTotalMinutos?: number;
}) {
  const duracaoMinutos = input.dataSaida
    ? Math.floor((input.dataSaida.getTime() - input.dataEntrada.getTime()) / 60000)
    : null;

  return prisma.ticketTimeline.create({
    data: {
      ticketId: input.ticketId,
      etapa: input.etapa,
      dataEntrada: input.dataEntrada,
      dataSaida: input.dataSaida,
      duracaoMinutos,
      responsavelAnteriorId: input.responsavelAnteriorId,
      responsavelNovoId: input.responsavelNovoId,
      motivoMudanca: input.motivoMudanca,
      isPaused: input.isPaused ?? false,
      pausaTotalMinutos: input.pausaTotalMinutos ?? 0,
    },
  });
}

export async function closeTimelineEntry(ticketId: string, etapa: string) {
  const entry = await prisma.ticketTimeline.findFirst({
    where: { ticketId, etapa, dataSaida: null },
    orderBy: { dataEntrada: 'desc' },
  });
  if (!entry) return null;

  const now = new Date();
  const duracaoMinutos = Math.floor((now.getTime() - entry.dataEntrada.getTime()) / 60000);

  return prisma.ticketTimeline.update({
    where: { id: entry.id },
    data: { dataSaida: now, duracaoMinutos },
  });
}

export async function getTicketTimeline(ticketId: string) {
  return prisma.ticketTimeline.findMany({
    where: { ticketId },
    orderBy: { dataEntrada: 'asc' },
  });
}

// ══════════════════════════════════════════════════════════════════
// ── METRICS ────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════

export async function upsertTicketMetrics(ticketId: string, data: Partial<TicketMetricsData>) {
  return prisma.ticketMetrics.upsert({
    where: { ticketId },
    create: { ticketId, ...data } as any,
    update: data as any,
  });
}

export async function getTicketMetrics(ticketId: string) {
  return prisma.ticketMetrics.findUnique({ where: { ticketId } });
}

export async function calculateAndStoreMetrics(ticketId: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      messages: { orderBy: { sentAt: 'asc' } },
      timeline: { orderBy: { dataEntrada: 'asc' } },
      slaLogs: { orderBy: { createdAt: 'asc' } },
      aiLogs: { orderBy: { createdAt: 'asc' } },
      events: { orderBy: { createdAt: 'asc' } },
      csatResposta: true,
    },
  });
  if (!ticket) return null;

  const now = new Date();
  const abertura = new Date(ticket.dataAbertura);
  const fechamento = ticket.dataFechamento ? new Date(ticket.dataFechamento) : now;

  // ── Tempos base ──
  const tempoCorridoMin = Math.floor((fechamento.getTime() - abertura.getTime()) / 60000);
  const pausaMs = (ticket.slaPausadoTotalMin || 0) * 60000;
  const tempoTotalMin = Math.max(0, tempoCorridoMin - Math.floor(pausaMs / 60000));

  // ── Primeira resposta ──
  const primeiraRespostaEm = ticket.dataPrimeiraResposta
    ? new Date(ticket.dataPrimeiraResposta)
    : null;
  const tempoPrimeiraRespostaMin = primeiraRespostaEm
    ? Math.floor((primeiraRespostaEm.getTime() - abertura.getTime()) / 60000)
    : null;

  // ── Primeira resposta IA vs Humana ──
  const primeiraIaLog = ticket.aiLogs.find(l => l.tipo === 'suggest_response' || l.tipo === 'classify');
  const tempoPrimeiraRespostaIaMin = primeiraIaLog
    ? Math.floor((new Date(primeiraIaLog.createdAt).getTime() - abertura.getTime()) / 60000)
    : null;

  const primeiraMsgAgente = ticket.messages.find(m => m.fromMe && m.usuarioId);
  const tempoPrimeiraRespostaHumMin = primeiraMsgAgente
    ? Math.floor((new Date(primeiraMsgAgente.sentAt).getTime() - abertura.getTime()) / 60000)
    : null;

  // ── Tempos por etapa ──
  let tempoEmAtendimentoMin = 0;
  let tempoAguardandoClienteMin = 0;
  let tempoAguardandoTerceiroMin = 0;
  let tempoFilaMin = 0;

  for (const t of ticket.timeline) {
    const duracao = t.duracaoMinutos || 0;
    switch (t.etapa) {
      case 'em_atendimento': tempoEmAtendimentoMin += duracao; break;
      case 'aguardando_cliente': tempoAguardandoClienteMin += duracao; break;
      case 'aguardando_terceiro': tempoAguardandoTerceiroMin += duracao; break;
      case 'fila': tempoFilaMin += duracao; break;
    }
  }

  // ── Contadores ──
  const mensagensCliente = ticket.messages.filter(m => !m.fromMe).length;
  const mensagensAgente = ticket.messages.filter(m => m.fromMe && m.usuarioId).length;
  const mensagensBot = ticket.messages.filter(m => m.fromMe && !m.usuarioId).length;
  const totalMensagens = ticket.messages.length;

  const totalEscalonamentos = ticket.slaLogs.filter(l => l.acao === 'reassigned').length;
  const totalReaberturas = ticket.events.filter(e => e.tipo === 'reopened').length;

  // ── SLA ──
  const slaPrazoMinutos = ticket.slaTotalMinutos || undefined;
  const slaConsumidoMinutos = tempoTotalMin;
  const slaRestanteMinutos = slaPrazoMinutos ? Math.max(0, slaPrazoMinutos - slaConsumidoMinutos) : 0;
  const slaPercentualConsumido = slaPrazoMinutos ? (slaConsumidoMinutos / slaPrazoMinutos) * 100 : 0;
  const slaStatus = !slaPrazoMinutos ? undefined
    : slaPercentualConsumido >= 100 ? 'violado'
    : slaPercentualConsumido >= 90 ? 'alerta_90'
    : slaPercentualConsumido >= 75 ? 'alerta_75'
    : 'ok';

  // ── IA ──
  const iaConfiancaMedia = ticket.aiLogs.length > 0
    ? ticket.aiLogs.reduce((acc, l) => acc + (l.confianca || 0), 0) / ticket.aiLogs.length
    : undefined;
  const iaCustoTotalUsd = ticket.aiLogs.reduce((acc, l) => acc + (l.custoUsd || 0), 0);
  const iaCustoTotalBrl = ticket.aiLogs.reduce((acc, l) => acc + (l.custoBrl || 0), 0);

  // ── CSAT ──
  const csatNota = ticket.csatResposta?.nota ?? undefined;
  const csatRespondido = !!ticket.csatResposta?.respondidoEm;

  // ── Tempos derivados ──
  const tempoLeadTimeMin = tempoTotalMin;
  const tempoUtilMin = tempoTotalMin; // Simplificado - idealmente calcula com horario comercial
  const tempoForaExpedienteMin = Math.max(0, tempoCorridoMin - tempoUtilMin);
  const tempoParadoMin = tempoAguardandoClienteMin + tempoAguardandoTerceiroMin;

  const metricsData: TicketMetricsData = {
    tempoTotalMin,
    tempoPrimeiraRespostaMin: tempoPrimeiraRespostaMin ?? undefined,
    tempoPrimeiraRespostaIaMin: tempoPrimeiraRespostaIaMin ?? undefined,
    tempoPrimeiraRespostaHumMin: tempoPrimeiraRespostaHumMin ?? undefined,
    tempoEmAtendimentoMin,
    tempoAguardandoClienteMin,
    tempoAguardandoTerceiroMin,
    tempoFilaMin,
    tempoResolucaoIaMin: ticket.resolvidoPorIa ? tempoTotalMin : undefined,
    tempoResolucaoHumanoMin: !ticket.resolvidoPorIa ? tempoTotalMin : undefined,
    tempoLeadTimeMin,
    tempoUtilMin,
    tempoCorridoMin,
    tempoForaExpedienteMin,
    tempoParadoMin,
    totalMensagens,
    mensagensCliente,
    mensagensAgente,
    mensagensBot,
    totalReaberturas,
    totalEscalonamentos,
    slaPrazoMinutos,
    slaConsumidoMinutos,
    slaRestanteMinutos,
    slaPercentualConsumido,
    slaStatus,
    csatNota,
    csatRespondido,
    resolvidoPorIa: ticket.resolvidoPorIa,
    iaConfiancaMedia,
    iaTotalInteracoes: ticket.aiLogs.length,
    iaCustoTotalUsd,
    iaCustoTotalBrl,
    primeiraRespostaEm: primeiraRespostaEm ?? undefined,
    ultimoAtendimentoEm: ticket.lastAgentMessageAt ?? undefined,
  };

  return upsertTicketMetrics(ticketId, metricsData);
}

// ══════════════════════════════════════════════════════════════════
// ── SLA LOGS ───────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════

export async function logSlaEvent(input: {
  ticketId: string;
  acao: string;
  slaMinutos: number;
  percentual?: number;
  restantesMin?: number;
  motivo?: string;
  dados?: Record<string, any>;
  usuarioId?: string;
  isSystem?: boolean;
}) {
  return prisma.ticketSlaLog.create({
    data: {
      ticketId: input.ticketId,
      acao: input.acao,
      slaMinutos: input.slaMinutos,
      percentual: input.percentual,
      restantesMin: input.restantesMin,
      motivo: input.motivo,
      dados: input.dados ? JSON.stringify(input.dados) : undefined,
      usuarioId: input.usuarioId,
      isSystem: input.isSystem ?? false,
    },
  });
}

export async function getSlaLogs(ticketId: string) {
  return prisma.ticketSlaLog.findMany({
    where: { ticketId },
    orderBy: { createdAt: 'asc' },
    include: { usuario: { select: { id: true, name: true } } },
  });
}

// ══════════════════════════════════════════════════════════════════
// ── ACTIVITY ───────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════

export async function logActivity(input: {
  ticketId: string;
  usuarioId?: string;
  tipo: string;
  descricao?: string;
  dados?: Record<string, any>;
  ip?: string;
  userAgent?: string;
}) {
  return prisma.ticketActivity.create({
    data: {
      ticketId: input.ticketId,
      usuarioId: input.usuarioId,
      tipo: input.tipo,
      descricao: input.descricao,
      dados: input.dados ? JSON.stringify(input.dados) : undefined,
      ip: input.ip,
      userAgent: input.userAgent,
    },
  });
}

export async function getTicketActivities(
  ticketId: string,
  options?: { tipo?: string; limit?: number }
) {
  const where: any = { ticketId };
  if (options?.tipo) where.tipo = options.tipo;

  return prisma.ticketActivity.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: options?.limit ?? 50,
    include: { usuario: { select: { id: true, name: true, avatar: true } } },
  });
}

// ══════════════════════════════════════════════════════════════════
// ── WAIT TIMES ─────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════

export async function startWaitTime(input: {
  ticketId: string;
  etapa: string;
  motivo?: string;
  usuarioId?: string;
}) {
  // Fechar qualquer wait time aberto para esta etapa
  await prisma.ticketWaitTime.updateMany({
    where: { ticketId: input.ticketId, etapa: input.etapa, dataSaida: null },
    data: { dataSaida: new Date() },
  });

  return prisma.ticketWaitTime.create({
    data: {
      ticketId: input.ticketId,
      etapa: input.etapa,
      dataEntrada: new Date(),
      motivo: input.motivo,
      usuarioId: input.usuarioId,
    },
  });
}

export async function endWaitTime(ticketId: string, etapa: string) {
  const open = await prisma.ticketWaitTime.findFirst({
    where: { ticketId, etapa, dataSaida: null },
    orderBy: { dataEntrada: 'desc' },
  });
  if (!open) return null;

  const now = new Date();
  const duracaoMin = Math.floor((now.getTime() - open.dataEntrada.getTime()) / 60000);

  return prisma.ticketWaitTime.update({
    where: { id: open.id },
    data: { dataSaida: now, duracaoMin },
  });
}

export async function getTicketWaitTimes(ticketId: string) {
  return prisma.ticketWaitTime.findMany({
    where: { ticketId },
    orderBy: { dataEntrada: 'asc' },
  });
}

// ══════════════════════════════════════════════════════════════════
// ── AI LOGS ────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════

export async function logAiInteraction(input: {
  ticketId: string;
  tipo: string;
  modelo?: string;
  inputTokens?: number;
  outputTokens?: number;
  custoUsd?: number;
  custoBrl?: number;
  latenciaMs?: number;
  confianca?: number;
  resultado?: Record<string, any>;
  correcaoId?: string;
  erro?: string;
  duracaoProcessamentoMs?: number;
}) {
  return prisma.ticketAiLog.create({
    data: {
      ticketId: input.ticketId,
      tipo: input.tipo,
      modelo: input.modelo,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      custoUsd: input.custoUsd,
      custoBrl: input.custoBrl,
      latenciaMs: input.latenciaMs,
      confianca: input.confianca,
      resultado: input.resultado ? JSON.stringify(input.resultado) : undefined,
      correcaoId: input.correcaoId,
      erro: input.erro,
      duracaoProcessamentoMs: input.duracaoProcessamentoMs,
    },
  });
}

export async function getTicketAiLogs(ticketId: string) {
  return prisma.ticketAiLog.findMany({
    where: { ticketId },
    orderBy: { createdAt: 'asc' },
  });
}

// ══════════════════════════════════════════════════════════════════
// ── PERFORMANCE ────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════

export async function upsertPerformance(data: {
  periodo: string;
  tipoPeriodo?: string;
  usuarioId?: string;
  departamentoId?: string;
  ticketsRecebidos?: number;
  ticketsResolvidos?: number;
  ticketsEscalonados?: number;
  ticketsReabertos?: number;
  ticketsCancelados?: number;
  mttrMin?: number;
  mttaMin?: number;
  mtfaMin?: number;
  mtFilaMin?: number;
  slaCompliancePct?: number;
  slaViolados?: number;
  slaNoPrazo?: number;
  csatMedio?: number;
  csatTotalRespostas?: number;
  fcrPct?: number;
  iaResolveu?: number;
  iaConfiancaMedia?: number;
  iaCustoTotalUsd?: number;
  totalMensagensEnviadas?: number;
  totalMensagensRecebidas?: number;
  tempoAtivoMinutos?: number;
}) {
  const uniqueKey = {
    periodo_tipoPeriodo_usuarioId_departamentoId: {
      periodo: data.periodo,
      tipoPeriodo: data.tipoPeriodo || 'mensal',
      usuarioId: data.usuarioId || null,
      departamentoId: data.departamentoId || null,
    },
  };

  return prisma.ticketPerformance.upsert({
    where: uniqueKey as any,
    create: data as any,
    update: data as any,
  });
}

export async function getPerformanceReport(options: {
  periodo?: string;
  tipoPeriodo?: string;
  usuarioId?: string;
  departamentoId?: string;
}) {
  const where: any = {};
  if (options.periodo) where.periodo = options.periodo;
  if (options.tipoPeriodo) where.tipoPeriodo = options.tipoPeriodo;
  if (options.usuarioId) where.usuarioId = options.usuarioId;
  if (options.departamentoId) where.departamentoId = options.departamentoId;

  return prisma.ticketPerformance.findMany({
    where,
    orderBy: { periodo: 'desc' },
    include: {
      usuario: { select: { id: true, name: true } },
    },
  });
}

// ══════════════════════════════════════════════════════════════════
// ── REPLAY / HISTORY ───────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════

export async function getTicketReplayData(ticketId: string) {
  const [events, timeline, metrics, slaLogs, activities, waitTimes, aiLogs] = await Promise.all([
    prisma.ticketEvent.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
      include: { usuario: { select: { id: true, name: true } } },
    }),
    prisma.ticketTimeline.findMany({
      where: { ticketId },
      orderBy: { dataEntrada: 'asc' },
    }),
    prisma.ticketMetrics.findUnique({ where: { ticketId } }),
    prisma.ticketSlaLog.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.ticketActivity.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.ticketWaitTime.findMany({
      where: { ticketId },
      orderBy: { dataEntrada: 'asc' },
    }),
    prisma.ticketAiLog.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  return { events, timeline, metrics, slaLogs, activities, waitTimes, aiLogs };
}

// ══════════════════════════════════════════════════════════════════
// ── EXPORT ─────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════

export async function exportTicketData(
  ticketId: string,
  format: 'json' | 'csv'
) {
  const data = await getTicketReplayData(ticketId);

  if (format === 'json') {
    return JSON.stringify(data, null, 2);
  }

  // CSV: flatten events into rows
  const lines = ['tipo,descricao,usuario,data,isSystem,isAi'];
  for (const e of data.events) {
    const desc = (e.descricao || '').replace(/"/g, '""');
    const user = e.usuario?.name || 'sistema';
    lines.push(`"${e.tipo}","${desc}","${user}","${e.createdAt.toISOString()}",${e.isSystem},${e.isAi}`);
  }
  return lines.join('\n');
}
