import { Response } from 'express';
import prisma from '../../config/database';
import { AuthRequest } from '../../shared/middleware/auth';
import { env } from '../../config/env';
import { callClaude } from '../../shared/aiClient';
import { gerarDashboardExecutivo } from './dashboardExecutivo.service';
import { getDashboardIa } from './dashboardIa.service';
import { gerarAlertasVisaoGeral } from './alertasVisaoGeral.service';
import { getAlertDetail } from './alertDetail.service';
import { STATUS_ABERTO } from '../helpdesk/constants';

// ── Visão Geral — Alertas e Atenção ─────────────────────────────────────
// Endpoint: GET /api/analytics/visao-geral?dias=7|30|90
// Compõe os alertas operacionais + chamados em risco + tarefas + dev/implant
// + comportamento do analista + clientes com problema recorrente.
export async function getVisaoGeral(req: AuthRequest, res: Response) {
  try {
    const dias = Math.min(Math.max(parseInt(String(req.query.dias || '30'), 10) || 30, 1), 90);
    const fim = new Date();
    fim.setHours(23, 59, 59, 999);
    const inicio = new Date(fim);
    inicio.setDate(fim.getDate() - (dias - 1));
    inicio.setHours(0, 0, 0, 0);

    const [totalTickets, ticketsFechados, ticketsAbertos, csatData] = await Promise.all([
      prisma.ticket.count({ where: { createdAt: { gte: inicio, lte: fim } } }),
      prisma.ticket.count({ where: { createdAt: { gte: inicio, lte: fim }, OR: [{ status: 'fechado' }, { etapa: 'concluido' }] } }),
      prisma.ticket.count({ where: { status: { in: [...STATUS_ABERTO] } } }),
      prisma.cSATResposta.aggregate({
        where: { respondidoEm: { gte: inicio, lte: fim }, nota: { not: null } },
        _avg: { nota: true },
        _count: { id: true },
      }),
    ]);

    const alertas = await gerarAlertasVisaoGeral(dias, {
      totalTickets,
      taxaResolucao: totalTickets > 0 ? Math.round((ticketsFechados / totalTickets) * 100) : 0,
      tempoMedioRespostaMin: 0,
      csatMedio: csatData._avg.nota ? Math.round(csatData._avg.nota * 100) / 100 : 0,
      ticketsAbertos,
      slaCumprido: 0,
      slaTotal: 0,
      taxaSla: 0,
    });

    res.json({
      atualizadoEm: new Date().toISOString(),
      periodo: { inicio: inicio.toISOString(), fim: fim.toISOString(), dias },
      alertas,
    });
  } catch (err: any) {
    console.error('Erro na visão geral:', err?.message || err);
    res.status(500).json({ error: 'Erro ao carregar alertas da visão geral' });
  }
}

// ── Dashboard Executivo Consolidado ─────────────────────────────────────
// Endpoint: GET /api/analytics/executivo?dias=30
const dashboardCache = new Map<string, { data: any; expiresAt: number }>();
const DASHBOARD_CACHE_TTL = 60_000; // 60 seconds

export async function getDashboardExecutivo(req: AuthRequest, res: Response) {
  try {
    const dias = Math.min(Math.max(parseInt(String(req.query.dias || '30'), 10) || 30, 1), 90);
    const cacheKey = `executivo_${dias}`;
    const cached = dashboardCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return res.json(cached.data);
    }
    const data = await gerarDashboardExecutivo(dias);
    dashboardCache.set(cacheKey, { data, expiresAt: Date.now() + DASHBOARD_CACHE_TTL });
    res.json(data);
  } catch (err: any) {
    console.error('Erro no dashboard executivo:', err?.message || err);
    res.status(500).json({ error: 'Erro ao carregar dashboard executivo' });
  }
}

// ── Dashboard IA (Gestão Inteligente) ───────────────────────────────────
// Endpoint: GET /api/analytics/dashboard-ia?dias=1|7|30
export async function getDashboardIaHandler(req: AuthRequest, res: Response) {
  try {
    const dias = parseInt(String(req.query.dias || '7'), 10) || 7;
    const data = await getDashboardIa(dias);
    res.json(data);
  } catch (err: any) {
    console.error('Erro no dashboard IA:', err?.message || err);
    res.status(500).json({ error: 'Erro ao carregar dashboard IA' });
  }
}

