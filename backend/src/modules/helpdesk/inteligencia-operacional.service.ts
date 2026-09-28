import prisma from '../../config/database';
import { buildWhere, RelatorioFiltros } from '../analytics/relatorios.service';
import {
  STATUS_ABERTO,
  STATUS_ENCERRADO,
  ETAPAS_ENCERRADAS,
  WHERE_TICKET_RESOLVIDO,
} from './constants';

// ── Types ───────────────────────────────────────────────────────────────

export interface FiltrosInteligencia extends RelatorioFiltros {
  nivelSuporte?: string;
  comReabertura?: boolean;
}

export type NivelSuporte = 'N1' | 'N2' | 'N3';

export interface ClassificacaoNivel {
  nivel: NivelSuporte;
  sugeridoIa: boolean;
  confianca: number | null;
  motivo: string | null;
  classificadoPor: string | null;
  classificadoEm: Date | null;
}

export interface AnaliseAssunto {
  assuntoId: string;
  assuntoNome: string;
  categoriaNome: string | null;
  total: number;
  percentual: number;
  tendencia: {
    atual: number;
    anterior: number;
    variacaoPct: number;
    direcao: 'crescendo' | 'diminuindo' | 'estavel';
  };
  porNivel: { N1: number; N2: number; N3: number };
  resolvidos: number;
  abertos: number;
  reabertos: number;
  emAtraso: number;
  sla: { total: number; cumprido: number; percentual: number };
  csatMedio: number | null;
  csatTotal: number;
  tempoMedioMin: number;
  tempoMedianoMin: number;
  primeiraRespostaMin: number;
  transferencias: number;
  retrabalho: number;
  clientesAfetados: number;
  prioridadeOperacional: number;
  recomendacoes: RecomendacaoAssunto[];
}

export interface RecomendacaoAssunto {
  tipo: 'automacao' | 'base_conhecimento' | 'procedimento_n1' | 'roteiro_diagnostico' | 'problema_sistemico' | 'plano_correcao';
  titulo: string;
  descricao: string;
  prioridade: 'urgente' | 'alta' | 'media' | 'baixa';
  evidencias: string[];
  confianca: 'alta' | 'media' | 'baixa';
  impactoEstimado: string;
}

export interface AnaliseCliente {
  clienteId: string;
  clienteNome: string;
  risco: 'baixo' | 'atencao' | 'alto' | 'critico';
  scoreRisco: number;
  fatores: FatorRisco[];
  totalChamadosPeriodo: number;
  chamadosAbertos: number;
  chamadosSimultaneos: number;
  reaberturas: number;
  transferencias: number;
  slaExcedidos: number;
  csatMedio: number | null;
  tempoEsperaMin: number;
  assuntosMaisFrequentes: Array<{ assunto: string; total: number }>;
  recomendacoes: RecomendacaoCliente[];
}

export interface FatorRisco {
  tipo: string;
  descricao: string;
  peso: number;
  valor: number;
}

export interface RecomendacaoCliente {
  titulo: string;
  descricao: string;
  prioridade: 'urgente' | 'alta' | 'media' | 'baixa';
}

export interface ProgressoChamado {
  ticketId: string;
  protocolo: string | null;
  contactName: string | null;
  etapa: string;
  status: string;
  nivelSuporte: string | null;
  assigneeNome: string | null;
  clienteNome: string | null;
  progresso: 'em_progresso' | 'atencao' | 'parado' | 'critico';
  ultimaAtividadeRelevante: Date | null;
  tempoSemProgressoMin: number;
  slaRestanteMin: number | null;
  slaStatus: string | null;
  fatores: string[];
}

export interface IndicePrioridadeOperacional {
  assunto: string;
  score: number;
  fatores: {
    volume: number;
    crescimento: number;
    impacto: number;
    sla: number;
    reabertura: number;
    clientes: number;
    complexidade: number;
  };
  classificacao: 'critico' | 'alto' | 'medio' | 'baixo';
}

export interface EscalonamentoNiveis {
  total: number;
  n1ParaN2: number;
  n2ParaN3: number;
  n1ParaN3: number;
  taxaN1ParaN2: number;
  taxaN2ParaN3: number;
  taxaN1ParaN3: number;
  porAssunto: Array<{
    assunto: string;
    total: number;
    n1ParaN2: number;
    n2ParaN3: number;
    taxaEscalonamento: number;
  }>;
}

export interface OportunidadeAutomacao {
  assunto: string;
  tipo: 'chatbot' | 'macro' | 'resposta_pronta' | 'base_conhecimento' | 'automacao' | 'procedimento_n1';
  motivo: string;
  volumePotencial: number;
  tempoEconomizadoMin: number;
  confianca: 'alta' | 'media' | 'baixa';
}

export interface PossivelBug {
  assunto: string;
  clientesAfetados: number;
  totalChamados: number;
  crescimentoPct: number;
  nivelN2N3: number;
  reaberturas: number;
  evidencias: string[];
  confianca: 'alta' | 'media' | 'baixa';
}

export interface ResumoExecutivo {
  totalChamados: number;
  abertos: number;
  resolvidos: number;
  reabertos: number;
  n1: number;
  n2: number;
  n3: number;
  parados: number;
  slaEmRisco: number;
  clientesEmRisco: number;
  principaisAssuntos: Array<{ assunto: string; total: number; variacao: number }>;
  principaisAlertas: Array<{ nivel: string; titulo: string; descricao: string }>;
  decisoesRecomendadas: RecomendacaoAssunto[];
}

export interface InteligenciaCompleta {
  atualizadoEm: string;
  periodo: { inicio: Date; fim: Date; label: string; dias: number };
  resumoExecutivo: ResumoExecutivo;
  analiseAssuntos: AnaliseAssunto[];
  rankingAssuntos: Array<{ posicao: number; assunto: string; total: number; score: number }>;
  clientesEmRisco: AnaliseCliente[];
  chamadosParados: ProgressoChamado[];
  escalonamento: EscalonamentoNiveis;
  oportunidadesAutomacao: OportunidadeAutomacao[];
  possiveisBugs: PossivelBug[];
}

// ── Helpers ─────────────────────────────────────────────────────────────

function range(dias: number): { inicio: Date; fim: Date } {
  const fim = new Date();
  fim.setHours(23, 59, 59, 999);
  const inicio = new Date(fim);
  inicio.setDate(fim.getDate() - (dias - 1));
  inicio.setHours(0, 0, 0, 0);
  return { inicio, fim };
}

function rangeAnterior(inicio: Date, fim: Date): { inicio: Date; fim: Date } {
  const duracao = fim.getTime() - inicio.getTime();
  const antFim = new Date(inicio.getTime() - 1);
  const antInicio = new Date(antFim.getTime() - duracao);
  return { inicio: antInicio, fim: antFim };
}

