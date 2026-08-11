import prisma from '../../config/database';

export interface TimeEntryInput {
  usuarioId: string;
  ticketId?: string;
  orderId?: string;
  projectId?: string;
  tipo?: string;
  descricao?: string;
  dataInicio?: string;
  duracaoMin?: number;
  billable?: boolean;
  tags?: string[];
}

export interface TimeEntryUpdate {
  tipo?: string;
  descricao?: string;
  dataFim?: string;
  duracaoMin?: number;
  billable?: boolean;
  faturado?: boolean;
  tags?: string[];
}

// ── Start timer ──────────────────────────────────────────────────────

export async function startTimer(input: TimeEntryInput) {
  // Stop any running timer for this user first
  const running = await prisma.timeEntry.findFirst({
    where: { usuarioId: input.usuarioId, dataFim: null },
  });
  if (running) {
    await stopTimer(running.id);
  }

  return prisma.timeEntry.create({
    data: {
      usuarioId: input.usuarioId,
      ticketId: input.ticketId || null,
      orderId: input.orderId || null,
      projectId: input.projectId || null,
      tipo: input.tipo || 'suporte',
      descricao: input.descricao || null,
      dataInicio: input.dataInicio ? new Date(input.dataInicio) : new Date(),
      billable: input.billable ?? true,
      tags: input.tags || [],
    },
    include: {
      ticket: { select: { id: true, assunto: true, protocolo: true } },
      order: { select: { id: true, numeroOs: true, tipoServico: true } },
    },
  });
}

// ── Stop timer ───────────────────────────────────────────────────────

export async function stopTimer(id: string) {
  const entry = await prisma.timeEntry.findUnique({ where: { id } });
  if (!entry) throw new Error('TimeEntry nao encontrado');
  if (entry.dataFim) throw new Error('Timer ja foi finalizado');

  const now = new Date();
  const duracaoMin = Math.round((now.getTime() - entry.dataInicio.getTime()) / 60000);

  return prisma.timeEntry.update({
    where: { id },
    data: { dataFim: now, duracaoMin },
    include: {
      ticket: { select: { id: true, assunto: true, protocolo: true } },
      order: { select: { id: true, numeroOs: true, tipoServico: true } },
    },
  });
}

// ── Create manual entry ──────────────────────────────────────────────

export async function createManualEntry(input: TimeEntryInput & { duracaoMin: number }) {
  return prisma.timeEntry.create({
    data: {
      usuarioId: input.usuarioId,
      ticketId: input.ticketId || null,
      orderId: input.orderId || null,
      projectId: input.projectId || null,
      tipo: input.tipo || 'suporte',
      descricao: input.descricao || null,
      dataInicio: input.dataInicio ? new Date(input.dataInicio) : new Date(),
      dataFim: new Date(),
      duracaoMin: input.duracaoMin,
      billable: input.billable ?? true,
      tags: input.tags || [],
    },
    include: {
      ticket: { select: { id: true, assunto: true, protocolo: true } },
      order: { select: { id: true, numeroOs: true, tipoServico: true } },
    },
  });
}

// ── Update entry ─────────────────────────────────────────────────────

export async function updateEntry(id: string, data: TimeEntryUpdate) {
  const update: any = {};
  if (data.tipo !== undefined) update.tipo = data.tipo;
  if (data.descricao !== undefined) update.descricao = data.descricao;
  if (data.billable !== undefined) update.billable = data.billable;
  if (data.faturado !== undefined) update.faturado = data.faturado;
  if (data.tags !== undefined) update.tags = data.tags;
  if (data.duracaoMin !== undefined) update.duracaoMin = data.duracaoMin;

  return prisma.timeEntry.update({
    where: { id },
    data: update,
    include: {
      ticket: { select: { id: true, assunto: true, protocolo: true } },
      order: { select: { id: true, numeroOs: true, tipoServico: true } },
    },
  });
}

// ── Delete entry ─────────────────────────────────────────────────────

export async function deleteEntry(id: string) {
  return prisma.timeEntry.delete({ where: { id } });
}

// ── List entries ─────────────────────────────────────────────────────

