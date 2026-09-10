import prisma from '../../../config/database';
import { AppError } from '../../../shared/errors/AppError';

// ── Types ──────────────────────────────────────────────────────────────

export type TipoDecisao =
  | 'reabertura'
  | 'sla'
  | 'csat'
  | 'retrabalho'
  | 'ociosidade'
  | 'produtividade'
  | 'fila'
  | 'transferencia'
  | 'qualidade'
  | 'resolucao'
  | 'primeira_resposta'
  | 'recorrencia'
  | 'performance_analista';

export type SeveridadeDecisao = 'critica' | 'alta' | 'media' | 'baixa' | 'info';
export type ConfiancaDecisao = 'alta' | 'media' | 'baixa';
export type StatusDecisao = 'pendente' | 'em_acao' | 'concluido' | 'revertido' | 'ignorado';
export type RevisaoStatus = 'pendente' | 'aprovado' | 'rejeitado' | 'reavaliar';

export interface EvidenciaItem {
  tipo: string;
  dado: string;
  valor: number | string;
  comparacao?: string;
  fonte?: string;
  ticketIds?: string[];
}

export interface CalculoInfo {
  formula: string;
  resultado: string | number;
  comparacao?: string;
}

export interface ComparacaoInfo {
  indicador: string;
  valorAtual: number | string;
  valorAnterior: number | string;
  variacao: string;
}

export interface RankingAnalista {
  agenteId: string;
  nome: string;
  valor: number;
  classificacao: string;
  contexto?: string;
}

export interface PadraoDetectado {
  tipo: string;
  descricao: string;
  frequencia: number;
  confianca: string;
}

export interface DecisaoGenerada {
  tipo: TipoDecisao;
  severidade: SeveridadeDecisao;
  titulo: string;
  problema: string;
  evidencias: EvidenciaItem[];
  comoChegamos: string;
  oQueDadosMostram: string;
  hipotese: string;
  impacto: string;
  confianca: ConfiancaDecisao;
  confiancaMotivo: string;
  recomendacao: string;
  responsavelAcao: string;
  prazoAcao: string;
  comoVerificar: string;
  dadosAnalisados: Record<string, any>;
  calculos: CalculoInfo;
  comparacoes: ComparacaoInfo[];
  ticketsEnvolvidos: string[];
  rankingAnalistas: RankingAnalista[];
  padroesDetectados: PadraoDetectado[];
}

export interface FiltroDecisao {
  tipo?: TipoDecisao;
  severidade?: SeveridadeDecisao;
  confianca?: ConfiancaDecisao;
  status?: StatusDecisao;
  revisaoStatus?: RevisaoStatus;
  dataInicio?: Date;
  dataFim?: Date;
  agenteId?: string;
  limit?: number;
  offset?: number;
}

export interface DecisaoSalva {
  id: string;
  tipo: string;
  severidade: string;
  titulo: string;
  problema: string;
  evidencias: EvidenciaItem[];
  comoChegamos: string;
  oQueDadosMostram: string;
  hipotese: string;
  impacto: string;
  confianca: string;
  confiancaMotivo: string | null;
  recomendacao: string;
  responsavelAcao: string | null;
  prazoAcao: string | null;
  comoVerificar: string | null;
  resultado: string | null;
  resultadoData: Date | null;
  status: string;
  periodoInicio: Date | null;
  periodoFim: Date | null;
  dadosAnalisados: Record<string, any>;
  calculos: CalculoInfo;
  comparacoes: ComparacaoInfo[];
  ticketsEnvolvidos: string[];
  rankingAnalistas: RankingAnalista[];
  padroesDetectados: PadraoDetectado[];
  modeloIa: string | null;
  revisaoStatus: string;
  criadoEm: Date;
}

// ── Helpers ────────────────────────────────────────────────────────────

