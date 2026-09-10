import prisma from '../../../config/database';
import { operationalBus, OperationalEvent } from './eventBus';

export type AnalystOperationalStatus =
  | 'em_atendimento'
  | 'disponivel'
  | 'aguardando_cliente'
  | 'aguardando_departamento'
  | 'aguardando_sistema'
  | 'em_pausa'
  | 'offline'
  | 'sem_atividade';

export type IdleLevel = 'nenhum' | 'recente' | 'baixa' | 'ociosidade' | 'ociosidade_elevada' | 'critica';

export interface PauseInfo {
  startedAt: Date;
  reason?: string;
  durationMs: number;
}

export interface AnalystOperational {
  userId: string;
  name: string;
  email: string;
  role: string;
  avatar?: string | null;
  departmentNames: string[];
  status: AnalystOperationalStatus;
  statusLabel: string;
  statusIcon: string;
  currentTicketId?: string;
  currentTicketProtocolo?: string;
  currentTicketSubject?: string;
  currentClientName?: string;
  currentDepartment?: string;
  currentChannel?: string;
  currentPriority?: string;
  currentSlaPercent?: number;
  currentSlaStatus?: string;
  timeInStatusMs: number;
  timeInStatusLabel: string;
  lastActivityAt?: Date;
  lastActivityType?: string;
  lastActivityLabel?: string;
  idleMs: number;
  idleLevel: IdleLevel;
  idleLabel: string;
  activeTicketsCount: number;
  totalTicketsToday: number;
  pause?: PauseInfo;
  online: boolean;
  lastSeenAt?: Date;
}

export interface QueueInfo {
  total: number;
  averageWaitMs: number;
  averageWaitLabel: string;
  oldestWaitMs: number;
  oldestWaitLabel: string;
  byDepartment: { departmentId: string; departmentName: string; count: number }[];
}

export interface OperationalSnapshot {
  timestamp: Date;
  analysts: AnalystOperational[];
  summary: {
    totalOnline: number;
    emAtendimento: number;
    disponiveis: number;
    aguardandoCliente: number;
    emPausa: number;
    offline: number;
    semAtividade: number;
  };
  queue: QueueInfo;
  alerts: OperationalAlert[];
}

export interface OperationalAlert {
  id: string;
  type: 'sla_critico' | 'sla_em_risco' | 'analista_ocioso' | 'fila_crescendo' | 'analista_sobrecarregado' | 'analista_sem_atendimento' | 'ticket_parado';
  severity: 'critico' | 'atencao' | 'info';
  title: string;
  description: string;
  userId?: string;
  ticketId?: string;
  departmentName?: string;
  timestamp: Date;
}

export interface AnalystTimelineEntry {
  timestamp: Date;
  type: string;
  label: string;
  ticketId?: string;
  ticketProtocolo?: string;
  details?: string;
}

const STATUS_CONFIG: Record<AnalystOperationalStatus, { label: string; icon: string }> = {
  em_atendimento: { label: 'Em Atendimento', icon: '🟢' },
  disponivel: { label: 'Disponível', icon: '🔵' },
  aguardando_cliente: { label: 'Aguardando Cliente', icon: '🟣' },
  aguardando_departamento: { label: 'Aguardando Depto.', icon: '🟣' },
  aguardando_sistema: { label: 'Aguardando Sistema', icon: '🟣' },
  em_pausa: { label: 'Em Pausa', icon: '🟠' },
  offline: { label: 'Offline', icon: '🔴' },
  sem_atividade: { label: 'Sem Atividade', icon: '⚪' },
};

const IDLE_THRESHOLDS = {
  recente: 5 * 60 * 1000,
  baixa: 10 * 60 * 1000,
  ociosidade: 20 * 60 * 1000,
  ociosidade_elevada: 30 * 60 * 1000,
  critica: 60 * 60 * 1000,
};

const IDLE_LABELS: Record<IdleLevel, string> = {
  nenhum: 'Ativo',
  recente: 'Atividade recente',
  baixa: 'Baixa atividade',
  ociosidade: 'Ociosidade',
  ociosidade_elevada: 'Ociosidade elevada',
  critica: 'Ociosidade crítica',
};

