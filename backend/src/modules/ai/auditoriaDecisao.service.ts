import prisma from '../../config/database';
import { FiltroAuditoria, auditarTicket } from './auditoriaProfissional.service';
import { createTask } from '../kanban/kanban.service';
import { AppError } from '../../shared/errors/AppError';
import {
  calcularIndicadores,
  calcularRankingAnalistas,
  calcularPadroesGlobais,
} from './auditoriaAgregacao.service';

// ── Tipos ───────────────────────────────────────────────────────

export type SaudeAtendimento = 'BOA' | 'ATENCAO' | 'CRITICA';

export interface RecomendacaoGerencial {
  id: string;
  descricao: string;
  prioridade: 'baixa' | 'media' | 'alta' | 'urgente';
  origem: string;
  meta: string;
  acao: string;
  acompanhamento: string;
  prazo: string;
}

export interface PlanoAcaoItem {
  etapa: string;
  acoes: string[];
  prazo: string;
}

export interface TomadaDecisao {
  periodo: { inicio: Date | null; fim: Date | null };
  saudeAtendimento: SaudeAtendimento;
  iconeSaude: '🟢' | '🟡' | '🔴';
  notaGeralMedia: number;
  justificativa: string;
  resumoExecutivo: string;
  oQueGestorDeveFazer: string[];
  recomendacoes: RecomendacaoGerencial[];
  planoAcao: PlanoAcaoItem[];
  metasSugeridas: Array<{ indicador: string; atual: number; meta: number; prazo: string }>;
  focosPorAnalista: Array<{ agenteNome: string; nota: number; principalMelhoria: string }>;
  padroesCriticos: Array<{ descricao: string; ocorrencias: number; gravidade: string }>;
}

// ── Helpers ─────────────────────────────────────────────────────

function recomendar(
  id: string,
  descricao: string,
  prioridade: RecomendacaoGerencial['prioridade'],
  origem: string,
  meta: string,
  acao: string,
  prazo: string
): RecomendacaoGerencial {
  return { id, descricao, prioridade, origem, meta, acao, acompanhamento: `Reavaliar via auditoria após ${prazo}`, prazo };
}

// ── Função principal ────────────────────────────────────────────

