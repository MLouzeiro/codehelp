import prisma from '../../config/database';
import { logAudit } from '../audit/audit.service';

export interface TimeEntryInput {
  usuarioId: string;
  ticketId?: string;
  orderId?: string;
  projectId?: string;
  clienteId?: string;
  tarefaId?: string;
  setorId?: string;
  tipo?: string;
  descricao?: string;
  dataInicio?: string;
  duracaoMin?: number;
  billable?: boolean;
  tags?: string[];
}

async function registrarBloco(timeEntryId: string, tipo: string, usuarioId?: string | null, observacao?: string | null) {
  return prisma.timeEntryBlock.create({
    data: {
      timeEntryId,
      tipo,
      usuarioId: usuarioId || null,
      observacao: observacao || null,
    },
  });
}

/** Soma as horas das TimeEntries da tarefa e grava em KanbanTask.horasTrabalhadas. */
export async function sincronizarHorasTarefa(tarefaId: string) {
  const agg = await prisma.timeEntry.aggregate({
    where: { tarefaId, dataFim: { not: null } },
    _sum: { duracaoMin: true },
  });
  const horas = Math.round(((agg._sum.duracaoMin || 0) / 60) * 100) / 100;
  await prisma.kanbanTask.update({
    where: { id: tarefaId },
    data: { horasTrabalhadas: horas },
  });
  return horas;
}

// Categorias canonicas do relatorio de consumo (spec FASE 4)
export const CATEGORIA_ATENDIMENTO = 'atendimento';
export const CATEGORIA_DESENVOLVIMENTO = 'desenvolvimento';
export const CATEGORIA_IMPLANTACAO = 'implantacao';
export const CATEGORIA_OUTRO = 'outro';

// Mapeia o tipo gravado na TimeEntry para a categoria canonica
export function categorizarTipo(tipo: string): string {
  const t = (tipo || '').toLowerCase();
  if (t === 'dev' || t.includes('desenvolvimento')) return CATEGORIA_DESENVOLVIMENTO;
  if (t === 'implantacao' || t.includes('implantac')) return CATEGORIA_IMPLANTACAO;
  if (t === 'atendimento' || t === 'suporte' || t === 'treinamento' || t === 'reuniao') return CATEGORIA_ATENDIMENTO;
  return CATEGORIA_OUTRO;
}

// Infere o tipo da tarefa criada dentro do ticket a partir do departamento
export function inferirTipoDeDepartamento(slugOrNome?: string): string {
  const s = (slugOrNome || '').toLowerCase();
  if (s.includes('dev') || s.includes('desenvolvimento')) return 'dev';
  if (s.includes('implant')) return 'implantacao';
  if (s.includes('treinament') || s.includes('treino')) return 'treinamento';
  return 'suporte';
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
    await stopTimer(running.id, input.usuarioId);
  }

  // Infere o tipo a partir da tarefa, quando vinculada e sem tipo explicito
  let tipo = input.tipo || 'suporte';
  if (input.tarefaId && !input.tipo) {
    const task = await prisma.kanbanTask.findUnique({
      where: { id: input.tarefaId },
      select: { tipoTarefa: true, departamento: { select: { slug: true, nome: true } } },
    });
    tipo = inferirTipoDeDepartamento(task?.departamento?.slug || task?.departamento?.nome);
    if (task?.tipoTarefa && ['dev', 'implantacao', 'atendimento'].includes(task.tipoTarefa)) {
      tipo = task.tipoTarefa === 'dev' ? 'dev' : task.tipoTarefa === 'implantacao' ? 'implantacao' : 'suporte';
    }
  }

  const entry = await prisma.timeEntry.create({
    data: {
      usuarioId: input.usuarioId,
      ticketId: input.ticketId || null,
      orderId: input.orderId || null,
      projectId: input.projectId || null,
      clienteId: input.clienteId || null,
      tarefaId: input.tarefaId || null,
      setorId: input.setorId || null,
      tipo,
      descricao: input.descricao || null,
      dataInicio: input.dataInicio ? new Date(input.dataInicio) : new Date(),
      billable: input.billable ?? true,
      tags: input.tags || [],
    },
    include: {
      ticket: { select: { id: true, assunto: true, protocolo: true } },
      order: { select: { id: true, numeroOs: true, tipoServico: true } },
      tarefa: { select: { id: true, titulo: true, numero: true } },
    },
  });

  await registrarBloco(entry.id, 'inicio', input.usuarioId);
  await logAudit({
    usuarioId: input.usuarioId,
    modulo: 'Tarefas',
    entidade: 'TimeEntry',
    entidadeId: entry.id,
    acao: 'iniciar_tempo',
    descricao: input.tarefaId ? 'Início de tempo em tarefa' : 'Início de tempo',
    origem: 'web',
    metadata: { tarefaId: input.tarefaId ?? null, tipo },
  });

  return entry;
}

