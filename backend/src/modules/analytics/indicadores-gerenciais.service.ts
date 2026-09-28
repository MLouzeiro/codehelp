import prisma from '../../config/database';

// ── Types ─────────────────────────────────────────────────────────────

export interface IndicadorGeral {
  totalChamados: number;
  chamadosPorMes: number;
  mediaPorCliente: number;
  top10Clientes: { clienteId: string; clienteNome: string; total: number }[];
  tempoMedioResolucaoHoras: number;
  taxaResolucao: number;
  top10Motivos: { motivo: string; total: number }[];
  custoEstimado: number;
}

export interface PerformanceAnalista {
  analistaId: string;
  analistaNome: string;
  totalChamados: number;
  chamadosResolvidos: number;
  taxaResolucao: number;
  tempoMedioResolucaoMin: number;
  csatMedio: number;
  ticketsPorCategoria: { categoria: string; total: number }[];
  ultimaAtividade: Date | null;
  analiseQualitativa: string;
}

export interface IndicadoresGerenciaisResponse {
  periodo: { inicio: Date; fim: Date; dias: number };
  indicadores: IndicadorGeral;
  performancePorAnalista: PerformanceAnalista[];
}

// ── Service ───────────────────────────────────────────────────────────

export async function getIndicadoresGerenciais(
  dias: number = 30,
  organizationId?: string
): Promise<IndicadoresGerenciaisResponse> {
  const fim = new Date();
  fim.setHours(23, 59, 59, 999);
  const inicio = new Date(fim);
  inicio.setDate(fim.getDate() - (dias - 1));
  inicio.setHours(0, 0, 0, 0);

  const ticketWhere: any = {
    createdAt: { gte: inicio, lte: fim },
  };
  if (organizationId) ticketWhere.organizationId = organizationId;

  // ── 1. Total de chamados ──────────────────────────────────────────
  const totalChamados = await prisma.ticket.count({ where: ticketWhere });

  // ── 2. Chamados por mês (média diária * 30) ───────────────────────
  const chamadosPorMes = Math.round((totalChamados / dias) * 30);

  // ── 3. Média por cliente ──────────────────────────────────────────
  const ticketsComCliente = await prisma.ticket.groupBy({
    by: ['clientId'],
    where: { ...ticketWhere, clientId: { not: null } },
    _count: { id: true },
  });
  const clientesUnicos = ticketsComCliente.length;
  const mediaPorCliente = clientesUnicos > 0 ? Math.round((totalChamados / clientesUnicos) * 10) / 10 : 0;

  // ── 4. Top 10 clientes ────────────────────────────────────────────
  const top10ClientesRaw = await prisma.ticket.groupBy({
    by: ['clientId'],
    where: { ...ticketWhere, clientId: { not: null } },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 10,
  });

  const clientIds = top10ClientesRaw.map(t => t.clientId).filter(Boolean) as string[];
  const clients = await prisma.client.findMany({
    where: { id: { in: clientIds } },
    select: { id: true, nomeFantasia: true, razaoSocial: true },
  });
  const clientMap = new Map(clients.map(c => [c.id, c.nomeFantasia || c.razaoSocial || 'Cliente']));

  const top10Clientes = top10ClientesRaw.map(t => ({
    clienteId: t.clientId || '',
    clienteNome: clientMap.get(t.clientId || '') || 'Cliente',
    total: t._count.id,
  }));

  // ── 5. Tempo médio de resolução ───────────────────────────────────
  const ticketsResolvidos = await prisma.ticket.findMany({
    where: {
      ...ticketWhere,
      dataFechamento: { not: null },
    },
    select: { dataAbertura: true, dataFechamento: true },
  });

  let tempoTotalResolucaoMin = 0;
  ticketsResolvidos.forEach(t => {
    if (t.dataFechamento && t.dataAbertura) {
      tempoTotalResolucaoMin += (t.dataFechamento.getTime() - t.dataAbertura.getTime()) / 60000;
    }
  });
  const tempoMedioResolucaoHoras = ticketsResolvidos.length > 0
    ? Math.round((tempoTotalResolucaoMin / ticketsResolvidos.length / 60) * 10) / 10
    : 0;

  // ── 6. Taxa de resolução ──────────────────────────────────────────
  const ticketsFechados = await prisma.ticket.count({
    where: { ...ticketWhere, OR: [{ status: 'fechado' }, { etapa: 'concluido' }] },
  });
  const taxaResolucao = totalChamados > 0 ? Math.round((ticketsFechados / totalChamados) * 100) : 0;

  // ── 7. Top 10 motivos ─────────────────────────────────────────────
  const top10MotivosRaw = await prisma.ticket.groupBy({
    by: ['motivoStatus'],
    where: { ...ticketWhere, motivoStatus: { not: null } },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 10,
  });

  const top10Motivos = top10MotivosRaw.map(t => ({
    motivo: t.motivoStatus || 'Não informado',
    total: t._count.id,
  }));

  // ── 8. Custo estimado ─────────────────────────────────────────────
  // Baseado em: tempo médio de resolução * custo médio por hora do técnico
  // Custo médio estimado: R$ 75/hora (técnico de TI)
  const CUSTO_POR_HORA = 75;
  const custoEstimado = Math.round(tempoMedioResolucaoHoras * totalChamados * CUSTO_POR_HORA * 100) / 100;

  // ── Performance por analista ───────────────────────────────────────
  const performancePorAnalista = await getPerformanceAnalistas(ticketWhere, inicio, fim);

  return {
    periodo: { inicio, fim, dias },
    indicadores: {
      totalChamados,
      chamadosPorMes,
      mediaPorCliente,
      top10Clientes,
      tempoMedioResolucaoHoras,
      taxaResolucao,
      top10Motivos,
      custoEstimado,
    },
    performancePorAnalista,
  };
}

