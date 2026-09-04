import prisma from '../../config/database';
import { env } from '../../config/env';
import { callClaude } from '../../shared/aiClient';
import {
  WHERE_TICKET_RESOLVIDO,
  STATUS_ABERTO,
} from '../helpdesk/constants';

// ── Interfaces ─────────────────────────────────────────────────

export interface WeeklyReportData {
  periodo: { inicio: Date; fim: Date; label: string };
  resumo: {
    totalTickets: number;
    ticketsFechados: number;
    ticketsAbertos: number;
    taxaResolucao: number;
    tempoMedioResposta: number; // minutos
    tempoMedioResolucao: number; // minutos
    slaCumprido: number;
    slaTotal: number;
    taxaSla: number;
    csatMedio: number;
    csatTotalRespostas: number;
    fcr: number; // first call resolution %
  };
  porCliente: { clienteId: string; clienteNome: string; total: number; fechados: number }[];
  porCategoria: { categoria: string; total: number; fechados: number }[];
  porDepartamento: { departamentoId: string; departamentoNome: string; total: number; fechados: number }[];
  porAgente: {
    agenteId: string; agenteNome: string;
    atendidos: number; fechados: number;
    tempoMedio: number; csatMedio: number;
  }[];
  porCanal: { canal: string; total: number }[];
  porDia: { dia: string; total: number; fechados: number }[];
  comparativoSemanaAnterior: {
    deltaTickets: number;
    deltaFechados: number;
    deltaTempoResposta: number;
    deltaCsat: number;
    deltaSla: number;
  };
  sugestoesIa: string[];
  topTicketsProblema: { ticketId: string; protocolo: string; cliente: string; assunto: string; tempoHoras: number; csat: number | null }[];
}

// ── Helpers ────────────────────────────────────────────────────

function getWeekRange(date: Date = new Date()): { inicio: Date; fim: Date } {
  const fim = new Date(date);
  fim.setHours(23, 59, 59, 999);
  const inicio = new Date(fim);
  inicio.setDate(fim.getDate() - 6);
  inicio.setHours(0, 0, 0, 0);
  return { inicio, fim };
}

function getPreviousWeekRange(fimAtual: Date): { inicio: Date; fim: Date } {
  const fim = new Date(fimAtual);
  fim.setDate(fim.getDate() - 7);
  fim.setHours(23, 59, 59, 999);
  const inicio = new Date(fim);
  inicio.setDate(fim.getDate() - 6);
  inicio.setHours(0, 0, 0, 0);
  return { inicio, fim };
}

function formatPeriod(inicio: Date, fim: Date): string {
  const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return `${fmt(inicio)} a ${fmt(fim)}`;
}

// ── Coleta de Dados ────────────────────────────────────────────