export async function gerarTomadaDecisao(filtro: FiltroAuditoria = {}): Promise<TomadaDecisao> {
  const [indicadores, ranking, padroes] = await Promise.all([
    calcularIndicadores(filtro),
    calcularRankingAnalistas(filtro),
    calcularPadroesGlobais(filtro),
  ]);

  const recomendacoes: RecomendacaoGerencial[] = [];
  const oQueGestorDeveFazer: string[] = [];
  const metasSugeridas: Array<{ indicador: string; atual: number; meta: number; prazo: string }> = [];
  const focosPorAnalista: TomadaDecisao['focosPorAnalista'] = [];
  const padroesCriticos = padroes
    .filter(p => p.gravidade === 'alta' || p.gravidade === 'critica')
    .slice(0, 8);

  let saude: SaudeAtendimento = 'BOA';
  let icone: '🟢' | '🟡' | '🔴' = '🟢';
  let justificativa = 'O atendimento está dentro do esperado. Continue monitorando.';

  // Saúde do atendimento
  const nota = indicadores.notaGeralMedia;
  if (nota >= 70 && indicadores.taxaReabertura <= 20 && indicadores.taxaResolucao >= 60) {
    saude = 'BOA';
    icone = '🟢';
    justificativa = `Nota geral ${nota}/100, reabertura ${indicadores.taxaReabertura}% e resolução ${indicadores.taxaResolucao}%. Atendimento saudável.`;
  } else if (nota >= 50) {
    saude = 'ATENCAO';
    icone = '🟡';
    justificativa = `Nota geral ${nota}/100 com indicadores em atenção: reabertura ${indicadores.taxaReabertura}%, resolução ${indicadores.taxaResolucao}%.`;
  } else {
    saude = 'CRITICA';
    icone = '🔴';
    justificativa = `Nota geral ${nota}/100 — abaixo do aceitável. Ação imediata do gestor é necessária.`;
  }

  // Recomendações automáticas baseadas nos indicadores
  if (nota < 70) {
    recomendacoes.push(recomendar(
      'nota-geral',
      `Elevar a nota geral média de ${nota}/100 para ≥ 80`,
      nota < 50 ? 'urgente' : 'alta',
      'indicadores',
      'Nota geral média ≥ 80',
      'Revisar com cada analista as auditorias com nota < 70, identificar pontos comuns e criar plano de treinamento',
      '30 dias'
    ));
    oQueGestorDeveFazer.push(`Definir plano de melhoria da nota geral (atual ${nota}/100, meta 80/100).`);
  }

  if (indicadores.taxaReabertura > 20) {
    recomendacoes.push(recomendar(
      'reabertura',
      `Reduzir a taxa de reabertura de ${indicadores.taxaReabertura}% para ≤ 15%`,
      indicadores.taxaReabertura > 40 ? 'urgente' : 'alta',
      'indicadores',
      'Taxa de reabertura ≤ 15%',
      'Investigar causas comuns das reaberturas, garantir confirmação de resolução antes do encerramento e validar CSAT',
      '30 dias'
    ));
    oQueGestorDeveFazer.push(`Reduzir reaberturas (${indicadores.taxaReabertura}% → ≤ 15%): reforçar confirmação de resolução antes do encerramento.`);
  }

  if (indicadores.taxaResolucao < 60) {
    recomendacoes.push(recomendar(
      'resolucao',
      `Elevar a taxa de resolução de ${indicadores.taxaResolucao}% para ≥ 80%`,
      'alta',
      'indicadores',
      'Taxa de resolução ≥ 80%',
      'Identificar tickets sem resolução, verificar se estão sendo transferidos corretamente ou precisam de treinamento técnico',
      '30 dias'
    ));
    oQueGestorDeveFazer.push(`Investigar tickets não resolvidos (taxa de resolução ${indicadores.taxaResolucao}%).`);
  }

  if (indicadores.taxaRetrabalho > 20) {
    recomendacoes.push(recomendar(
      'retrabalho',
      `Reduzir o retrabalho de ${indicadores.taxaRetrabalho}% para ≤ 10%`,
      'media',
      'indicadores',
      'Taxa de retrabalho ≤ 10%',
      'Revisar primeira resposta dos atendentes, investir em diagnóstico correto na primeira interação',
      '60 dias'
    ));
    oQueGestorDeveFazer.push(`Reduzir retrabalho (${indicadores.taxaRetrabalho}% → ≤ 10%).`);
  }

  if (indicadores.riscoInsatisfacao.CRITICO && indicadores.riscoInsatisfacao.CRITICO >= 2) {
    recomendacoes.push(recomendar(
      'insatisfacao',
      `${indicadores.riscoInsatisfacao.CRITICO} auditorias com risco crítico de insatisfação — ação imediata`,
      'urgente',
      'risco',
      'Zero auditorias com risco crítico',
      'Contatar os clientes afetados, revisar os atendimentos e corrigir procedimentos',
      '7 dias'
    ));
    oQueGestorDeveFazer.push(`Contatar clientes com risco crítico de insatisfação (${indicadores.riscoInsatisfacao.CRITICO} casos).`);
  }

  const mediaCategorias = indicadores.mediaCategorias;
  const piorCategoria = Object.entries(mediaCategorias).sort((a, b) => a[1] - b[1])[0];
  if (piorCategoria && piorCategoria[1] < 70) {
    recomendacoes.push(recomendar(
      'categoria',
      `Fortalecer a categoria mais fraca: "${piorCategoria[0]}" (${piorCategoria[1]}/100)`,
      'alta',
      'categorias',
      `${piorCategoria[0]} ≥ 80`,
      `Criar treinamento específico em ${piorCategoria[0].toLowerCase()} e acompanhar via auditorias`,
      '30 dias'
    ));
    oQueGestorDeveFazer.push(`Criar treinamento em ${piorCategoria[0]} (média ${piorCategoria[1]}/100).`);
  }

  for (const p of padroesCriticos.slice(0, 3)) {
    recomendacoes.push(recomendar(
      `padrao-${p.ocorrencias}`,
      `Padrão: "${p.descricao}" (${p.ocorrencias} ocorrências)`,
      p.gravidade === 'critica' ? 'urgente' : 'alta',
      'padroes',
      'Eliminar o padrão',
      `Revisar procedimentos relacionados a "${p.descricao}" e definir ação preventiva`,
      '30 dias'
    ));
    oQueGestorDeveFazer.push(`Tratar padrão recorrente: "${p.descricao}".`);
  }

  // Focos por analista
  for (const a of ranking) {
    const pior = Object.entries(a.mediaCategorias).sort((x, y) => x[1] - y[1])[0];
    focosPorAnalista.push({
      agenteNome: a.agenteNome,
      nota: a.notaGeralMedia,
      principalMelhoria: pior ? `${pior[0]} (${pior[1]}/100)` : '—',
    });
  }

  // Metas sugeridas
  if (indicadores.totalAuditadas > 0) {
    metasSugeridas.push({ indicador: 'Nota geral média', atual: Math.round(nota), meta: 80, prazo: '30 dias' });
    metasSugeridas.push({ indicador: 'Taxa de resolução', atual: Math.round(indicadores.taxaResolucao), meta: 80, prazo: '30 dias' });
    metasSugeridas.push({ indicador: 'Taxa de reabertura', atual: Math.round(indicadores.taxaReabertura), meta: 15, prazo: '30 dias' });
    metasSugeridas.push({ indicador: 'Taxa de retrabalho', atual: Math.round(indicadores.taxaRetrabalho), meta: 10, prazo: '60 dias' });
  }

  // Plano de ação 7/30/60
  const planoAcao: PlanoAcaoItem[] = [
    {
      etapa: 'Ação imediata (7 dias)',
      acoes: oQueGestorDeveFazer.slice(0, 3).length
        ? oQueGestorDeveFazer.slice(0, 3)
        : ['Nenhuma ação crítica identificada — manter monitoramento regular'],
      prazo: '7 dias',
    },
    {
      etapa: 'Curto prazo (30 dias)',
      acoes: oQueGestorDeveFazer.slice(3, 6).length
        ? oQueGestorDeveFazer.slice(3, 6)
        : ['Acompanhar evolução das notas nas próximas auditorias'],
      prazo: '30 dias',
    },
    {
      etapa: 'Médio prazo (60 dias)',
      acoes: oQueGestorDeveFazer.length >= 6 ? oQueGestorDeveFazer.slice(6) : ['Revisar metas e ajustar processo se necessário'],
      prazo: '60 dias',
    },
  ];

  // Resumo executivo
  const resumoExecutivo = `${icone} Saúde do atendimento: ${saude}. Nota geral média ${nota}/100 (${indicadores.classificacaoGeral}) em ${indicadores.totalAuditadas} auditorias. ` +
    `Resolução ${indicadores.taxaResolucao}%, reabertura ${indicadores.taxaReabertura}%, retrabalho ${indicadores.taxaRetrabalho}%. ` +
    (recomendacoes.length ? `${recomendacoes.length} recomendação(ões) gerada(s) para o gestor.` : 'Nenhuma recomendação crítica no momento.');

  return {
    periodo: indicadores.periodo,
    saudeAtendimento: saude,
    iconeSaude: icone,
    notaGeralMedia: nota,
    justificativa,
    resumoExecutivo,
    oQueGestorDeveFazer,
    recomendacoes,
    planoAcao,
    metasSugeridas,
    focosPorAnalista,
    padroesCriticos,
  };
}

