import { Prisma } from '@prisma/client';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import prisma from '../../config/database';
import {
  WHERE_TICKET_RESOLVIDO,
  STATUS_ABERTO,
} from '../helpdesk/constants';

// ── Filtros combinados de relatório ─────────────────────────────────────
// Relatório analítico genérico: todos os filtros são opcionais e combináveis.

export interface RelatorioFiltros {
  inicio?: Date;
  fim?: Date;
  filaId?: string;
  canal?: string;
  prioridade?: string;
  status?: string;
  etapa?: string;
  departamentoId?: string;
  analistaId?: string;
  clienteId?: string;
  categoria?: string;
  assunto?: string;
}

export interface RelatorioAnalitico {
  atualizadoEm: string;
  periodo: { inicio: Date; fim: Date; label: string; dias: number };
  resumo: {
    totalTickets: number;
    ticketsFechados: number;
    ticketsAbertos: number;
    taxaResolucao: number;
    tempoMedioRespostaMin: number;
    tempoMedioResolucaoH: number;
    slaCumprido: number;
    slaTotal: number;
    taxaSla: number;
    csatMedio: number;
    csatTotal: number;
    fcr: number;
  };
  comparativo: {
    deltaTickets: number;
    deltaFechados: number;
    deltaTempoResposta: number;
    deltaTempoResolucao: number;
    deltaCsat: number;
    deltaSla: number;
    deltaFcr: number;
  };
  tendenciaDiaria: { dia: string; total: number; fechados: number }[];
  porCanal: { valor: string; total: number }[];
  porPrioridade: { valor: string; total: number }[];
  porStatus: { valor: string; total: number }[];
  porCategoria: { valor: string; total: number; fechados: number }[];
  porDepartamento: { valor: string; total: number; fechados: number }[];
  porFila: { valor: string; total: number; fechados: number }[];
  porAnalista: { valor: string; atendidos: number; fechados: number; tempoMedioMin: number; csatMedio: number }[];
  porCliente: { valor: string; total: number; fechados: number }[];
  porAssunto: { valor: string; total: number }[];
  tempoPorTipo: { valor: string; totalMin: number; qtd: number }[];
  tempoPorDepartamento: { valor: string; totalMin: number }[];
  horasDev: { totalH: number; porTicket: number };
  implantacoes: {
    total: number;
    concluidas: number;
    mediaHorasDev: number;
    horasSuporteTotal: number;
  };
}

// ── Helpers de período ──────────────────────────────────────────────────

function rangeDefault(): { inicio: Date; fim: Date } {
  const fim = new Date();
  fim.setHours(23, 59, 59, 999);
  const inicio = new Date(fim);
  inicio.setDate(fim.getDate() - 29);
  inicio.setHours(0, 0, 0, 0);
  return { inicio, fim };
}

function previousRange(inicio: Date, fim: Date): { inicio: Date; fim: Date } {
  const dias = Math.max(1, Math.round((fim.getTime() - inicio.getTime()) / 86400000));
  const fimPrev = new Date(inicio);
  fimPrev.setDate(fimPrev.getDate() - 1);
  fimPrev.setHours(23, 59, 59, 999);
  const inicioPrev = new Date(fimPrev);
  inicioPrev.setDate(fimPrev.getDate() - (dias - 1));
  inicioPrev.setHours(0, 0, 0, 0);
  return { inicio: inicioPrev, fim: fimPrev };
}