const ACTIVE_STAGES = ['fila', 'triagem', 'em_atendimento'];
const WAITING_STAGES = ['aguardando_cliente', 'aguardando_os'];

let pauseState = new Map<string, { startedAt: Date; reason?: string }>();

export function startPause(userId: string, reason?: string) {
  pauseState.set(userId, { startedAt: new Date(), reason });
  operationalBus.emitEvent({
    type: 'pause_started',
    userId,
    data: { reason },
    timestamp: new Date(),
  });
}

export function endPause(userId: string) {
  const pause = pauseState.get(userId);
  if (pause) {
    pauseState.delete(userId);
    operationalBus.emitEvent({
      type: 'pause_ended',
      userId,
      data: { durationMs: Date.now() - pause.startedAt.getTime(), reason: pause.reason },
      timestamp: new Date(),
    });
  }
}

export function getPauseState(userId: string): PauseInfo | undefined {
  const p = pauseState.get(userId);
  if (!p) return undefined;
  return { startedAt: p.startedAt, reason: p.reason, durationMs: Date.now() - p.startedAt.getTime() };
}

function classifyIdle(lastActivityAt: Date | null, status: AnalystOperationalStatus): { level: IdleLevel; label: string; ms: number } {
  if (status === 'em_pausa' || status === 'offline') {
    return { level: 'nenhum', label: status === 'em_pausa' ? 'Em pausa' : 'Offline', ms: 0 };
  }
  if (!lastActivityAt) {
    return { level: 'critica', label: 'Sem atividade registrada', ms: IDLE_THRESHOLDS.critica + 1 };
  }
  const ms = Date.now() - lastActivityAt.getTime();
  if (ms < IDLE_THRESHOLDS.recente) return { level: 'nenhum', label: 'Ativo', ms };
  if (ms < IDLE_THRESHOLDS.baixa) return { level: 'recente', label: IDLE_LABELS.recente, ms };
  if (ms < IDLE_THRESHOLDS.ociosidade) return { level: 'baixa', label: IDLE_LABELS.baixa, ms };
  if (ms < IDLE_THRESHOLDS.ociosidade_elevada) return { level: 'ociosidade', label: IDLE_LABELS.ociosidade, ms };
  if (ms < IDLE_THRESHOLDS.critica) return { level: 'ociosidade_elevada', label: IDLE_LABELS.ociosidade_elevada, ms };
  return { level: 'critica', label: IDLE_LABELS.critica, ms };
}

