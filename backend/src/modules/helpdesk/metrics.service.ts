import prisma from '../../config/database';
import { getSlaInfoFromTicket } from './sla.service';
import { getEstatisticasCsat } from '../csat/csat.service';

export interface DashboardMetrics {
  periodo: { inicio: Date; fim: Date };
  backlog: {
    total: number;
    porEtapa: Record<string, number>;
    porPrioridade: Record<string, number>;
    porFila: Record<string, number>;
  };
  mttr: {
    mediaMinutos: number;
    medianaMinutos: number;
    p95Minutos: number;
  };
  mtfa: {
    mediaMinutos: number;
  };
  sla: {
    compliancePercentual: number;
    violados: number;
    noPrazo: number;
    total: number;
  };
  fcr: {
    percentual: number;
    primeiraResolucao: number;
    escalonados: number;
  };
  csat: {
    mediaNotas: number;
    totalRespostas: number;
    percentualResposta: number;
  };
  porAgente: Array<{
    usuarioId: string;
    nome: string;
    ticketsAtendidos: number;
    mttrMedioMin: number;
    csatMedio: number | null;
  }>;
  porCategoria: Array<{
    categoria: string;
    total: number;
    percentual: number;
  }>;
  ia?: {
    totalChamados: number;
    chamadosIaResolveu: number;
    taxaResolucaoIa: number;
    tempoMedioResolucaoIaMin: number;
    tempoMedioResolucaoHumanoMin: number;
    totalCorrecoes: number;
    confiancaMediaClassificacao: number;
  };
}