function dayKey(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function fmtPeriod(inicio: Date, fim: Date): string {
  const f = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return `${f(inicio)} a ${f(fim)}`;
}

// ── Construção do WHERE combinado ───────────────────────────────────────

export function buildWhere(filtros: RelatorioFiltros): Prisma.TicketWhereInput {
  const where: Prisma.TicketWhereInput = {};

  if (filtros.inicio || filtros.fim) {
    where.createdAt = {};
    if (filtros.inicio) where.createdAt.gte = filtros.inicio;
    if (filtros.fim) where.createdAt.lte = filtros.fim;
  }
  if (filtros.filaId) where.idFila = filtros.filaId;
  if (filtros.canal) where.canal = filtros.canal;
  if (filtros.prioridade) where.prioridade = filtros.prioridade;
  if (filtros.status) where.status = filtros.status;
  if (filtros.etapa) where.etapa = filtros.etapa;
  if (filtros.departamentoId) where.departamentoId = filtros.departamentoId;
  if (filtros.analistaId) where.assigneeId = filtros.analistaId;
  if (filtros.clienteId) where.clientId = filtros.clienteId;
  if (filtros.categoria) where.categoria = filtros.categoria;
  if (filtros.assunto) where.assunto = { contains: filtros.assunto, mode: 'insensitive' };

  return where;
}

// ── Resumo ──────────────────────────────────────────────────────────────

async function coletarResumo(where: Prisma.TicketWhereInput) {
  const [totalTickets, ticketsFechados, ticketsAbertos, slaData, csatData, fcrData, respostas, resolucoes] = await Promise.all([
    prisma.ticket.count({ where }),
    prisma.ticket.count({ where: { ...where, ...WHERE_TICKET_RESOLVIDO } }),
    prisma.ticket.count({ where: { ...where, status: { in: [...STATUS_ABERTO] } } }),
    prisma.ticket.aggregate({ where: { ...where, slaTotalMinutos: { not: null } }, _count: { id: true } }),
    prisma.cSATResposta.aggregate({
      where: { respondidoEm: { not: null }, nota: { not: null }, ticket: where },
      _avg: { nota: true },
      _count: { id: true },
    }),
    prisma.ticket.count({
      where: { ...where, ...WHERE_TICKET_RESOLVIDO, dataPrimeiraResposta: { not: null } },
    }),
    prisma.ticket.findMany({
      where: { ...where, dataPrimeiraResposta: { not: null } },
      select: { dataAbertura: true, dataPrimeiraResposta: true },
    }),
    prisma.ticket.findMany({
      where: { ...where, dataFechamento: { not: null } },
      select: { dataAbertura: true, dataFechamento: true, slaPausadoTotalMin: true },
    }),
  ]);

  const somaResp = respostas.reduce((acc, t) => acc + Math.max(0, (t.dataPrimeiraResposta!.getTime() - t.dataAbertura.getTime()) / 60000), 0);
  const tempoMedioRespostaMin = respostas.length > 0 ? Math.round(somaResp / respostas.length) : 0;

  const somaRes = resolucoes.reduce((acc, t) => {
    const pausaMs = (t.slaPausadoTotalMin || 0) * 60 * 1000;
    return acc + Math.max(0, (t.dataFechamento!.getTime() - t.dataAbertura.getTime() - pausaMs) / 3600000);
  }, 0);
  const tempoMedioResolucaoH = resolucoes.length > 0 ? Math.round((somaRes / resolucoes.length) * 10) / 10 : 0;

  const slaViolado = await prisma.ticket.count({ where: { ...where, slaTotalMinutos: { gt: 60 } } });

  const taxaResolucao = totalTickets > 0 ? Math.round((ticketsFechados / totalTickets) * 100) : 0;
  const taxaSla = slaData._count.id > 0 ? Math.round(((slaData._count.id - slaViolado) / slaData._count.id) * 100) : 0;
  const fcr = totalTickets > 0 ? Math.round((fcrData / totalTickets) * 100) : 0;

  return {
    totalTickets,
    ticketsFechados,
    ticketsAbertos,
    taxaResolucao,
    tempoMedioRespostaMin,
    tempoMedioResolucaoH,
    slaCumprido: slaData._count.id - slaViolado,
    slaTotal: slaData._count.id,
    taxaSla,
    csatMedio: csatData._avg.nota ? Math.round(csatData._avg.nota * 100) / 100 : 0,
    csatTotal: csatData._count.id,
    fcr,
  };
}

// ── Agrupamentos ────────────────────────────────────────────────────────

async function coletarPorGrupo(where: Prisma.TicketWhereInput, campo: 'canal' | 'prioridade' | 'status' | 'categoria' | 'assunto') {
  const rows = await prisma.ticket.groupBy({
    by: [campo],
    where,
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 15,
  });
  return rows
    .filter(r => r[campo])
    .map(r => ({ valor: String(r[campo]), total: r._count.id }));
}

async function coletarPorDepartamento(where: Prisma.TicketWhereInput) {
  const rows = await prisma.ticket.groupBy({
    by: ['departamentoId'],
    where: { ...where, departamentoId: { not: null } },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });
  const ids = rows.map(r => r.departamentoId!);
  const [depts, fechados] = await Promise.all([
    prisma.departamento.findMany({ where: { id: { in: ids } }, select: { id: true, nome: true } }),
    prisma.ticket.groupBy({
      by: ['departamentoId'],
      where: { ...where, departamentoId: { in: ids }, ...WHERE_TICKET_RESOLVIDO },
      _count: { id: true },
    }),
  ]);
  const nomeMap = new Map(depts.map(d => [d.id, d.nome]));
  const fechMap = new Map(fechados.map(f => [f.departamentoId, f._count.id]));
  return rows.map(r => ({
    valor: nomeMap.get(r.departamentoId!) || 'Sem departamento',
    total: r._count.id,
    fechados: fechMap.get(r.departamentoId!) || 0,
  }));
}

async function coletarPorFila(where: Prisma.TicketWhereInput) {
  const rows = await prisma.ticket.groupBy({
    by: ['idFila'],
    where: { ...where, idFila: { not: null } },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });
  const ids = rows.map(r => r.idFila!);
  const [filas, fechados] = await Promise.all([
    prisma.fila.findMany({ where: { id: { in: ids } }, select: { id: true, nome: true } }),
    prisma.ticket.groupBy({
      by: ['idFila'],
      where: { ...where, idFila: { in: ids }, ...WHERE_TICKET_RESOLVIDO },
      _count: { id: true },
    }),
  ]);
  const nomeMap = new Map(filas.map(f => [f.id, f.nome]));
  const fechMap = new Map(fechados.map(f => [f.idFila, f._count.id]));
  return rows.map(r => ({
    valor: nomeMap.get(r.idFila!) || 'Sem fila',
    total: r._count.id,
    fechados: fechMap.get(r.idFila!) || 0,
  }));
}

async function coletarPorAnalista(where: Prisma.TicketWhereInput) {
  const rows = await prisma.ticket.groupBy({
    by: ['assigneeId'],
    where: { ...where, assigneeId: { not: null } },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 15,
  });
  const ids = rows.map(r => r.assigneeId!);
  const [users, fechados, tempos, csat] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),
    prisma.ticket.groupBy({
      by: ['assigneeId'],
      where: { ...where, assigneeId: { in: ids }, ...WHERE_TICKET_RESOLVIDO },
      _count: { id: true },
    }),
    prisma.ticket.findMany({
      where: { ...where, assigneeId: { in: ids }, dataFechamento: { not: null } },
      select: { assigneeId: true, dataAbertura: true, dataFechamento: true, slaPausadoTotalMin: true },
    }),
    prisma.cSATResposta.groupBy({
      by: ['ticketId'],
      where: { respondidoEm: { not: null }, nota: { not: null }, ticket: where },
      _avg: { nota: true },
    }),
  ]);

  const nomeMap = new Map(users.map(u => [u.id, u.name]));
  const fechMap = new Map(fechados.map(f => [f.assigneeId, f._count.id]));
  const tempoMap = new Map<string, { soma: number; count: number }>();
  for (const t of tempos) {
    if (!t.assigneeId) continue;
    const pausaMs = (t.slaPausadoTotalMin || 0) * 60 * 1000;
    const min = Math.max(0, (t.dataFechamento!.getTime() - t.dataAbertura.getTime() - pausaMs) / 60000);
    const prev = tempoMap.get(t.assigneeId) || { soma: 0, count: 0 };
    prev.soma += min;
    prev.count += 1;
    tempoMap.set(t.assigneeId, prev);
  }

  const tickets = await prisma.ticket.findMany({ where, select: { id: true, assigneeId: true } });
  const ticketAgentMap = new Map(tickets.map(t => [t.id, t.assigneeId]));
  const csatMap = new Map<string, number[]>();
  for (const c of csat) {
    const aid = ticketAgentMap.get(c.ticketId);
    if (aid && c._avg.nota) {
      const list = csatMap.get(aid) || [];
      list.push(c._avg.nota);
      csatMap.set(aid, list);
    }
  }

  return rows.map(r => {
    const aid = r.assigneeId!;
    const tm = tempoMap.get(aid);
    const scores = csatMap.get(aid) || [];
    return {
      valor: nomeMap.get(aid) || 'Desconhecido',
      atendidos: r._count.id,
      fechados: fechMap.get(aid) || 0,
      tempoMedioMin: tm?.count ? Math.round(tm.soma / tm.count) : 0,
      csatMedio: scores.length > 0 ? Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 100) / 100 : 0,
    };
  });
}