function formatMs(ms: number): string {
  if (ms < 0) return '0s';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return rs > 0 ? `${m}min ${rs}s` : `${m}min`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}h ${rm}min` : `${h}h`;
}

function getLastActivityInfo(userId: string, events: any[]): { at?: Date; type?: string; label?: string } {
  const userEvents = events.filter(e => e.usuarioId === userId);
  if (userEvents.length === 0) return {};
  const last = userEvents[userEvents.length - 1];
  const typeMap: Record<string, string> = {
    message_sent: 'Mensagem enviada',
    message_received: 'Mensagem recebida',
    stage_changed: 'Status alterado',
    assignee_changed: 'Ticket atribuído',
    created: 'Chamado aberto',
    closed: 'Chamado encerrado',
    escalated: 'Chamado escalado',
    note_added: 'Nota adicionada',
    reopened: 'Chamado reaberto',
  };
  return {
    at: last.createdAt,
    type: last.tipo,
    label: typeMap[last.tipo] || last.tipo,
  };
}

export async function buildOperationalSnapshot(organizationId?: string | null): Promise<OperationalSnapshot> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const whereUsers: any = { active: true };
  if (organizationId) whereUsers.organizationId = organizationId;

  const [users, activeTickets, allTodayTickets, recentEvents] = await Promise.all([
    prisma.user.findMany({
      where: whereUsers,
      select: {
        id: true, name: true, email: true, role: true, avatar: true,
        online: true, lastSeenAt: true, organizationId: true,
        departamentos: { include: { departamento: { select: { id: true, nome: true } } } },
      },
    }),
    prisma.ticket.findMany({
      where: {
        status: { in: ['aberto', 'em_atendimento', 'pendente', 'escalonado'] },
        ...(organizationId ? { organizationId } : {}),
      },
      select: {
        id: true, protocolo: true, assunto: true, etapa: true, status: true,
        prioridade: true, canal: true, assigneeId: true, departamentoId: true,
        dataAbertura: true, lastAgentMessageAt: true, createdAt: true,
        slaTotalMinutos: true, slaPausadoTotalMin: true, slaPausadoEm: true,
        client: { select: { razaoSocial: true, nomeFantasia: true } },
        departamento: { select: { nome: true } },
        channel: { select: { nome: true, tipo: true } },
        metrics: { select: { slaPercentualConsumido: true, slaStatus: true, slaRestanteMinutos: true } },
      },
    }),
    prisma.ticket.findMany({
      where: {
        createdAt: { gte: todayStart },
        ...(organizationId ? { organizationId } : {}),
      },
      select: { id: true, assigneeId: true },
    }),
    prisma.ticketEvent.findMany({
      where: {
        createdAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) },
        ...(organizationId ? {
          ticket: { organizationId },
        } : {}),
      },
      select: { ticketId: true, tipo: true, createdAt: true, usuarioId: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const ticketByAssignee = new Map<string, typeof activeTickets>();
  const ticketsInQueue: typeof activeTickets = [];

  for (const t of activeTickets) {
    if (t.assigneeId) {
      const list = ticketByAssignee.get(t.assigneeId) || [];
      list.push(t);
      ticketByAssignee.set(t.assigneeId, list);
    } else if (t.etapa === 'fila') {
      ticketsInQueue.push(t);
    }
  }

  const todayByUser = new Map<string, number>();
  for (const t of allTodayTickets) {
    if (t.assigneeId) {
      todayByUser.set(t.assigneeId, (todayByUser.get(t.assigneeId) || 0) + 1);
    }
  }

  const analysts: AnalystOperational[] = [];

  for (const user of users) {
    const deptNames = user.departamentos.map(d => d.departamento.nome);
    const userTickets = ticketByAssignee.get(user.id) || [];
    const pause = getPauseState(user.id);
    const lastActivity = getLastActivityInfo(user.id, recentEvents);

    let status: AnalystOperationalStatus;
    const mainTicket = userTickets.find(t => t.etapa === 'em_atendimento') || userTickets[0];

    if (!user.online) {
      status = 'offline';
    } else if (pause) {
      status = 'em_pausa';
    } else if (mainTicket) {
      if (mainTicket.etapa === 'em_atendimento') {
        status = 'em_atendimento';
      } else if (mainTicket.etapa === 'aguardando_cliente') {
        status = 'aguardando_cliente';
      } else if (mainTicket.etapa === 'aguardando_os') {
        status = 'aguardando_departamento';
      } else {
        status = 'em_atendimento';
      }
    } else {
      status = 'disponivel';
    }

    const config = STATUS_CONFIG[status];
    const idle = classifyIdle(lastActivity.at || user.lastSeenAt, status);
    const timeInStatusMs = lastActivity.at ? Date.now() - lastActivity.at.getTime() : (user.lastSeenAt ? Date.now() - user.lastSeenAt.getTime() : 0);

    let currentSlaPercent: number | undefined;
    let currentSlaStatus: string | undefined;
    if (mainTicket?.metrics) {
      currentSlaPercent = mainTicket.metrics.slaPercentualConsumido;
      currentSlaStatus = mainTicket.metrics.slaStatus ?? undefined;
    }

    analysts.push({
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      departmentNames: deptNames,
      status,
      statusLabel: config.label,
      statusIcon: config.icon,
      currentTicketId: mainTicket?.id,
      currentTicketProtocolo: mainTicket?.protocolo || undefined,
      currentTicketSubject: mainTicket?.assunto || undefined,
      currentClientName: mainTicket?.client?.nomeFantasia || mainTicket?.client?.razaoSocial || undefined,
      currentDepartment: mainTicket?.departamento?.nome || undefined,
      currentChannel: mainTicket?.channel?.nome || undefined,
      currentPriority: mainTicket?.prioridade || undefined,
      currentSlaPercent,
      currentSlaStatus,
      timeInStatusMs,
      timeInStatusLabel: formatMs(timeInStatusMs),
      lastActivityAt: lastActivity.at,
      lastActivityType: lastActivity.type,
      lastActivityLabel: lastActivity.label,
      idleMs: idle.ms,
      idleLevel: idle.level,
      idleLabel: idle.label,
      activeTicketsCount: userTickets.length,
      totalTicketsToday: todayByUser.get(user.id) || 0,
      pause: pause,
      online: user.online,
      lastSeenAt: user.lastSeenAt || undefined,
    });
  }

  const summary = {
    totalOnline: analysts.filter(a => a.online).length,
    emAtendimento: analysts.filter(a => a.status === 'em_atendimento').length,
    disponiveis: analysts.filter(a => a.status === 'disponivel').length,
    aguardandoCliente: analysts.filter(a => a.status === 'aguardando_cliente').length,
    emPausa: analysts.filter(a => a.status === 'em_pausa').length,
    offline: analysts.filter(a => a.status === 'offline').length,
    semAtividade: analysts.filter(a => a.status === 'sem_atividade').length,
  };

  const deptCounts = new Map<string, { departmentId: string; departmentName: string; count: number }>();
  for (const t of ticketsInQueue) {
    const deptId = t.departamentoId || 'none';
    const deptName = t.departamento?.nome || 'Sem departamento';
    const existing = deptCounts.get(deptId);
    if (existing) {
      existing.count++;
    } else {
      deptCounts.set(deptId, { departmentId: deptId, departmentName: deptName, count: 1 });
    }
  }

  const totalWaitMs = ticketsInQueue.reduce((sum, t) => sum + (Date.now() - t.dataAbertura.getTime()), 0);
  const queue: QueueInfo = {
    total: ticketsInQueue.length,
    averageWaitMs: ticketsInQueue.length > 0 ? Math.round(totalWaitMs / ticketsInQueue.length) : 0,
    averageWaitLabel: formatMs(ticketsInQueue.length > 0 ? totalWaitMs / ticketsInQueue.length : 0),
    oldestWaitMs: ticketsInQueue.length > 0 ? Math.max(...ticketsInQueue.map(t => Date.now() - t.dataAbertura.getTime())) : 0,
    oldestWaitLabel: formatMs(ticketsInQueue.length > 0 ? Math.max(...ticketsInQueue.map(t => Date.now() - t.dataAbertura.getTime())) : 0),
    byDepartment: Array.from(deptCounts.values()),
  };

  const alerts: OperationalAlert[] = [];

  for (const a of analysts) {
    if (a.idleLevel === 'ociosidade_elevada' || a.idleLevel === 'critica') {
      alerts.push({
        id: `idle-${a.userId}`,
        type: 'analista_ocioso',
        severity: a.idleLevel === 'critica' ? 'critico' : 'atencao',
        title: `${a.name} sem atividade há ${formatMs(a.idleMs)}`,
        description: `${a.name} está ${a.idleLabel.toLowerCase()}. Última atividade: ${a.lastActivityLabel || 'desconhecida'}.`,
        userId: a.userId,
        timestamp: new Date(),
      });
    }
    if (a.activeTicketsCount >= 6) {
      const slaHigh = a.currentSlaPercent && a.currentSlaPercent > 80;
      alerts.push({
        id: `overload-${a.userId}`,
        type: 'analista_sobrecarregado',
        severity: slaHigh ? 'critico' : 'atencao',
        title: `Alta carga: ${a.name} com ${a.activeTicketsCount} chamados`,
        description: `${a.name} possui ${a.activeTicketsCount} chamados ativos${slaHigh ? ', sendo ' + a.activeTicketsCount + ' com SLA elevado' : ''}.`,
        userId: a.userId,
        timestamp: new Date(),
      });
    }
  }

  for (const t of activeTickets) {
    if (t.metrics?.slaStatus === 'violado') {
      const assignee = analysts.find(a => a.userId === t.assigneeId);
      alerts.push({
        id: `sla-${t.id}`,
        type: 'sla_critico',
        severity: 'critico',
        title: `SLA violado: #${t.protocolo || t.id.slice(0, 8)}`,
        description: `Chamado com SLA consumido em ${Math.round(t.metrics.slaPercentualConsumido || 0)}%.${assignee ? ` Analista: ${assignee.name}.` : ''}`,
        userId: t.assigneeId || undefined,
        ticketId: t.id,
        departmentName: t.departamento?.nome,
        timestamp: new Date(),
      });
    } else if (t.metrics?.slaStatus === 'alerta_90' || t.metrics?.slaStatus === 'alerta_75') {
      alerts.push({
        id: `sla-risk-${t.id}`,
        type: 'sla_em_risco',
        severity: 'atencao',
        title: `SLA em risco: #${t.protocolo || t.id.slice(0, 8)}`,
        description: `Chamado com SLA em ${Math.round(t.metrics.slaPercentualConsumido || 0)}%.`,
        userId: t.assigneeId || undefined,
        ticketId: t.id,
        departmentName: t.departamento?.nome,
        timestamp: new Date(),
      });
    }
  }

  alerts.sort((a, b) => {
    const sev = { critico: 0, atencao: 1, info: 2 };
    return (sev[a.severity] || 3) - (sev[b.severity] || 3);
  });

  return {
    timestamp: new Date(),
    analysts,
    summary,
    queue,
    alerts,
  };
}

