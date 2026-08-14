import prisma from '../../config/database';
import {
  WHERE_TICKET_RESOLVIDO,
  STATUS_ABERTO,
} from '../helpdesk/constants';

export interface DashboardExecutivoData {
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
  tendenciaDiaria: { dia: string; total: number; fechados: number }[];
  statusPorDia: { date: string; [status: string]: string | number }[];
  statuses: string[];
  porEtapa: { etapa: string; total: number }[];
  porCanal: { canal: string; total: number }[];
  porCategoria: { categoria: string; total: number }[];
  porDepartamento: { departamento: string; total: number; fechados: number }[];
  porAgente: { agente: string; atendidos: number; fechados: number; tempoMedioMin: number; csatMedio: number }[];
  tempoMedioPorFila: { fila: string; tempoMedioMin: number; total: number }[];
  csatTrending: { date: string; media: number; total: number }[];
  comparativo: {
    deltaTickets: number;
    deltaFechados: number;
    deltaTempoResposta: number;
    deltaCsat: number;
  };
}

function range(dias: number): { inicio: Date; fim: Date } {
  const fim = new Date();
  fim.setHours(23, 59, 59, 999);
  const inicio = new Date(fim);
  inicio.setDate(fim.getDate() - (dias - 1));
  inicio.setHours(0, 0, 0, 0);
  return { inicio, fim };
}

function previousRange(fim: Date, dias: number): { inicio: Date; fim: Date } {
  const fimPrev = new Date(fim);
  fimPrev.setDate(fimPrev.getDate() - dias);
  fimPrev.setHours(23, 59, 59, 999);
  const inicio = new Date(fimPrev);
  inicio.setDate(fimPrev.getDate() - (dias - 1));
  inicio.setHours(0, 0, 0, 0);
  return { inicio, fim };
}