// ── Pause timer ──────────────────────────────────────────────────────

export async function pauseTimer(id: string, usuarioId?: string, motivo?: string) {
  const entry = await prisma.timeEntry.findUnique({ where: { id } });
  if (!entry) throw new Error('TimeEntry nao encontrado');
  if (entry.dataFim) throw new Error('Timer ja foi finalizado');
  if (entry.pausado) throw new Error('Timer ja esta pausado');

  await prisma.timeEntry.update({
    where: { id },
    data: { pausado: true, pausadoEm: new Date() },
  });
  await registrarBloco(entry.id, 'pausa', usuarioId ?? null, motivo || null);
  await logAudit({
    usuarioId: usuarioId ?? entry.usuarioId,
    modulo: 'Tarefas',
    entidade: 'TimeEntry',
    entidadeId: entry.id,
    acao: 'pausar_tempo',
    descricao: 'Tempo pausado',
    motivo: motivo ?? undefined,
    origem: 'web',
  });
  return prisma.timeEntry.findUnique({ where: { id } });
}

// ── Resume timer ─────────────────────────────────────────────────────

export async function resumeTimer(id: string, usuarioId?: string, motivo?: string) {
  const entry = await prisma.timeEntry.findUnique({ where: { id } });
  if (!entry) throw new Error('TimeEntry nao encontrado');
  if (entry.dataFim) throw new Error('Timer ja foi finalizado');
  if (!entry.pausado) throw new Error('Timer nao esta pausado');

  let pausadoTotalMin = entry.pausadoTotalMin || 0;
  if (entry.pausadoEm) {
    pausadoTotalMin += Math.max(0, Math.round((Date.now() - new Date(entry.pausadoEm).getTime()) / 60000));
  }

  await prisma.timeEntry.update({
    where: { id },
    data: { pausado: false, pausadoEm: null, pausadoTotalMin },
  });
  await registrarBloco(entry.id, 'retomada', usuarioId ?? null, motivo || null);
  await logAudit({
    usuarioId: usuarioId ?? entry.usuarioId,
    modulo: 'Tarefas',
    entidade: 'TimeEntry',
    entidadeId: entry.id,
    acao: 'retomar_tempo',
    descricao: 'Tempo retomado',
    motivo: motivo ?? undefined,
    origem: 'web',
  });
  return prisma.timeEntry.findUnique({ where: { id } });
}

// ── Stop timer ───────────────────────────────────────────────────────

export async function stopTimer(id: string, usuarioId?: string, motivo?: string) {
  const entry = await prisma.timeEntry.findUnique({ where: { id } });
  if (!entry) throw new Error('TimeEntry nao encontrado');
  if (entry.dataFim) throw new Error('Timer ja foi finalizado');

  const now = new Date();
  let pausadoTotalMin = entry.pausadoTotalMin || 0;
  if (entry.pausado && entry.pausadoEm) {
    pausadoTotalMin += Math.max(0, Math.round((now.getTime() - new Date(entry.pausadoEm).getTime()) / 60000));
  }

  const bruto = Math.round((now.getTime() - entry.dataInicio.getTime()) / 60000);
  const duracaoMin = Math.max(0, bruto - pausadoTotalMin);

  const updated = await prisma.timeEntry.update({
    where: { id },
    data: { dataFim: now, duracaoMin, pausado: false, pausadoEm: null, pausadoTotalMin },
    include: {
      ticket: { select: { id: true, assunto: true, protocolo: true } },
      order: { select: { id: true, numeroOs: true, tipoServico: true } },
      tarefa: { select: { id: true, titulo: true, numero: true } },
    },
  });

  await registrarBloco(entry.id, 'fim', usuarioId ?? entry.usuarioId, motivo || null);
  await logAudit({
    usuarioId: usuarioId ?? entry.usuarioId,
    modulo: 'Tarefas',
    entidade: 'TimeEntry',
    entidadeId: entry.id,
    acao: 'encerrar_tempo',
    descricao: `Tempo encerrado (${duracaoMin}min, pausas ${pausadoTotalMin}min)`,
    motivo: motivo ?? undefined,
    origem: 'web',
  });

  if (entry.tarefaId) {
    await sincronizarHorasTarefa(entry.tarefaId);
  }

  return updated;
}

// ── Create manual entry ──────────────────────────────────────────────

