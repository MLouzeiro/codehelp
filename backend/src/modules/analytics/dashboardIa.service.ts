import prisma from '../../config/database';
import { callClaude, hasClaude } from '../../shared/aiClient';
import {
  getIndicadoresAtendimento,
  getAlertasIndicadores,
  AlertaIndicador,
  IndicadoresAtendimento,
  AnalistaIndicador,
} from '../helpdesk/indicadores.service';
import { gerarRelatorioSemanal } from './weeklyReport.service';

// ── Dashboard IA — Gestão Inteligente ──────────────────────────────────
// Compõe os indicadores de atendimento (FASE B), o relatório semanal
// (gerencial) e as auditorias IA (nota por agente + encerramento) em um
// único painel de gestão com insights gerenciais.

export interface EncerramentosAnalista {
  auditados: number;
  prematuros: number;
  resolucoesReais: number;
  reaberturas: number;
  semDados: number;
  notaMedia: number;
}

export interface AnalistaDashboardIa extends AnalistaIndicador {
  notaIa: number | null; // média 0-10 das auditorias de atendimento IA no período
  auditoriasIa: number;  // quantidade de auditorias IA consideradas
  encerramentos: EncerramentosAnalista;
}

export interface InsightGerencial {
  texto: string;
  gravidade: 'info' | 'atencao' | 'critico';
}

export interface DashboardIaData {
  atualizadoEm: string;
  periodo: { inicio: string; fim: string; label: string; dias: number };
  cards: IndicadoresAtendimento['cards'];
  sla: IndicadoresAtendimento['sla'];
  primeiraResposta: IndicadoresAtendimento['primeiraResposta'];
  porAnalista: AnalistaDashboardIa[];
  porDia: { dia: string; total: number; fechados: number }[];
  comparativo: {
    deltaTickets: number;
    deltaFechados: number;
    deltaTempoResposta: number;
    deltaCsat: number;
    deltaSla: number;
  };
  topTicketsProblema: { ticketId: string; protocolo: string; cliente: string; assunto: string; tempoHoras: number; csat: number | null }[];
  alertas: AlertaIndicador[];
  insights: InsightGerencial[];
  fonte: 'claude' | 'local';
}

// ── Helpers ────────────────────────────────────────────────────────────

function getRange(dias: number): { inicio: Date; fim: Date } {
  const fim = new Date();
  const inicio = new Date(fim);
  inicio.setDate(fim.getDate() - (dias - 1));
  inicio.setHours(0, 0, 0, 0);
  return { inicio, fim };
}

function fmtPeriodo(inicio: Date, fim: Date): string {
  const f = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return `${f(inicio)} a ${f(fim)}`;
}

// ── Coleta das auditorias IA por agente ────────────────────────────────

async function coletarAuditoriasPorAgente(inicio: Date, fim: Date) {
  const agrupado = await prisma.aIAgentAudit.groupBy({
    by: ['agentId'],
    where: { processadoEm: { gte: inicio, lte: fim } },
    _avg: { notaGeral: true },
    _count: { id: true },
  });
  const map = new Map<string, { notaIa: number | null; auditoriasIa: number }>();
  for (const a of agrupado) {
    map.set(a.agentId, {
      notaIa: a._avg.notaGeral != null ? Math.round(a._avg.notaGeral * 10) / 10 : null,
      auditoriasIa: a._count.id,
    });
  }
  return map;
}

async function coletarEncerramentosPorAgente(inicio: Date, fim: Date) {
  const agrupado = await prisma.aIAgentClosureAudit.groupBy({
    by: ['agentId', 'tipo'],
    where: { agentId: { not: null }, processadoEm: { gte: inicio, lte: fim } },
    _avg: { nota: true },
    _count: { id: true },
  });
  const map = new Map<string, EncerramentosAnalista>();
  for (const a of agrupado) {
    if (!a.agentId) continue;
    const cur = map.get(a.agentId) || {
      auditados: 0,
      prematuros: 0,
      resolucoesReais: 0,
      reaberturas: 0,
      semDados: 0,
      notaMedia: 0,
    };
    cur.auditados += a._count.id;
    if (a.tipo === 'encerramento_prematuro') cur.prematuros += a._count.id;
    else if (a.tipo === 'resolucao_real') cur.resolucoesReais += a._count.id;
    else if (a.tipo === 'reabertura') cur.reaberturas += a._count.id;
    else if (a.tipo === 'sem_dados') cur.semDados += a._count.id;
    if (a._avg.nota != null) {
      cur.notaMedia += (a._avg.nota || 0) * a._count.id;
    }
    map.set(a.agentId, cur);
  }
  for (const cur of map.values()) {
    if (cur.auditados > 0) cur.notaMedia = Math.round((cur.notaMedia / cur.auditados) * 10) / 10;
  }
  return map;
}