async function coletarResumo(inicio: Date, fim: Date) {
  const [totalTickets, ticketsFechados, ticketsAbertos, slaData, csatData, fcrData, tempoResposta, tempoResolucao] = await Promise.all([
    prisma.ticket.count({
      where: { createdAt: { gte: inicio, lte: fim } },
    }),
    prisma.ticket.count({
      where: {
        createdAt: { gte: inicio, lte: fim },
        ...WHERE_TICKET_RESOLVIDO,
      },
    }),
    prisma.ticket.count({
      where: {
        status: { in: [...STATUS_ABERTO] },
      },
    }),
    prisma.ticket.aggregate({
      where: {
        createdAt: { gte: inicio, lte: fim },
        slaTotalMinutos: { not: null },
      },
      _avg: { slaTotalMinutos: true },
      _count: { id: true },
    }),
    prisma.cSATResposta.aggregate({
      where: {
        enviadoEm: { gte: inicio, lte: fim },
        respondidoEm: { not: null },
        nota: { not: null },
      },
      _avg: { nota: true },
      _count: { id: true },
    }),
    prisma.ticket.count({
      where: {
        createdAt: { gte: inicio, lte: fim },
        ...WHERE_TICKET_RESOLVIDO,
        dataPrimeiraResposta: { not: null },
      },
    }),
    // Tempo médio de primeira resposta (dataPrimeiraResposta - dataAbertura)
    prisma.ticket.findMany({
      where: {
        createdAt: { gte: inicio, lte: fim },
        dataPrimeiraResposta: { not: null },
      },
      select: { dataAbertura: true, dataPrimeiraResposta: true },
    }),
    // Tempo médio de resolução (dataFechamento - dataAbertura - pausas SLA)
    prisma.ticket.findMany({
      where: {
        createdAt: { gte: inicio, lte: fim },
        dataFechamento: { not: null },
      },
      select: { dataAbertura: true, dataFechamento: true, slaPausadoTotalMin: true },
    }),
  ]);

  const tempoRespostaTotalMin = tempoResposta.reduce((acc, t) => {
    const ms = (t.dataPrimeiraResposta!.getTime() - t.dataAbertura.getTime()) / 60000;
    return acc + Math.max(0, ms);
  }, 0);
  const tempoMedioResposta = tempoResposta.length > 0 ? Math.round(tempoRespostaTotalMin / tempoResposta.length) : 0;

  const tempoResolucaoTotalMin = tempoResolucao.reduce((acc, t) => {
    const pausaMs = (t.slaPausadoTotalMin || 0) * 60 * 1000;
    const ms = (t.dataFechamento!.getTime() - t.dataAbertura.getTime() - pausaMs) / 60000;
    return acc + Math.max(0, ms);
  }, 0);
  const tempoMedioResolucao = tempoResolucao.length > 0 ? Math.round(tempoResolucaoTotalMin / tempoResolucao.length) : 0;

  const slaViolado = await prisma.ticket.count({
    where: {
      createdAt: { gte: inicio, lte: fim },
      slaTotalMinutos: { gt: 60 }, // Mais de 1 hora = possível violação
    },
  });

  const taxaResolucao = totalTickets > 0 ? Math.round((ticketsFechados / totalTickets) * 100) : 0;
  const taxaSla = slaData._count.id > 0 ? Math.round(((slaData._count.id - slaViolado) / slaData._count.id) * 100) : 0;

  return {
    totalTickets,
    ticketsFechados,
    ticketsAbertos,
    taxaResolucao,
    tempoMedioResposta,
    tempoMedioResolucao,
    slaCumprido: slaData._count.id - slaViolado,
    slaTotal: slaData._count.id,
    taxaSla,
    csatMedio: csatData._avg.nota ? Math.round(csatData._avg.nota * 100) / 100 : 0,
    csatTotalRespostas: csatData._count.id,
    fcr: totalTickets > 0 ? Math.round((fcrData / totalTickets) * 100) : 0,
  };
}

async function coletarPorCliente(inicio: Date, fim: Date) {
  const clientIds = await prisma.ticket.groupBy({
    by: ['clientId'],
    where: {
      createdAt: { gte: inicio, lte: fim },
      clientId: { not: null },
    },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 15,
  });

  const validClients = clientIds.filter(c => c.clientId);

  const [clients, closedCounts] = await Promise.all([
    prisma.client.findMany({
      where: { id: { in: validClients.map(c => c.clientId!) } },
      select: { id: true, razaoSocial: true, nomeFantasia: true },
    }),
    prisma.ticket.groupBy({
      by: ['clientId'],
      where: {
        createdAt: { gte: inicio, lte: fim },
        clientId: { in: validClients.map(c => c.clientId!) },
        ...WHERE_TICKET_RESOLVIDO,
      },
      _count: { id: true },
    }),
  ]);

  const clientMap = new Map(clients.map(c => [c.id, c]));
  const closedMap = new Map(closedCounts.map(c => [c.clientId, c._count.id]));

  return validClients.map(c => ({
    clienteId: c.clientId!,
    clienteNome: clientMap.get(c.clientId!)?.nomeFantasia || clientMap.get(c.clientId!)?.razaoSocial || 'Desconhecido',
    total: c._count.id,
    fechados: closedMap.get(c.clientId!) || 0,
  }));
}

async function coletarPorCategoria(inicio: Date, fim: Date) {
  const categories = await prisma.ticket.groupBy({
    by: ['categoria'],
    where: {
      createdAt: { gte: inicio, lte: fim },
      categoria: { not: null },
    },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 10,
  });

  const validCategories = categories.filter(c => c.categoria);

  const closedCounts = await prisma.ticket.groupBy({
    by: ['categoria'],
    where: {
      createdAt: { gte: inicio, lte: fim },
      categoria: { in: validCategories.map(c => c.categoria!) },
      ...WHERE_TICKET_RESOLVIDO,
    },
    _count: { id: true },
  });

  const closedMap = new Map(closedCounts.map(c => [c.categoria, c._count.id]));

  return validCategories.map(c => ({
    categoria: c.categoria!,
    total: c._count.id,
    fechados: closedMap.get(c.categoria!) || 0,
  }));
}