function parseJson<T>(value: string, fallback: T): T {
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function classificarSeveridade(
  valor: number,
  limiarCritico: number,
  limiarAlto: number,
  limiarMedio: number,
): SeveridadeDecisao {
  if (valor >= limiarCritico) return 'critica';
  if (valor >= limiarAlto) return 'alta';
  if (valor >= limiarMedio) return 'media';
  return 'baixa';
}

function classificarConfianca(
  amostra: number,
  padraoConsistente: boolean,
  multiplasEvidencias: boolean,
): ConfiancaDecisao {
  if (amostra >= 30 && padraoConsistente && multiplasEvidencias) return 'alta';
  if (amostra >= 10 || (padraoConsistente && multiplasEvidencias)) return 'media';
  return 'baixa';
}

// ── Geração de Decisões ───────────────────────────────────────────────

/**
 * Gera decisão sobre reaberturas
 */
export async function gerarDecisaoReabertura(
  dataInicio: Date,
  dataFim: Date,
): Promise<DecisaoGenerada> {
  const [ticketsFechados, ticketsReabertos] = await Promise.all([
    prisma.ticket.count({
      where: {
        status: 'fechado',
        dataFechamento: { gte: dataInicio, lte: dataFim },
      },
    }),
    prisma.ticket.count({
      where: {
        status: { not: 'fechado' },
        dataFechamento: { gte: dataInicio, lte: dataFim },
        etapa: { in: ['fila', 'triagem', 'em_atendimento'] },
      },
    }),
  ]);

  const taxaReabertura = ticketsFechados > 0
    ? (ticketsReabertos / ticketsFechados) * 100
    : 0;

  // Detalhar reaberturas por analista
  const reabertos = await prisma.ticket.findMany({
    where: {
      status: { not: 'fechado' },
      dataFechamento: { gte: dataInicio, lte: dataFim },
      etapa: { in: ['fila', 'triagem', 'em_atendimento'] },
    },
    select: {
      id: true,
      assigneeId: true,
      assignee: { select: { name: true } },
      contactName: true,
      assunto: true,
      categoria: true,
      dataAbertura: true,
      dataFechamento: true,
    },
  });

  // Reaberturas até 24h
  const reabertos24h = reabertos.filter((t) => {
    if (!t.dataFechamento) return false;
    const diffHoras = (t.dataAbertura.getTime() - t.dataFechamento.getTime()) / (1000 * 60 * 60);
    return diffHoras <= 24;
  });

  const pct24h = ticketsReabertos > 0 ? (reabertos24h.length / ticketsReabertos) * 100 : 0;

  // Tickets únicos envolvidos
  const ticketIds = reabertos.map((t) => t.id);

  // Ranking por analista
  const porAnalista = new Map<string, { nome: string; count: number }>();
  for (const t of reabertos) {
    if (!t.assigneeId) continue;
    const key = t.assigneeId;
    const existing = porAnalista.get(key);
    if (existing) {
      existing.count++;
    } else {
      porAnalista.set(key, { nome: t.assignee?.name || 'N/A', count: 1 });
    }
  }

  const ranking: RankingAnalista[] = Array.from(porAnalista.entries())
    .map(([agenteId, data]) => ({
      agenteId,
      nome: data.nome,
      valor: data.count,
      classificacao: data.count >= 5 ? 'alerta' : 'normal',
    }))
    .sort((a, b) => b.valor - a.valor);

  const confianca = classificarConfianca(
    ticketsReabertos,
    taxaReabertura > 15,
    reabertos24h.length > 0,
  );

  return {
    tipo: 'reabertura',
    severidade: classificarSeveridade(taxaReabertura, 25, 15, 10),
    titulo: `Reabertura ${taxaReabertura.toFixed(1)}% — ${ticketsReabertos} tickets reabertos`,
    problema: `${ticketsReabertos} dos ${ticketsFechados} tickets fechados foram reabertos no período. Taxa de ${taxaReabertura.toFixed(2)}%.`,
    evidencias: [
      { tipo: 'quantidade', dado: 'Tickets fechados', valor: ticketsFechados, fonte: 'Ticket' },
      { tipo: 'quantidade', dado: 'Tickets reabertos', valor: ticketsReabertos, fonte: 'Ticket' },
      { tipo: 'percentual', dado: 'Taxa de reabertura', valor: `${taxaReabertura.toFixed(2)}%` },
      { tipo: 'quantidade', dado: 'Reabertos até 24h', valor: reabertos24h.length, comparacao: `${pct24h.toFixed(1)}% do total`, fonte: 'Ticket' },
    ],
    comoChegamos: `taxa = tickets reabertos / tickets fechados × 100\n${ticketsReabertos} / ${ticketsFechados} × 100 = ${taxaReabertura.toFixed(2)}%\n\nReabertos até 24h: ${reabertos24h.length} / ${ticketsReabertos} = ${pct24h.toFixed(1)}%`,
    oQueDadosMostram: `${pct24h.toFixed(1)}% das reaberturas ocorreram em até 24 horas após o fechamento. ${reabertos.length > 0 ? `Os tickets reabertos incluem: ${reabertos.slice(0, 5).map((t) => t.contactName || t.assunto || t.id).join(', ')}` : 'Nenhum ticket reaberto com detalhes disponíveis.'}`,
    hipotese: 'Existe possibilidade de fechamento antes da confirmação efetiva da solução, ou o problema não foi completamente resolvido no primeiro atendimento.',
    impacto: 'Retrabalho para a equipe, insatisfação do cliente e aumento do tempo médio de resolução.',
    confianca,
    confiancaMotivo: `Amostra de ${ticketsReabertos} reaberturas. ${confianca === 'alta' ? 'Padrão consistente com múltiplas evidências.' : confianca === 'media' ? 'Padrão identificado mas amostra limitada.' : 'Dados insuficientes para conclusão definitiva.'}`,
    recomendacao: 'Durante os próximos 7 dias, exigir confirmação da solução antes do fechamento para tickets classificados como erro técnico, falha recorrente ou problema de integração.',
    responsavelAcao: 'Coordenação/Supervisão',
    prazoAcao: '7 dias',
    comoVerificar: 'Taxa de reabertura deve reduzir para abaixo de 10%',
    dadosAnalisados: { totalTickets: ticketsFechados, ticketsFechados, ticketsReabertos, reabertos24h: reabertos24h.length },
    calculos: { formula: 'ticketsReabertos / ticketsFechados * 100', resultado: taxaReabertura, comparacao: `${ticketsReabertos} / ${ticketsFechados} * 100 = ${taxaReabertura.toFixed(2)}%` },
    comparacoes: [],
    ticketsEnvolvidos: ticketIds,
    rankingAnalistas: ranking,
    padroesDetectados: reabertos24h.length > 5
      ? [{ tipo: 'fechamento_prematuro', descricao: 'Alta taxa de reabertura em até 24h', frequencia: reabertos24h.length, confianca: confianca }]
      : [],
  };
}

/**
 * Gera decisão sobre SLA
 */
export async function gerarDecisaoSLA(
  dataInicio: Date,
  dataFim: Date,
  metaSlaPct: number = 95,
): Promise<DecisaoGenerada> {
  const tickets = await prisma.ticket.findMany({
    where: {
      dataAbertura: { gte: dataInicio, lte: dataFim },
      status: 'fechado',
    },
    select: {
      id: true,
      dataAbertura: true,
      dataFechamento: true,
      assigneeId: true,
      assignee: { select: { name: true } },
      prioridade: true,
      etapa: true,
    },
  });

  const total = tickets.length;
  const dentroSla = tickets.filter((t) => {
    if (!t.dataFechamento || !t.dataAbertura) return false;
    const diffMin = (t.dataFechamento.getTime() - t.dataAbertura.getTime()) / (1000 * 60);
    const slaMin = t.prioridade === 'urgente' ? 60 : t.prioridade === 'alta' ? 240 : 480;
    return diffMin <= slaMin;
  }).length;

  const foraSla = total - dentroSla;
  const taxaSla = total > 0 ? (dentroSla / total) * 100 : 100;

  // Tempo médio
  const tempos = tickets
    .filter((t) => t.dataFechamento && t.dataAbertura)
    .map((t) => (t.dataFechamento!.getTime() - t.dataAbertura!.getTime()) / (1000 * 60));

  const tmrMedio = tempos.length > 0 ? tempos.reduce((a, b) => a + b, 0) / tempos.length : 0;
  const tmrP95 = tempos.length > 0 ? tempos.sort((a, b) => a - b)[Math.floor(tempos.length * 0.95)] : 0;

  // Tickets fora do SLA
  const ticketsForaSla = tickets.filter((t) => {
    if (!t.dataFechamento || !t.dataAbertura) return false;
    const diffMin = (t.dataFechamento.getTime() - t.dataAbertura.getTime()) / (1000 * 60);
    const slaMin = t.prioridade === 'urgente' ? 60 : t.prioridade === 'alta' ? 240 : 480;
    return diffMin > slaMin;
  });

  const ticketIds = ticketsForaSla.map((t) => t.id);

  const confianca = classificarConfianca(
    total,
    taxaSla < metaSlaPct,
    ticketsForaSla.length > 0,
  );

  return {
    tipo: 'sla',
    severidade: taxaSla < 80 ? 'critica' : taxaSla < metaSlaPct ? 'alta' : 'baixa',
    titulo: `SLA ${taxaSla.toFixed(1)}% — Meta: ${metaSlaPct}%`,
    problema: `${foraSla} dos ${total} tickets fechados ficaram fora do SLA contratado. Taxa de conformidade: ${taxaSla.toFixed(2)}%.`,
    evidencias: [
      { tipo: 'quantidade', dado: 'Total de tickets', valor: total, fonte: 'Ticket' },
      { tipo: 'quantidade', dado: 'Dentro do SLA', valor: dentroSla, fonte: 'Ticket' },
      { tipo: 'quantidade', dado: 'Fora do SLA', valor: foraSla, fonte: 'Ticket' },
      { tipo: 'percentual', dado: 'Taxa de conformidade', valor: `${taxaSla.toFixed(2)}%` },
      { tipo: 'tempo', dado: 'TMR médio', valor: `${tmrMedio.toFixed(0)} min` },
      { tipo: 'tempo', dado: 'TMR P95', valor: `${tmrP95.toFixed(0)} min` },
    ],
    comoChegamos: `SLA = (tickets dentro do SLA / total de tickets) * 100\n${dentroSla} / ${total} * 100 = ${taxaSla.toFixed(2)}%\n\nMeta contratual: ${metaSlaPct}%`,
    oQueDadosMostram: `${foraSla} tickets ultrapassaram o tempo máximo de resolução. ${tmrP95 > tmrMedio * 2 ? 'A média está sendo elevada por uma pequena quantidade de atendimentos muito longos.' : 'Os atrasos estão distribuídos de forma consistente.'}`,
    hipotese: 'Os atrasos podem estar relacionados a filas com volume elevado, complexidade dos problemas ou falta de recursos no período.',
    impacto: 'Violação de contrato, insatisfação do cliente e risco de perda de SLA.',
    confianca,
    confiancaMotivo: `Amostra de ${total} tickets. ${confianca === 'alta' ? 'Padrão consistente com múltiplas evidências.' : 'Dados disponíveis para análise.'}`,
    recomendacao: 'Implementar monitoramento em tempo real do SLA e escalar automaticamente tickets que atingirem 80% do tempo limite.',
    responsavelAcao: 'Supervisão',
    prazoAcao: '5 dias',
    comoVerificar: 'Taxa de SLA deve atingir a meta de conformidade',
    dadosAnalisados: { total, dentroSla, foraSla, tmrMedio, tmrP95 },
    calculos: { formula: 'dentroSla / total * 100', resultado: taxaSla, comparacao: `${dentroSla} / ${total} * 100 = ${taxaSla.toFixed(2)}%` },
    comparacoes: [
      { indicador: 'SLA', valorAtual: `${taxaSla.toFixed(1)}%`, valorAnterior: `${metaSlaPct}%`, variacao: `${(taxaSla - metaSlaPct).toFixed(1)}pp` },
    ],
    ticketsEnvolvidos: ticketIds,
    rankingAnalistas: [],
    padroesDetectados: tmrP95 > tmrMedio * 3
      ? [{ tipo: 'outliers', descricao: 'Atendimentos muito longos elevando a média', frequencia: Math.ceil(total * 0.05), confianca: 'media' }]
      : [],
  };
}

/**
 * Gera decisão sobre CSAT
 */
export async function gerarDecisaoCSAT(
  dataInicio: Date,
  dataFim: Date,
  metaCsat: number = 4.0,
): Promise<DecisaoGenerada> {
  const respostas = await prisma.cSATResposta.findMany({
    where: {
      respondidoEm: { gte: dataInicio, lte: dataFim },
      nota: { not: null },
    },
    select: {
      id: true,
      nota: true,
      ticketId: true,
      respondidoEm: true,
    },
  });

  const total = respostas.length;
  const notas = respostas.map((r) => r.nota!);
  const media = total > 0 ? notas.reduce((a, b) => a + b, 0) / total : 0;
  const distribuicao = [1, 2, 3, 4, 5].map((n) => ({
    nota: n,
    count: notas.filter((x) => x === n).length,
    pct: total > 0 ? (notas.filter((x) => x === n).length / total) * 100 : 0,
  }));

  const notasBaixas = respostas.filter((r) => r.nota! <= 2);
  const ticketIdsBaixas = notasBaixas.map((r) => r.ticketId).filter(Boolean) as string[];

  // CSAT de tickets reabertos vs não reabertos
  const ticketIds = respostas.map((r) => r.ticketId).filter(Boolean) as string[];
  const ticketsComReabertura = await prisma.ticket.findMany({
    where: { id: { in: ticketIds }, etapa: { in: ['fila', 'triagem'] } },
    select: { id: true },
  });
  const reabertosIds = new Set(ticketsComReabertura.map((t) => t.id));

  const csatReabertos = respostas
    .filter((r) => r.ticketId && reabertosIds.has(r.ticketId))
    .map((r) => r.nota!);
  const csatNaoReabertos = respostas
    .filter((r) => r.ticketId && !reabertosIds.has(r.ticketId))
    .map((r) => r.nota!);

  const mediaReabertos = csatReabertos.length > 0 ? csatReabertos.reduce((a, b) => a + b, 0) / csatReabertos.length : 0;
  const mediaNaoReabertos = csatNaoReabertos.length > 0 ? csatNaoReabertos.reduce((a, b) => a + b, 0) / csatNaoReabertos.length : 0;

  const confianca = classificarConfianca(
    total,
    media < metaCsat,
    notasBaixas.length > 0,
  );

  return {
    tipo: 'csat',
    severidade: media < 3.0 ? 'critica' : media < metaCsat ? 'alta' : 'baixa',
    titulo: `CSAT ${media.toFixed(2)} — Meta: ${metaCsat}`,
    problema: `Satisfação do cliente está ${media < metaCsat ? 'abaixo' : 'dentro'} da meta. Nota média: ${media.toFixed(2)} de 5. ${notasBaixas.length} avaliações negativas.`,
    evidencias: [
      { tipo: 'quantidade', dado: 'Total de avaliações', valor: total, fonte: 'CSATResposta' },
      { tipo: 'nota', dado: 'Nota média', valor: media.toFixed(2), comparacao: `Meta: ${metaCsat}` },
      { tipo: 'quantidade', dado: 'Notas baixas (1-2)', valor: notasBaixas.length, fonte: 'CSATResposta' },
      { tipo: 'distribuicao', dado: 'Distribuição', valor: distribuicao.map((d) => `${d.nota}★:${d.count}`).join(' | ') },
    ],
    comoChegamos: `CSAT média = soma das notas / total de avaliações\n${notas.reduce((a, b) => a + b, 0)} / ${total} = ${media.toFixed(2)}`,
    oQueDadosMostram: `${media < metaCsat ? 'A nota média está abaixo da meta.' : 'A nota média está dentro da meta.'} ${csatReabertos.length > 0 && mediaReabertos < mediaNaoReabertos ? `Tickets reabertos tiveram CSAT médio de ${mediaReabertos.toFixed(2)}, enquanto tickets não reabertos tiveram ${mediaNaoReabertos.toFixed(2)}.` : ''} ${notasBaixas.length > 0 ? `${notasBaixas.length} clientes deram nota 1 ou 2.` : ''}`,
    hipotese: media < metaCsat
      ? 'A baixa satisfação pode estar relacionada a tempo de espera elevado, qualidade da solução ou comunicação inadequada.'
      : 'A satisfação está dentro do esperado, mas deve ser monitorada.',
    impacto: media < 3.0
      ? 'Risco de churn, reputação negativa e perda de contratos.'
      : 'Satisfação aceitável, mas há espaço para melhoria.',
    confianca,
    confiancaMotivo: `Amostra de ${total} avaliações. ${confianca === 'alta' ? 'Dados suficientes para conclusão.' : 'Amostra limitada.'}`,
    recomendacao: media < metaCsat
      ? 'Investigar os tickets com nota baixa, verificar padrões de atendimento e implementar treinamento focado.'
      : 'Manter monitoramento e buscar melhoria contínua.',
    responsavelAcao: 'Coordenação/Supervisão',
    prazoAcao: '7 dias',
    comoVerificar: `CSAT deve atingir ${metaCsat} ou superior`,
    dadosAnalisados: { total, media, notasBaixas: notasBaixas.length, mediaReabertos, mediaNaoReabertos },
    calculos: { formula: 'somaNotas / total', resultado: media, comparacao: `${notas.reduce((a, b) => a + b, 0)} / ${total} = ${media.toFixed(2)}` },
    comparacoes: [
      { indicador: 'CSAT', valorAtual: media.toFixed(2), valorAnterior: metaCsat.toFixed(1), variacao: `${(media - metaCsat).toFixed(2)}` },
    ],
    ticketsEnvolvidos: ticketIdsBaixas,
    rankingAnalistas: [],
    padroesDetectados: mediaReabertos < mediaNaoReabertos && csatReabertos.length >= 3
      ? [{ tipo: 'correlacao_reabertura_csat', descricao: 'Reabertura associada a baixa satisfação', frequencia: csatReabertos.length, confianca: 'media' }]
      : [],
  };
}

/**
 * Gera decisão sobre ociosidade
 */
export async function gerarDecisaoOciosidade(
  dataInicio: Date,
  dataFim: Date,
): Promise<DecisaoGenerada> {
  const usuarios = await prisma.user.findMany({
    where: { active: true, role: { in: ['tecnico', 'admin'] } },
    select: { id: true, name: true, online: true, lastSeenAt: true },
  });

  const tickets = await prisma.ticket.findMany({
    where: {
      dataAbertura: { gte: dataInicio, lte: dataFim },
      status: { not: 'fechado' },
    },
    select: { id: true, assigneeId: true, status: true, etapa: true },
  });

  const filaTickets = await prisma.ticket.count({
    where: { status: 'aberto', etapa: 'fila' },
  });

  // Analistas online sem ticket atribuído
  const onlineSemTicket = usuarios.filter((u) => {
    if (!u.online) return false;
    const temTicket = tickets.some((t) => t.assigneeId === u.id);
    return !temTicket;
  });

  // Analistas online com ticket
  const onlineComTicket = usuarios.filter((u) => {
    if (!u.online) return false;
    return tickets.some((t) => t.assigneeId === u.id);
  });

  const confianca = classificarConfianca(
    onlineSemTicket.length,
    onlineSemTicket.length > 0 && filaTickets > 5,
    filaTickets > 0,
  );

  return {
    tipo: 'ociosidade',
    severidade: onlineSemTicket.length > 2 && filaTickets > 10 ? 'alta' : onlineSemTicket.length > 0 ? 'media' : 'info',
    titulo: `${onlineSemTicket.length} analistas online sem tickets — ${filaTickets} na fila`,
    problema: `${onlineSemTicket.length} analistas estão online mas sem tickets atribuídos, enquanto ${filaTickets} tickets aguardam na fila.`,
    evidencias: [
      { tipo: 'quantidade', dado: 'Analistas online', valor: onlineComTicket.length + onlineSemTicket.length, fonte: 'User' },
      { tipo: 'quantidade', dado: 'Online sem ticket', valor: onlineSemTicket.length, fonte: 'User' },
      { tipo: 'quantidade', dado: 'Tickets na fila', valor: filaTickets, fonte: 'Ticket' },
      { tipo: 'lista', dado: 'Analistas ociosos', valor: onlineSemTicket.map((u) => u.name).join(', ') || 'Nenhum' },
    ],
    comoChegamos: `Analistas online: ${usuarios.filter((u) => u.online).length}\nCom ticket: ${onlineComTicket.length}\nSem ticket: ${onlineSemTicket.length}\nFila: ${filaTickets}`,
    oQueDadosMostram: `${onlineSemTicket.length} analistas estão disponíveis mas não possuem tickets atribuídos. ${filaTickets > 0 ? `Existem ${filaTickets} tickets aguardando na fila.` : 'Não há tickets na fila.'}`,
    hipotese: 'A distribuição de tickets pode estar desbalanceada, ou a fila pode estar vazia devido a alta demanda anterior.',
    impacto: 'Subutilização de recursos e possível aumento do tempo de espera para novos tickets.',
    confianca,
    confiancaMotivo: `Dados de ${usuarios.length} analistas e ${tickets.length} tickets. ${confianca === 'alta' ? 'Padrão claro de ociosidade.' : 'Dados disponíveis para análise.'}`,
    recomendacao: filaTickets > 0
      ? 'Distribuir tickets da fila para analistas ociosos e monitorar a utilização.'
      : 'Manter monitoramento para garantir pronta resposta a novos tickets.',
    responsavelAcao: 'Supervisão',
    prazoAcao: 'Imediato',
    comoVerificar: 'Fila deve estar vazia ou analistas devem estar com tickets atribuídos',
    dadosAnalisados: { totalAnalistas: usuarios.length, online: usuarios.filter((u) => u.online).length, semTicket: onlineSemTicket.length, fila: filaTickets },
    calculos: { formula: 'analistasOnline - analistasComTicket', resultado: onlineSemTicket.length, comparacao: `${usuarios.filter((u) => u.online).length} - ${onlineComTicket.length} = ${onlineSemTicket.length}` },
    comparacoes: [],
    ticketsEnvolvidos: [],
    rankingAnalistas: onlineSemTicket.map((u) => ({
      agenteId: u.id,
      nome: u.name,
      valor: 0,
      classificacao: 'ocioso',
    })),
    padroesDetectados: [],
  };
}

/**
 * Gera decisão sobre retrabalho
 */
export async function gerarDecisaoRetrabalho(
  dataInicio: Date,
  dataFim: Date,
  metaRetrabalhoPct: number = 20,
): Promise<DecisaoGenerada> {
  // Retrabalho = tickets com múltiplas etapas de atendimento ou reaberturas
  const tickets = await prisma.ticket.findMany({
    where: {
      dataAbertura: { gte: dataInicio, lte: dataFim },
      status: 'fechado',
    },
    select: {
      id: true,
      assigneeId: true,
      assignee: { select: { name: true } },
      etapa: true,
      status: true,
    },
  });

  const total = tickets.length;

  // Retrabalho = tickets que passaram por mais de 1 ciclo (reabertos)
  const reabertos = await prisma.ticket.findMany({
    where: {
      dataAbertura: { gte: dataInicio, lte: dataFim },
      etapa: { in: ['fila', 'triagem', 'em_atendimento'] },
      status: { not: 'fechado' },
    },
    select: { id: true },
  });

  const retrabalho = reabertos.length;
  const taxaRetrabalho = total > 0 ? (retrabalho / total) * 100 : 0;

  const confianca = classificarConfianca(
    retrabalho,
    taxaRetrabalho > metaRetrabalhoPct,
    retrabalho > 0,
  );

  return {
    tipo: 'retrabalho',
    severidade: classificarSeveridade(taxaRetrabalho, 30, 20, 10),
    titulo: `Retrabalho ${taxaRetrabalho.toFixed(1)}% — ${retrabalho} tickets retrabalhados`,
    problema: `${retrabalho} dos ${total} tickets fechados necessitaram de retrabalho. Taxa de ${taxaRetrabalho.toFixed(2)}%.`,
    evidencias: [
      { tipo: 'quantidade', dado: 'Total de tickets', valor: total, fonte: 'Ticket' },
      { tipo: 'quantidade', dado: 'Retrabalhados', valor: retrabalho, fonte: 'Ticket' },
      { tipo: 'percentual', dado: 'Taxa de retrabalho', valor: `${taxaRetrabalho.toFixed(2)}%` },
    ],
    comoChegamos: `taxaRetrabalho = retrabalhados / total * 100\n${retrabalho} / ${total} * 100 = ${taxaRetrabalho.toFixed(2)}%`,
    oQueDadosMostram: `${taxaRetrabalho.toFixed(1)}% dos tickets precisaram de retrabalho. ${taxaRetrabalho > metaRetrabalhoPct ? 'Acima da meta.' : 'Dentro da meta.'}`,
    hipotese: 'O retrabalho pode estar relacionado a soluções incompletas, comunicação deficiente ou problemas complexos.',
    impacto: 'Aumento do custo operacional e sobrecarga da equipe.',
    confianca,
    confiancaMotivo: `Amostra de ${retrabalho} casos. ${confianca === 'alta' ? 'Padrão consistente.' : 'Dados limitados.'}`,
    recomendacao: 'Revisar os tickets retrabalhados, identificar padrões e implementarchecklists de verificação antes do fechamento.',
    responsavelAcao: 'Coordenação',
    prazoAcao: '10 dias',
    comoVerificar: `Taxa de retrabalho deve reduzir para abaixo de ${metaRetrabalhoPct}%`,
    dadosAnalisados: { total, retrabalho, taxaRetrabalho },
    calculos: { formula: 'retrabalho / total * 100', resultado: taxaRetrabalho },
    comparacoes: [],
    ticketsEnvolvidos: reabertos.map((r) => r.id),
    rankingAnalistas: [],
    padroesDetectados: [],
  };
}

// ── CRUD de Decisões ──────────────────────────────────────────────────

/**
 * Salva uma decisão gerada no banco
 */
export async function salvarDecisao(
  decisao: DecisaoGenerada,
  periodoInicio: Date,
  periodoFim: Date,
  criadoPorId?: string,
  organizationId?: string,
): Promise<DecisaoSalva> {
  const saved = await prisma.decisionAudit.create({
    data: {
      tipo: decisao.tipo,
      severidade: decisao.severidade,
      titulo: decisao.titulo,
      problema: decisao.problema,
      evidencias: JSON.stringify(decisao.evidencias),
      comoChegamos: decisao.comoChegamos,
      oQueDadosMostram: decisao.oQueDadosMostram,
      hipotese: decisao.hipotese,
      impacto: decisao.impacto,
      confianca: decisao.confianca,
      confiancaMotivo: decisao.confiancaMotivo,
      recomendacao: decisao.recomendacao,
      responsavelAcao: decisao.responsavelAcao,
      prazoAcao: decisao.prazoAcao,
      comoVerificar: decisao.comoVerificar,
      dadosAnalisados: JSON.stringify(decisao.dadosAnalisados),
      calculos: JSON.stringify(decisao.calculos),
      comparacoes: JSON.stringify(decisao.comparacoes),
      ticketsEnvolvidos: JSON.stringify(decisao.ticketsEnvolvidos),
      rankingAnalistas: JSON.stringify(decisao.rankingAnalistas),
      padroesDetectados: JSON.stringify(decisao.padroesDetectados),
      periodoInicio,
      periodoFim,
      criadoPorId: criadoPorId || null,
      organizationId: organizationId || null,
    },
  });

  return {
    ...saved,
    evidencias: parseJson(saved.evidencias, []),
    dadosAnalisados: parseJson(saved.dadosAnalisados, {}),
    calculos: parseJson(saved.calculos, { formula: '', resultado: '' }),
    comparacoes: parseJson(saved.comparacoes, []),
    ticketsEnvolvidos: parseJson(saved.ticketsEnvolvidos, []),
    rankingAnalistas: parseJson(saved.rankingAnalistas, []),
    padroesDetectados: parseJson(saved.padroesDetectados, []),
  };
}

/**
 * Lista decisões com filtros
 */
export async function listarDecisoes(filtro: FiltroDecisao): Promise<{ decisoes: DecisaoSalva[]; total: number }> {
  const where: any = {};
  if (filtro.tipo) where.tipo = filtro.tipo;
  if (filtro.severidade) where.severidade = filtro.severidade;
  if (filtro.confianca) where.confianca = filtro.confianca;
  if (filtro.status) where.status = filtro.status;
  if (filtro.revisaoStatus) where.revisaoStatus = filtro.revisaoStatus;
  if (filtro.dataInicio || filtro.dataFim) {
    where.criadoEm = {};
    if (filtro.dataInicio) where.criadoEm.gte = filtro.dataInicio;
    if (filtro.dataFim) where.criadoEm.lte = filtro.dataFim;
  }

  const limit = filtro.limit || 50;
  const offset = filtro.offset || 0;

  const [items, total] = await Promise.all([
    prisma.decisionAudit.findMany({
      where,
      orderBy: [
        { severidade: 'asc' },
        { criadoEm: 'desc' },
      ],
      take: limit,
      skip: offset,
    }),
    prisma.decisionAudit.count({ where }),
  ]);

  const decisoes: DecisaoSalva[] = items.map((item) => ({
    ...item,
    evidencias: parseJson(item.evidencias, []),
    dadosAnalisados: parseJson(item.dadosAnalisados, {}),
    calculos: parseJson(item.calculos, { formula: '', resultado: '' }),
    comparacoes: parseJson(item.comparacoes, []),
    ticketsEnvolvidos: parseJson(item.ticketsEnvolvidos, []),
    rankingAnalistas: parseJson(item.rankingAnalistas, []),
    padroesDetectados: parseJson(item.padroesDetectados, []),
  }));

  return { decisoes, total };
}

/**
 * Atualiza status de uma decisão
 */
export async function atualizarStatusDecisao(
  id: string,
  status: StatusDecisao,
  resultado?: string,
): Promise<DecisaoSalva> {
  const updateData: any = { status };
  if (resultado) {
    updateData.resultado = resultado;
    updateData.resultadoData = new Date();
  }

  const item = await prisma.decisionAudit.update({
    where: { id },
    data: updateData,
  });

  return {
    ...item,
    evidencias: parseJson(item.evidencias, []),
    dadosAnalisados: parseJson(item.dadosAnalisados, {}),
    calculos: parseJson(item.calculos, { formula: '', resultado: '' }),
    comparacoes: parseJson(item.comparacoes, []),
    ticketsEnvolvidos: parseJson(item.ticketsEnvolvidos, []),
    rankingAnalistas: parseJson(item.rankingAnalistas, []),
    padroesDetectados: parseJson(item.padroesDetectados, []),
  };
}

/**
 * Revisa uma decisão
 */
export async function revisarDecisao(
  id: string,
  revisaoStatus: RevisaoStatus,
  justificativa: string,
  revisadoPorId: string,
): Promise<DecisaoSalva> {
  const item = await prisma.decisionAudit.update({
    where: { id },
    data: {
      revisaoStatus,
      revisaoJustificativa: justificativa,
      revisadoPorId,
      revisaoEm: new Date(),
    },
  });

  return {
    ...item,
    evidencias: parseJson(item.evidencias, []),
    dadosAnalisados: parseJson(item.dadosAnalisados, {}),
    calculos: parseJson(item.calculos, { formula: '', resultado: '' }),
    comparacoes: parseJson(item.comparacoes, []),
    ticketsEnvolvidos: parseJson(item.ticketsEnvolvidos, []),
    rankingAnalistas: parseJson(item.rankingAnalistas, []),
    padroesDetectados: parseJson(item.padroesDetectados, []),
  };
}

/**
 * Gera decisões completas para um período
 */
export async function gerarDecisoesPeriodo(
  dataInicio: Date,
  dataFim: Date,
  criadoPorId?: string,
  organizationId?: string,
): Promise<DecisaoSalva[]> {
  const decisoes: DecisaoGenerada[] = [];

  // Gerar cada tipo de decisão
  try {
    const reabertura = await gerarDecisaoReabertura(dataInicio, dataFim);
    decisoes.push(reabertura);
  } catch {}

  try {
    const sla = await gerarDecisaoSLA(dataInicio, dataFim);
    decisoes.push(sla);
  } catch {}

  try {
    const csat = await gerarDecisaoCSAT(dataInicio, dataFim);
    decisoes.push(csat);
  } catch {}

  try {
    const retrabalho = await gerarDecisaoRetrabalho(dataInicio, dataFim);
    decisoes.push(retrabalho);
  } catch {}

  try {
    const ociosidade = await gerarDecisaoOciosidade(dataInicio, dataFim);
    decisoes.push(ociosidade);
  } catch {}

  // Salvar todas as decisões
  const salvas: DecisaoSalva[] = [];
  for (const decisao of decisoes) {
    try {
      const salva = await salvarDecisao(decisao, dataInicio, dataFim, criadoPorId, organizationId);
      salvas.push(salva);
    } catch {}
  }

  return salvas;
}

/**
 * Retorna resumo das decisões (para dashboard)
 */
export async function getResumoDecisoes(dias: number = 30) {
  const dataInicio = new Date();
  dataInicio.setDate(dataInicio.getDate() - dias);

  const [total, porSeveridade, porStatus, porTipo, porConfianca] = await Promise.all([
    prisma.decisionAudit.count({ where: { criadoEm: { gte: dataInicio } } }),
    prisma.decisionAudit.groupBy({ by: ['severidade'], where: { criadoEm: { gte: dataInicio } }, _count: true }),
    prisma.decisionAudit.groupBy({ by: ['status'], where: { criadoEm: { gte: dataInicio } }, _count: true }),
    prisma.decisionAudit.groupBy({ by: ['tipo'], where: { criadoEm: { gte: dataInicio } }, _count: true }),
    prisma.decisionAudit.groupBy({ by: ['confianca'], where: { criadoEm: { gte: dataInicio } }, _count: true }),
  ]);

  return {
    total,
    porSeveridade: porSeveridade.map((s) => ({ severidade: s.severidade, count: s._count })),
    porStatus: porStatus.map((s) => ({ status: s.status, count: s._count })),
    porTipo: porTipo.map((t) => ({ tipo: t.tipo, count: t._count })),
    porConfianca: porConfianca.map((c) => ({ confianca: c.confianca, count: c._count })),
  };
}