// ── Fila de auditoria ───────────────────────────────────────────

export interface FilaAuditoriaItem {
  id: string;
  ticketId: string;
  protocolo: string | null;
  contactName: string | null;
  agenteNome: string | null;
  status: string;
  notaGeral: number;
  classificacao: string;
  auditadoEm: Date;
  revisaoStatus: string | null;
  modeloUsado: string | null;
}

export async function getFilaAuditoria(filtro: FiltroAuditoria = {}): Promise<FilaAuditoriaItem[]> {
  const where: any = {};
  if (filtro.dataInicio || filtro.dataFim) {
    where.auditadoEm = {
      ...(filtro.dataInicio ? { gte: filtro.dataInicio } : {}),
      ...(filtro.dataFim ? { lte: filtro.dataFim } : {}),
    };
  }
  if (filtro.status) where.status = filtro.status;
  if (filtro.agenteId) where.agenteId = filtro.agenteId;
  if (filtro.classificacao) where.classificacao = filtro.classificacao;
  if (filtro.revisaoStatus) where.revisaoStatus = filtro.revisaoStatus;

  const items = await prisma.auditoriaProfissional.findMany({
    where,
    orderBy: [{ status: 'asc' }, { auditadoEm: 'desc' }],
    take: filtro.limit || 100,
    select: {
      id: true,
      ticketId: true,
      protocolo: true,
      contactName: true,
      status: true,
      notaGeral: true,
      classificacao: true,
      auditadoEm: true,
      revisaoStatus: true,
      modeloUsado: true,
      agente: { select: { name: true } },
    },
  });

  return items.map(i => ({
    id: i.id,
    ticketId: i.ticketId,
    protocolo: i.protocolo,
    contactName: i.contactName,
    agenteNome: i.agente?.name || null,
    status: i.status,
    notaGeral: i.notaGeral,
    classificacao: i.classificacao,
    auditadoEm: i.auditadoEm,
    revisaoStatus: i.revisaoStatus,
    modeloUsado: i.modeloUsado,
  }));
}