async function coletarPorCliente(where: Prisma.TicketWhereInput) {
  const rows = await prisma.ticket.groupBy({
    by: ['clientId'],
    where: { ...where, clientId: { not: null } },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 15,
  });
  const ids = rows.map(r => r.clientId!);
  const [clients, fechados] = await Promise.all([
    prisma.client.findMany({ where: { id: { in: ids } }, select: { id: true, razaoSocial: true, nomeFantasia: true } }),
    prisma.ticket.groupBy({
      by: ['clientId'],
      where: { ...where, clientId: { in: ids }, ...WHERE_TICKET_RESOLVIDO },
      _count: { id: true },
    }),
  ]);
  const nomeMap = new Map(clients.map(c => [c.id, c.nomeFantasia || c.razaoSocial || 'Desconhecido']));
  const fechMap = new Map(fechados.map(f => [f.clientId, f._count.id]));
  return rows.map(r => ({
    valor: nomeMap.get(r.clientId!) || 'Desconhecido',
    total: r._count.id,
    fechados: fechMap.get(r.clientId!) || 0,
  }));
}

async function coletarTendencia(where: Prisma.TicketWhereInput, inicio: Date, fim: Date) {
  const rows = await prisma.ticket.findMany({
    where,
    select: { createdAt: true, status: true, etapa: true },
    orderBy: { createdAt: 'asc' },
  });

  const mapa = new Map<string, { total: number; fechados: number }>();
  const cur = new Date(inicio);
  while (cur <= fim) {
    const k = dayKey(cur);
    mapa.set(k, { total: 0, fechados: 0 });
    cur.setDate(cur.getDate() + 1);
  }

  for (const t of rows) {
    const k = dayKey(t.createdAt);
    const e = mapa.get(k);
    if (e) {
      e.total += 1;
      const fechado = t.status === 'fechado' || t.etapa === 'concluido';
      if (fechado) e.fechados += 1;
    }
  }

  return Array.from(mapa.entries()).map(([dia, v]) => ({ dia, ...v }));
}