export async function getAnalystTimeline(userId: string, organizationId?: string | null): Promise<AnalystTimelineEntry[]> {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const [events, tickets] = await Promise.all([
    prisma.ticketEvent.findMany({
      where: {
        usuarioId: userId,
        createdAt: { gte: dayStart },
        ...(organizationId ? { ticket: { organizationId } } : {}),
      },
      select: { tipo: true, createdAt: true, ticketId: true, descricao: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.ticket.findMany({
      where: {
        OR: [
          { assigneeId: userId },
          { usuarioId: userId },
        ],
        createdAt: { gte: dayStart },
        ...(organizationId ? { organizationId } : {}),
      },
      select: { id: true, protocolo: true },
    }),
  ]);

  const ticketMap = new Map(tickets.map(t => [t.id, t.protocolo || t.id.slice(0, 8)]));

  const typeLabels: Record<string, string> = {
    created: 'Chamado aberto',
    message_sent: 'Mensagem enviada',
    message_received: 'Mensagem recebida',
    stage_changed: 'Status alterado',
    assignee_changed: 'Ticket atribuído',
    priority_changed: 'Prioridade alterada',
    note_added: 'Nota adicionada',
    escalated: 'Ticket escalado',
    closed: 'Chamado encerrado',
    reopened: 'Chamado reaberto',
    sla_started: 'SLA iniciado',
    sla_paused: 'SLA pausado',
    sla_resumed: 'SLA retomado',
    sla_breached: 'SLA violado',
    ai_classified: 'IA classificou',
    ai_responded: 'IA respondeu',
  };

  const entries: AnalystTimelineEntry[] = events.map(e => ({
    timestamp: e.createdAt,
    type: e.tipo,
    label: typeLabels[e.tipo] || e.tipo,
    ticketId: e.ticketId,
    ticketProtocolo: ticketMap.get(e.ticketId),
    details: e.descricao || undefined,
  }));

  const pause = getPauseState(userId);
  if (pause) {
    entries.unshift({
      timestamp: pause.startedAt,
      type: 'pause_started',
      label: `Pausa iniciada${pause.reason ? ` (${pause.reason})` : ''}`,
    });
  }

  return entries;
}

export async function getAnalystDailySummary(userId: string, organizationId?: string | null) {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, online: true, lastSeenAt: true },
  });

  if (!user) return null;

  const [tickets, events] = await Promise.all([
    prisma.ticket.findMany({
      where: {
        assigneeId: userId,
        createdAt: { gte: dayStart },
        ...(organizationId ? { organizationId } : {}),
      },
      select: { id: true, status: true, etapa: true, dataAbertura: true, dataFechamento: true },
    }),
    prisma.ticketEvent.findMany({
      where: {
        usuarioId: userId,
        createdAt: { gte: dayStart },
        ...(organizationId ? { ticket: { organizationId } } : {}),
      },
      select: { tipo: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const resolved = tickets.filter(t => ['fechado', 'cancelado'].includes(t.status)).length;
  const reabertos = events.filter(e => e.tipo === 'reopened').length;

  return {
    user,
    ticketsToday: tickets.length,
    ticketsResolved: resolved,
    reopened: reabertos,
    eventsCount: events.length,
  };
}