// ── Insights gerenciais ────────────────────────────────────────────────

function mediaPonderada(itens: { peso: number; valor: number }[]): number {
  let somaPeso = 0;
  let somaValor = 0;
  for (const i of itens) {
    if (i.peso > 0 && i.valor > 0) {
      somaPeso += i.peso;
      somaValor += i.valor * i.peso;
    }
  }
  return somaPeso > 0 ? Math.round((somaValor / somaPeso) * 10) / 10 : 0;
}

function calcularCsatFcr(porAnalista: AnalistaDashboardIa[]): { csatMedio: number; fcrMedio: number } {
  const csat = mediaPonderada(porAnalista.map(a => ({ peso: a.tickets, valor: a.csatMedia })));
  const fcr = mediaPonderada(porAnalista.map(a => ({ peso: a.tickets, valor: a.fcr })));
  return { csatMedio: csat, fcrMedio: fcr };
}

async function gerarInsights(dados: {
  cards: IndicadoresAtendimento['cards'];
  sla: IndicadoresAtendimento['sla'];
  porAnalista: AnalistaDashboardIa[];
  comparativo: any;
  topTickets: { protocolo: string; tempoHoras: number }[];
  alertas: AlertaIndicador[];
}): Promise<{ insights: InsightGerencial[]; fonte: 'claude' | 'local' }> {
  const { csatMedio, fcrMedio } = calcularCsatFcr(dados.porAnalista);

  if (!hasClaude()) {
    return { insights: gerarInsightsLocais(dados, csatMedio, fcrMedio), fonte: 'local' };
  }

  const top3 = dados.porAnalista.slice(0, 5).map(a => ({
    nome: a.agenteNome,
    tickets: a.tickets,
    fcr: a.fcr,
    csat: a.csatMedia,
    notaIa: a.notaIa,
    encerramentosPrematuros: a.encerramentos.prematuros,
  }));
  const alertasResumo = dados.alertas
    .slice(0, 8)
    .map(a => `[${a.gravidade}] ${a.titulo}: ${a.mensagem}`);

  const prompt = `Você é um gestor de operações de suporte técnico. Com base nos dados abaixo, gere EXATAMENTE 4 insights gerenciais objetivos e acionáveis.

DADOS:
- Total de tickets: ${dados.cards.totalTickets.valor}
- TMR (resolução): ${dados.cards.tmr.valor} min (meta ${dados.cards.tmr.meta})
- TME (espera do cliente): ${dados.cards.tme.valor} min (meta ${dados.cards.tme.meta})
- Primeira resposta: ${dados.cards.primeiraResposta.valor} min (meta ${dados.cards.primeiraResposta.meta})
- SLA cumprido: ${dados.sla.percentualCumprimento}%
- CSAT médio: ${csatMedio}/5
- FCR: ${fcrMedio}%

COMPARATIVO:
- Delta tickets: ${dados.comparativo.deltaTickets}
- Delta SLA: ${dados.comparativo.deltaSla}%

TOP ANALISTAS (por tickets atendidos):
${JSON.stringify(top3)}

ALERTAS ATIVOS:
${alertasResumo.join('\n') || 'Nenhum'}

REGRAS:
1. Cada insight deve ter NO MÁXIMO 2 frases e citar números reais.
2. Foque em: treinamento de analistas, automação/KB, SLA, qualidade de encerramento, CSAT.
3. Classifique cada um como "info", "atencao" ou "critico" conforme a urgência.
4. Responda APENAS com JSON: {"insights":[{"texto":"...","gravidade":"info|atencao|critico"}]}`;

  try {
    const text = await callClaude(prompt, 500, 'dashboard-ia');
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed.insights)) {
        const insights = parsed.insights
          .filter((i: any) => i && typeof i.texto === 'string')
          .slice(0, 4)
          .map((i: any) => ({
            texto: i.texto,
            gravidade: ['info', 'atencao', 'critico'].includes(i.gravidade) ? i.gravidade : 'info',
          }));
        if (insights.length > 0) return { insights, fonte: 'claude' };
      }
    }
  } catch (e) {
    console.warn('[DashboardIA] Falha ao gerar insights IA:', (e as Error).message);
  }

  return { insights: gerarInsightsLocais(dados, csatMedio, fcrMedio), fonte: 'local' };
}

