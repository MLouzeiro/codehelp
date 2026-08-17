import prisma from '../../config/database';
import { classificarNota, FiltroAuditoria } from './auditoriaProfissional.service';

// ── Tipos ───────────────────────────────────────────────────────

export interface IndicadoresPeriodo {
  periodo: { inicio: Date | null; fim: Date | null };
  totalAuditadas: number;
  totalTicketsPeriodo: number;
  cobertura: number; // %
  notaGeralMedia: number;
  classificacaoGeral: string;
  distribuicaoClassificacao: Record<string, number>;
  distribuicaoResolucao: Record<string, number>;
  distribuicaoEncerramento: Record<string, number>;
  distribuicaoPadrao: Record<string, number>;
  taxaResolucao: number; // % RESOLVIDO + PROVAVELMENTE_RESOLVIDO
  taxaReabertura: number; // %
  taxaRetrabalho: number; // %
  custoOperacionalMedioMin: number;
  riscoInsatisfacao: Record<string, number>;
  csatMedia: number | null;
  mediaCategorias: Record<string, number>;
}

export interface AnalistaIndicador {
  agenteId: string;
  agenteNome: string;
  totalAuditadas: number;
  notaGeralMedia: number;
  classificacao: string;
  taxaResolucao: number;
  taxaReabertura: number;
  taxaRetrabalho: number;
  csatMedia: number | null;
  mediaCategorias: Record<string, number>;
  distribuicaoClassificacao: Record<string, number>;
}

export interface ClienteIndicador {
  clienteId: string | null;
  clienteNome: string;
  totalAuditadas: number;
  notaGeralMedia: number;
  taxaResolucao: number;
  taxaReabertura: number;
  riscoInsatisfacao: string;
  principaisProblemas: Array<{ descricao: string; ocorrencias: number; gravidade: string }>;
}

export interface AssuntoIndicador {
  categoria: string;
  totalAuditadas: number;
  notaGeralMedia: number;
  taxaResolucao: number;
  taxaReabertura: number;
  padrao: string;
  principaisProblemas: Array<{ descricao: string; ocorrencias: number }>;
}

export interface EvolucaoAnalista {
  agenteId: string;
  agenteNome: string;
  periodos: Array<{
    chave: string;
    inicio: Date;
    fim: Date;
    totalAuditadas: number;
    notaGeralMedia: number;
    classificacao: string;
  }>;
  tendencia: 'melhorando' | 'estavel' | 'piorando' | 'sem_dados';
  variacao: number; // pontos da primeira para última
  atual: number;
  meta: number;
  atingiuMeta: boolean;
}

export interface PadraoGlobal {
  tipo: string;
  descricao: string;
  gravidade: 'baixa' | 'media' | 'alta' | 'critica';
  ocorrencias: number;
  confianca: number;
}

export interface PanoramaAuditoria {
  periodo: { inicio: Date | null; fim: Date | null };
  indicadores: IndicadoresPeriodo;
  rankingAnalistas: AnalistaIndicador[];
  topClientesRisco: ClienteIndicador[];
  topAssuntos: AssuntoIndicador[];
  padroesGlobais: PadraoGlobal[];
  alertasGerenciais: Array<{ tipo: string; mensagem: string; gravidade: string }>;
}

// ── Helpers ─────────────────────────────────────────────────────