// ── Tempo / Desenvolvimento / Implantação (views) ───────────────────────

async function coletarTempoPorTipo(inicio: Date, fim: Date) {
  const rows = await prisma.timeEntry.groupBy({
    by: ['tipo'],
    where: { dataInicio: { gte: inicio, lte: fim }, duracaoMin: { not: null } },
    _sum: { duracaoMin: true },
    _count: { id: true },
    orderBy: { _sum: { duracaoMin: 'desc' } },
  });
  return rows
    .filter(r => r.tipo)
    .map(r => ({
      valor: r.tipo || 'outro',
      totalMin: r._sum.duracaoMin || 0,
      qtd: r._count.id,
    }));
}

async function coletarTempoPorDepartamento(inicio: Date, fim: Date) {
  const rows = await prisma.ticketDepartmentTime.groupBy({
    by: ['departamentoId'],
    where: { dataInicio: { gte: inicio, lte: fim }, duracaoMin: { not: null } },
    _sum: { duracaoMin: true },
    orderBy: { _sum: { duracaoMin: 'desc' } },
  });
  const ids = rows.map(r => r.departamentoId);
  const depts = await prisma.departamento.findMany({ where: { id: { in: ids } }, select: { id: true, nome: true } });
  const nomeMap = new Map(depts.map(d => [d.id, d.nome]));
  return rows.map(r => ({
    valor: nomeMap.get(r.departamentoId) || 'Sem departamento',
    totalMin: r._sum.duracaoMin || 0,
  }));
}

async function coletarHorasDev(inicio: Date, fim: Date) {
  const [ticketAgg, orderAgg] = await Promise.all([
    prisma.ticket.aggregate({
      where: { horasDesenvolvimento: { not: null, gt: 0 }, createdAt: { gte: inicio, lte: fim } },
      _sum: { horasDesenvolvimento: true },
      _count: { id: true },
    }),
    prisma.serviceOrder.aggregate({
      where: { horasDev: { not: null, gt: 0 }, createdAt: { gte: inicio, lte: fim } },
      _sum: { horasDev: true },
    }),
  ]);
  return {
    totalH: Math.round(((ticketAgg._sum.horasDesenvolvimento || 0) + (orderAgg._sum.horasDev || 0)) * 10) / 10,
    porTicket: ticketAgg._count.id > 0 ? Math.round(((ticketAgg._sum.horasDesenvolvimento || 0) / ticketAgg._count.id) * 10) / 10 : 0,
  };
}