function gerarInsightsLocais(
  dados: {
    cards: IndicadoresAtendimento['cards'];
    sla: IndicadoresAtendimento['sla'];
    porAnalista: AnalistaDashboardIa[];
    comparativo: any;
    topTickets: { protocolo: string; tempoHoras: number }[];
    alertas: AlertaIndicador[];
  },
  csatMedio: number,
  fcrMedio: number,
): InsightGerencial[] {
  const insights: InsightGerencial[] = [];
  const c = dados.cards;

  if (dados.sla.percentualCumprimento < c.sla.meta) {
    insights.push({
      texto: `SLA em ${dados.sla.percentualCumprimento}% (meta ${c.sla.meta}%). ${dados.sla.violado} ticket(s) violado(s) e ${dados.sla.emRisco} em risco — priorize a fila de SLA.`,
      gravidade: 'critico',
    });
  } else if (dados.sla.emRisco > 0) {
    insights.push({
      texto: `SLA estável em ${dados.sla.percentualCumprimento}%, mas ${dados.sla.emRisco} ticket(s) em risco de violação.`,
      gravidade: 'atencao',
    });
  }

  if (c.tmr.valor > 0 && c.tmr.meta > 0 && c.tmr.valor > c.tmr.meta) {
    insights.push({
      texto: `TMR de ${c.tmr.valor}min acima da meta de ${c.tmr.meta}min. Reveja o fluxo de atendimento e a priorização das filas.`,
      gravidade: 'atencao',
    });
  }

  if (c.primeiraResposta.valor > 0 && c.primeiraResposta.meta > 0 && c.primeiraResposta.valor > c.primeiraResposta.meta) {
    insights.push({
      texto: `Primeira resposta em ${c.primeiraResposta.valor}min acima da meta de ${c.primeiraResposta.meta}min. Avalie respostas automáticas para dúvidas comuns.`,
      gravidade: 'atencao',
    });
  }

  if (csatMedio > 0 && csatMedio < 3.5) {
    insights.push({
      texto: `CSAT de ${csatMedio}/5 abaixo do aceitável. Pesquise com clientes de baixa nota para identificar gargalos no atendimento.`,
      gravidade: 'critico',
    });
  }

  if (fcrMedio > 0 && fcrMedio < 60) {
    insights.push({
      texto: `FCR de ${fcrMedio}% abaixo de 60%. Capacite os analistas para resolver na primeira interação e use a base de conhecimento.`,
      gravidade: 'atencao',
    });
  }

  const analistaPiorIa = [...dados.porAnalista]
    .filter(a => a.auditoriasIa > 0 && a.notaIa != null)
    .sort((a, b) => (a.notaIa || 0) - (b.notaIa || 0))[0];
  if (analistaPiorIa && analistaPiorIa.notaIa != null && analistaPiorIa.notaIa < 7) {
    insights.push({
      texto: `${analistaPiorIa.agenteNome} tem nota IA média ${analistaPiorIa.notaIa}/10 em ${analistaPiorIa.auditoriasIa} auditorias. Agende coaching direcionado.`,
      gravidade: 'atencao',
    });
  }

  const analistaPrematuros = [...dados.porAnalista]
    .filter(a => a.encerramentos.prematuros > 0)
    .sort((a, b) => b.encerramentos.prematuros - a.encerramentos.prematuros)[0];
  if (analistaPrematuros && analistaPrematuros.encerramentos.prematuros >= 2) {
    insights.push({
      texto: `${analistaPrematuros.agenteNome} encerrou ${analistaPrematuros.encerramentos.prematuros} ticket(s) prematuramente. Reforce o fluxo de confirmação de resolução.`,
      gravidade: 'atencao',
    });
  }

  const criticos = dados.alertas.filter(a => a.gravidade === 'critico').length;
  const atencao = dados.alertas.filter(a => a.gravidade === 'atencao').length;
  if (criticos > 0) {
    insights.push({
      texto: `${criticos} alerta(s) crítico(s) e ${atencao} de atenção ativos. Trate os tickets de SLA violado e os parados primeiro.`,
      gravidade: 'critico',
    });
  } else if (atencao > 0) {
    insights.push({
      texto: `${atencao} alerta(s) de atenção ativos. Monitore a fila para evitar SLA violado.`,
      gravidade: 'info',
    });
  }

  const top = dados.topTickets[0];
  if (top && top.tempoHoras >= 24) {
    insights.push({
      texto: `Ticket #${top.protocolo} parado há ${top.tempoHoras}h. Desbloqueie ou reatribua para evitar acúmulo de atraso.`,
      gravidade: 'atencao',
    });
  }

  if (dados.comparativo.deltaTickets > 0) {
    insights.push({
      texto: `Volume aumentou ${dados.comparativo.deltaTickets} ticket(s) vs período anterior. Verifique comunicação proativa e KB para absorver a demanda.`,
      gravidade: 'info',
    });
  }

  if (insights.length === 0) {
    insights.push({
      texto: 'Desempenho consistente no período. Foque em automatizar tarefas repetitivas e manter a qualidade de encerramento.',
      gravidade: 'info',
    });
  }

  return insights.slice(0, 4);
}

