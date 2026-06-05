import { Response } from 'express';
import prisma from '../../config/database';
import { AuthRequest } from '../../shared/middleware/auth';
import { env } from '../../config/env';

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
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 500,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const data: any = await response.json();
      const content = data.content?.[0]?.text || '';
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
  ] = await Promise.all([
    prisma.ticket.count({ where: { createdAt: { gte: firstDayMonth } } }),
    prisma.ticket.count({ where: { status: { in: ['aberto', 'em_andamento'] } } }),
    prisma.ticket.count({ where: { status: 'fechado', dataFechamento: { gte: firstDayMonth } } }),
    prisma.serviceOrder.count({ where: { createdAt: { gte: firstDayMonth } } }),
    prisma.serviceOrder.count({ where: { status: 'aguardando_assinatura' } }),
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
    cards: { totalTicketsMonth, ticketsAbertos, ticketsFechados, tmrMedia, tmresMedia, totalOsMonth, osAguardando },
    charts: { ticketsByCategory },
  };
}