// ── Detalhe de Alerta (análise profunda) ─────────────────────────────
// Endpoint: GET /api/analytics/alert-detail?tipo=X&dias=7
export async function getAlertDetailHandler(req: AuthRequest, res: Response) {
  try {
    const tipo = String(req.query.tipo || '');
    const dias = parseInt(String(req.query.dias || '7'), 10) || 7;
    if (!tipo) {
      res.status(400).json({ error: 'Parâmetro "tipo" é obrigatório' });
      return;
    }
    const detalhe = await getAlertDetail({ tipo, dias });
    res.json(detalhe);
  } catch (err: any) {
    console.error('Erro no detalhe do alerta:', err?.message || err);
    res.status(500).json({ error: 'Erro ao carregar detalhe do alerta' });
  }
}

// ── Métricas de Helpdesk/Suporite e Implantação ────────────────────────
// Endpoint: GET /api/analytics/helpdesk-metrics
export async function getHelpdeskMetrics(req: AuthRequest, res: Response) {
  try {
    const now = new Date();
    const firstDayMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Período: último mês (mês atual)
    const periodoInicio = firstDayMonth;
    const periodoFim = now;

    // ── 1. Chamados abertos no último mês (total de todos os clientes) ──
    const totalChamadosMes = await prisma.ticket.count({
      where: { createdAt: { gte: periodoInicio, lte: periodoFim } },
    });

    // ── 2. Tempo médio de atendimento por chamado (minutos) ──
    const ticketsComTempo = await prisma.ticket.findMany({
      where: {
        dataFechamento: { not: null, gte: periodoInicio, lte: periodoFim },
      },
      select: {
        dataAbertura: true,
        dataFechamento: true,
        slaPausadoTotalMin: true,
      },
    });

    let tempoTotalAtendimento = 0;
    for (const t of ticketsComTempo) {
      const pausaMs = (t.slaPausadoTotalMin || 0) * 60 * 1000;
      const diffMin = (new Date(t.dataFechamento!).getTime() - new Date(t.dataAbertura).getTime() - pausaMs) / 60000;
      tempoTotalAtendimento += Math.max(0, diffMin);
    }
    const tempoMedioAtendimento = ticketsComTempo.length > 0
      ? Math.round(tempoTotalAtendimento / ticketsComTempo.length)
      : 0;

    // ── 3. Chamados do cliente que MAIS te aciona no mês ──
    const chamadosPorCliente = await prisma.ticket.groupBy({
      by: ['clientId'],
      where: { createdAt: { gte: periodoInicio, lte: periodoFim } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    const clientIds = chamadosPorCliente
      .filter(c => c.clientId)
      .map(c => c.clientId!);

    const clients = await prisma.client.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, razaoSocial: true, nomeFantasia: true },
    });
    const clientMap = new Map(clients.map(c => [c.id, c]));

    const topClienteChamados = chamadosPorCliente[0]?.clientId
      ? {
          clientId: chamadosPorCliente[0].clientId,
          nome: clientMap.get(chamadosPorCliente[0].clientId!)?.razaoSocial || 'Desconhecido',
          totalChamados: chamadosPorCliente[0]._count.id,
        }
      : null;

    const rankingChamadosPorCliente = chamadosPorCliente.map(c => ({
      clientId: c.clientId,
      nome: clientMap.get(c.clientId!)?.razaoSocial || 'Desconhecido',
      totalChamados: c._count.id,
    }));

    // ── 4. Horas de dev que os clientes consomem (total no mês + top cliente) ──
    const horasDevPorCliente = await prisma.serviceOrder.groupBy({
      by: ['clientId'],
      where: {
        createdAt: { gte: periodoInicio, lte: periodoFim },
        horasDev: { not: null, gt: 0 },
      },
      _sum: { horasDev: true },
      _count: { id: true },
      orderBy: { _sum: { horasDev: 'desc' } },
      take: 10,
    });

    const devClientIds = horasDevPorCliente.map(c => c.clientId);
    const devClients = await prisma.client.findMany({
      where: { id: { in: devClientIds } },
      select: { id: true, razaoSocial: true },
    });
    const devClientMap = new Map(devClients.map(c => [c.id, c]));

    const totalHorasDevMes = horasDevPorCliente.reduce(
      (sum, c) => sum + (c._sum.horasDev || 0), 0
    );

    const topClienteHorasDev = horasDevPorCliente[0]?.clientId
      ? {
          clientId: horasDevPorCliente[0].clientId,
          nome: devClientMap.get(horasDevPorCliente[0].clientId)?.razaoSocial || 'Desconhecido',
          horasDev: horasDevPorCliente[0]._sum.horasDev || 0,
        }
      : null;

    const rankingHorasDevPorCliente = horasDevPorCliente.map(c => ({
      clientId: c.clientId,
      nome: devClientMap.get(c.clientId)?.razaoSocial || 'Desconhecido',
      horasDev: c._sum.horasDev || 0,
      totalOs: c._count.id,
    }));

    // ── 5. Horas de dev por implantação (média do começo até cliente ativar) ──
    const implantacoesComHorasDev = await prisma.serviceOrder.findMany({
      where: {
        tipoImplantacao: 'implantacao',
        horasDev: { not: null, gt: 0 },
      },
      select: {
        horasDev: true,
        dataInicioImplantacao: true,
        dataFimImplantacao: true,
        implantacaoConcluida: true,
      },
    });

    const mediaHorasDevImplantacao = implantacoesComHorasDev.length > 0
      ? Math.round(
          implantacoesComHorasDev.reduce((sum, i) => sum + (i.horasDev || 0), 0) /
          implantacoesComHorasDev.length * 100
        ) / 100
      : 0;

    // ── 6. Horas de suporte por implantação (treinamento, migração, configuração) ──
    const horasSuportePorTipo = await prisma.serviceOrder.groupBy({
      by: ['tipoImplantacao'],
      where: {
        tipoImplantacao: { in: ['treinamento', 'migracao', 'configuracao'] },
        horasSuporte: { not: null, gt: 0 },
      },
      _sum: { horasSuporte: true },
      _count: { id: true },
    });

    const totalHorasSuporte = horasSuportePorTipo.reduce(
      (sum, t) => sum + (t._sum.horasSuporte || 0), 0
    );

    const horasSuportePorCategoria = horasSuportePorTipo.map(t => ({
      tipo: t.tipoImplantacao,
      horasSuporte: t._sum.horasSuporte || 0,
      totalOs: t._count.id,
      mediaPorOs: t._count.id > 0
        ? Math.round((t._sum.horasSuporte || 0) / t._count.id * 100) / 100
        : 0,
    }));

    // ── 7. Preço médio da implantação ──
    const implantacoesComPreco = await prisma.serviceOrder.findMany({
      where: {
        tipoImplantacao: 'implantacao',
        precoImplantacao: { not: null, gt: 0 },
      },
      select: { precoImplantacao: true },
    });

    const precoMedioImplantacao = implantacoesComPreco.length > 0
      ? Math.round(
          implantacoesComPreco.reduce((sum, i) => sum + (i.precoImplantacao || 0), 0) /
          implantacoesComPreco.length * 100
        ) / 100
      : 0;

    const totalImplantacoes = await prisma.serviceOrder.count({
      where: { tipoImplantacao: 'implantacao' },
    });

    const implantacoesConcluidas = await prisma.serviceOrder.count({
      where: { tipoImplantacao: 'implantacao', implantacaoConcluida: true },
    });

    return res.json({
      periodo: {
        inicio: periodoInicio.toISOString(),
        fim: periodoFim.toISOString(),
        label: `${now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`,
      },
      helpdesk: {
        totalChamadosMes,
        tempoMedioAtendimentoMin: tempoMedioAtendimento,
        ticketsComTempoResolvido: ticketsComTempo.length,
        topClienteChamados,
        rankingChamadosPorCliente,
      },
      horasDev: {
        totalMes: totalHorasDevMes,
        topCliente: topClienteHorasDev,
        rankingPorCliente: rankingHorasDevPorCliente,
        implantacoes: {
          total: totalImplantacoes,
          concluidas: implantacoesConcluidas,
          mediaHorasDevPorImplantacao: mediaHorasDevImplantacao,
        },
      },
      horasSuporte: {
        totalMes: totalHorasSuporte,
        porCategoria: horasSuportePorCategoria,
      },
      implantacao: {
        precoMedio: precoMedioImplantacao,
        totalComPreco: implantacoesComPreco.length,
      },
    });
  } catch (error: any) {
    console.error('[Analytics] Erro ao calcular helpdesk metrics:', error?.message || error);
    return res.status(500).json({ error: 'Erro ao calcular métricas de helpdesk' });
  }
}