function mediana(valores: number[]): number {
  if (valores.length === 0) return 0;
  const sorted = [...valores].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function classificarPrioridade(score: number): 'critico' | 'alto' | 'medio' | 'baixo' {
  if (score >= 80) return 'critico';
  if (score >= 60) return 'alto';
  if (score >= 40) return 'medio';
  return 'baixo';
}

function classificarRisco(score: number): 'baixo' | 'atencao' | 'alto' | 'critico' {
  if (score >= 80) return 'critico';
  if (score >= 60) return 'alto';
  if (score >= 35) return 'atencao';
  return 'baixo';
}

function classificarProgresso(
  tempoSemProgressoMin: number,
  slaRestanteMin: number | null,
  etapa: string,
): 'em_progresso' | 'atencao' | 'parado' | 'critico' {
  if (etapa === 'concluido') return 'em_progresso';
  if (slaRestanteMin !== null && slaRestanteMin <= 0) return 'critico';
  if (tempoSemProgressoMin >= 480) return 'critico'; // 8h
  if (tempoSemProgressoMin >= 240) return 'parado'; // 4h
  if (tempoSemProgressoMin >= 120) return 'atencao'; // 2h
  return 'em_progresso';
}

// ── Análise por Assunto ─────────────────────────────────────────────────

export async function analisePorAssunto(filtros: FiltrosInteligencia): Promise<AnaliseAssunto[]> {
  const dias = filtros.fim && filtros.inicio
    ? Math.ceil((filtros.fim.getTime() - filtros.inicio.getTime()) / (24 * 60 * 60 * 1000)) + 1
    : 30;
  const { inicio, fim } = filtros.inicio && filtros.fim
    ? { inicio: filtros.inicio, fim: filtros.fim }
    : range(dias);
  const ant = rangeAnterior(inicio, fim);

  const whereBase = buildWhere(filtros);

  // Buscar todos os tickets do período com joins necessários
  const tickets = await prisma.ticket.findMany({
    where: {
      ...whereBase,
      createdAt: { gte: inicio, lte: fim },
    },
    include: {
      metrics: { select: { totalReaberturas: true, slaStatus: true, tempoTotalMin: true, csatNota: true, csatRespondido: true, slaRestanteMinutos: true } },
      nivelSuporte: { select: { slug: true, nome: true } },
      client: { select: { id: true, razaoSocial: true } },
      assignee: { select: { id: true, name: true } },
      stageHistory: { select: { etapaNova: true, createdAt: true } },
      messages: { select: { fromMe: true, tipo: true, sentAt: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Tickets do período anterior para comparação
  const ticketsAnterior = await prisma.ticket.findMany({
    where: {
      ...whereBase,
      createdAt: { gte: ant.inicio, lte: ant.fim },
    },
    select: { id: true, assunto: true },
  });

  // Agrupar por assunto
  const assuntoMap = new Map<string, {
    tickets: typeof tickets;
    anterior: number;
  }>();

  for (const ticket of tickets) {
    const assunto = ticket.assunto || 'Sem assunto';
    if (!assuntoMap.has(assunto)) {
      assuntoMap.set(assunto, { tickets: [], anterior: 0 });
    }
    assuntoMap.get(assunto)!.tickets.push(ticket);
  }

  for (const ticket of ticketsAnterior) {
    const assunto = ticket.assunto || 'Sem assunto';
    const entry = assuntoMap.get(assunto);
    if (entry) {
      entry.anterior++;
    } else {
      assuntoMap.set(assunto, { tickets: [], anterior: 1 });
    }
  }

  const totalGeral = tickets.length;
  const resultados: AnaliseAssunto[] = [];

  for (const [assuntoNome, dados] of assuntoMap) {
    const { tickets: tks, anterior } = dados;
    const total = tks.length;
    const percentual = totalGeral > 0 ? (total / totalGeral) * 100 : 0;

    // Tendência
    const variacaoPct = anterior > 0 ? ((total - anterior) / anterior) * 100 : total > 0 ? 100 : 0;
    const direcao = variacaoPct > 10 ? 'crescendo' : variacaoPct < -10 ? 'diminuindo' : 'estavel';

    // N1/N2/N3
    const porNivel = { N1: 0, N2: 0, N3: 0 };
    for (const tk of tks) {
      const nivel = tk.nivelSuporte?.slug;
      if (nivel === 'N1' || nivel === 'N2' || nivel === 'N3') {
        porNivel[nivel]++;
      }
    }

    // Status
    const resolvidos = tks.filter(t =>
      t.status === 'fechado' || t.etapa === 'concluido'
    ).length;
    const abertos = tks.filter(t =>
      STATUS_ABERTO.includes(t.status) && !ETAPAS_ENCERRADAS.includes(t.etapa)
    ).length;
    const reabertos = tks.reduce((acc, t) => acc + (t.metrics?.totalReaberturas || 0), 0);

    // SLA
    const slaTotal = tks.filter(t => t.metrics?.slaStatus).length;
    const slaCumprido = tks.filter(t => t.metrics?.slaStatus === 'cumprido').length;
    const slaPercentual = slaTotal > 0 ? (slaCumprido / slaTotal) * 100 : 100;

    // CSAT
    const csatTickets = tks.filter(t => t.metrics?.csatRespondido && t.metrics?.csatNota);
    const csatMedio = csatTickets.length > 0
      ? csatTickets.reduce((acc, t) => acc + (t.metrics!.csatNota || 0), 0) / csatTickets.length
      : null;

    // Tempo médio
    const temposResolvidos = tks
      .filter(t => t.metrics?.tempoTotalMin && t.metrics.tempoTotalMin > 0)
      .map(t => t.metrics!.tempoTotalMin!);
    const tempoMedioMin = temposResolvidos.length > 0
      ? temposResolvidos.reduce((a, b) => a + b, 0) / temposResolvidos.length
      : 0;
    const tempoMedianoMin = mediana(temposResolvidos);

    // Primeira resposta
    const temposPrimeiraResposta = tks
      .filter(t => t.dataPrimeiraResposta)
      .map(t => {
        const diff = t.dataPrimeiraResposta!.getTime() - t.dataAbertura.getTime();
        return Math.round(diff / 60000);
      });
    const primeiraRespostaMin = temposPrimeiraResposta.length > 0
      ? temposPrimeiraResposta.reduce((a, b) => a + b, 0) / temposPrimeiraResposta.length
      : 0;

    // Transferências (contagem de mudanças de assignee)
    const transferencias = tks.reduce((acc, t) => {
      const uniqueAgents = new Set(t.stageHistory.filter(s => s.etapaNova === 'em_atendimento').map(() => t.assigneeId));
      return acc + Math.max(0, uniqueAgents.size - 1);
    }, 0);

    // Retrabalho
    const retrabalho = tks.reduce((acc, t) => {
      const reaberturas = t.metrics?.totalReaberturas || 0;
      return acc + (reaberturas > 0 ? 1 : 0);
    }, 0);

    // Em atraso
    const emAtraso = tks.filter(t =>
      t.metrics?.slaStatus === 'violado' ||
      (t.metrics?.slaRestanteMinutos !== null && t.metrics?.slaRestanteMinutos !== undefined && t.metrics.slaRestanteMinutos <= 0)
    ).length;

    // Clientes afetados
    const clientesAfetados = new Set(tks.filter(t => t.clientId).map(t => t.clientId)).size;

    // Índice de prioridade operacional
    const score = calcularIndicePrioridade({
      volume: total,
      crescimento: variacaoPct,
      sla: slaPercentual,
      reabertura: reabertos,
      clientes: clientesAfetados,
      complexidadeN2N3: porNivel.N2 + porNivel.N3,
      csat: csatMedio,
      emAtraso,
    });

    // Recomendações
    const recomendacoes = gerarRecomendacoesAssunto({
      assuntoNome,
      total,
      variacaoPct,
      porNivel,
      resolvidos,
      abertos,
      reabertos,
      emAtraso,
      slaPercentual,
      csatMedio,
      clientesAfetados,
      tempoMedioMin,
      score,
    });

    resultados.push({
      assuntoId: tks[0]?.assuntoId || '',
      assuntoNome,
      categoriaNome: tks[0]?.categoria || null,
      total,
      percentual: Math.round(percentual * 10) / 10,
      tendencia: {
        atual: total,
        anterior,
        variacaoPct: Math.round(variacaoPct * 10) / 10,
        direcao,
      },
      porNivel,
      resolvidos,
      abertos,
      reabertos,
      emAtraso,
      sla: { total: slaTotal, cumprido: slaCumprido, percentual: Math.round(slaPercentual * 10) / 10 },
      csatMedio: csatMedio ? Math.round(csatMedio * 10) / 10 : null,
      csatTotal: csatTickets.length,
      tempoMedioMin: Math.round(tempoMedioMin),
      tempoMedianoMin: Math.round(tempoMedianoMin),
      primeiraRespostaMin: Math.round(primeiraRespostaMin),
      transferencias,
      retrabalho,
      clientesAfetados,
      prioridadeOperacional: score,
      recomendacoes,
    });
  }

  // Ordenar por prioridade operacional (maior primeiro)
  resultados.sort((a, b) => b.prioridadeOperacional - a.prioridadeOperacional);

  return resultados;
}

// ── Índice de Prioridade Operacional ────────────────────────────────────
// Fórmula documentada e configurável
// Fatores: volume (20%), crescimento (15%), impacto/SLA (20%), reabertura (15%),
//          clientes afetados (10%), complexidade N2/N3 (10%), CSAT (10%)
// Cada fator é normalizado de 0-100 antes de aplicar o peso.

interface FatoresPrioridade {
  volume: number;
  crescimento: number;
  sla: number;
  reabertura: number;
  clientes: number;
  complexidadeN2N3: number;
  csat: number | null;
  emAtraso: number;
}

const PESOS_PRIORIDADE = {
  volume: 0.20,
  crescimento: 0.15,
  sla: 0.20,
  reabertura: 0.15,
  clientes: 0.10,
  complexidade: 0.10,
  csat: 0.10,
};

export function calcularIndicePrioridade(fatores: FatoresPrioridade): number {
  // Normalizar cada fator para 0-100
  const volumeNorm = Math.min(100, (fatores.volume / 100) * 100);
  const crescimentoNorm = Math.min(100, Math.max(0, fatores.crescimento));
  // SLA: invertido (menor SLA = maior prioridade)
  const slaNorm = Math.min(100, Math.max(0, 100 - fatores.sla));
  const reaberturaNorm = Math.min(100, (fatores.reabertura / Math.max(1, fatores.volume)) * 200);
  const clientesNorm = Math.min(100, (fatores.clientes / Math.max(1, fatores.volume)) * 150);
  const complexidadeNorm = Math.min(100, (fatores.complexidadeN2N3 / Math.max(1, fatores.volume)) * 150);
  // CSAT: invertido (menor CSAT = maior prioridade)
  const csatNorm = fatores.csat !== null ? Math.min(100, Math.max(0, (5 - fatores.csat) / 4 * 100)) : 50;
  // Bônus para em atraso
  const bonusAtraso = Math.min(20, fatores.emAtraso * 2);

  const score =
    volumeNorm * PESOS_PRIORIDADE.volume +
    crescimentoNorm * PESOS_PRIORIDADE.crescimento +
    slaNorm * PESOS_PRIORIDADE.sla +
    reaberturaNorm * PESOS_PRIORIDADE.reabertura +
    clientesNorm * PESOS_PRIORIDADE.clientes +
    complexidadeNorm * PESOS_PRIORIDADE.complexidade +
    csatNorm * PESOS_PRIORIDADE.csat +
    bonusAtraso;

  return Math.min(100, Math.round(score * 10) / 10);
}

// ── Recomendações por Assunto ───────────────────────────────────────────

function gerarRecomendacoesAssunto(dados: {
  assuntoNome: string;
  total: number;
  variacaoPct: number;
  porNivel: { N1: number; N2: number; N3: number };
  resolvidos: number;
  abertos: number;
  reabertos: number;
  emAtraso: number;
  slaPercentual: number;
  csatMedio: number | null;
  clientesAfetados: number;
  tempoMedioMin: number;
  score: number;
}): RecomendacaoAssunto[] {
  const recs: RecomendacaoAssunto[] = [];
  const { porNivel, total } = dados;

  // Automação: volume alto + N1 dominante
  const pctN1 = total > 0 ? (porNivel.N1 / total) * 100 : 0;
  if (dados.total >= 20 && pctN1 >= 50) {
    recs.push({
      tipo: 'automacao',
      titulo: 'Candidato à automação',
      descricao: `${dados.total} chamados com ${Math.round(pctN1)}% em N1. Possível automatizar com chatbot, macro ou resposta pronta.`,
      prioridade: dados.variacaoPct > 30 ? 'urgente' : 'alta',
      evidencias: [`${dados.total} chamados`, `${Math.round(pctN1)}% N1`, `CSAT ${dados.csatMedio || 'N/A'}`],
      confianca: pctN1 >= 70 ? 'alta' : 'media',
      impactoEstimado: `Redução estimada de ${Math.round(pctN1 * 0.3)}% no volume`,
    });
  }

  // Base de Conhecimento: N1 alto + solução repetitiva
  if (dados.total >= 15 && pctN1 >= 40) {
    recs.push({
      tipo: 'base_conhecimento',
      titulo: 'Criar/atualizar artigo da Base de Conhecimento',
      descricao: `${porNivel.N1} chamados N1 poderiam ser resolvidos com documentação adequada.`,
      prioridade: 'media',
      evidencias: [`${porNivel.N1} chamados N1`, `Tempo médio: ${dados.tempoMedioMin}min`],
      confianca: 'media',
      impactoEstimado: 'Redução de chamados N1 e tempo de atendimento',
    });
  }

  // Problema sistêmico: muitos clientes + N2/N3 + reabertura
  const pctN2N3 = total > 0 ? ((porNivel.N2 + porNivel.N3) / total) * 100 : 0;
  if (dados.clientesAfetados >= 3 && pctN2N3 >= 50 && dados.reabertos >= 3) {
    recs.push({
      tipo: 'problema_sistemico',
      titulo: 'Possível problema sistêmico',
      descricao: `${dados.clientesAfetados} clientes afetados, ${Math.round(pctN2N3)}% em N2/N3, ${dados.reabertos} reaberturas.`,
      prioridade: 'urgente',
      evidencias: [
        `${dados.clientesAfetados} clientes`,
        `${Math.round(pctN2N3)}% N2/N3`,
        `${dados.reabertos} reaberturas`,
        `SLA ${dados.slaPercentual}%`,
      ],
      confianca: dados.reabertos >= 5 ? 'alta' : 'media',
      impactoEstimado: 'Investigação técnica necessária',
    });
  }

  // Procedimento N1: N1 alto mas escalona para N2
  if (porNivel.N1 >= 10 && porNivel.N2 >= porNivel.N1 * 0.5) {
    recs.push({
      tipo: 'procedimento_n1',
      titulo: 'Criar procedimento de diagnóstico N1',
      descricao: 'Alta taxa de escalonamento de N1 para N2. Procedimento N1 pode reduzir escalonamentos desnecessários.',
      prioridade: 'alta',
      evidencias: [`${porNivel.N1} N1`, `${porNivel.N2} N2`, `Escalonamento: ${Math.round((porNivel.N2 / Math.max(1, porNivel.N1)) * 100)}%`],
      confianca: 'media',
      impactoEstimado: 'Redução de escalonamentos e tempo de resolução',
    });
  }

  // Plano de correção: reabertura alta
  const taxaReabertura = total > 0 ? (dados.reabertos / total) * 100 : 0;
  if (taxaReabertura >= 15) {
    recs.push({
      tipo: 'plano_correcao',
      titulo: 'Plano de correção definitiva',
      descricao: `${Math.round(taxaReabertura)}% de reabertura indica que a solução aplicada não resolve o problema.`,
      prioridade: 'urgente',
      evidencias: [`${dados.reabertos} reaberturas`, `${Math.round(taxaReabertura)}% taxa`],
      confianca: 'alta',
      impactoEstimado: 'Eliminação da causa raiz',
    });
  }

  // Roteiro de diagnóstico: N2 alto
  if (porNivel.N2 >= 10 && porNivel.N2 > porNivel.N1) {
    recs.push({
      tipo: 'roteiro_diagnostico',
      titulo: 'Criar roteiro de diagnóstico N2',
      descricao: `${porNivel.N2} chamados em N2. Roteiro pode acelerar o diagnóstico.`,
      prioridade: 'media',
      evidencias: [`${porNivel.N2} chamados N2`, `Tempo médio: ${dados.tempoMedioMin}min`],
      confianca: 'media',
      impactoEstimado: 'Redução do tempo médio de resolução',
    });
  }

  return recs;
}

// ── Análise de Risco de Cliente ─────────────────────────────────────────

export async function analiseRiscoClientes(filtros: FiltrosInteligencia): Promise<AnaliseCliente[]> {
  const dias = filtros.fim && filtros.inicio
    ? Math.ceil((filtros.fim.getTime() - filtros.inicio.getTime()) / (24 * 60 * 60 * 1000)) + 1
    : 30;
  const { inicio, fim } = filtros.inicio && filtros.fim
    ? { inicio: filtros.inicio, fim: filtros.fim }
    : range(dias);

  // Buscar tickets agrupados por cliente
  const ticketsPorCliente = await prisma.ticket.groupBy({
    by: ['clientId'],
    where: {
      createdAt: { gte: inicio, lte: fim },
      clientId: { not: null },
    },
    _count: { id: true },
    having: {
      id: { _count: { gte: 2 } }, // Clientes com 2+ chamados
    },
  });

  const clientes: AnaliseCliente[] = [];

  for (const grupo of ticketsPorCliente) {
    if (!grupo.clientId) continue;

    const tickets = await prisma.ticket.findMany({
      where: {
        clientId: grupo.clientId,
        createdAt: { gte: inicio, lte: fim },
      },
      include: {
        metrics: { select: { totalReaberturas: true, slaStatus: true, csatNota: true, csatRespondido: true, tempoTotalMin: true } },
        assignee: { select: { id: true, name: true } },
        client: { select: { id: true, razaoSocial: true } },
      },
    });

    const client = tickets[0]?.client;
    if (!client) continue;

    const total = tickets.length;
    const abertos = tickets.filter(t => STATUS_ABERTO.includes(t.status) && !ETAPAS_ENCERRADAS.includes(t.etapa)).length;
    const simultaneos = abertos; // Chamados simultâneos = abertos
    const reaberturas = tickets.reduce((acc, t) => acc + (t.metrics?.totalReaberturas || 0), 0);
    const slaExcedidos = tickets.filter(t => t.metrics?.slaStatus === 'violado').length;

    // Transferências (múltiplos assignees)
    const uniqueAgents = new Set(tickets.map(t => t.assigneeId).filter(Boolean));
    const transferencias = Math.max(0, uniqueAgents.size - 1);

    // CSAT
    const csatTickets = tickets.filter(t => t.metrics?.csatRespondido && t.metrics?.csatNota);
    const csatMedio = csatTickets.length > 0
      ? csatTickets.reduce((acc, t) => acc + (t.metrics!.csatNota || 0), 0) / csatTickets.length
      : null;

    // Tempo de espera (tempo total dos tickets abertos)
    const tempoEsperaMin = tickets
      .filter(t => STATUS_ABERTO.includes(t.status))
      .reduce((acc, t) => acc + (t.metrics?.tempoTotalMin || 0), 0);

    // Assuntos mais frequentes
    const assuntoCount = new Map<string, number>();
    tickets.forEach(t => {
      const a = t.assunto || 'Sem assunto';
      assuntoCount.set(a, (assuntoCount.get(a) || 0) + 1);
    });
    const assuntosMaisFrequentes = Array.from(assuntoCount.entries())
      .map(([assunto, total]) => ({ assunto, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // Calcular score de risco
    const fatores = calcularFatoresRisco({
      total,
      simultaneos,
      reaberturas,
      transferencias,
      slaExcedidos,
      csatMedio,
      tempoEsperaMin,
      chamadosN3: tickets.filter(t => t.nivelSuporteId).length, // simplificado
    });

    const scoreRisco = fatores.reduce((acc, f) => acc + f.peso * f.valor, 0);
    const risco = classificarRisco(scoreRisco);

    // Recomendações
    const recomendacoes = gerarRecomendacoesCliente({
      risco,
      total,
      simultaneos,
      reaberturas,
      transferencias,
      slaExcedidos,
      csatMedio,
    });

    clientes.push({
      clienteId: client.id,
      clienteNome: client.razaoSocial,
      risco,
      scoreRisco: Math.round(scoreRisco * 10) / 10,
      fatores,
      totalChamadosPeriodo: total,
      chamadosAbertos: abertos,
      chamadosSimultaneos: simultaneos,
      reaberturas,
      transferencias,
      slaExcedidos,
      csatMedio: csatMedio ? Math.round(csatMedio * 10) / 10 : null,
      tempoEsperaMin,
      assuntosMaisFrequentes,
      recomendacoes,
    });
  }

  // Ordenar por risco (critico > alto > atencao > baixo)
  const ordemRisco = { critico: 0, alto: 1, atencao: 2, baixo: 3 };
  clientes.sort((a, b) => ordemRisco[a.risco] - ordemRisco[b.risco]);

  return clientes;
}

function calcularFatoresRisco(dados: {
  total: number;
  simultaneos: number;
  reaberturas: number;
  transferencias: number;
  slaExcedidos: number;
  csatMedio: number | null;
  tempoEsperaMin: number;
  chamadosN3: number;
}): FatorRisco[] {
  const fatores: FatorRisco[] = [];

  // Volume de chamados
  if (dados.total >= 5) {
    fatores.push({
      tipo: 'volume_chamados',
      descricao: `${dados.total} chamados no período`,
      peso: 20,
      valor: Math.min(100, dados.total * 15),
    });
  }

  // Chamados simultâneos
  if (dados.simultaneos >= 2) {
    fatores.push({
      tipo: 'chamados_simultaneos',
      descricao: `${dados.simultaneos} chamados abertos simultaneamente`,
      peso: 25,
      valor: Math.min(100, dados.simultaneos * 30),
    });
  }

  // Reaberturas
  if (dados.reaberturas > 0) {
    fatores.push({
      tipo: 'reaberturas',
      descricao: `${dados.reaberturas} reabertura(s) — mesmo problema retornou`,
      peso: 20,
      valor: Math.min(100, dados.reaberturas * 35),
    });
  }

  // Transferências
  if (dados.transferencias >= 2) {
    fatores.push({
      tipo: 'transferencias',
      descricao: `${dados.transferencias} transferência(s) entre analistas`,
      peso: 15,
      valor: Math.min(100, dados.transferencias * 25),
    });
  }

  // SLA excedido
  if (dados.slaExcedidos > 0) {
    fatores.push({
      tipo: 'sla_excedido',
      descricao: `${dados.slaExcedidos} chamado(s) com SLA excedido`,
      peso: 25,
      valor: Math.min(100, dados.slaExcedidos * 40),
    });
  }

  // CSAT baixo
  if (dados.csatMedio !== null && dados.csatMedio < 3) {
    fatores.push({
      tipo: 'csat_baixo',
      descricao: `Avaliação média ${dados.csatMedio.toFixed(1)}/5`,
      peso: 20,
      valor: Math.min(100, (5 - dados.csatMedio) * 30),
    });
  }

  // Tempo de espera excessivo
  if (dados.tempoEsperaMin > 240) {
    fatores.push({
      tipo: 'tempo_espera',
      descricao: `Tempo total de espera: ${Math.round(dados.tempoEsperaMin / 60)}h`,
      peso: 15,
      valor: Math.min(100, (dados.tempoEsperaMin / 60) * 15),
    });
  }

  return fatores;
}

function gerarRecomendacoesCliente(dados: {
  risco: string;
  total: number;
  simultaneos: number;
  reaberturas: number;
  transferencias: number;
  slaExcedidos: number;
  csatMedio: number | null;
}): RecomendacaoCliente[] {
  const recs: RecomendacaoCliente[] = [];

  if (dados.reaberturas > 0) {
    recs.push({
      titulo: 'Investigar causa raiz',
      descricao: 'O problema retornou. Verificar se a solução aplicada foi definitiva ou paliativa.',
      prioridade: 'urgente',
    });
  }

  if (dados.transferencias >= 2) {
    recs.push({
      titulo: 'Designar responsável único',
      descricao: `${dados.transferencias} transferências indicam falta de clareza na responsabilidade.`,
      prioridade: 'alta',
    });
  }

  if (dados.simultaneos >= 3) {
    recs.push({
      titulo: 'Fazer contato proativo',
      descricao: `${dados.simultaneos} chamados abertos. O cliente pode estar frustrado com a situação.`,
      prioridade: 'alta',
    });
  }

  if (dados.slaExcedidos > 0) {
    recs.push({
      titulo: 'Priorizar resolução imediata',
      descricao: 'Chamados com SLA excedido precisam de atenção urgente.',
      prioridade: 'urgente',
    });
  }

  if (dados.csatMedio !== null && dados.csatMedio < 3) {
    recs.push({
      titulo: 'Revisar qualidade do atendimento',
      descricao: `Avaliação ${dados.csatMedio.toFixed(1)}/5 indica insatisfação.`,
      prioridade: 'alta',
    });
  }

  if (recs.length === 0 && dados.total >= 3) {
    recs.push({
      titulo: 'Monitorar de perto',
      descricao: 'Múltiplos chamados em curto período. Manter acompanhamento próximo.',
      prioridade: 'media',
    });
  }

  return recs;
}

// ── Progresso dos Chamados ──────────────────────────────────────────────

export async function analiseProgresso(filtros: FiltrosInteligencia): Promise<ProgressoChamado[]> {
  const { inicio, fim } = filtros.inicio && filtros.fim
    ? { inicio: filtros.inicio, fim: filtros.fim }
    : range(30);
  const agora = new Date();

  // Buscar tickets abertos com métricas
  const tickets = await prisma.ticket.findMany({
    where: {
      status: { in: [...STATUS_ABERTO] },
      etapa: { notIn: [...ETAPAS_ENCERRADAS] },
      createdAt: { gte: inicio, lte: fim },
    },
    include: {
      metrics: {
        select: {
          slaRestanteMinutos: true,
          slaStatus: true,
          tempoTotalMin: true,
        },
      },
      nivelSuporte: { select: { slug: true } },
      assignee: { select: { name: true } },
      client: { select: { razaoSocial: true } },
    },
  });

  const progressos: ProgressoChamado[] = [];

  for (const ticket of tickets) {
    // Última atividade relevante (mensagem não-bot, mudança de etapa, etc.)
    const ultimaAtividade = ticket.ultimaAtividadeRelevante || ticket.updatedAt;
    const tempoSemProgressoMin = Math.round(
      (agora.getTime() - ultimaAtividade.getTime()) / 60000
    );

    const slaRestanteMin = ticket.metrics?.slaRestanteMinutos ?? null;
    const slaStatus = ticket.metrics?.slaStatus ?? null;

    const progresso = classificarProgresso(tempoSemProgressoMin, slaRestanteMin, ticket.etapa);

    // Fatores do progresso
    const fatores: string[] = [];
    if (progresso === 'critico') {
      if (slaRestanteMin !== null && slaRestanteMin <= 0) fatores.push('SLA excedido');
      if (tempoSemProgressoMin >= 480) fatores.push(`Sem progresso há ${Math.round(tempoSemProgressoMin / 60)}h`);
    } else if (progresso === 'parado') {
      fatores.push(`Sem progresso há ${Math.round(tempoSemProgressoMin / 60)}h`);
      if (slaRestanteMin !== null && slaRestanteMin <= 120) fatores.push('SLA próximo do vencimento');
    } else if (progresso === 'atencao') {
      fatores.push('Progresso lento');
      if (slaRestanteMin !== null && slaRestanteMin <= 240) fatores.push('SLA se aproximando');
    }

    progressos.push({
      ticketId: ticket.id,
      protocolo: ticket.protocolo,
      contactName: ticket.contactName,
      etapa: ticket.etapa,
      status: ticket.status,
      nivelSuporte: ticket.nivelSuporte?.slug || null,
      assigneeNome: ticket.assignee?.name || null,
      clienteNome: ticket.client?.razaoSocial || null,
      progresso,
      ultimaAtividadeRelevante: ultimaAtividade,
      tempoSemProgressoMin,
      slaRestanteMin,
      slaStatus,
      fatores,
    });
  }

  // Ordenar: crítico primeiro, depois parado, atenção, em progresso
  const ordemProgresso = { critico: 0, parado: 1, atencao: 2, em_progresso: 3 };
  progressos.sort((a, b) => ordemProgresso[a.progresso] - ordemProgresso[b.progresso]);

  return progressos;
}

// ── Escalonamento N1→N2→N3 ─────────────────────────────────────────────

export async function analiseEscalonamento(filtros: FiltrosInteligencia): Promise<EscalonamentoNiveis> {
  const { inicio, fim } = filtros.inicio && filtros.fim
    ? { inicio: filtros.inicio, fim: filtros.fim }
    : range(30);

  // Buscar tickets que mudaram de nível
  const ticketsComHistorico = await prisma.ticket.findMany({
    where: {
      createdAt: { gte: inicio, lte: fim },
      nivelSuporteId: { not: null },
    },
    include: {
      nivelSuporte: { select: { slug: true, nome: true } },
      stageHistory: {
        select: { etapaNova: true, etapaAnterior: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  let n1ParaN2 = 0;
  let n2ParaN3 = 0;
  let n1ParaN3 = 0;

  const assuntoEscalonamento = new Map<string, {
    total: number;
    n1ParaN2: number;
    n2ParaN3: number;
  }>();

  for (const ticket of ticketsComHistorico) {
    const nivelAtual = ticket.nivelSuporte?.slug;
    if (!nivelAtual) continue;

    const assunto = ticket.assunto || 'Sem assunto';
    if (!assuntoEscalonamento.has(assunto)) {
      assuntoEscalonamento.set(assunto, { total: 0, n1ParaN2: 0, n2ParaN3: 0 });
    }
    const entry = assuntoEscalonamento.get(assunto)!;
    entry.total++;

    // Detectar escalonamento baseado no histórico de fases
    // Se o ticket passou por múltiplas filas, há escalonamento
    const filasVisitadas = new Set(ticket.stageHistory.map(s => s.etapaNova));
    if (filasVisitadas.has('em_atendimento')) {
      // Simplificação: se tinha nivel baixo e agora tem alto, houve escalonamento
      if (nivelAtual === 'N2') {
        n1ParaN2++;
        entry.n1ParaN2++;
      } else if (nivelAtual === 'N3') {
        n2ParaN3++;
        entry.n2ParaN3++;
      }
    }
  }

  const total = ticketsComHistorico.length;
  const porAssunto = Array.from(assuntoEscalonamento.entries())
    .map(([assunto, dados]) => ({
      assunto,
      total: dados.total,
      n1ParaN2: dados.n1ParaN2,
      n2ParaN3: dados.n2ParaN3,
      taxaEscalonamento: dados.total > 0
        ? Math.round(((dados.n1ParaN2 + dados.n2ParaN3) / dados.total) * 100)
        : 0,
    }))
    .sort((a, b) => b.taxaEscalonamento - a.taxaEscalonamento);

  return {
    total,
    n1ParaN2,
    n2ParaN3,
    n1ParaN3,
    taxaN1ParaN2: total > 0 ? Math.round((n1ParaN2 / total) * 100) : 0,
    taxaN2ParaN3: total > 0 ? Math.round((n2ParaN3 / total) * 100) : 0,
    taxaN1ParaN3: total > 0 ? Math.round((n1ParaN3 / total) * 100) : 0,
    porAssunto,
  };
}

// ── Oportunidades de Automação ──────────────────────────────────────────

export async function detectarOportunidadesAutomacao(filtros: FiltrosInteligencia): Promise<OportunidadeAutomacao[]> {
  const assuntos = await analisePorAssunto(filtros);
  const oportunidades: OportunidadeAutomacao[] = [];

  for (const assunto of assuntos) {
    const pctN1 = assunto.total > 0 ? (assunto.porNivel.N1 / assunto.total) * 100 : 0;

    // Automação: volume alto + N1 dominante
    if (assunto.total >= 15 && pctN1 >= 50) {
      oportunidades.push({
        assunto: assunto.assuntoNome,
        tipo: pctN1 >= 70 ? 'chatbot' : 'macro',
        motivo: `${Math.round(pctN1)}% dos chamados são N1 com procedimento conhecido`,
        volumePotencial: Math.round(assunto.total * pctN1 / 100),
        tempoEconomizadoMin: Math.round(assunto.tempoMedioMin * assunto.total * 0.3),
        confianca: pctN1 >= 70 ? 'alta' : 'media',
      });
    }

    // Base de conhecimento: N1 alto
    if (assunto.total >= 10 && pctN1 >= 40 && assunto.porNivel.N1 >= 5) {
      oportunidades.push({
        assunto: assunto.assuntoNome,
        tipo: 'base_conhecimento',
        motivo: `${assunto.porNivel.N1} chamados N1 com solução repetitiva`,
        volumePotencial: assunto.porNivel.N1,
        tempoEconomizadoMin: Math.round(assunto.tempoMedioMin * assunto.porNivel.N1 * 0.5),
        confianca: 'media',
      });
    }

    // Procedimento N1
    if (assunto.porNivel.N1 >= 5 && assunto.porNivel.N2 > assunto.porNivel.N1 * 0.5) {
      oportunidades.push({
        assunto: assunto.assuntoNome,
        tipo: 'procedimento_n1',
        motivo: 'Alta taxa de escalonamento N1→N2 indica procedimento N1 insuficiente',
        volumePotencial: assunto.porNivel.N1,
        tempoEconomizadoMin: Math.round(assunto.tempoMedioMin * 5),
        confianca: 'media',
      });
    }
  }

  return oportunidades.sort((a, b) => b.volumePotencial - a.volumePotencial);
}

// ── Possíveis Bugs ──────────────────────────────────────────────────────

export async function detectarPossiveisBugs(filtros: FiltrosInteligencia): Promise<PossivelBug[]> {
  const assuntos = await analisePorAssunto(filtros);
  const bugs: PossivelBug[] = [];

  for (const assunto of assuntos) {
    const pctN2N3 = assunto.total > 0
      ? ((assunto.porNivel.N2 + assunto.porNivel.N3) / assunto.total) * 100
      : 0;

    // Possível bug: muitos clientes + N2/N3 + crescimento + reabertura
    if (
      assunto.clientesAfetados >= 3 &&
      pctN2N3 >= 50 &&
      assunto.tendencia.variacaoPct > 20 &&
      assunto.reabertos >= 2
    ) {
      const evidencias = [
        `${assunto.clientesAfetados} clientes afetados`,
        `${Math.round(pctN2N3)}% em N2/N3`,
        `${assunto.tendencia.variacaoPct > 0 ? '+' : ''}${assunto.tendencia.variacaoPct}% crescimento`,
        `${assunto.reabertos} reaberturas`,
        `SLA ${assunto.sla.percentual}%`,
      ];

      bugs.push({
        assunto: assunto.assuntoNome,
        clientesAfetados: assunto.clientesAfetados,
        totalChamados: assunto.total,
        crescimentoPct: assunto.tendencia.variacaoPct,
        nivelN2N3: assunto.porNivel.N2 + assunto.porNivel.N3,
        reaberturas: assunto.reabertos,
        evidencias,
        confianca: assunto.reabertos >= 5 && assunto.clientesAfetados >= 5 ? 'alta' : 'media',
      });
    }
  }

  return bugs.sort((a, b) => b.clientesAfetados - a.clientesAfetados);
}

// ── Classificação IA N1/N2/N3 ───────────────────────────────────────────

export async function sugerirClassificacaoNivel(
  ticketId: string,
): Promise<{ nivel: NivelSuporte; confianca: number; motivo: string }> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      messages: { select: { content: true, fromMe: true, tipo: true }, orderBy: { sentAt: 'asc' } },
      nivelSuporte: { select: { slug: true } },
    },
  });

  if (!ticket) throw new Error('Ticket não encontrado');

  // Regras baseadas em palavras-chave e contexto
  const conteudoCliente = ticket.messages
    .filter(m => !m.fromMe && m.tipo !== 'system')
    .map(m => m.content || '')
    .join(' ')
    .toLowerCase();

  const totalMensagens = ticket.messages.length;
  const temAnexo = ticket.messages.some(m => m.tipo === 'audio' || m.tipo === 'image');

  // Padrões N1 (problemas conhecidos, dúvidas simples)
  const padroesN1 = [
    'como faço', 'como configurar', 'não consigo acessar', 'esqueci a senha',
    'dúvida', 'orientação', 'procedimento', 'manual', 'tutorial',
    'configurar email', 'alterar senha', 'instalar', 'atualizar',
  ];

  // Padrões N2 (análise técnica, investigação)
  const padroesN2 = [
    'erro', 'falha', 'não funciona', 'bug', 'problema técnico',
    'integração', 'log', 'investigar', 'analisar', 'diagnóstico',
    'configuração avançada', 'servidor', 'banco de dados', 'api',
    'timeout', 'conexão', 'sincronização', 'importação', 'exportação',
  ];

  // Padrões N3 (especializado, desenvolvimento)
  const padroesN3 = [
    'desenvolvimento', 'código', 'alteração de código', 'migração',
    'banco de dados', 'estrutura', 'performance', 'otimização',
    'integração profunda', 'webhook', 'api externa', 'customização',
    'bug crítico', 'sistema travando', 'perda de dados', 'segurança',
  ];

  let n1Score = 0;
  let n2Score = 0;
  let n3Score = 0;

  for (const padrao of padroesN1) {
    if (conteudoCliente.includes(padrao)) n1Score += 2;
  }
  for (const padrao of padroesN2) {
    if (conteudoCliente.includes(padrao)) n2Score += 2;
  }
  for (const padrao of padroesN3) {
    if (conteudoCliente.includes(padrao)) n3Score += 2;
  }

  // Fatores contextuais
  if (totalMensagens <= 3) n1Score += 1; // Poucas mensagens = problema simples
  if (totalMensagens > 10) n3Score += 1; // Muitas mensagens = problema complexo
  if (temAnexo) n2Score += 1; // Anexo sugere investigação

  // Determinar nível
  const maxScore = Math.max(n1Score, n2Score, n3Score);
  let nivel: NivelSuporte = 'N1';
  let confianca = 0.5;
  let motivo = 'Classificação baseada em regras';

  if (maxScore === 0) {
    nivel = 'N1';
    confianca = 0.3;
    motivo = 'Sem padrões identificados — classificação padrão N1';
  } else if (n3Score >= n2Score && n3Score >= n1Score) {
    nivel = 'N3';
    confianca = Math.min(0.9, 0.5 + (n3Score / (n1Score + n2Score + n3Score)) * 0.4);
    motivo = `Padrões N3 detectados (score: ${n3Score})`;
  } else if (n2Score >= n1Score) {
    nivel = 'N2';
    confianca = Math.min(0.85, 0.5 + (n2Score / (n1Score + n2Score + n3Score)) * 0.35);
    motivo = `Padrões N2 detectados (score: ${n2Score})`;
  } else {
    nivel = 'N1';
    confianca = Math.min(0.8, 0.5 + (n1Score / (n1Score + n2Score + n3Score)) * 0.3);
    motivo = `Padrões N1 detectados (score: ${n1Score})`;
  }

  return { nivel, confianca: Math.round(confianca * 100) / 100, motivo };
}

// ── Resumo Executivo ────────────────────────────────────────────────────

export async function gerarResumoExecutivo(filtros: FiltrosInteligencia): Promise<ResumoExecutivo> {
  const dias = filtros.fim && filtros.inicio
    ? Math.ceil((filtros.fim.getTime() - filtros.inicio.getTime()) / (24 * 60 * 60 * 1000)) + 1
    : 30;
  const { inicio, fim } = filtros.inicio && filtros.fim
    ? { inicio: filtros.inicio, fim: filtros.fim }
    : range(dias);

  const whereBase = buildWhere(filtros);

  const [totalChamados, abertos, resolvidos, reabertos, n1, n2, n3, parados, slaEmRisco, clientesEmRisco] = await Promise.all([
    prisma.ticket.count({ where: { ...whereBase, createdAt: { gte: inicio, lte: fim } } }),
    prisma.ticket.count({ where: { ...whereBase, createdAt: { gte: inicio, lte: fim }, status: { in: [...STATUS_ABERTO] }, etapa: { notIn: [...ETAPAS_ENCERRADAS] } } }),
    prisma.ticket.count({ where: { ...whereBase, createdAt: { gte: inicio, lte: fim }, OR: [{ status: 'fechado' }, { etapa: 'concluido' }] } }),
    prisma.ticket.count({ where: { ...whereBase, createdAt: { gte: inicio, lte: fim }, metrics: { is: { totalReaberturas: { gt: 0 } } } } }),
    prisma.ticket.count({ where: { ...whereBase, createdAt: { gte: inicio, lte: fim }, nivelSuporte: { slug: 'N1' } } }),
    prisma.ticket.count({ where: { ...whereBase, createdAt: { gte: inicio, lte: fim }, nivelSuporte: { slug: 'N2' } } }),
    prisma.ticket.count({ where: { ...whereBase, createdAt: { gte: inicio, lte: fim }, nivelSuporte: { slug: 'N3' } } }),
    prisma.ticket.count({ where: { ...whereBase, status: { in: [...STATUS_ABERTO] }, etapa: { notIn: [...ETAPAS_ENCERRADAS] }, updatedAt: { lt: new Date(Date.now() - 4 * 60 * 60 * 1000) } } }),
    prisma.ticket.count({ where: { ...whereBase, createdAt: { gte: inicio, lte: fim }, metrics: { is: { slaStatus: 'violado' } } } }),
    prisma.ticket.groupBy({
      by: ['clientId'],
      where: { ...whereBase, createdAt: { gte: inicio, lte: fim }, clientId: { not: null } },
      _count: { id: true },
      having: { id: { _count: { gte: 3 } } },
    }).then(r => r.length),
  ]);

  // Principais assuntos
  const assuntosResult = await prisma.ticket.groupBy({
    by: ['assunto'],
    where: { ...whereBase, createdAt: { gte: inicio, lte: fim }, assunto: { not: null } },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 5,
  });

  const principaisAssuntos = assuntosResult.map(a => ({
    assunto: a.assunto || 'Sem assunto',
    total: a._count.id,
    variacao: 0, // TODO: comparar com período anterior
  }));

  // Principais alertas
  const principaisAlertas: Array<{ nivel: string; titulo: string; descricao: string }> = [];
  if (parados > 0) principaisAlertas.push({ nivel: 'critico', titulo: 'Chamados parados', descricao: `${parados} chamados sem progresso há mais de 4h` });
  if (slaEmRisco > 0) principaisAlertas.push({ nivel: 'critico', titulo: 'SLA excedido', descricao: `${slaEmRisco} chamados com SLA violado` });
  if (clientesEmRisco > 0) principaisAlertas.push({ nivel: 'alto', titulo: 'Clientes em risco', descricao: `${clientesEmRisco} clientes com 3+ chamados` });

  // Decisões recomendadas (top 3 assuntos com maior prioridade)
  const assuntosAnalise = await analisePorAssunto(filtros);
  const decisoesRecomendadas = assuntosAnalise
    .flatMap(a => a.recomendacoes)
    .filter(r => r.prioridade === 'urgente' || r.prioridade === 'alta')
    .slice(0, 3);

  return {
    totalChamados,
    abertos,
    resolvidos,
    reabertos,
    n1,
    n2,
    n3,
    parados,
    slaEmRisco,
    clientesEmRisco,
    principaisAssuntos,
    principaisAlertas,
    decisoesRecomendadas,
  };
}

// ── Orquestrador Principal ──────────────────────────────────────────────

export async function gerarInteligenciaCompleta(
  filtros: FiltrosInteligencia,
): Promise<InteligenciaCompleta> {
  const dias = filtros.fim && filtros.inicio
    ? Math.ceil((filtros.fim.getTime() - filtros.inicio.getTime()) / (24 * 60 * 60 * 1000)) + 1
    : 30;
  const { inicio, fim } = filtros.inicio && filtros.fim
    ? { inicio: filtros.inicio, fim: filtros.fim }
    : range(dias);

  const [
    resumoExecutivo,
    analiseAssuntos,
    clientesEmRisco,
    chamadosParados,
    escalonamento,
    oportunidadesAutomacao,
    possiveisBugs,
  ] = await Promise.all([
    gerarResumoExecutivo(filtros),
    analisePorAssunto(filtros),
    analiseRiscoClientes(filtros),
    analiseProgresso(filtros),
    analiseEscalonamento(filtros),
    detectarOportunidadesAutomacao(filtros),
    detectarPossiveisBugs(filtros),
  ]);

  // Ranking de assuntos
  const rankingAssuntos = analiseAssuntos
    .slice(0, 10)
    .map((a, i) => ({
      posicao: i + 1,
      assunto: a.assuntoNome,
      total: a.total,
      score: a.prioridadeOperacional,
    }));

  return {
    atualizadoEm: new Date().toISOString(),
    periodo: { inicio, fim, label: `${dias} dias`, dias },
    resumoExecutivo,
    analiseAssuntos,
    rankingAssuntos,
    clientesEmRisco: clientesEmRisco.slice(0, 10),
    chamadosParados: chamadosParados.filter(c => c.progresso === 'critico' || c.progresso === 'parado').slice(0, 20),
    escalonamento,
    oportunidadesAutomacao: oportunidadesAutomacao.slice(0, 10),
    possiveisBugs,
  };
}