async function coletarImplantacoes(inicio: Date, fim: Date) {
  const [total, concluidas, horasAgg, suporteAgg] = await Promise.all([
    prisma.serviceOrder.count({ where: { tipoImplantacao: 'implantacao', createdAt: { gte: inicio, lte: fim } } }),
    prisma.serviceOrder.count({ where: { tipoImplantacao: 'implantacao', implantacaoConcluida: true, createdAt: { gte: inicio, lte: fim } } }),
    prisma.serviceOrder.aggregate({
      where: { tipoImplantacao: 'implantacao', horasDev: { not: null, gt: 0 }, createdAt: { gte: inicio, lte: fim } },
      _sum: { horasDev: true },
      _count: { id: true },
    }),
    prisma.serviceOrder.aggregate({
      where: { tipoImplantacao: 'implantacao', horasSuporte: { not: null, gt: 0 }, createdAt: { gte: inicio, lte: fim } },
      _sum: { horasSuporte: true },
    }),
  ]);
  return {
    total,
    concluidas,
    mediaHorasDev: horasAgg._count.id > 0 ? Math.round(((horasAgg._sum.horasDev || 0) / horasAgg._count.id) * 100) / 100 : 0,
    horasSuporteTotal: Math.round((suporteAgg._sum.horasSuporte || 0) * 100) / 100,
  };
}

// ── Geração principal ───────────────────────────────────────────────────

export async function gerarRelatorioAnalitico(filtros: RelatorioFiltros = {}): Promise<RelatorioAnalitico> {
  const { inicio, fim } = (filtros.inicio && filtros.fim) ? { inicio: filtros.inicio, fim: filtros.fim } : rangeDefault();

  const filtrosRange = { ...filtros, inicio, fim };
  const where = buildWhere(filtrosRange);

  const { inicio: iniPrev, fim: fimPrev } = previousRange(inicio, fim);
  const wherePrev = buildWhere({ ...filtrosRange, inicio: iniPrev, fim: fimPrev });

  const [resumo, resumoPrev, tendenciaDiaria, porCanal, porPrioridade, porStatus, porCategoria, porDepartamento, porFila, porAnalista, porCliente, porAssunto] = await Promise.all([
    coletarResumo(where),
    coletarResumo(wherePrev),
    coletarTendencia(where, inicio, fim),
    coletarPorGrupo(where, 'canal'),
    coletarPorGrupo(where, 'prioridade'),
    coletarPorGrupo(where, 'status'),
    coletarPorGrupo(where, 'categoria'),
    coletarPorDepartamento(where),
    coletarPorFila(where),
    coletarPorAnalista(where),
    coletarPorCliente(where),
    coletarPorGrupo(where, 'assunto'),
  ]);

  const [tempoPorTipo, tempoPorDepartamento, horasDev, implantacoes] = await Promise.all([
    coletarTempoPorTipo(inicio, fim),
    coletarTempoPorDepartamento(inicio, fim),
    coletarHorasDev(inicio, fim),
    coletarImplantacoes(inicio, fim),
  ]);

  const fechados = await Promise.all([
    prisma.ticket.groupBy({
      by: ['categoria'],
      where: { ...where, categoria: { in: porCategoria.map(c => c.valor) }, ...WHERE_TICKET_RESOLVIDO },
      _count: { id: true },
    }),
  ]);
  const fechadosMap = new Map(fechados[0].map(f => [f.categoria, f._count.id]));

  const dias = Math.max(1, Math.round((fim.getTime() - inicio.getTime()) / 86400000));

  return {
    atualizadoEm: new Date().toISOString(),
    periodo: { inicio, fim, label: fmtPeriod(inicio, fim), dias },
    resumo,
    comparativo: {
      deltaTickets: resumo.totalTickets - resumoPrev.totalTickets,
      deltaFechados: resumo.ticketsFechados - resumoPrev.ticketsFechados,
      deltaTempoResposta: resumo.tempoMedioRespostaMin - resumoPrev.tempoMedioRespostaMin,
      deltaTempoResolucao: Math.round((resumo.tempoMedioResolucaoH - resumoPrev.tempoMedioResolucaoH) * 10) / 10,
      deltaCsat: Math.round((resumo.csatMedio - resumoPrev.csatMedio) * 100) / 100,
      deltaSla: resumo.taxaSla - resumoPrev.taxaSla,
      deltaFcr: resumo.fcr - resumoPrev.fcr,
    },
    tendenciaDiaria,
    porCanal,
    porPrioridade,
    porStatus,
    porCategoria: porCategoria.map(c => ({ ...c, fechados: fechadosMap.get(c.valor) || 0 })),
    porDepartamento,
    porFila,
    porAnalista,
    porCliente,
    porAssunto,
    tempoPorTipo,
    tempoPorDepartamento,
    horasDev,
    implantacoes,
  };
}