async function coletarPorDepartamento(inicio: Date, fim: Date) {
  const departments = await prisma.ticket.groupBy({
    by: ['departamentoId'],
    where: {
      createdAt: { gte: inicio, lte: fim },
      departamentoId: { not: null },
    },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });

  const validDepts = departments.filter(d => d.departamentoId);

  const [deptEntities, closedCounts] = await Promise.all([
    prisma.departamento.findMany({
      where: { id: { in: validDepts.map(d => d.departamentoId!) } },
      select: { id: true, nome: true },
    }),
    prisma.ticket.groupBy({
      by: ['departamentoId'],
      where: {
        createdAt: { gte: inicio, lte: fim },
        departamentoId: { in: validDepts.map(d => d.departamentoId!) },
        ...WHERE_TICKET_RESOLVIDO,
      },
      _count: { id: true },
    }),
  ]);

  const deptMap = new Map(deptEntities.map(d => [d.id, d]));
  const closedMap = new Map(closedCounts.map(c => [c.departamentoId, c._count.id]));

  return validDepts.map(d => ({
    departamentoId: d.departamentoId!,
    departamentoNome: deptMap.get(d.departamentoId!)?.nome || 'Sem departamento',
    total: d._count.id,
    fechados: closedMap.get(d.departamentoId!) || 0,
  }));
}

async function coletarPorAgente(inicio: Date, fim: Date) {
  const agents = await prisma.ticket.groupBy({
    by: ['assigneeId'],
    where: {
      createdAt: { gte: inicio, lte: fim },
      assigneeId: { not: null },
    },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 15,
  });

  const validAgents = agents.filter(a => a.assigneeId);
  const agentIds = validAgents.map(a => a.assigneeId!);

  const [users, closedCounts, timeAggregates, csatAggregates] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: agentIds } },
      select: { id: true, name: true },
    }),
    prisma.ticket.groupBy({
      by: ['assigneeId'],
      where: {
        assigneeId: { in: agentIds },
        createdAt: { gte: inicio, lte: fim },
        ...WHERE_TICKET_RESOLVIDO,
      },
      _count: { id: true },
    }),
    prisma.ticket.findMany({
      where: {
        assigneeId: { in: agentIds },
        createdAt: { gte: inicio, lte: fim },
        dataFechamento: { not: null },
      },
      select: { assigneeId: true, dataAbertura: true, dataFechamento: true, slaPausadoTotalMin: true },
    }),
    prisma.cSATResposta.groupBy({
      by: ['ticketId'],
      where: {
        ticket: { assigneeId: { in: agentIds } },
        enviadoEm: { gte: inicio, lte: fim },
        respondidoEm: { not: null },
        nota: { not: null },
      },
      _avg: { nota: true },
    }),
  ]);

  const userMap = new Map(users.map(u => [u.id, u]));
  const closedMap = new Map(closedCounts.map(c => [c.assigneeId, c._count.id]));
  const timeMap = new Map<string, number>();
  for (const t of timeAggregates) {
    if (!t.assigneeId) continue;
    const pausaMs = (t.slaPausadoTotalMin || 0) * 60 * 1000;
    const min = Math.max(0, (t.dataFechamento!.getTime() - t.dataAbertura.getTime() - pausaMs) / 60000);
    const prev = timeMap.get(t.assigneeId) || 0;
    timeMap.set(t.assigneeId, prev + min);
  }
  const timeCountMap = new Map<string, number>();
  for (const t of timeAggregates) {
    if (!t.assigneeId) continue;
    timeCountMap.set(t.assigneeId, (timeCountMap.get(t.assigneeId) || 0) + 1);
  }

  const agentTickets = await prisma.ticket.findMany({
    where: { assigneeId: { in: agentIds }, createdAt: { gte: inicio, lte: fim } },
    select: { id: true, assigneeId: true },
  });

  const ticketsByAgent = new Map<string, string[]>();
  for (const t of agentTickets) {
    if (!t.assigneeId) continue;
    const list = ticketsByAgent.get(t.assigneeId) || [];
    list.push(t.id);
    ticketsByAgent.set(t.assigneeId, list);
  }

  const csatByAgent = new Map<string, number[]>();
  for (const csat of csatAggregates) {
    const ticketEntry = agentTickets.find(t => t.id === csat.ticketId);
    if (ticketEntry?.assigneeId && csat._avg.nota) {
      const list = csatByAgent.get(ticketEntry.assigneeId) || [];
      list.push(csat._avg.nota);
      csatByAgent.set(ticketEntry.assigneeId, list);
    }
  }

  return validAgents.map(a => {
    const agentId = a.assigneeId!;
    const csatScores = csatByAgent.get(agentId) || [];
    const avgCsat = csatScores.length > 0
      ? Math.round((csatScores.reduce((s, v) => s + v, 0) / csatScores.length) * 100) / 100
      : 0;

    return {
      agenteId: agentId,
      agenteNome: userMap.get(agentId)?.name || 'Desconhecido',
      atendidos: a._count.id,
      fechados: closedMap.get(agentId) || 0,
      tempoMedio: timeCountMap.get(agentId) ? Math.round((timeMap.get(agentId) || 0) / timeCountMap.get(agentId)!) : 0,
      csatMedio: avgCsat,
    };
  });
}