function media(nums: number[]): number {
  if (!nums.length) return 0;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

function buildWhere(filtro: FiltroAuditoria = {}, extra: Record<string, any> = {}): any {
  const where: any = { ...extra };
  if (filtro.dataInicio || filtro.dataFim) {
    where.auditadoEm = {
      ...(filtro.dataInicio ? { gte: filtro.dataInicio } : {}),
      ...(filtro.dataFim ? { lte: filtro.dataFim } : {}),
    };
  }
  if (filtro.agenteId) where.agenteId = filtro.agenteId;
  if (filtro.clienteId) where.clienteId = filtro.clienteId;
  if (filtro.departamentoId) where.departamentoId = filtro.departamentoId;
  if (filtro.categoria) where.categoria = filtro.categoria;
  if (filtro.status) where.status = filtro.status;
  if (filtro.classificacao) where.classificacao = filtro.classificacao;
  if (filtro.classificacaoResolucao) where.classificacaoResolucao = filtro.classificacaoResolucao;
  if (filtro.revisaoStatus) where.revisaoStatus = filtro.revisaoStatus;
  return where;
}

const CATEGORIAS_NOTA: Array<[string, string]> = [
  ['notaComunicacao', 'Comunicação'],
  ['notaProfissionalismo', 'Profissionalismo'],
  ['notaEmpatia', 'Empatia'],
  ['notaClareza', 'Clareza'],
  ['notaFormalidade', 'Formalidade'],
  ['notaConhecimentoTecnico', 'Conhecimento técnico'],
  ['notaDiagnostico', 'Diagnóstico'],
  ['notaResolucao', 'Resolução'],
  ['notaGestaoTempo', 'Gestão do tempo'],
  ['notaProcesso', 'Processo'],
  ['notaEncerramento', 'Encerramento'],
  ['notaSeguranca', 'Segurança'],
  ['notaResponsabilidade', 'Responsabilidade'],
  ['notaSatisfacaoCliente', 'Satisfação do cliente'],
];

function parseListaJson(val: string | null): any[] {
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function classificarPadrao(ocorrencias: number): string {
  if (ocorrencias >= 10) return 'PROBLEMA_SISTEMICO';
  if (ocorrencias >= 5) return 'PROBLEMA_FREQUENTE';
  if (ocorrencias >= 2) return 'PADRAO_RECORRENTE';
  return 'EVENTO_ISOLADO';
}

// ── Indicadores do período ──────────────────────────────────────

export async function calcularIndicadores(filtro: FiltroAuditoria = {}): Promise<IndicadoresPeriodo> {
  const where = buildWhere(filtro);

  const [auditadas, csat] = await Promise.all([
    prisma.auditoriaProfissional.findMany({
      where,
      select: {
        notaGeral: true,
        classificacao: true,
        classificacaoResolucao: true,
        classificacaoEncerramento: true,
        padrao: true,
        riscoInsatisfacao: true,
        retrabalho: true,
        reaberto: true,
        custoOperacionalMin: true,
        notaComunicacao: true, notaProfissionalismo: true, notaEmpatia: true, notaClareza: true,
        notaFormalidade: true, notaConhecimentoTecnico: true, notaDiagnostico: true, notaResolucao: true,
        notaGestaoTempo: true, notaProcesso: true, notaEncerramento: true, notaSeguranca: true,
        notaResponsabilidade: true, notaSatisfacaoCliente: true,
        ticketId: true,
      },
    }),
    prisma.cSATResposta.aggregate({
      where: { respondidoEm: { not: null }, nota: { not: null } },
      _avg: { nota: true },
      _count: { nota: true },
    }),
  ]);

  const totalTicketsPeriodo = await prisma.ticket.count({
    where: filtro.dataInicio || filtro.dataFim
      ? { dataAbertura: { ...(filtro.dataInicio ? { gte: filtro.dataInicio } : {}), ...(filtro.dataFim ? { lte: filtro.dataFim } : {}) } }
      : {},
  });

  const distClass: Record<string, number> = {};
  const distRes: Record<string, number> = {};
  const distEnc: Record<string, number> = {};
  const distPad: Record<string, number> = {};
  const riscoDist: Record<string, number> = {};
  const somaCategorias: Record<string, number> = {};
  for (const c of CATEGORIAS_NOTA) somaCategorias[c[1]] = 0;

  let somaNota = 0;
  let resolvidos = 0;
  let reabertos = 0;
  let retrabalhos = 0;
  let somaCusto = 0;
  const n = auditadas.length;

  for (const a of auditadas) {
    somaNota += a.notaGeral;
    distClass[a.classificacao] = (distClass[a.classificacao] || 0) + 1;
    distRes[a.classificacaoResolucao] = (distRes[a.classificacaoResolucao] || 0) + 1;
    distEnc[a.classificacaoEncerramento] = (distEnc[a.classificacaoEncerramento] || 0) + 1;
    distPad[a.padrao] = (distPad[a.padrao] || 0) + 1;
    riscoDist[a.riscoInsatisfacao] = (riscoDist[a.riscoInsatisfacao] || 0) + 1;
    if (['RESOLVIDO', 'PROVAVELMENTE_RESOLVIDO'].includes(a.classificacaoResolucao)) resolvidos++;
    if (a.reaberto) reabertos++;
    if (a.retrabalho) retrabalhos++;
    somaCusto += a.custoOperacionalMin || 0;
    for (const [campo, nome] of CATEGORIAS_NOTA) {
      const v = (a as any)[campo] || 0;
      somaCategorias[nome] = somaCategorias[nome] || 0;
      somaCategorias[nome] += v;
    }
  }

  const mediaCategorias: Record<string, number> = {};
  for (const [campo, nome] of CATEGORIAS_NOTA) {
    mediaCategorias[nome] = n ? Math.round((somaCategorias[nome] / n) * 10) / 10 : 0;
  }

  const notaGeralMedia = n ? Math.round((somaNota / n) * 10) / 10 : 0;

  const fatorResolucao = n ? resolvidos / n : 0;
  const classificacaoGeral =
    notaGeralMedia >= 90 ? 'EXCELENTE'
    : notaGeralMedia >= 80 ? 'MUITO_BOM'
    : notaGeralMedia >= 70 ? 'BOM'
    : notaGeralMedia >= 50 ? 'ATENCAO'
    : notaGeralMedia >= 30 ? 'ABAIXO_DA_MEDIA'
    : 'CRITICO';

  return {
    periodo: { inicio: filtro.dataInicio || null, fim: filtro.dataFim || null },
    totalAuditadas: n,
    totalTicketsPeriodo,
    cobertura: totalTicketsPeriodo ? Math.round((n / totalTicketsPeriodo) * 1000) / 10 : 0,
    notaGeralMedia,
    classificacaoGeral,
    distribuicaoClassificacao: distClass,
    distribuicaoResolucao: distRes,
    distribuicaoEncerramento: distEnc,
    distribuicaoPadrao: distPad,
    taxaResolucao: n ? Math.round((resolvidos / n) * 1000) / 10 : 0,
    taxaReabertura: n ? Math.round((reabertos / n) * 1000) / 10 : 0,
    taxaRetrabalho: n ? Math.round((retrabalhos / n) * 1000) / 10 : 0,
    custoOperacionalMedioMin: n ? Math.round(somaCusto / n) : 0,
    riscoInsatisfacao: riscoDist,
    csatMedia: csat._count.nota ? Math.round((csat._avg.nota || 0) * 100) / 100 : null,
    mediaCategorias,
  };
}

// ── Ranking de analistas ────────────────────────────────────────

export async function calcularRankingAnalistas(filtro: FiltroAuditoria = {}): Promise<AnalistaIndicador[]> {
  const where = buildWhere(filtro, { agenteId: { not: null } });
  const agrupado = await prisma.auditoriaProfissional.groupBy({
    by: ['agenteId'],
    where,
    _count: { _all: true },
    _avg: { notaGeral: true, notaResolucao: true, notaSatisfacaoCliente: true },
  });

  const agentes = await prisma.user.findMany({
    where: { id: { in: agrupado.map(a => a.agenteId as string) } },
    select: { id: true, name: true },
  });
  const nomeMap = new Map(agentes.map(a => [a.id, a.name]));

  const resultado: AnalistaIndicador[] = [];
  for (const g of agrupado) {
    const agentId = g.agenteId as string;
    const total = g._count._all;
    const notaGeral = Math.round((g._avg.notaGeral || 0) * 10) / 10;

    const subFiltro = { ...filtro, agenteId: agentId };
    const subWhere = buildWhere(subFiltro);
    const detalhes = await prisma.auditoriaProfissional.findMany({
      where: subWhere,
      select: {
        classificacao: true, classificacaoResolucao: true, retrabalho: true, reaberto: true,
        notaComunicacao: true, notaProfissionalismo: true, notaEmpatia: true, notaClareza: true,
        notaFormalidade: true, notaConhecimentoTecnico: true, notaDiagnostico: true, notaResolucao: true,
        notaGestaoTempo: true, notaProcesso: true, notaEncerramento: true, notaSeguranca: true,
        notaResponsabilidade: true, notaSatisfacaoCliente: true, ticketId: true,
      },
    });

    const distClass: Record<string, number> = {};
    let resolvidos = 0;
    let reabertos = 0;
    let retrabalhos = 0;
    const somaCat: Record<string, number> = {};
    for (const c of CATEGORIAS_NOTA) somaCat[c[1]] = 0;
    for (const d of detalhes) {
      distClass[d.classificacao] = (distClass[d.classificacao] || 0) + 1;
      if (['RESOLVIDO', 'PROVAVELMENTE_RESOLVIDO'].includes(d.classificacaoResolucao)) resolvidos++;
      if (d.reaberto) reabertos++;
      if (d.retrabalho) retrabalhos++;
      for (const [campo, nome] of CATEGORIAS_NOTA) somaCat[nome] += (d as any)[campo] || 0;
    }
    const mediaCategorias: Record<string, number> = {};
    for (const [campo, nome] of CATEGORIAS_NOTA) mediaCategorias[nome] = detalhes.length ? Math.round((somaCat[nome] / detalhes.length) * 10) / 10 : 0;

    // CSAT médio por analista
    const csatAgg = await prisma.cSATResposta.findMany({
      where: { ticket: { assigneeId: agentId }, respondidoEm: { not: null }, nota: { not: null } },
      select: { nota: true },
    });
    const csatMedia = csatAgg.length ? Math.round((csatAgg.reduce((a, b) => a + (b.nota || 0), 0) / csatAgg.length) * 100) / 100 : null;

    resultado.push({
      agenteId: agentId,
      agenteNome: nomeMap.get(agentId) || 'Analista',
      totalAuditadas: total,
      notaGeralMedia: notaGeral,
      classificacao: classificarNota(notaGeral),
      taxaResolucao: detalhes.length ? Math.round((resolvidos / detalhes.length) * 1000) / 10 : 0,
      taxaReabertura: detalhes.length ? Math.round((reabertos / detalhes.length) * 1000) / 10 : 0,
      taxaRetrabalho: detalhes.length ? Math.round((retrabalhos / detalhes.length) * 1000) / 10 : 0,
      csatMedia,
      mediaCategorias,
      distribuicaoClassificacao: distClass,
    });
  }

  return resultado.sort((a, b) => b.notaGeralMedia - a.notaGeralMedia);
}

// ── Clientes em risco ───────────────────────────────────────────

export async function calcularClientesRisco(filtro: FiltroAuditoria = {}, top = 10): Promise<ClienteIndicador[]> {
  const where = buildWhere(filtro, { clienteId: { not: null } });
  const agrupado = await prisma.auditoriaProfissional.groupBy({
    by: ['clienteId'],
    where,
    _count: { _all: true },
    _avg: { notaGeral: true },
  });

  const clientes = await prisma.client.findMany({
    where: { id: { in: agrupado.map(a => a.clienteId as string) } },
    select: { id: true, razaoSocial: true, nomeFantasia: true },
  });
  const nomeMap = new Map(clientes.map(c => [c.id, c.razaoSocial || c.nomeFantasia || 'Cliente']));

  const resultado: ClienteIndicador[] = [];
  for (const g of agrupado) {
    const clienteId = g.clienteId as string;
    const subWhere = buildWhere({ ...filtro, clienteId });
    const detalhes = await prisma.auditoriaProfissional.findMany({
      where: subWhere,
      select: { classificacaoResolucao: true, reaberto: true, riscoInsatisfacao: true, evidenciaProblemas: true },
    });
    const resolvidos = detalhes.filter(d => ['RESOLVIDO', 'PROVAVELMENTE_RESOLVIDO'].includes(d.classificacaoResolucao)).length;
    const reabertos = detalhes.filter(d => d.reaberto).length;

    const problemaCount: Record<string, { count: number; gravidade: string }> = {};
    let piorRisco = 'BAIXO';
    for (const d of detalhes) {
      const ordem = ['BAIXO', 'MEDIO', 'ALTO', 'CRITICO'];
      if (ordem.indexOf(d.riscoInsatisfacao) > ordem.indexOf(piorRisco)) piorRisco = d.riscoInsatisfacao;
      for (const p of parseListaJson(d.evidenciaProblemas)) {
        const chave = p.descricao || 'problema';
        if (!problemaCount[chave]) problemaCount[chave] = { count: 0, gravidade: p.gravidade || 'media' };
        problemaCount[chave].count++;
      }
    }

    resultado.push({
      clienteId,
      clienteNome: nomeMap.get(clienteId) || 'Cliente',
      totalAuditadas: g._count._all,
      notaGeralMedia: Math.round((g._avg.notaGeral || 0) * 10) / 10,
      taxaResolucao: detalhes.length ? Math.round((resolvidos / detalhes.length) * 1000) / 10 : 0,
      taxaReabertura: detalhes.length ? Math.round((reabertos / detalhes.length) * 1000) / 10 : 0,
      riscoInsatisfacao: piorRisco,
      principaisProblemas: Object.entries(problemaCount)
        .map(([descricao, { count, gravidade }]) => ({ descricao, ocorrencias: count, gravidade }))
        .sort((a, b) => b.ocorrencias - a.ocorrencias)
        .slice(0, 5),
    });
  }

  const ordem = ['BAIXO', 'MEDIO', 'ALTO', 'CRITICO'];
  return resultado
    .sort((a, b) => ordem.indexOf(b.riscoInsatisfacao) - ordem.indexOf(a.riscoInsatisfacao) || b.totalAuditadas - a.totalAuditadas)
    .slice(0, top);
}

// ── Assuntos / categorias ───────────────────────────────────────

export async function calcularAssuntos(filtro: FiltroAuditoria = {}, top = 10): Promise<AssuntoIndicador[]> {
  const where = buildWhere(filtro, { categoria: { not: null } });
  const agrupado = await prisma.auditoriaProfissional.groupBy({
    by: ['categoria'],
    where,
    _count: { _all: true },
    _avg: { notaGeral: true },
  });

  const resultado: AssuntoIndicador[] = [];
  for (const g of agrupado) {
    const categoria = g.categoria as string;
    const subWhere = buildWhere({ ...filtro, categoria });
    const detalhes = await prisma.auditoriaProfissional.findMany({
      where: subWhere,
      select: { classificacaoResolucao: true, reaberto: true, evidenciaProblemas: true },
    });
    const resolvidos = detalhes.filter(d => ['RESOLVIDO', 'PROVAVELMENTE_RESOLVIDO'].includes(d.classificacaoResolucao)).length;
    const reabertos = detalhes.filter(d => d.reaberto).length;

    const problemaCount: Record<string, number> = {};
    for (const d of detalhes) {
      for (const p of parseListaJson(d.evidenciaProblemas)) {
        const chave = p.descricao || 'problema';
        problemaCount[chave] = (problemaCount[chave] || 0) + 1;
      }
    }

    const ocorrencias = g._count._all;
    resultado.push({
      categoria,
      totalAuditadas: ocorrencias,
      notaGeralMedia: Math.round((g._avg.notaGeral || 0) * 10) / 10,
      taxaResolucao: detalhes.length ? Math.round((resolvidos / detalhes.length) * 1000) / 10 : 0,
      taxaReabertura: detalhes.length ? Math.round((reabertos / detalhes.length) * 1000) / 10 : 0,
      padrao: classificarPadrao(ocorrencias),
      principaisProblemas: Object.entries(problemaCount)
        .map(([descricao, count]) => ({ descricao, ocorrencias: count }))
        .sort((a, b) => b.ocorrencias - a.ocorrencias)
        .slice(0, 5),
    });
  }

  return resultado.sort((a, b) => b.totalAuditadas - a.totalAuditadas).slice(0, top);
}

// ── Evolução do analista ────────────────────────────────────────

export async function calcularEvolucaoAnalista(
  agenteId: string,
  periodoMeses = 3,
  meta = 80
): Promise<EvolucaoAnalista | null> {
  const agente = await prisma.user.findUnique({ where: { id: agenteId }, select: { id: true, name: true } });
  if (!agente) return null;

  const periodos: EvolucaoAnalista['periodos'] = [];
  const agora = new Date();
  for (let i = periodoMeses - 1; i >= 0; i--) {
    const inicio = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    const fim = i === 0 ? new Date() : new Date(agora.getFullYear(), agora.getMonth() - i + 1, 0, 23, 59, 59);
    const agg = await prisma.auditoriaProfissional.aggregate({
      where: { agenteId, auditadoEm: { gte: inicio, lte: fim } },
      _count: { _all: true },
      _avg: { notaGeral: true },
    });
    const nota = Math.round((agg._avg.notaGeral || 0) * 10) / 10;
    periodos.push({
      chave: `${inicio.getFullYear()}-${String(inicio.getMonth() + 1).padStart(2, '0')}`,
      inicio,
      fim,
      totalAuditadas: agg._count._all,
      notaGeralMedia: nota,
      classificacao: classificarNota(nota),
    });
  }

  const comDados = periodos.filter(p => p.totalAuditadas > 0);
  if (comDados.length === 0) {
    return { agenteId, agenteNome: agente.name, periodos, tendencia: 'sem_dados', variacao: 0, atual: 0, meta, atingiuMeta: false };
  }

  const atual = comDados[comDados.length - 1].notaGeralMedia;
  const primeira = comDados[0].notaGeralMedia;
  const variacao = Math.round((atual - primeira) * 10) / 10;
  let tendencia: EvolucaoAnalista['tendencia'] = 'estavel';
  if (variacao >= 3) tendencia = 'melhorando';
  else if (variacao <= -3) tendencia = 'piorando';

  return {
    agenteId,
    agenteNome: agente.name,
    periodos,
    tendencia,
    variacao,
    atual,
    meta,
    atingiuMeta: atual >= meta,
  };
}

// ── Padrões globais ─────────────────────────────────────────────

export async function calcularPadroesGlobais(filtro: FiltroAuditoria = {}): Promise<PadraoGlobal[]> {
  const where = buildWhere(filtro);
  const auditadas = await prisma.auditoriaProfissional.findMany({
    where,
    select: { evidenciaProblemas: true, riscos: true },
  });

  const problemas: Record<string, { count: number; gravidade: string }> = {};
  for (const a of auditadas) {
    for (const p of parseListaJson(a.evidenciaProblemas)) {
      const chave = p.descricao || 'problema';
      if (!problemas[chave]) problemas[chave] = { count: 0, gravidade: p.gravidade || 'media' };
      problemas[chave].count++;
    }
  }

  return Object.entries(problemas)
    .map(([descricao, { count, gravidade }]) => ({
      tipo: classificarPadrao(count),
      descricao,
      gravidade: gravidade as any,
      ocorrencias: count,
      confianca: Math.min(95, 40 + count * 10),
    }))
    .sort((a, b) => b.ocorrencias - a.ocorrencias)
    .slice(0, 15);
}

// ── Panorama completo ───────────────────────────────────────────

export async function getPanoramaAuditoria(filtro: FiltroAuditoria = {}): Promise<PanoramaAuditoria> {
  const [indicadores, rankingAnalistas, topClientesRisco, topAssuntos, padroesGlobais] = await Promise.all([
    calcularIndicadores(filtro),
    calcularRankingAnalistas(filtro),
    calcularClientesRisco(filtro, 10),
    calcularAssuntos(filtro, 10),
    calcularPadroesGlobais(filtro),
  ]);

  const alertasGerenciais: Array<{ tipo: string; mensagem: string; gravidade: string }> = [];

  if (indicadores.notaGeralMedia < 50) {
    alertasGerenciais.push({ tipo: 'nota_geral', mensagem: `Nota geral média de ${indicadores.notaGeralMedia}/100 — abaixo do aceitável`, gravidade: 'critica' });
  } else if (indicadores.notaGeralMedia < 70) {
    alertasGerenciais.push({ tipo: 'nota_geral', mensagem: `Nota geral média de ${indicadores.notaGeralMedia}/100 — requer atenção`, gravidade: 'alta' });
  }

  if (indicadores.taxaReabertura > 20) {
    alertasGerenciais.push({ tipo: 'reabertura', mensagem: `Taxa de reabertura de ${indicadores.taxaReabertura}% — acima de 20%`, gravidade: 'alta' });
  }

  if (indicadores.taxaResolucao < 60) {
    alertasGerenciais.push({ tipo: 'resolucao', mensagem: `Taxa de resolução de ${indicadores.taxaResolucao}% — abaixo de 60%`, gravidade: 'alta' });
  }

  if (indicadores.riscoInsatisfacao.CRITICO && indicadores.riscoInsatisfacao.CRITICO >= 3) {
    alertasGerenciais.push({ tipo: 'insatisfacao', mensagem: `${indicadores.riscoInsatisfacao.CRITICO} auditorias com risco crítico de insatisfação`, gravidade: 'critica' });
  }

  const piorAnalista = rankingAnalistas[rankingAnalistas.length - 1];
  if (piorAnalista && piorAnalista.notaGeralMedia < 50 && piorAnalista.totalAuditadas >= 3) {
    alertasGerenciais.push({ tipo: 'analista', mensagem: `Analista ${piorAnalista.agenteNome} com média ${piorAnalista.notaGeralMedia} em ${piorAnalista.totalAuditadas} auditorias`, gravidade: 'alta' });
  }

  const riscoCritico = padroesGlobais.find(p => p.gravidade === 'critica');
  if (riscoCritico) {
    alertasGerenciais.push({ tipo: 'padrao', mensagem: `Padrão crítico identificado: ${riscoCritico.descricao} (${riscoCritico.ocorrencias} ocorrências)`, gravidade: 'critica' });
  }

  return {
    periodo: indicadores.periodo,
    indicadores,
    rankingAnalistas,
    topClientesRisco,
    topAssuntos,
    padroesGlobais,
    alertasGerenciais,
  };
}