// ── Opções de filtro (dropdowns) ────────────────────────────────────────

export async function obterOpcoesFiltros() {
  const [filas, departamentos, analistas, clientes, categorias] = await Promise.all([
    prisma.fila.findMany({ select: { id: true, nome: true }, orderBy: { nome: 'asc' } }),
    prisma.departamento.findMany({ select: { id: true, nome: true }, orderBy: { nome: 'asc' } }),
    prisma.user.findMany({
      where: { active: true, role: { in: ['admin', 'gerente', 'tecnico', 'agente'] } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.client.findMany({
      where: { status: 'ativo' },
      select: { id: true, razaoSocial: true, nomeFantasia: true },
      orderBy: { razaoSocial: 'asc' },
      take: 500,
    }),
    prisma.ticket.groupBy({ by: ['categoria'], where: { categoria: { not: null } }, _count: { id: true } }),
  ]);

  return {
    filas,
    departamentos,
    analistas,
    clientes: clientes.map(c => ({ id: c.id, nome: c.nomeFantasia || c.razaoSocial })),
    canais: ['whatsapp', 'telefone', 'email', 'web', 'presencial', 'outro'],
    prioridades: ['baixa', 'media', 'alta', 'urgente'],
    statuses: ['aberto', 'em_atendimento', 'pendente', 'fechado', 'cancelado', 'arquivado', 'resolvido'],
    categorias: categorias
      .filter(c => c.categoria)
      .map(c => c.categoria as string)
      .sort(),
  };
}

// ── Exportação CSV ───────────────────────────────────────────────────────

export function gerarCsvRelatorio(dados: RelatorioAnalitico): string {
  const linhas: string[] = [];
  linhas.push('SEPARADOR=;');
  linhas.push(`Relatório Analítico;${dados.periodo.label}`);

  const r = dados.resumo;
  linhas.push('');
  linhas.push('Indicador;Valor');
  linhas.push(`Total de tickets;${r.totalTickets}`);
  linhas.push(`Resolvidos;${r.ticketsFechados}`);
  linhas.push(`Abertos;${r.ticketsAbertos}`);
  linhas.push(`Taxa de resolução (%);${r.taxaResolucao}`);
  linhas.push(`Tempo médio de resposta (min);${r.tempoMedioRespostaMin}`);
  linhas.push(`Tempo médio de resolução (h);${r.tempoMedioResolucaoH}`);
  linhas.push(`SLA cumprido (%);${r.taxaSla}`);
  linhas.push(`CSAT médio;${r.csatMedio}`);
  linhas.push(`FCR (%);${r.fcr}`);

  const secao = (titulo: string, colunas: string[], itens: any[]) => {
    if (itens.length === 0) return;
    linhas.push('');
    linhas.push(titulo);
    linhas.push(colunas.join(';'));
    for (const item of itens) {
      linhas.push(colunas.map(c => String(item[c] ?? '')).join(';'));
    }
  };

  secao('Tickets por dia', ['dia', 'total', 'fechados'], dados.tendenciaDiaria);
  secao('Por canal', ['valor', 'total'], dados.porCanal);
  secao('Por prioridade', ['valor', 'total'], dados.porPrioridade);
  secao('Por status', ['valor', 'total'], dados.porStatus);
  secao('Por categoria', ['valor', 'total', 'fechados'], dados.porCategoria);
  secao('Por departamento', ['valor', 'total', 'fechados'], dados.porDepartamento);
  secao('Por fila', ['valor', 'total', 'fechados'], dados.porFila);
  secao('Por analista', ['valor', 'atendidos', 'fechados', 'tempoMedioMin', 'csatMedio'], dados.porAnalista);
  secao('Por cliente', ['valor', 'total', 'fechados'], dados.porCliente);
  secao('Tempo por tipo', ['valor', 'totalMin', 'qtd'], dados.tempoPorTipo);
  secao('Tempo por departamento', ['valor', 'totalMin'], dados.tempoPorDepartamento);

  return linhas.join('\r\n');
}

// ── Exportação PDF (pdfkit) ─────────────────────────────────────────────

export function gerarPdfRelatorio(dados: RelatorioAnalitico): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const FONT = 'Helvetica';
    const FONT_B = 'Helvetica-Bold';
    const GRAY = '#64748b';
    const BLUE = '#2563eb';

    doc.font(FONT_B).fontSize(18).fillColor('#0f172a').text('Relatório Analítico', { align: 'center' });
    doc.font(FONT).fontSize(10).fillColor(GRAY).text(`Período: ${dados.periodo.label}`, { align: 'center' });
    doc.moveDown();

    const r = dados.resumo;
    const cards: [string, string][] = [
      ['Total de tickets', String(r.totalTickets)],
      ['Resolvidos', `${r.ticketsFechados} (${r.taxaResolucao}%)`],
      ['Abertos', String(r.ticketsAbertos)],
      ['Tempo médio resposta', `${r.tempoMedioRespostaMin} min`],
      ['Tempo médio resolução', `${r.tempoMedioResolucaoH} h`],
      ['SLA cumprido', `${r.taxaSla}%`],
      ['CSAT médio', `${r.csatMedio}/5`],
      ['FCR', `${r.fcr}%`],
    ];

    const colW = (doc.page.width - 80) / 2;
    cards.forEach(([label, valor], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 40 + col * colW;
      const y = 120 + row * 52;
      doc.roundedRect(x, y, colW - 10, 44, 6).fillAndStroke('#f8fafc', '#e2e8f0');
      doc.font(FONT_B).fontSize(16).fillColor(BLUE).text(valor, x + 12, y + 6, { width: colW - 34 });
      doc.font(FONT).fontSize(8).fillColor(GRAY).text(label, x + 12, y + 26, { width: colW - 34 });
    });

    doc.y = 330;

    const tabela = (titulo: string, headers: string[], linhas: any[]) => {
      if (linhas.length === 0 || doc.y > doc.page.height - 120) return;
      doc.moveDown();
      doc.font(FONT_B).fontSize(11).fillColor('#0f172a').text(titulo);
      doc.moveDown(0.3);

      const widths = headers.map((_, i) => (doc.page.width - 80) / headers.length);
      let y = doc.y;
      doc.font(FONT_B).fontSize(8).fillColor('#fff');
      headers.forEach((h, i) => {
        doc.rect(40 + widths.slice(0, i).reduce((a, b) => a + b, 0), y, widths[i], 16).fill(BLUE);
        doc.fillColor('#fff').text(h, 44 + widths.slice(0, i).reduce((a, b) => a + b, 0), y + 4, { width: widths[i] - 8 });
      });
      y += 16;

      doc.font(FONT).fontSize(8).fillColor('#0f172a');
      for (const row of linhas) {
        if (y > doc.page.height - 40) {
          doc.addPage();
          y = 40;
        }
        doc.rect(40, y, doc.page.width - 80, 14).fill('#ffffff');
        headers.forEach((h, i) => {
          doc.text(String(row[h] ?? ''), 44 + widths.slice(0, i).reduce((a, b) => a + b, 0), y + 3, { width: widths[i] - 8 });
        });
        y += 14;
      }
      doc.y = y;
    };

    tabela('Tickets por dia', ['dia', 'total', 'fechados'], dados.tendenciaDiaria);
    tabela('Por canal', ['valor', 'total'], dados.porCanal);
    tabela('Por categoria', ['valor', 'total', 'fechados'], dados.porCategoria);
    tabela('Por analista', ['valor', 'atendidos', 'fechados', 'tempoMedioMin', 'csatMedio'], dados.porAnalista);
    tabela('Por cliente', ['valor', 'total', 'fechados'], dados.porCliente);
    tabela('Tempo por tipo', ['valor', 'totalMin', 'qtd'], dados.tempoPorTipo);

    doc.end();
  });
}