// ── Endpoint principal ─────────────────────────────────────────────────

export async function getDashboardIa(dias = 7): Promise<DashboardIaData> {
  const diasFinal = Math.min(Math.max(Number.isFinite(dias) ? dias : 7, 1), 90);
  const { inicio, fim } = getRange(diasFinal);

  const [indicadores, alertasData, relatorio, auditoriasMap, encerramentosMap] = await Promise.all([
    getIndicadoresAtendimento({ inicio, fim }),
    getAlertasIndicadores({ inicio, fim }),
    gerarRelatorioSemanal(inicio, fim),
    coletarAuditoriasPorAgente(inicio, fim),
    coletarEncerramentosPorAgente(inicio, fim),
  ]);

  const porAnalista: AnalistaDashboardIa[] = indicadores.porAnalista.map(a => {
    const aud = auditoriasMap.get(a.agenteId);
    const enc = encerramentosMap.get(a.agenteId) || {
      auditados: 0,
      prematuros: 0,
      resolucoesReais: 0,
      reaberturas: 0,
      semDados: 0,
      notaMedia: 0,
    };
    return {
      ...a,
      notaIa: aud ? aud.notaIa : null,
      auditoriasIa: aud ? aud.auditoriasIa : 0,
      encerramentos: enc,
    };
  });

  const insights = await gerarInsights({
    cards: indicadores.cards,
    sla: indicadores.sla,
    porAnalista,
    comparativo: relatorio.comparativoSemanaAnterior,
    topTickets: relatorio.topTicketsProblema,
    alertas: alertasData.alertas,
  });

  return {
    atualizadoEm: new Date().toISOString(),
    periodo: { inicio: inicio.toISOString(), fim: fim.toISOString(), label: fmtPeriodo(inicio, fim), dias: diasFinal },
    cards: indicadores.cards,
    sla: indicadores.sla,
    primeiraResposta: indicadores.primeiraResposta,
    porAnalista,
    porDia: relatorio.porDia,
    comparativo: relatorio.comparativoSemanaAnterior,
    topTicketsProblema: relatorio.topTicketsProblema,
    alertas: alertasData.alertas,
    insights: insights.insights,
    fonte: insights.fonte,
  };
}