async function getPerformanceAnalistas(
  baseWhere: any,
  inicio: Date,
  fim: Date
): Promise<PerformanceAnalista[]> {
  // Buscar todos os analistas que tiveram chamados no período
  const analistasComChamados = await prisma.ticket.groupBy({
    by: ['assigneeId'],
    where: { ...baseWhere, assigneeId: { not: null } },
    _count: { id: true },
  });

  const analistaIds = analistasComChamados.map(a => a.assigneeId).filter(Boolean) as string[];
  if (analistaIds.length === 0) return [];

  // Buscar nomes dos analistas
  const analistas = await prisma.user.findMany({
    where: { id: { in: analistaIds } },
    select: { id: true, name: true },
  });
  const analistaMap = new Map(analistas.map(a => [a.id, a.name]));

  const performance: PerformanceAnalista[] = [];

  for (const analistaId of analistaIds) {
    const analistaNome = analistaMap.get(analistaId) || 'Analista';

    // Total de chamados do analista
    const totalChamados = await prisma.ticket.count({
      where: { ...baseWhere, assigneeId: analistaId },
    });

    // Chamados resolvidos
    const chamadosResolvidos = await prisma.ticket.count({
      where: {
        ...baseWhere,
        assigneeId: analistaId,
        OR: [{ status: 'fechado' }, { etapa: 'concluido' }],
      },
    });

    const taxaResolucao = totalChamados > 0 ? Math.round((chamadosResolvidos / totalChamados) * 100) : 0;

    // Tempo médio de resolução
    const ticketsResolvidos = await prisma.ticket.findMany({
      where: {
        ...baseWhere,
        assigneeId: analistaId,
        dataFechamento: { not: null },
      },
      select: { dataAbertura: true, dataFechamento: true },
    });

    let tempoTotalMin = 0;
    ticketsResolvidos.forEach(t => {
      if (t.dataFechamento && t.dataAbertura) {
        tempoTotalMin += (t.dataFechamento.getTime() - t.dataAbertura.getTime()) / 60000;
      }
    });
    const tempoMedioResolucaoMin = ticketsResolvidos.length > 0
      ? Math.round(tempoTotalMin / ticketsResolvidos.length)
      : 0;

    // CSAT médio
    const csatData = await prisma.cSATResposta.aggregate({
      where: {
        ticket: { assigneeId: analistaId, createdAt: { gte: inicio, lte: fim } },
        nota: { not: null },
      },
      _avg: { nota: true },
    });
    const csatMedio = csatData._avg.nota ? Math.round(csatData._avg.nota * 100) / 100 : 0;

    // Tickets por categoria
    const categoriasRaw = await prisma.ticket.groupBy({
      by: ['categoria'],
      where: { ...baseWhere, assigneeId: analistaId, categoria: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });

    const ticketsPorCategoria = categoriasRaw.map(c => ({
      categoria: c.categoria || 'Sem categoria',
      total: c._count.id,
    }));

    // Última atividade
    const ultimoTicket = await prisma.ticket.findFirst({
      where: { assigneeId: analistaId, updatedAt: { gte: inicio, lte: fim } },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    });

    // Análise qualitativa baseada em métricas
    const analiseQualitativa = gerarAnaliseQualitativa({
      taxaResolucao,
      tempoMedioResolucaoMin,
      csatMedio,
      totalChamados,
    });

    performance.push({
      analistaId,
      analistaNome,
      totalChamados,
      chamadosResolvidos,
      taxaResolucao,
      tempoMedioResolucaoMin,
      csatMedio,
      ticketsPorCategoria,
      ultimaAtividade: ultimoTicket?.updatedAt || null,
      analiseQualitativa,
    });
  }

  // Ordenar por taxa de resolução (melhores primeiro)
  performance.sort((a, b) => b.taxaResolucao - a.taxaResolucao);

  return performance;
}

function gerarAnaliseQualitativa(metricas: {
  taxaResolucao: number;
  tempoMedioResolucaoMin: number;
  csatMedio: number;
  totalChamados: number;
}): string {
  const partes: string[] = [];

  if (metricas.taxaResolucao >= 80) {
    partes.push('Excelente taxa de resolução');
  } else if (metricas.taxaResolucao >= 60) {
    partes.push('Taxa de resolução adequada');
  } else {
    partes.push('Taxa de resolução precisa melhorar');
  }

  if (metricas.tempoMedioResolucaoMin > 0) {
    if (metricas.tempoMedioResolucaoMin < 60) {
      partes.push(`Resolução rápida (${metricas.tempoMedioResolucaoMin}min em média)`);
    } else if (metricas.tempoMedioResolucaoMin < 240) {
      partes.push(`Tempo de resolução moderado (${Math.round(metricas.tempoMedioResolucaoMin / 60)}h em média)`);
    } else {
      partes.push(`Tempo de resolução elevado (${Math.round(metricas.tempoMedioResolucaoMin / 60)}h em média)`);
    }
  }

  if (metricas.csatMedio > 0) {
    if (metricas.csatMedio >= 4) {
      partes.push(`CSAT excelente (${metricas.csatMedio}/5)`);
    } else if (metricas.csatMedio >= 3) {
      partes.push(`CSAT adequado (${metricas.csatMedio}/5)`);
    } else {
      partes.push(`CSAT abaixo do esperado (${metricas.csatMedio}/5)`);
    }
  }

  if (metricas.totalChamados >= 20) {
    partes.push('Alto volume de atendimentos');
  } else if (metricas.totalChamados <= 3) {
    partes.push('Baixo volume de atendimentos');
  }

  return partes.join(' | ');
}