// ── Exportação Excel (exceljs) ──────────────────────────────────────────

function estiloCabecalho(ws: ExcelJS.Worksheet, colunas: string[]) {
  ws.addRow(colunas).eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    cell.alignment = { vertical: 'middle' };
  });
  const lastRow = ws.lastRow;
  if (lastRow) lastRow.height = 20;
}

function adicionarSecao(ws: ExcelJS.Worksheet, titulo: string, colunas: string[], itens: any[]) {
  ws.addRow([]);
  ws.addRow([titulo]).eachCell(cell => {
    cell.font = { bold: true, size: 12, color: { argb: 'FF0F172A' } };
  });
  if (itens.length === 0) return;
  estiloCabecalho(ws, colunas);
  for (const item of itens) {
    ws.addRow(colunas.map(c => item[c] ?? ''));
  }
  ws.getColumn(1).width = 40;
}

export async function gerarExcelRelatorio(dados: RelatorioAnalitico): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Codemed Hub';
  wb.created = new Date();

  // Planilha 1 — Resumo
  const wsResumo = wb.addWorksheet('Resumo');
  wsResumo.addRow(['Relatório Analítico']).eachCell(cell => {
    cell.font = { bold: true, size: 16, color: { argb: 'FF0F172A' } };
  });
  wsResumo.addRow([`Período: ${dados.periodo.label}`]);
  wsResumo.addRow([`Gerado em: ${dados.atualizadoEm}`]);
  const r = dados.resumo;
  const indicadores: [string, any][] = [
    ['Total de tickets', r.totalTickets],
    ['Resolvidos', r.ticketsFechados],
    ['Abertos', r.ticketsAbertos],
    ['Taxa de resolução (%)', r.taxaResolucao],
    ['Tempo médio de resposta (min)', r.tempoMedioRespostaMin],
    ['Tempo médio de resolução (h)', r.tempoMedioResolucaoH],
    ['SLA cumprido (%)', r.taxaSla],
    ['CSAT médio', r.csatMedio],
    ['FCR (%)', r.fcr],
    ['Horas de desenvolvimento', dados.horasDev?.totalH ?? 0],
    ['Implantações', dados.implantacoes?.total ?? 0],
  ];
  adicionarSecao(wsResumo, 'Indicadores', ['Indicador', 'Valor'], indicadores.map(([label, valor]) => ({ Indicador: label, Valor: valor })));

  // Planilha 2 — Tendência diária
  const wsDia = wb.addWorksheet('Tendência Diária');
  adicionarSecao(wsDia, 'Tickets por dia', ['dia', 'total', 'fechados'], dados.tendenciaDiaria);

  // Planilha 3 — Distribuições
  const wsDist = wb.addWorksheet('Distribuição');
  adicionarSecao(wsDist, 'Por canal', ['valor', 'total'], dados.porCanal);
  adicionarSecao(wsDist, 'Por prioridade', ['valor', 'total'], dados.porPrioridade);
  adicionarSecao(wsDist, 'Por status', ['valor', 'total'], dados.porStatus);
  adicionarSecao(wsDist, 'Por categoria', ['valor', 'total', 'fechados'], dados.porCategoria);
  adicionarSecao(wsDist, 'Por departamento', ['valor', 'total', 'fechados'], dados.porDepartamento);
  adicionarSecao(wsDist, 'Por fila', ['valor', 'total', 'fechados'], dados.porFila);
  adicionarSecao(wsDist, 'Por assunto', ['valor', 'total'], dados.porAssunto);

  // Planilha 4 — Analistas
  const wsAnalistas = wb.addWorksheet('Analistas');
  adicionarSecao(wsAnalistas, 'Por analista', ['valor', 'atendidos', 'fechados', 'tempoMedioMin', 'csatMedio'], dados.porAnalista);

  // Planilha 5 — Clientes
  const wsClientes = wb.addWorksheet('Clientes');
  adicionarSecao(wsClientes, 'Por cliente', ['valor', 'total', 'fechados'], dados.porCliente);

  // Planilha 6 — Tempo
  const wsTempo = wb.addWorksheet('Tempo');
  adicionarSecao(wsTempo, 'Tempo por tipo', ['valor', 'totalMin', 'qtd'], dados.tempoPorTipo);
  adicionarSecao(wsTempo, 'Tempo por departamento', ['valor', 'totalMin'], dados.tempoPorDepartamento);
  adicionarSecao(wsTempo, 'Desenvolvimento', ['totalH', 'porTicket'], [{ totalH: dados.horasDev?.totalH ?? 0, porTicket: dados.horasDev?.porTicket ?? 0 }]);
  adicionarSecao(wsTempo, 'Implantação', ['total', 'concluidas', 'mediaHorasDev', 'horasSuporteTotal'], [dados.implantacoes ?? {}]);

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}