async function coletarPorCanal(inicio: Date, fim: Date) {
  const results = await prisma.ticket.groupBy({
    by: ['canal'],
    where: { createdAt: { gte: inicio, lte: fim } },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });

  return results.map(r => ({
    canal: r.canal || 'Desconhecido',
    total: r._count.id,
  }));
}

async function coletarPorDia(inicio: Date, fim: Date) {
  const results = await prisma.ticket.groupBy({
    by: ['createdAt'],
    where: { createdAt: { gte: inicio, lte: fim } },
    _count: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  const closedResults = await prisma.ticket.groupBy({
    by: ['createdAt'],
    where: {
      createdAt: { gte: inicio, lte: fim },
      ...WHERE_TICKET_RESOLVIDO,
    },
    _count: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  const porDia: Record<string, { total: number; fechados: number }> = {};

  const current = new Date(inicio);
  while (current <= fim) {
    const key = current.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
    porDia[key] = { total: 0, fechados: 0 };
    current.setDate(current.getDate() + 1);
  }

  for (const r of results) {
    const key = r.createdAt.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
    if (porDia[key]) {
      porDia[key].total += r._count.id;
    }
  }

  for (const r of closedResults) {
    const key = r.createdAt.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
    if (porDia[key]) {
      porDia[key].fechados += r._count.id;
    }
  }

  return Object.entries(porDia).map(([dia, data]) => ({ dia, ...data }));
}

async function compararComSemanaAnterior(fimAtual: Date, resumoAtual: any) {
  const { inicio, fim } = getPreviousWeekRange(fimAtual);
  const resumoAnterior = await coletarResumo(inicio, fim);

  return {
    deltaTickets: resumoAtual.totalTickets - resumoAnterior.totalTickets,
    deltaFechados: resumoAtual.ticketsFechados - resumoAnterior.ticketsFechados,
    deltaTempoResposta: resumoAtual.tempoMedioResposta - resumoAnterior.tempoMedioResposta,
    deltaCsat: Math.round((resumoAtual.csatMedio - resumoAnterior.csatMedio) * 100) / 100,
    deltaSla: resumoAtual.taxaSla - resumoAnterior.taxaSla,
  };
}

async function identificarTicketsProblema(inicio: Date, fim: Date) {
  const tickets = await prisma.ticket.findMany({
    where: {
      createdAt: { gte: inicio, lte: fim },
      ...WHERE_TICKET_RESOLVIDO,
      dataFechamento: { not: null },
    },
    select: {
      id: true,
      protocolo: true,
      assunto: true,
      dataAbertura: true,
      dataFechamento: true,
      slaPausadoTotalMin: true,
      client: { select: { razaoSocial: true, nomeFantasia: true } },
      csatResposta: { select: { nota: true } },
    },
  });

  return tickets
    .map(t => {
      const pausaMs = (t.slaPausadoTotalMin || 0) * 60 * 1000;
      const tempoMs = t.dataFechamento!.getTime() - t.dataAbertura.getTime() - pausaMs;
      const tempoHoras = Math.max(0, tempoMs / 3600000);
      return {
        ticketId: t.id,
        protocolo: t.protocolo || t.id.slice(0, 8),
        cliente: t.client?.nomeFantasia || t.client?.razaoSocial || 'N/A',
        assunto: t.assunto || 'Sem assunto',
        tempoHoras: Math.round(tempoHoras * 10) / 10,
        csat: t.csatResposta?.nota || null,
      };
    })
    .sort((a, b) => b.tempoHoras - a.tempoHoras)
    .slice(0, 5);
}

// ── IA: Sugestões de Redução de Chamados ───────────────────────

async function gerarSugestoesIa(dados: {
  resumo: any;
  porCategoria: any[];
  porCliente: any[];
  porDepartamento: any[];
  porAgente: any[];
  topTickets: any[];
  comparativo: any;
}): Promise<string[]> {
  const { resumo, porCategoria, porCliente, porDepartamento, comparativo } = dados;

  // Se não tem Claude, gerar sugestões baseadas em regras
  if (!env.anthropicKey) {
    return gerarSugestoesEstaticas(dados);
  }

  try {
    const prompt = `Você é um analista de operações de suporte técnico. Analise os dados semanais abaixo e gere EXATAMENTE 5 sugestões práticas e específicas para reduzir a quantidade de chamados.

DADOS DA SEMANA:
- Total de tickets: ${resumo.totalTickets}
- Taxa de resolução: ${resumo.taxaResolucao}%
- Tempo médio de resposta: ${resumo.tempoMedioResposta} min
- Tempo médio de resolução: ${resumo.tempoMedioResolucao} min
- SLA cumprido: ${resumo.taxaSla}%
- CSAT médio: ${resumo.csatMedio}/5
- FCR: ${resumo.fcr}%

TOP CATEGORIAS:
${porCategoria.slice(0, 5).map(c => `- ${c.categoria}: ${c.total} tickets (${c.fechados} resolvidos)`).join('\n')}

TOP CLIENTES (com mais chamados):
${porCliente.slice(0, 5).map(c => `- ${c.clienteNome}: ${c.total} tickets`).join('\n')}

COMPARATIVO COM SEMANA ANTERIOR:
- Delta tickets: ${comparativo.deltaTickets > 0 ? '+' : ''}${comparativo.deltaTickets}
- Delta resolvidos: ${comparativo.deltaFechados > 0 ? '+' : ''}${comparativo.deltaFechados}
- Delta tempo resposta: ${comparativo.deltaTempoResposta > 0 ? '+' : ''}${comparativo.deltaTempoResposta} min
- Delta CSAT: ${comparativo.deltaCsat > 0 ? '+' : ''}${comparativo.deltaCsat}

REGRAS:
1. Cada sugestão deve ser MÁXIMO 2 frases
2. Seja específico com números e dados reais
3. Foque em ações que possam ser implementadas na semana seguinte
4. Priorize: KB (base de conhecimento), automação, treinamento, processos
5. Responda APENAS com JSON: { "sugestoes": ["sugestão 1", "sugestão 2", ...] }`;

    const text = await callClaude(prompt, 600, 'weekly-report');
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed.sugestoes) && parsed.sugestoes.length > 0) {
        return parsed.sugestoes.slice(0, 5);
      }
    }
  } catch (e) {
    console.warn('[WeeklyReport] Falha ao gerar sugestões IA:', (e as Error).message);
  }

  return gerarSugestoesEstaticas(dados);
}

function gerarSugestoesEstaticas(dados: {
  resumo: any;
  porCategoria: any[];
  porCliente: any[];
  comparativo: any;
}): string[] {
  const sugestoes: string[] = [];
  const { resumo, porCategoria, porCliente, comparativo } = dados;

  if (resumo.totalTickets > 20) {
    sugestoes.push(`Com ${resumo.totalTickets} tickets na semana, considere criar artigos na Base de Conhecimento para as top categorias e direcionar clientes para autoatendimento.`);
  }

  const catMaisComum = porCategoria[0];
  if (catMaisComum && catMaisComum.total > resumo.totalTickets * 0.3) {
    sugestoes.push(`A categoria "${catMaisComum.categoria}" representa ${Math.round(catMaisComum.total / resumo.totalTickets * 100)}% dos chamados. Crie um FAQ ou automação específica para esse tipo de problema.`);
  }

  const clienteRecorrente = porCliente.find(c => c.total > 3);
  if (clienteRecorrente) {
    sugestoes.push(`O cliente "${clienteRecorrente.clienteNome}" abriu ${clienteRecorrente.total} chamados esta semana. Considere um atendimento dedicado ou treinamento para reduzir chamados repetidos.`);
  }

  if (resumo.tempoMedioResposta > 30) {
    sugestoes.push(`O tempo médio de resposta de ${resumo.tempoMedioResposta} min está alto. Considere adicionar mais agentes no horário de pico ou implementar respostas automáticas para dúvidas comuns.`);
  }

  if (resumo.csatMedio < 3.5) {
    sugestoes.push(`O CSAT de ${resumo.csatMedio}/5 indica insatisfação. Realize uma pesquisa com clientes de baixa nota para identificar gargalos no atendimento.`);
  }

  if (comparativo.deltaTickets > 5) {
    sugestoes.push(`Houve aumento de ${comparativo.deltaTickets} tickets vs semana anterior. Verifique se há problemas recorrentes que possam ser resolvidos com comunicação proativa.`);
  }

  if (sugestoes.length === 0) {
    sugestoes.push(`Mantenha o bom trabalho! A equipe está com desempenho consistente. Foque em automatizar tarefas repetitivas para ganhar eficiência.`);
  }

  return sugestoes.slice(0, 5);
}

// ── Formatação da Mensagem WhatsApp ────────────────────────────

export function formatarMensagemWhatsApp(report: WeeklyReportData): string {
  const linhas: string[] = [];

  linhas.push(`📊 *RELATÓRIO SEMANAL*`);
  linhas.push(`📅 ${report.periodo.label}`);
  linhas.push('');

  // Resumo
  linhas.push(`📋 *RESUMO*`);
  linhas.push(`• Total de tickets: *${report.resumo.totalTickets}*`);
  linhas.push(`• Resolvidos: *${report.resumo.ticketsFechados}* (${report.resumo.taxaResolucao}%)`);
  linhas.push(`• Abertos: *${report.resumo.ticketsAbertos}*`);
  linhas.push('');

  // Performance
  linhas.push(`⚡ *PERFORMANCE*`);
  linhas.push(`• Tempo médio resposta: *${report.resumo.tempoMedioResposta} min*`);
  linhas.push(`• Tempo médio resolução: *${report.resumo.tempoMedioResolucao} min*`);
  linhas.push(`• SLA cumprido: *${report.resumo.taxaSla}%*`);
  linhas.push(`• CSAT médio: *${report.resumo.csatMedio}/5* (${report.resumo.csatTotalRespostas} respostas)`);
  linhas.push(`• FCR (resolução 1º contato): *${report.resumo.fcr}%*`);
  linhas.push('');

  // Comparativo
  const cmp = report.comparativoSemanaAnterior;
  linhas.push(`📈 *COMPARATIVO VS SEMANA ANTERIOR*`);
  linhas.push(`• Tickets: ${cmp.deltaTickets > 0 ? '📈 +' : '📉 '}${cmp.deltaTickets}`);
  linhas.push(`• Resolvidos: ${cmp.deltaFechados > 0 ? '📈 +' : '📉 '}${cmp.deltaFechados}`);
  linhas.push(`• Tempo resposta: ${cmp.deltaTempoResposta > 0 ? '📈 +' : '📉 '}${cmp.deltaTempoResposta} min`);
  linhas.push(`• CSAT: ${cmp.deltaCsat > 0 ? '📈 +' : '📉 '}${cmp.deltaCsat}`);
  linhas.push('');

  // Top categorias
  if (report.porCategoria.length > 0) {
    linhas.push(`📂 *TOP CATEGORIAS*`);
    for (const c of report.porCategoria.slice(0, 5)) {
      linhas.push(`• ${c.categoria}: ${c.total} tickets (${c.fechados} ✅)`);
    }
    linhas.push('');
  }

  // Top clientes
  if (report.porCliente.length > 0) {
    linhas.push(`🏢 *TOP CLIENTES*`);
    for (const c of report.porCliente.slice(0, 5)) {
      linhas.push(`• ${c.clienteNome}: ${c.total} chamados`);
    }
    linhas.push('');
  }

  // Performance por agente
  if (report.porAgente.length > 0) {
    linhas.push(`👥 *PERFORMANCE POR AGENTE*`);
    for (const a of report.porAgente.slice(0, 5)) {
      linhas.push(`• ${a.agenteNome}: ${a.atendidos} tickets, ${a.tempoMedio}min médio, CSAT ${a.csatMedio}`);
    }
    linhas.push('');
  }

  // Sugestões IA
  if (report.sugestoesIa.length > 0) {
    linhas.push(`💡 *SUGESTÕES PARA REDUZIR CHAMADOS*`);
    for (let i = 0; i < report.sugestoesIa.length; i++) {
      linhas.push(`${i + 1}. ${report.sugestoesIa[i]}`);
    }
    linhas.push('');
  }

  linhas.push(`_Relatório gerado automaticamente pelo Codemed Hub_`);

  return linhas.join('\n');
}

// ── Gerar Relatório Completo ───────────────────────────────────

export async function gerarRelatorioSemanal(dataInicio?: Date, dataFim?: Date): Promise<WeeklyReportData> {
  const { inicio, fim } = dataInicio && dataFim
    ? { inicio: dataInicio, fim: dataFim }
    : getWeekRange();

  console.log(`[WeeklyReport] Gerando relatório de ${inicio.toISOString()} a ${fim.toISOString()}`);

  const [resumo, porCliente, porCategoria, porDepartamento, porAgente, porCanal, porDia, topTickets, comparativo] = await Promise.all([
    coletarResumo(inicio, fim),
    coletarPorCliente(inicio, fim),
    coletarPorCategoria(inicio, fim),
    coletarPorDepartamento(inicio, fim),
    coletarPorAgente(inicio, fim),
    coletarPorCanal(inicio, fim),
    coletarPorDia(inicio, fim),
    identificarTicketsProblema(inicio, fim),
    compararComSemanaAnterior(fim, await coletarResumo(inicio, fim)),
  ]);

  const sugestoesIa = await gerarSugestoesIa({
    resumo,
    porCategoria,
    porCliente,
    porDepartamento,
    porAgente,
    topTickets,
    comparativo,
  });

  const report: WeeklyReportData = {
    periodo: { inicio, fim, label: formatPeriod(inicio, fim) },
    resumo,
    porCliente,
    porCategoria,
    porDepartamento,
    porAgente,
    porCanal,
    porDia,
    comparativoSemanaAnterior: comparativo,
    sugestoesIa,
    topTicketsProblema: topTickets,
  };

  console.log(`[WeeklyReport] Relatório gerado: ${report.resumo.totalTickets} tickets, ${report.sugestoesIa.length} sugestões`);

  return report;
}

// ── Enviar Relatório via WhatsApp ──────────────────────────────

export async function enviarRelatorioSemanalWhatsApp(): Promise<{ enviado: boolean; erro?: string }> {
  try {
    const report = await gerarRelatorioSemanal();
    const mensagem = formatarMensagemWhatsApp(report);

    // Buscar destinatários ativos
    const recipients = await prisma.alertRecipient.findMany({ where: { ativo: true } });
    if (recipients.length === 0) {
      console.warn('[WeeklyReport] Nenhum destinatário configurado');
      return { enviado: false, erro: 'Nenhum destinatário configurado' };
    }

    const { sendWhatsAppMessage } = await import('../integrations/whatsapp/whatsapp.service');

    let enviados = 0;
    for (const r of recipients) {
      if (!r.whatsapp) continue;
      const result = await sendWhatsAppMessage(r.whatsapp, mensagem);
      if (result.success) enviados++;
    }

    // Salvar no histórico
    await prisma.alertHistory.create({
      data: {
        tipo: 'relatorio_semanal',
        destinatarios: recipients.map(r => r.nome).join(', '),
        conteudo: mensagem,
        status: enviados > 0 ? 'enviado' : 'erro',
      },
    });

    console.log(`[WeeklyReport] Relatório enviado para ${enviados}/${recipients.length} destinatários`);
    return { enviado: enviados > 0 };
  } catch (error: any) {
    console.error('[WeeklyReport] Erro ao enviar relatório:', error?.message || error);
    return { enviado: false, erro: error?.message };
  }
}