function mediana(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

function percentil(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.floor((sorted.length - 1) * p);
  return sorted[idx];
}

export async function getDashboardMetrics(
  periodoInicio?: Date,
  periodoFim?: Date
): Promise<DashboardMetrics> {
  const fim = periodoFim || new Date();
  const inicio = periodoInicio || new Date(fim.getTime() - 30 * 24 * 60 * 60 * 1000);

  const ticketsAbertos = await prisma.ticket.findMany({
    where: { status: { notIn: ['fechado', 'cancelado', 'arquivado'] } },
    include: { fila: true },
  });
  const porEtapa: Record<string, number> = {};
  const porPrioridade: Record<string, number> = {};
  const porFila: Record<string, number> = {};
  for (const t of ticketsAbertos) {
    porEtapa[t.etapa] = (porEtapa[t.etapa] || 0) + 1;
    porPrioridade[t.prioridade] = (porPrioridade[t.prioridade] || 0) + 1;
    const filaNome = t.fila?.nome || 'sem_fila';
    porFila[filaNome] = (porFila[filaNome] || 0) + 1;
  }

  const ticketsResolvidos = await prisma.ticket.findMany({
    where: {
      OR: [
        { status: { in: ['fechado', 'cancelado', 'resolvido'] } },
        { etapa: { in: ['concluido', 'descartado'] } },
      ],
      dataFechamento: { gte: inicio, lte: fim },
    },
    select: {
      id: true,
      dataAbertura: true,
      dataInicioAtendimento: true,
      dataFechamento: true,
      slaTotalMinutos: true,
      slaPausadoTotalMin: true,
      slaPausadoEm: true,
      assigneeId: true,
    },
  });

  const temposResolucao: number[] = [];
  const temposPrimeiraResposta: number[] = [];
  let noPrazo = 0;
  let violados = 0;
  for (const t of ticketsResolvidos) {
    if (t.dataFechamento && t.dataInicioAtendimento) {
      const abertura = new Date(t.dataAbertura).getTime();
      const inicio = new Date(t.dataInicioAtendimento).getTime();
      const fechamento = new Date(t.dataFechamento).getTime();
      const pausaMs = (t.slaPausadoTotalMin || 0) * 60 * 1000;
      const mttrMin = Math.max(0, (fechamento - abertura - pausaMs) / 60000);
      temposResolucao.push(mttrMin);
      const mtfaMin = Math.max(0, (inicio - abertura - pausaMs) / 60000);
      temposPrimeiraResposta.push(mtfaMin);
      if (t.slaTotalMinutos) {
        if (mttrMin <= t.slaTotalMinutos) noPrazo++;
        else violados++;
      }
    }
  }
  const totalSla = noPrazo + violados;
  const compliancePercentual = totalSla > 0 ? Math.round((noPrazo / totalSla) * 10000) / 100 : 0;

  const ticketsComEscalonamento = await prisma.ticket.findMany({
    where: {
      status: 'escalonado',
      OR: [
        { dataFechamento: { gte: inicio, lte: fim } },
        { dataFechamento: null },
      ],
    },
    select: { id: true },
  });
  const escalonados = ticketsComEscalonamento.length;
  const totalResolvidos = ticketsResolvidos.length;
  const primeiraResolucao = Math.max(0, totalResolvidos - escalonados);
  const fcrPercentual = totalResolvidos > 0 ? Math.round((primeiraResolucao / totalResolvidos) * 10000) / 100 : 0;

  const csatStats = await getEstatisticasCsat(inicio, fim);

  const ticketsPorAgente = await prisma.ticket.groupBy({
    by: ['assigneeId'],
    where: {
      assigneeId: { not: null },
      dataFechamento: { gte: inicio, lte: fim },
    },
    _count: { _all: true },
  });

  // Batch fetch users and CSAT to avoid N+1
  const agentIds = ticketsPorAgente.filter(g => g.assigneeId).map(g => g.assigneeId!);
  const [users, allCsats] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: agentIds } },
      select: { id: true, name: true },
    }),
    prisma.cSATResposta.findMany({
      where: {
        ticketId: { in: ticketsResolvidos.map(t => t.id) },
        nota: { not: null },
      },
      select: { ticketId: true, nota: true },
    }),
  ]);

  const userMap = new Map(users.map(u => [u.id, u.name]));
  const csatByTicket = new Map<string, number[]>();
  for (const c of allCsats) {
    if (!csatByTicket.has(c.ticketId)) csatByTicket.set(c.ticketId, []);
    csatByTicket.get(c.ticketId)!.push(c.nota || 0);
  }

  const porAgente: DashboardMetrics['porAgente'] = [];
  for (const grupo of ticketsPorAgente) {
    if (!grupo.assigneeId) continue;
    const userName = userMap.get(grupo.assigneeId);
    if (!userName) continue;
    const ticketsAgente = ticketsResolvidos.filter((t) => t.assigneeId === grupo.assigneeId);
    const temposAgente = ticketsAgente
      .filter((t) => t.dataFechamento && t.dataInicioAtendimento)
      .map((t) => {
        const ms = new Date(t.dataFechamento!).getTime() - new Date(t.dataInicioAtendimento!).getTime();
        return Math.max(0, ms / 60000);
      });
    const mttrMedio = temposAgente.length > 0
      ? Math.round(temposAgente.reduce((a, b) => a + b, 0) / temposAgente.length)
      : 0;

    // Compute CSAT from batch-fetched data
    const notas: number[] = [];
    for (const t of ticketsAgente) {
      const tNotas = csatByTicket.get(t.id);
      if (tNotas) notas.push(...tNotas);
    }
    const csatMedio = notas.length > 0
      ? Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 100) / 100
      : null;

    porAgente.push({
      usuarioId: grupo.assigneeId,
      nome: userName,
      ticketsAtendidos: grupo._count._all,
      mttrMedioMin: mttrMedio,
      csatMedio,
    });
  }
  porAgente.sort((a, b) => b.ticketsAtendidos - a.ticketsAtendidos);

  const ticketsPorCategoria = await prisma.ticket.groupBy({
    by: ['categoria'],
    where: { dataAbertura: { gte: inicio, lte: fim } },
    _count: { _all: true },
  });
  const totalCategoria = ticketsPorCategoria.reduce((a, b) => a + b._count._all, 0);
  const porCategoria = ticketsPorCategoria
    .map((c) => ({
      categoria: c.categoria || 'sem_categoria',
      total: c._count._all,
      percentual: totalCategoria > 0 ? Math.round((c._count._all / totalCategoria) * 10000) / 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  // ── Metricas de IA ──
  const [totalChamadosIa, chamadosIaResolveu, correcoes, classificacoes, ticketsIaResolvidos, ticketsHumanosResolvidos] = await Promise.all([
    prisma.ticket.count({
      where: { dataAbertura: { gte: inicio, lte: fim }, status: { not: 'arquivado' } },
    }),
    prisma.ticket.count({
      where: { dataAbertura: { gte: inicio, lte: fim }, resolvidoPorIa: true },
    }),
    prisma.aICorrection.count({
      where: { createdAt: { gte: inicio, lte: fim } },
    }),
    prisma.aIClassification.findMany({
      where: { createdAt: { gte: inicio, lte: fim } },
      select: { confianca: true },
    }),
    prisma.ticket.findMany({
      where: {
        dataAbertura: { gte: inicio, lte: fim },
        resolvidoPorIa: true,
        dataFechamento: { not: null },
      },
      select: { dataAbertura: true, dataFechamento: true },
    }),
    prisma.ticket.findMany({
      where: {
        dataAbertura: { gte: inicio, lte: fim },
        resolvidoPorIa: false,
        status: { in: ['fechado', 'resolvido'] },
        dataFechamento: { not: null },
      },
      select: { dataAbertura: true, dataFechamento: true },
    }),
  ]);

  const taxaResolucaoIa = totalChamadosIa > 0
    ? Math.round((chamadosIaResolveu / totalChamadosIa) * 10000) / 100
    : 0;

  const tempoMedioResolucaoIaMin = ticketsIaResolvidos.length > 0
    ? Math.round(
        ticketsIaResolvidos.reduce((acc, t) => {
          const ms = new Date(t.dataFechamento!).getTime() - new Date(t.dataAbertura).getTime();
          return acc + ms / 60000;
        }, 0) / ticketsIaResolvidos.length
      )
    : 0;

  const tempoMedioResolucaoHumanoMin = ticketsHumanosResolvidos.length > 0
    ? Math.round(
        ticketsHumanosResolvidos.reduce((acc, t) => {
          const ms = new Date(t.dataFechamento!).getTime() - new Date(t.dataAbertura).getTime();
          return acc + ms / 60000;
        }, 0) / ticketsHumanosResolvidos.length
      )
    : 0;

  const confiancaMedia = classificacoes.length > 0
    ? Math.round(
        classificacoes.reduce((acc, c) => acc + (c.confianca || 0), 0) / classificacoes.length
      )
    : 0;

  return {
    periodo: { inicio, fim },
    backlog: {
      total: ticketsAbertos.length,
      porEtapa,
      porPrioridade,
      porFila,
    },
    mttr: {
      mediaMinutos: temposResolucao.length > 0 ? Math.round(temposResolucao.reduce((a, b) => a + b, 0) / temposResolucao.length) : 0,
      medianaMinutos: mediana(temposResolucao),
      p95Minutos: percentil(temposResolucao, 0.95),
    },
    mtfa: {
      mediaMinutos: temposPrimeiraResposta.length > 0 ? Math.round(temposPrimeiraResposta.reduce((a, b) => a + b, 0) / temposPrimeiraResposta.length) : 0,
    },
    sla: {
      compliancePercentual,
      violados,
      noPrazo,
      total: totalSla,
    },
    fcr: {
      percentual: fcrPercentual,
      primeiraResolucao,
      escalonados,
    },
    csat: {
      mediaNotas: csatStats.mediaNotas,
      totalRespostas: csatStats.totalRespondidos,
      percentualResposta: csatStats.percentualResposta,
    },
    porAgente,
    porCategoria,
    ia: {
      totalChamados: totalChamadosIa,
      chamadosIaResolveu,
      taxaResolucaoIa,
      tempoMedioResolucaoIaMin,
      tempoMedioResolucaoHumanoMin,
      totalCorrecoes: correcoes,
      confiancaMediaClassificacao: confiancaMedia,
    },
  };
}