export async function createManualEntry(input: TimeEntryInput & { duracaoMin: number }) {
  const entry = await prisma.timeEntry.create({
    data: {
      usuarioId: input.usuarioId,
      ticketId: input.ticketId || null,
      orderId: input.orderId || null,
      projectId: input.projectId || null,
      clienteId: input.clienteId || null,
      tarefaId: input.tarefaId || null,
      setorId: input.setorId || null,
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
      tarefa: { select: { id: true, titulo: true, numero: true } },
    },
  });

  await registrarBloco(entry.id, 'inicio', input.usuarioId, 'apontamento manual');
  await registrarBloco(entry.id, 'fim', input.usuarioId, 'apontamento manual');

  if (entry.tarefaId) {
    await sincronizarHorasTarefa(entry.tarefaId);
  }

  return entry;
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
      tarefa: { select: { id: true, titulo: true, numero: true } },
      cliente: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
      setor: { select: { id: true, nome: true } },
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
      tarefa: { select: { id: true, titulo: true, numero: true } },
      cliente: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
      setor: { select: { id: true, nome: true } },
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

// ── Consumo por cliente (relatorio FASE 4) ──────────────────────────

export async function getConsumptionByClient(filters: {
  clienteId?: string;
  from?: string;
  to?: string;
}) {
  const where: any = { dataFim: { not: null } };
  if (filters.clienteId) where.clienteId = filters.clienteId;

  if (filters.from || filters.to) {
    where.dataInicio = {};
    if (filters.from) where.dataInicio.gte = new Date(filters.from);
    if (filters.to) where.dataInicio.lte = new Date(filters.to);
  }

  const entries = await prisma.timeEntry.findMany({
    where,
    select: {
      id: true,
      tipo: true,
      duracaoMin: true,
      dataInicio: true,
      clienteId: true,
      ticketId: true,
      tarefaId: true,
      usuario: { select: { id: true, name: true } },
      cliente: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
      ticket: { select: { id: true, protocolo: true } },
      tarefa: { select: { id: true, titulo: true } },
    },
    orderBy: { dataInicio: 'desc' },
  });

  const result: Record<
    string,
    {
      id: string;
      nome: string;
      atendimentoMin: number;
      desenvolvimentoMin: number;
      implantacaoMin: number;
      outroMin: number;
      totalMin: number;
      entradas: number;
    }
  > = {};

  for (const e of entries) {
    const clienteId = e.clienteId || 'sem-cliente';
    if (!result[clienteId]) {
      result[clienteId] = {
        id: e.cliente?.id || clienteId,
        nome: e.cliente?.razaoSocial || e.cliente?.nomeFantasia || 'Sem cliente',
        atendimentoMin: 0,
        desenvolvimentoMin: 0,
        implantacaoMin: 0,
        outroMin: 0,
        totalMin: 0,
        entradas: 0,
      };
    }
    const min = e.duracaoMin || 0;
    const cat = categorizarTipo(e.tipo);
    if (cat === CATEGORIA_ATENDIMENTO) result[clienteId].atendimentoMin += min;
    else if (cat === CATEGORIA_DESENVOLVIMENTO) result[clienteId].desenvolvimentoMin += min;
    else if (cat === CATEGORIA_IMPLANTACAO) result[clienteId].implantacaoMin += min;
    else result[clienteId].outroMin += min;
    result[clienteId].totalMin += min;
    result[clienteId].entradas++;
  }

  return Object.values(result).sort((a, b) => b.totalMin - a.totalMin);
}

// ── Blocos de tempo do ticket (timeline FASE 4) ─────────────────────

export async function getTicketTimeBlocks(ticketId: string) {
  const entries = await prisma.timeEntry.findMany({
    where: { ticketId },
    include: {
      usuario: { select: { id: true, name: true } },
      tarefa: { select: { id: true, titulo: true, numero: true } },
      setor: { select: { id: true, nome: true } },
    },
    orderBy: { dataInicio: 'desc' },
  });

  return entries.map((e) => ({
    id: e.id,
    usuario: e.usuario.name,
    tarefa: e.tarefa ? { id: e.tarefa.id, titulo: e.tarefa.titulo } : null,
    setor: e.setor ? e.setor.nome : null,
    tipo: e.tipo,
    descricao: e.descricao,
    dataInicio: e.dataInicio,
    dataFim: e.dataFim,
    duracaoMin: e.duracaoMin,
  }));
}

// ── Resumo de tempo da tarefa (spec §5/§6/§9/§10) ────────────────────

export async function getTaskTimeSummary(tarefaId: string) {
  const [entries, stageTimes] = await Promise.all([
    prisma.timeEntry.findMany({
      where: { tarefaId, dataFim: { not: null } },
      orderBy: { dataInicio: 'desc' },
      include: { usuario: { select: { id: true, name: true } } },
    }),
    prisma.kanbanStageTime.findMany({
      where: { taskId: tarefaId },
      orderBy: { dataEntrada: 'asc' },
    }),
  ]);

  const porTipo: Record<string, number> = {};
  let totalMin = 0;
  let pausasMin = 0;
  for (const e of entries) {
    const min = e.duracaoMin || 0;
    totalMin += min;
    pausasMin += e.pausadoTotalMin || 0;
    const cat = categorizarTipo(e.tipo);
    porTipo[cat] = (porTipo[cat] || 0) + min;
  }

  const porEtapa = stageTimes.map((s) => ({
    id: s.id,
    etapa: s.columnNome,
    columnId: s.columnId,
    dataEntrada: s.dataEntrada,
    dataSaida: s.dataSaida,
    duracaoMin: s.duracaoMin ?? (s.dataSaida ? Math.round((s.dataSaida.getTime() - s.dataEntrada.getTime()) / 60000) : Math.round((Date.now() - s.dataEntrada.getTime()) / 60000)),
    emAndamento: !s.dataSaida,
  }));

  return {
    totalMin,
    pausasMin,
    totalHoras: +(totalMin / 60).toFixed(2),
    porTipo,
    porEtapa,
    blocos: entries,
    desenvolvimentoMin: porTipo[CATEGORIA_DESENVOLVIMENTO] || 0,
    implantacaoMin: porTipo[CATEGORIA_IMPLANTACAO] || 0,
    atendimentoMin: porTipo[CATEGORIA_ATENDIMENTO] || 0,
    outroMin: porTipo[CATEGORIA_OUTRO] || 0,
  };
}

// ── Deteccao de sobreposicao de tempo (spec §12) ─────────────────────

export async function detectarSobreposicao(usuarioId: string, dataInicio: Date, dataFim: Date) {
  const entradas = await prisma.timeEntry.findMany({
    where: {
      usuarioId,
      dataFim: { not: null },
      NOT: { tarefaId: null },
    },
    select: { id: true, tarefaId: true, dataInicio: true, dataFim: true, duracaoMin: true },
  });

  const sobreposicoes = entradas.filter((e) => {
    if (!e.dataFim) return false;
    const a = e.dataInicio.getTime();
    const b = e.dataFim.getTime();
    const x = dataInicio.getTime();
    const y = dataFim.getTime();
    return a < y && x < b;
  });

  if (sobreposicoes.length > 0) {
    await logAudit({
      usuarioId,
      modulo: 'Tarefas',
      entidade: 'TimeEntry',
      entidadeId: null,
      acao: 'sobreposicao_tempo',
      descricao: `Sobreposição de tempo detectada: ${sobreposicoes.length} registro(s) concorrente(s)`,
      resultado: 'alerta',
      metadata: {
        novoIntervalo: { dataInicio, dataFim },
        concorrentes: sobreposicoes.map((s) => ({ id: s.id, tarefaId: s.tarefaId, dataInicio: s.dataInicio, dataFim: s.dataFim })),
      },
    });
  }

  return sobreposicoes;
}

// ── Ajuste manual de tempo auditado (spec §41/§42) ───────────────────

export async function ajustarTempo(entryId: string, novoDuracaoMin: number, motivo: string, usuarioId?: string | null) {
  const entry = await prisma.timeEntry.findUnique({ where: { id: entryId } });
  if (!entry) throw new Error('TimeEntry nao encontrado');
  if (!motivo || !motivo.trim()) throw new Error('Motivo do ajuste é obrigatório');
  if (!Number.isFinite(novoDuracaoMin) || novoDuracaoMin < 0) throw new Error('Duração inválida');

  const antigo = entry.duracaoMin ?? 0;

  await prisma.timeEntry.update({
    where: { id: entryId },
    data: { duracaoMin: novoDuracaoMin },
  });

  await registrarBloco(entry.id, 'fim', usuarioId ?? entry.usuarioId, `AJUSTE MANUAL: ${antigo}min -> ${novoDuracaoMin}min (${motivo})`);
  await logAudit({
    usuarioId: usuarioId ?? entry.usuarioId,
    modulo: 'Tarefas',
    entidade: 'TimeEntry',
    entidadeId: entryId,
    acao: 'ajuste_manual_tempo',
    descricao: 'Ajuste manual de tempo',
    valorAnterior: `${antigo}min`,
    novoValor: `${novoDuracaoMin}min`,
    motivo,
    origem: 'web',
    resultado: 'correcao',
  });

  if (entry.tarefaId) {
    await sincronizarHorasTarefa(entry.tarefaId);
  }

  return prisma.timeEntry.findUnique({ where: { id: entryId } });
}