function dayKey(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export async function gerarDashboardExecutivo(dias = 30): Promise<DashboardExecutivoData> {
  const { inicio, fim } = range(dias);
  const { inicio: iniPrev, fim: fimPrev } = previousRange(fim, dias);

  const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const label = `${fmt(inicio)} a ${fmt(fim)} (${dias}d)`;

  // ── Resumo (período atual + anterior) ───────────────────────────
  const [
    totalTickets, ticketsFechados, ticketsAbertos, slaData, csatData, fcrData,
    respostas, resolucoes, fechadosPrev, totalPrev, csatPrev, slaPrev,
  ] = await Promise.all([
    prisma.ticket.count({ where: { createdAt: { gte: inicio, lte: fim } } }),
    prisma.ticket.count({
      where: { createdAt: { gte: inicio, lte: fim }, ...WHERE_TICKET_RESOLVIDO },
    }),
    prisma.ticket.count({ where: { status: { in: [...STATUS_ABERTO] } } }),
    prisma.ticket.aggregate({
      where: { createdAt: { gte: inicio, lte: fim }, slaTotalMinutos: { not: null } },
      _count: { id: true },
    }),
    prisma.cSATResposta.aggregate({
      where: { respondidoEm: { gte: inicio, lte: fim }, nota: { not: null } },
      _avg: { nota: true },
      _count: { id: true },
    }),
    prisma.ticket.count({
      where: { createdAt: { gte: inicio, lte: fim }, ...WHERE_TICKET_RESOLVIDO, dataPrimeiraResposta: { not: null } },
    }),
    prisma.ticket.findMany({
      where: { createdAt: { gte: inicio, lte: fim }, dataPrimeiraResposta: { not: null } },
      select: { dataAbertura: true, dataPrimeiraResposta: true },
    }),
    prisma.ticket.findMany({
      where: { createdAt: { gte: inicio, lte: fim }, dataFechamento: { not: null } },
      select: { dataAbertura: true, dataFechamento: true, slaPausadoTotalMin: true },
    }),
    prisma.ticket.count({
      where: { createdAt: { gte: iniPrev, lte: fimPrev }, ...WHERE_TICKET_RESOLVIDO },
    }),
    prisma.ticket.count({ where: { createdAt: { gte: iniPrev, lte: fimPrev } } }),
    prisma.cSATResposta.aggregate({
      where: { respondidoEm: { gte: iniPrev, lte: fimPrev }, nota: { not: null } },
      _avg: { nota: true },
    }),
    prisma.ticket.aggregate({
      where: { createdAt: { gte: iniPrev, lte: fimPrev }, slaTotalMinutos: { not: null } },
      _count: { id: true },
    }),
  ]);

  const somaResp = respostas.reduce((acc, t) => acc + Math.max(0, (t.dataPrimeiraResposta!.getTime() - t.dataAbertura.getTime()) / 60000), 0);
  const tempoMedioRespostaMin = respostas.length > 0 ? Math.round(somaResp / respostas.length) : 0;

  const somaRes = resolucoes.reduce((acc, t) => {
    const pausaMs = (t.slaPausadoTotalMin || 0) * 60 * 1000;
    return acc + Math.max(0, (t.dataFechamento!.getTime() - t.dataAbertura.getTime() - pausaMs) / 3600000);
  }, 0);
  const tempoMedioResolucaoH = resolucoes.length > 0 ? Math.round((somaRes / resolucoes.length) * 10) / 10 : 0;

  const taxaSla = slaData._count.id > 0 ? Math.round((slaData._count.id / slaData._count.id) * 100) : 0;
  const csatMedio = csatData._avg.nota ? Math.round(csatData._avg.nota * 100) / 100 : 0;
  const fcr = totalTickets > 0 ? Math.round((fcrData / totalTickets) * 100) : 0;
  const taxaResolucao = totalTickets > 0 ? Math.round((ticketsFechados / totalTickets) * 100) : 0;

  const csatAnterior = csatPrev._avg.nota ? Math.round(csatPrev._avg.nota * 100) / 100 : 0;
  const respPrev = await prisma.ticket.findMany({
    where: { createdAt: { gte: iniPrev, lte: fimPrev }, dataPrimeiraResposta: { not: null } },
    select: { dataAbertura: true, dataPrimeiraResposta: true },
  });
  const somaRespPrev = respPrev.reduce((acc, t) => acc + Math.max(0, (t.dataPrimeiraResposta!.getTime() - t.dataAbertura.getTime()) / 60000), 0);
  const tempoRespPrev = respPrev.length > 0 ? Math.round(somaRespPrev / respPrev.length) : 0;

  // ── Agrupamentos do período ─────────────────────────────────────
  const [porEtapa, porCanal, porCategoria, deptGroups, agentGroups] = await Promise.all([
    prisma.ticket.groupBy({
      by: ['etapa'], where: { createdAt: { gte: inicio, lte: fim } }, _count: { id: true },
    }),
    prisma.ticket.groupBy({
      by: ['canal'], where: { createdAt: { gte: inicio, lte: fim } }, _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    }),
    prisma.ticket.groupBy({
      by: ['categoria'], where: { createdAt: { gte: inicio, lte: fim }, categoria: { not: null } },
      _count: { id: true }, orderBy: { _count: { id: 'desc' } }, take: 10,
    }),
    prisma.ticket.groupBy({
      by: ['departamentoId'], where: { createdAt: { gte: inicio, lte: fim }, departamentoId: { not: null } },
      _count: { id: true }, orderBy: { _count: { id: 'desc' } },
    }),
    prisma.ticket.groupBy({
      by: ['assigneeId'], where: { createdAt: { gte: inicio, lte: fim }, assigneeId: { not: null } },
      _count: { id: true }, orderBy: { _count: { id: 'desc' } }, take: 15,
    }),
  ]);

  const deptIds = deptGroups.map(d => d.departamentoId!);
  const agentIds = agentGroups.map(a => a.assigneeId!);

  const [depts, users, deptClosed, agentClosed, agentTimes, agentCsat, filaData] = await Promise.all([
    prisma.departamento.findMany({ where: { id: { in: deptIds } }, select: { id: true, nome: true } }),
    prisma.user.findMany({ where: { id: { in: agentIds } }, select: { id: true, name: true } }),
    prisma.ticket.groupBy({
      by: ['departamentoId'],
      where: { departamentoId: { in: deptIds }, createdAt: { gte: inicio, lte: fim }, ...WHERE_TICKET_RESOLVIDO },
      _count: { id: true },
    }),
    prisma.ticket.groupBy({
      by: ['assigneeId'],
      where: { assigneeId: { in: agentIds }, createdAt: { gte: inicio, lte: fim }, ...WHERE_TICKET_RESOLVIDO },
      _count: { id: true },
    }),
    prisma.ticket.findMany({
      where: { assigneeId: { in: agentIds }, createdAt: { gte: inicio, lte: fim }, dataFechamento: { not: null } },
      select: { assigneeId: true, dataAbertura: true, dataFechamento: true, slaPausadoTotalMin: true },
    }),
    prisma.cSATResposta.groupBy({
      by: ['ticketId'],
      where: { ticket: { assigneeId: { in: agentIds } }, respondidoEm: { gte: inicio, lte: fim }, nota: { not: null } },
      _avg: { nota: true },
    }),
    prisma.ticket.findMany({
      where: { dataFechamento: { not: null, gte: inicio, lte: fim }, idFila: { not: null } },
      select: { idFila: true, dataAbertura: true, dataFechamento: true, slaPausadoTotalMin: true },
    }),
  ]);

  const deptMap = new Map(depts.map(d => [d.id, d.nome]));
  const userMap = new Map(users.map(u => [u.id, u.name]));
  const deptClosedMap = new Map(deptClosed.map(c => [c.departamentoId, c._count.id]));
  const agentClosedMap = new Map(agentClosed.map(c => [c.assigneeId, c._count.id]));

  const agentTimeMap = new Map<string, { soma: number; count: number }>();
  for (const t of agentTimes) {
    if (!t.assigneeId) continue;
    const pausaMs = (t.slaPausadoTotalMin || 0) * 60 * 1000;
    const min = Math.max(0, (t.dataFechamento!.getTime() - t.dataAbertura.getTime() - pausaMs) / 60000);
    const prev = agentTimeMap.get(t.assigneeId) || { soma: 0, count: 0 };
    prev.soma += min;
    prev.count += 1;
    agentTimeMap.set(t.assigneeId, prev);
  }

  const agentTickets = await prisma.ticket.findMany({
    where: { assigneeId: { in: agentIds }, createdAt: { gte: inicio, lte: fim } },
    select: { id: true, assigneeId: true },
  });
  const ticketAgentMap = new Map(agentTickets.map(t => [t.id, t.assigneeId]));
  const agentCsatMap = new Map<string, number[]>();
  for (const c of agentCsat) {
    const aid = ticketAgentMap.get(c.ticketId);
    if (aid && c._avg.nota) {
      const list = agentCsatMap.get(aid) || [];
      list.push(c._avg.nota);
      agentCsatMap.set(aid, list);
    }
  }

  const filaIds = Array.from(new Set(filaData.map(f => f.idFila!).filter(Boolean)));
  const filas = await prisma.fila.findMany({ where: { id: { in: filaIds } }, select: { id: true, nome: true } });
  const filaMap = new Map(filas.map(f => [f.id, f.nome]));
  const filaTimes = new Map<string, number[]>();
  for (const t of filaData) {
    const fid = t.idFila!;
    const pausaMs = (t.slaPausadoTotalMin || 0) * 60 * 1000;
    const min = Math.max(0, (t.dataFechamento!.getTime() - t.dataAbertura.getTime() - pausaMs) / 60000);
    const list = filaTimes.get(fid) || [];
    list.push(min);
    filaTimes.set(fid, list);
  }

  // ── Tendência diária ────────────────────────────────────────────
  const daily = await prisma.ticket.findMany({
    where: { createdAt: { gte: inicio, lte: fim } },
    select: { createdAt: true, status: true, etapa: true },
    orderBy: { createdAt: 'asc' },
  });

  const tendenciaMap = new Map<string, { total: number; fechados: number }>();
  const statusMap = new Map<string, Record<string, number>>();
  const statusesSet = new Set<string>();

  const current = new Date(inicio);
  while (current <= fim) {
    const k = dayKey(current);
    tendenciaMap.set(k, { total: 0, fechados: 0 });
    current.setDate(current.getDate() + 1);
  }

  for (const t of daily) {
    const k = dayKey(t.createdAt);
    const entry = tendenciaMap.get(k);
    if (entry) {
      entry.total += 1;
      const isFechado = (t.status === 'fechado' || t.etapa === 'concluido');
      if (isFechado) entry.fechados += 1;
    }
    statusesSet.add(t.status);
    if (!statusMap.has(k)) statusMap.set(k, {});
    const st = statusMap.get(k)!;
    st[t.status] = (st[t.status] || 0) + 1;
  }

  const tendenciaDiaria = Array.from(tendenciaMap.entries()).map(([dia, v]) => ({ dia, ...v }));
  const statusPorDia = Array.from(statusMap.entries()).map(([date, st]) => ({ date, ...st }));
  const statuses = Array.from(statusesSet);

  // ── CSAT trending ───────────────────────────────────────────────
  const csatRows = await prisma.cSATResposta.findMany({
    where: { respondidoEm: { not: null, gte: inicio, lte: fim }, nota: { not: null } },
    select: { nota: true, respondidoEm: true },
    orderBy: { respondidoEm: 'asc' },
  });
  const csatDayMap = new Map<string, { total: number; soma: number }>();
  for (const r of csatRows) {
    const date = r.respondidoEm!.toISOString().split('T')[0];
    const e = csatDayMap.get(date) || { total: 0, soma: 0 };
    e.total += 1;
    e.soma += r.nota || 0;
    csatDayMap.set(date, e);
  }
  const csatTrending = Array.from(csatDayMap.entries()).map(([date, d]) => ({
    date,
    media: Math.round((d.soma / d.total) * 100) / 100,
    total: d.total,
  }));

  return {
    atualizadoEm: new Date().toISOString(),
    periodo: { inicio, fim, label, dias },
    resumo: {
      totalTickets,
      ticketsFechados,
      ticketsAbertos,
      taxaResolucao,
      tempoMedioRespostaMin,
      tempoMedioResolucaoH,
      slaCumprido: slaData._count.id,
      slaTotal: slaData._count.id,
      taxaSla,
      csatMedio,
      csatTotal: csatData._count.id,
      fcr,
    },
    tendenciaDiaria,
    statusPorDia,
    statuses,
    porEtapa: porEtapa.map(e => ({ etapa: e.etapa || 'sem_etapa', total: e._count.id })),
    porCanal: porCanal.map(c => ({ canal: c.canal || 'Desconhecido', total: c._count.id })),
    porCategoria: porCategoria.map(c => ({ categoria: c.categoria!, total: c._count.id })),
    porDepartamento: deptGroups.map(d => ({
      departamento: deptMap.get(d.departamentoId!) || 'Sem departamento',
      total: d._count.id,
      fechados: deptClosedMap.get(d.departamentoId!) || 0,
    })),
    porAgente: agentGroups.map(a => {
      const aid = a.assigneeId!;
      const tm = agentTimeMap.get(aid);
      const scores = agentCsatMap.get(aid) || [];
      const csatAgente = scores.length > 0 ? Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 100) / 100 : 0;
      return {
        agente: userMap.get(aid) || 'Desconhecido',
        atendidos: a._count.id,
        fechados: agentClosedMap.get(aid) || 0,
        tempoMedioMin: tm?.count ? Math.round(tm.soma / tm.count) : 0,
        csatMedio: csatAgente,
      };
    }),
    tempoMedioPorFila: Array.from(filaTimes.entries()).map(([id, times]) => ({
      fila: filaMap.get(id) || 'Sem fila',
      tempoMedioMin: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
      total: times.length,
    })),
    csatTrending,
    comparativo: {
      deltaTickets: totalTickets - totalPrev,
      deltaFechados: ticketsFechados - fechadosPrev,
      deltaTempoResposta: tempoMedioRespostaMin - tempoRespPrev,
      deltaCsat: Math.round((csatMedio - csatAnterior) * 100) / 100,
    },
  };
}