// ── Auditoria contínua (amostragem) ─────────────────────────────

export async function auditarAmostra(percentual = 20, limit = 50, usarIa = true): Promise<number> {
  const total = await prisma.ticket.count({
    where: { dataFechamento: { not: null } },
  });
  const amostra = Math.max(1, Math.min(limit, Math.round(total * (percentual / 100))));

  const tickets = await prisma.ticket.findMany({
    where: {
      dataFechamento: { not: null },
      auditoriasProfissionais: { none: {} },
    },
    orderBy: { dataFechamento: 'desc' },
    take: amostra,
    select: { id: true },
  });

  let auditados = 0;
  for (const t of tickets) {
    try {
      await auditarTicket(t.id, usarIa);
      auditados++;
    } catch {
      // continua com o próximo
    }
  }
  return auditados;
}

// ── Criar tarefa a partir de uma recomendação ───────────────────────

export async function criarTarefaDeRecomendacao(
  recomendacaoId: string,
  boardId: string,
  dados: { responsavelId?: string; prazoEntrega?: Date } = {},
): Promise<{ id: string; titulo: string }> {
  const tomada = await gerarTomadaDecisao();
  const recomendacao = tomada.recomendacoes.find((r) => r.id === recomendacaoId);
  if (!recomendacao) {
    throw new AppError('Recomendação não encontrada. Atualize a Tomada de Decisão e tente novamente.', 404);
  }

  const board = await prisma.kanbanBoard.findUnique({ where: { id: boardId } });
  if (!board) throw new AppError('Board não encontrado', 404);
  const primeiraColuna = await prisma.kanbanColumn.findFirst({
    where: { boardId },
    orderBy: { ordem: 'asc' },
    select: { id: true },
  });
  if (!primeiraColuna) throw new AppError('Board sem colunas. Crie uma coluna antes.', 400);

  const prioridadeMap: Record<string, 'alta' | 'media' | 'baixa'> = {
    urgente: 'alta',
    alta: 'alta',
    media: 'media',
    baixa: 'baixa',
  };

  const task = await createTask(boardId, {
    titulo: recomendacao.descricao,
    descricao: `Origem: recomendação "${recomendacao.id}" da Tomada de Decisão.\nMeta: ${recomendacao.meta}\nAção: ${recomendacao.acao}`,
    columnId: primeiraColuna.id,
    responsavelId: dados.responsavelId || null,
    prioridade: prioridadeMap[recomendacao.prioridade] || 'media',
    prazoEntrega: dados.prazoEntrega || null,
    tipoTarefa: 'atendimento',
  });

  return { id: task.id, titulo: task.titulo };
}