export async function getKpis(req: AuthRequest, res: Response) {
  try {
    const { cards, charts } = await getKpisData();

    const now = new Date();
    const firstDayMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [totalClients, totalOpportunities, ticketsMonthPrev, osByStatus, ticketsByDay] = await Promise.all([
      prisma.client.count({ where: { status: 'ativo' } }),
      prisma.opportunity.count({ where: { etapa: { notIn: ['ganho', 'perdido'] } } }),
      prisma.ticket.count({
        where: { createdAt: { gte: firstDayPrevMonth, lte: lastDayPrevMonth } },
      }),
      prisma.serviceOrder.groupBy({ by: ['status'], _count: true }),
      prisma.ticket.findMany({
        where: { createdAt: { gte: firstDayMonth } },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const ticketsPerDay: Record<string, number> = {};
    ticketsByDay.forEach((t) => {
      const day = t.createdAt.toISOString().split('T')[0];
      ticketsPerDay[day] = (ticketsPerDay[day] || 0) + 1;
    });

    return res.json({
      cards: { ...cards, totalClients, totalOpportunities, ticketsMonthPrev },
      charts: {
        ...charts,
        ticketsByStatus: osByStatus,
        ticketsPerDay: Object.entries(ticketsPerDay).map(([date, count]) => ({ date, count })),
      },
    });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao calcular KPIs' });
  }
}

export async function getDashboard(req: AuthRequest, res: Response) {
  try {
    const now = new Date();
    const firstDayMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [ticketsByAgent, tasksByStatus, osTimeline] = await Promise.all([
      prisma.ticket.groupBy({
        by: ['usuarioId'],
        _count: { id: true },
        where: { createdAt: { gte: firstDayMonth }, usuarioId: { not: null } },
      }),
      prisma.task.groupBy({
        by: ['status', 'responsavelId'],
        _count: true,
      }),
      prisma.serviceOrder.findMany({
        where: { createdAt: { gte: firstDayMonth } },
        select: { dataEmissao: true, status: true, numeroOs: true },
        orderBy: { dataEmissao: 'asc' },
      }),
    ]);

    const agentIds = ticketsByAgent.filter(t => t.usuarioId).map(t => t.usuarioId!);
    const agents = await prisma.user.findMany({
      where: { id: { in: agentIds } },
      select: { id: true, name: true },
    });
    const agentMap = new Map(agents.map(a => [a.id, a.name]));

    const agentPerformance = ticketsByAgent.map((t) => ({
      agentId: t.usuarioId,
      agentName: agentMap.get(t.usuarioId!) || 'Desconhecido',
      totalTickets: t._count.id,
    }));

    const pipeline = await prisma.opportunity.findMany({
      where: { etapa: { notIn: ['ganho', 'perdido'] } },
      select: { valorEstimado: true, etapa: true, probabilidade: true },
    });

    const pipelineTotal = pipeline.reduce((sum, o) => sum + (o.valorEstimado || 0), 0);
    const pipelineWeighted = pipeline.reduce((sum, o) => sum + ((o.valorEstimado || 0) * (o.probabilidade || 0) / 100), 0);

    return res.json({
      agentPerformance,
      tasksByStatus,
      osTimeline,
      pipeline: { total: pipelineTotal, weighted: pipelineWeighted, count: pipeline.length },
    });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao carregar dashboard' });
  }
}

// ── NOVOS ENDPOINTS DE BI ──────────────────────────────────────────────

export async function getTicketsByDepartment(req: AuthRequest, res: Response) {
  try {
    const now = new Date();
    const firstDayMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const tickets = await prisma.ticket.groupBy({
      by: ['departamentoId'],
      where: { createdAt: { gte: firstDayMonth } },
      _count: { _all: true },
    });

    const deptIds = tickets.filter(t => t.departamentoId).map(t => t.departamentoId!);
    const depts = await prisma.departamento.findMany({
      where: { id: { in: deptIds } },
      select: { id: true, nome: true },
    });
    const deptMap = new Map(depts.map(d => [d.id, d.nome]));

    const result = tickets.map(t => ({
      departamento: deptMap.get(t.departamentoId!) || 'Sem departamento',
      count: t._count._all,
    }));

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao calcular chamados por departamento' });
  }
}

export async function getAvgTimeByQueue(req: AuthRequest, res: Response) {
  try {
    const now = new Date();
    const firstDayMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const tickets = await prisma.ticket.findMany({
      where: {
        dataFechamento: { not: null, gte: firstDayMonth },
        idFila: { not: null },
      },
      select: {
        idFila: true,
        dataAbertura: true,
        dataFechamento: true,
        slaPausadoTotalMin: true,
      },
    });

    const queueTimes: Record<string, number[]> = {};
    for (const t of tickets) {
      const fid = t.idFila || 'sem_fila';
      if (!queueTimes[fid]) queueTimes[fid] = [];
      const pausaMs = (t.slaPausadoTotalMin || 0) * 60 * 1000;
      const diffMin = Math.max(0, (new Date(t.dataFechamento!).getTime() - new Date(t.dataAbertura).getTime() - pausaMs) / 60000);
      queueTimes[fid].push(diffMin);
    }

    const queueIds = Object.keys(queueTimes).filter(id => id !== 'sem_fila');
    const filas = await prisma.fila.findMany({
      where: { id: { in: queueIds } },
      select: { id: true, nome: true },
    });
    const filaMap = new Map(filas.map(f => [f.id, f.nome]));

    const result = Object.entries(queueTimes).map(([id, times]) => ({
      fila: filaMap.get(id) || 'Sem fila',
      tempoMedioMin: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
      total: times.length,
    }));

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao calcular tempo medio por fila' });
  }
}

export async function getCsatTrending(req: AuthRequest, res: Response) {
  try {
    const now = new Date();
    const firstDayMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const respostas = await prisma.cSATResposta.findMany({
      where: {
        respondidoEm: { not: null, gte: firstDayMonth },
        nota: { not: null },
      },
      select: { nota: true, respondidoEm: true },
      orderBy: { respondidoEm: 'asc' },
    });

    const byDay: Record<string, { total: number; soma: number }> = {};
    for (const r of respostas) {
      const day = r.respondidoEm!.toISOString().split('T')[0];
      if (!byDay[day]) byDay[day] = { total: 0, soma: 0 };
      byDay[day].total++;
      byDay[day].soma += r.nota || 0;
    }

    const result = Object.entries(byDay).map(([date, data]) => ({
      date,
      media: Math.round((data.soma / data.total) * 100) / 100,
      total: data.total,
    }));

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao calcular trending de CSAT' });
  }
}

export async function getStatusByDay(req: AuthRequest, res: Response) {
  try {
    const now = new Date();
    const firstDayMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const tickets = await prisma.ticket.findMany({
      where: { createdAt: { gte: firstDayMonth } },
      select: { createdAt: true, status: true },
      orderBy: { createdAt: 'asc' },
    });

    const byDay: Record<string, Record<string, number>> = {};
    const allStatuses = new Set<string>();

    for (const t of tickets) {
      const day = t.createdAt.toISOString().split('T')[0];
      allStatuses.add(t.status);
      if (!byDay[day]) byDay[day] = {};
      byDay[day][t.status] = (byDay[day][t.status] || 0) + 1;
    }

    const result = Object.entries(byDay).map(([date, statuses]) => ({
      date,
      ...statuses,
    }));

    return res.json({ statuses: Array.from(allStatuses), data: result });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao calcular status por dia' });
  }
}

export async function getInsights(req: AuthRequest, res: Response) {
  try {
    const { cards, charts } = await getKpisData();

    if (!env.anthropicKey) {
      return res.json({
        insights: [
          `📊 ${cards.totalTicketsMonth} chamados no mês, ${cards.ticketsFechados} resolvidos (${cards.totalTicketsMonth > 0 ? Math.round(cards.ticketsFechados / cards.totalTicketsMonth * 100) : 0}% de resolução)`,
          `⏱️ Tempo médio de resposta: ${cards.tmrMedia} min | Tempo médio de resolução: ${cards.tmresMedia}h`,
          `📋 ${cards.totalOsMonth} OS emitidas, ${cards.osAguardando} aguardando assinatura`,
        ],
        generated: false,
      });
    }

    const prompt = `Você é um analista de operações da Codemed. Com base nos dados abaixo, gere 3 insights curtos e objetivos sobre o desempenho da equipe e volume de chamados. Foque em anomalias e oportunidades de melhoria. Use português brasileiro.

Dados:
- Chamados no mês: ${cards.totalTicketsMonth}
- Chamados abertos/andamento: ${cards.ticketsAbertos}
- Chamados fechados: ${cards.ticketsFechados}
- TMR médio: ${cards.tmrMedia} min
- TMRes médio: ${cards.tmresMedia} horas
- OS emitidas: ${cards.totalOsMonth}
- OS aguardando assinatura: ${cards.osAguardando}
- Total de categorias: ${JSON.stringify(charts.ticketsByCategory.slice(0, 5))}`;

    try {
      const content = await callClaude(prompt, 500, 'analytics-insights');
      const insights = content.split('\n').filter((l: string) => l.trim()).slice(0, 3);

      return res.json({ insights, generated: true });
    } catch (apiError) {
      console.error('Anthropic API error:', apiError);
      return res.json({
        insights: [
          `📊 ${cards.totalTicketsMonth} chamados no mês, ${cards.ticketsFechados} resolvidos (${cards.totalTicketsMonth > 0 ? Math.round(cards.ticketsFechados / cards.totalTicketsMonth * 100) : 0}% de resolução)`,
          `⏱️ Tempo médio de resposta: ${cards.tmrMedia} min | Tempo médio de resolução: ${cards.tmresMedia}h`,
          `📋 ${cards.totalOsMonth} OS emitidas, ${cards.osAguardando} aguardando assinatura`,
        ],
        generated: false,
      });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao gerar insights' });
  }
}

async function getKpisData() {
  const now = new Date();
  const firstDayMonth = new Date(now.getFullYear(), now.getMonth(), 1);

const [
    totalTicketsMonth, ticketsAbertos, ticketsFechados,
    totalOsMonth, osAguardando,
    ticketsResolvidosIa, ticketsResolvidosIaHumano, ticketsResolvidosSoloIa,
  ] = await Promise.all([
    prisma.ticket.count({ where: { createdAt: { gte: firstDayMonth } } }),
    prisma.ticket.count({ where: { status: { in: ['aberto', 'em_atendimento'] } } }),
    prisma.ticket.count({ where: { status: 'fechado', dataFechamento: { gte: firstDayMonth } } }),
    prisma.serviceOrder.count({ where: { createdAt: { gte: firstDayMonth } } }),
    prisma.serviceOrder.count({ where: { status: 'aguardando_assinatura' } }),
    prisma.ticket.count({
      where: { resolvidoPorIa: true, dataFechamento: { gte: firstDayMonth } },
    }),
    prisma.ticket.count({
      where: {
        resolvidoPorIa: false,
        status: { in: ['fechado', 'resolvido'] },
        dataFechamento: { gte: firstDayMonth },
      },
    }),
    prisma.ticket.count({
      where: {
        resolvidoPorIa: true,
        iaMensagensEnviadas: { gt: 0 },
        iaPrimeiraRespostaEm: { not: null },
        status: { in: ['fechado', 'resolvido'] },
        dataFechamento: { gte: firstDayMonth },
        // Solo IA: sem mensagens de agente humano (fromMe source != 'agent')
        assigneeId: null,
      },
    }),
  ]);

  const ticketsWithResponse = await prisma.ticket.findMany({
    where: { dataPrimeiraResposta: { not: null }, dataAbertura: { gte: firstDayMonth } },
    select: { dataAbertura: true, dataPrimeiraResposta: true },
  });

  let tmrTotal = 0;
  ticketsWithResponse.forEach((t) => {
    tmrTotal += (t.dataPrimeiraResposta!.getTime() - t.dataAbertura.getTime()) / 60000;
  });
  const tmrMedia = ticketsWithResponse.length > 0 ? Math.round(tmrTotal / ticketsWithResponse.length) : 0;

  const ticketsWithResolution = await prisma.ticket.findMany({
    where: { dataFechamento: { not: null }, dataAbertura: { gte: firstDayMonth } },
    select: { dataAbertura: true, dataFechamento: true },
  });

  let tmresTotal = 0;
  ticketsWithResolution.forEach((t) => {
    tmresTotal += (t.dataFechamento!.getTime() - t.dataAbertura.getTime()) / 3600000;
  });
  const tmresMedia = ticketsWithResolution.length > 0 ? Math.round(tmresTotal / ticketsWithResolution.length) : 0;

  const ticketsByCategory = await prisma.ticket.groupBy({
    by: ['categoria'],
    _count: true,
  });

  return {
    cards: {
      totalTicketsMonth, ticketsAbertos, ticketsFechados, tmrMedia, tmresMedia,
      totalOsMonth, osAguardando,
      ticketsResolvidosIa, ticketsResolvidosSoloIa,
      totalResolvidos: ticketsFechados,
    },
    charts: { ticketsByCategory },
  };
}