export async function listEntries(filters: {
  usuarioId?: string;
  ticketId?: string;
  orderId?: string;
  tipo?: string;
  billable?: boolean;
  from?: string;
  to?: string;
  running?: boolean;
}) {
  const where: any = {};
  if (filters.usuarioId) where.usuarioId = filters.usuarioId;
  if (filters.ticketId) where.ticketId = filters.ticketId;
  if (filters.orderId) where.orderId = filters.orderId;
  if (filters.tipo) where.tipo = filters.tipo;
  if (filters.billable !== undefined) where.billable = filters.billable;
  if (filters.running) where.dataFim = null;

  if (filters.from || filters.to) {
    where.dataInicio = {};
    if (filters.from) where.dataInicio.gte = new Date(filters.from);
    if (filters.to) where.dataInicio.lte = new Date(filters.to);
  }

  return prisma.timeEntry.findMany({
    where,
    include: {
      usuario: { select: { id: true, name: true } },
      ticket: { select: { id: true, assunto: true, protocolo: true } },
      order: { select: { id: true, numeroOs: true, tipoServico: true } },
    },
    orderBy: { dataInicio: 'desc' },
  });
}

// ── Get running timer for user ───────────────────────────────────────

export async function getRunningTimer(usuarioId: string) {
  return prisma.timeEntry.findFirst({
    where: { usuarioId, dataFim: null },
    include: {
      ticket: { select: { id: true, assunto: true, protocolo: true } },
      order: { select: { id: true, numeroOs: true, tipoServico: true } },
    },
  });
}

// ── Summary / Dashboard ─────────────────────────────────────────────

export async function getSummary(filters: {
  usuarioId?: string;
  from?: string;
  to?: string;
}) {
  const where: any = { dataFim: { not: null } };
  if (filters.usuarioId) where.usuarioId = filters.usuarioId;

  if (filters.from || filters.to) {
    where.dataInicio = {};
    if (filters.from) where.dataInicio.gte = new Date(filters.from);
    if (filters.to) where.dataInicio.lte = new Date(filters.to);
  }

  const entries = await prisma.timeEntry.findMany({
    where,
    select: {
      tipo: true,
      duracaoMin: true,
      billable: true,
      faturado: true,
      dataInicio: true,
      usuario: { select: { id: true, name: true } },
    },
  });

  // Aggregate by type
  const byType: Record<string, { total: number; billable: number; count: number }> = {};
  let totalMin = 0;
  let totalBillableMin = 0;
  let totalFaturadoMin = 0;

  for (const e of entries) {
    const min = e.duracaoMin || 0;
    totalMin += min;
    if (e.billable) totalBillableMin += min;
    if (e.faturado) totalFaturadoMin += min;

    if (!byType[e.tipo]) byType[e.tipo] = { total: 0, billable: 0, count: 0 };
    byType[e.tipo].total += min;
    if (e.billable) byType[e.tipo].billable += min;
    byType[e.tipo].count++;
  }

  // By user
  const byUser: Record<string, { total: number; billable: number; count: number }> = {};
  for (const e of entries) {
    const min = e.duracaoMin || 0;
    const userName = e.usuario?.name || 'Desconhecido';
    if (!byUser[userName]) byUser[userName] = { total: 0, billable: 0, count: 0 };
    byUser[userName].total += min;
    if (e.billable) byUser[userName].billable += min;
    byUser[userName].count++;
  }

  // By day
  const byDay: Record<string, number> = {};
  for (const e of entries) {
    const day = e.dataInicio.toISOString().split('T')[0];
    byDay[day] = (byDay[day] || 0) + (e.duracaoMin || 0);
  }

  return {
    totalHoras: +(totalMin / 60).toFixed(1),
    totalBillableHoras: +(totalBillableMin / 60).toFixed(1),
    totalFaturadoHoras: +(totalFaturadoMin / 60).toFixed(1),
    totalEntradas: entries.length,
    byType,
    byUser,
    byDay,
  };
}

// ── Sync ServiceOrder hours from time entries ────────────────────────

export async function syncOrderHours(orderId: string) {
  const entries = await prisma.timeEntry.findMany({
    where: { orderId, dataFim: { not: null } },
  });

  const devMin = entries.filter((e) => e.tipo === 'dev').reduce((sum, e) => sum + (e.duracaoMin || 0), 0);
  const suporteMin = entries.filter((e) => e.tipo === 'suporte' || e.tipo === 'treinamento' || e.tipo === 'implantacao').reduce((sum, e) => sum + (e.duracaoMin || 0), 0);

  await prisma.serviceOrder.update({
    where: { id: orderId },
    data: {
      horasDev: +(devMin / 60).toFixed(2),
      horasSuporte: +(suporteMin / 60).toFixed(2),
    },
  });
}
