import prisma from '../../config/database';
import { buildWhere, RelatorioFiltros } from '../analytics/relatorios.service';
import { STATUS_ABERTO, STATUS_ENCERRADO, ETAPAS_ENCERRADAS } from './constants';
import { getMetasIndicadores } from './indicadores.service';

// ── Types ───────────────────────────────────────────────────────────────

export interface FiltrosQualidade extends RelatorioFiltros {}

export interface ClassificacaoIndicador {
  estado: 'dentro' | 'atencao' | 'fora';
  icone: '🟢' | '🟡' | '🔴';
  texto: string;
}

export interface CardQualidade {
  label: string;
  valor: number | string;
  unidade: string;
  percentual?: number;
  classificacao: ClassificacaoIndicador;
  delta: number | null;
  deltaLabel: string;
}

export interface ReaberturaDetalhe {
  ticketId: string;
  protocolo: string | null;
  contactName: string | null;
  clientId: string | null;
  clientNome: string | null;
  agenteId: string | null;
  agenteNome: string | null;
  categoria: string | null;
  assunto: string | null;
  dataAbertura: Date;
  dataFechamento: Date | null;
  motivoStatus: string | null;
  totalReaberturas: number;
  csatNota: number | null;
}

export interface ProblemaRecorrente {
  problema: string;
  categoria: string | null;
  assunto: string | null;
  ocorrencias: number;
  clientesAfetados: number;
  clientes: Array<{ clienteId: string; nome: string; quantidade: number }>;
  ticketIds: string[];
  retrabalho: number;
}

export interface RetrabalhoDetalhe {
  ticketId: string;
  protocolo: string | null;
  contactName: string | null;
  agenteId: string | null;
  agenteNome: string | null;
  categoria: string | null;
  motivo: string;
  tempoMin: number;
  custoOperacionalMin: number | null;
}

export interface AlertaQualidade {
  nivel: 'info' | 'atencao' | 'critico';
  tipo: string;
  titulo: string;
  mensagem: string;
  contagem: number;
  icone: string;
  link?: string;
}

export interface SugestaoQualidade {
  categoria: 'treinamento' | 'desenvolvimento' | 'base_conhecimento' | 'processo' | 'automacao' | 'gestao';
  titulo: string;
  problema: string;
  ocorrencias: number;
  clientesAfetados: number;
  diagnostico: string;
  sugestao: string;
  prioridade: 'alta' | 'media' | 'baixa';
}

export interface DiagnosticoIa {
  titulo: string;
  dadosAnalisados: string[];
  evidencias: string[];
  conclusao: string;
  recomendacao: string;
  confianca: number | null;
  modelo: string;
}

export interface QualidadeOperacional {
  atualizadoEm: string;
  periodo: { inicio: Date; fim: Date; label: string; dias: number };
  reaberturas: {
    total: number;
    percentual: number;
    delta: number | null;
    porAnalista: Array<{ agenteId: string; agenteNome: string; total: number }>;
    porCliente: Array<{ clienteId: string; nome: string; total: number }>;
    porCategoria: Array<{ categoria: string; total: number }>;
  };
  recorrencia: {
    total: number;
    percentual: number;
    delta: number | null;
    problemas: ProblemaRecorrente[];
  };
  retrabalho: {
    total: number;
    percentual: number;
    delta: number | null;
    tempoAdicionalMin: number;
    porAnalista: Array<{ agenteId: string; agenteNome: string; total: number; tempoMin: number }>;
    porDepartamento: Array<{ departamento: string; total: number }>;
    porCategoria: Array<{ categoria: string; total: number }>;
  };
  fcr: {
    percentual: number;
    total: number;
    resolvidos: number;
    naoResolvidos: number;
    delta: number | null;
  };
  alertas: AlertaQualidade[];
  sugestoes: SugestaoQualidade[];
}

// ── Helpers ──────────────────────────────────────────────────────────────

const DIA_MS = 24 * 60 * 60 * 1000;

function range(dias: number): { inicio: Date; fim: Date } {
  const fim = new Date();
  fim.setHours(23, 59, 59, 999);
  const inicio = new Date(fim);
  inicio.setDate(fim.getDate() - (dias - 1));
  inicio.setHours(0, 0, 0, 0);
  return { inicio, fim };
}

function rangeAnterior(dias: number, fimAtual: Date): { inicio: Date; fim: Date } {
  const fim = new Date(fimAtual);
  fim.setDate(fim.getDate() - dias);
  fim.setHours(23, 59, 59, 999);
  const inicio = new Date(fim);
  inicio.setDate(fim.getDate() - (dias - 1));
  inicio.setHours(0, 0, 0, 0);
  return { inicio, fim };
}

function classificarPercentual(pct: number, meta: number): ClassificacaoIndicador {
  if (pct >= meta) return { estado: 'dentro', icone: '🟢', texto: `Dentro da meta (${pct.toFixed(0)}% ≥ ${meta}%)` };
  if (pct >= meta * 0.8) return { estado: 'atencao', icone: '🟡', texto: `Atenção (${pct.toFixed(0)}% < ${meta}%)` };
  return { estado: 'fora', icone: '🔴', texto: `Fora da meta (${pct.toFixed(0)}% < ${meta}%)` };
}

function classificarReabertura(taxa: number): ClassificacaoIndicador {
  if (taxa <= 5) return { estado: 'dentro', icone: '🟢', texto: `Baixa taxa (${taxa.toFixed(1)}%)` };
  if (taxa <= 15) return { estado: 'atencao', icone: '🟡', texto: `Atenção (${taxa.toFixed(1)}%)` };
  return { estado: 'fora', icone: '🔴', texto: `Alta taxa (${taxa.toFixed(1)}%)` };
}

// ── Main Function ────────────────────────────────────────────────────────

export async function getQualidadeOperacional(
  dias: number,
  filtros?: FiltrosQualidade,
): Promise<QualidadeOperacional> {
  const { inicio, fim } = range(dias);
  const anterior = rangeAnterior(dias, fim);
  const agora = new Date();

  const [reaberturas, recorrencia, retrabalho, fcr, alertas, sugestoes, reaberturasAnterior, retrabalhoAnterior] = await Promise.all([
    calcularReaberturas(inicio, fim, filtros),
    calcularRecorrencia(inicio, fim, filtros),
    calcularRetrabalho(inicio, fim, filtros),
    calcularFcr(inicio, fim),
    gerarAlertasQualidade(inicio, fim),
    gerarSugestoesQualidade(inicio, fim),
    calcularReaberturas(anterior.inicio, anterior.fim, filtros),
    calcularRetrabalho(anterior.inicio, anterior.fim, filtros),
  ]);

  const deltaReabertura = reaberturasAnterior.total > 0
    ? Math.round(((reaberturas.total - reaberturasAnterior.total) / reaberturasAnterior.total) * 100)
    : null;

  const deltaRetrabalho = retrabalhoAnterior.total > 0
    ? Math.round(((retrabalho.total - retrabalhoAnterior.total) / retrabalhoAnterior.total) * 100)
    : null;

  return {
    atualizadoEm: agora.toISOString(),
    periodo: { inicio, fim, label: `${dias} dias`, dias },
    reaberturas: {
      ...reaberturas,
      delta: deltaReabertura,
    },
    recorrencia,
    retrabalho: {
      ...retrabalho,
      delta: deltaRetrabalho,
    },
    fcr,
    alertas,
    sugestoes,
  };
}

// ── Reaberturas ──────────────────────────────────────────────────────────

async function calcularReaberturas(
  inicio: Date,
  fim: Date,
  filtros?: FiltrosQualidade,
) {
  const whereBase: any = {
    createdAt: { gte: inicio, lte: fim },
    ...buildWhere(filtros || {}),
  };

  const tickets = await prisma.ticket.findMany({
    where: whereBase,
    select: {
      id: true,
      protocolo: true,
      contactName: true,
      clientId: true,
      assigneeId: true,
      categoria: true,
      assunto: true,
      dataAbertura: true,
      dataFechamento: true,
      motivoStatus: true,
      client: { select: { razaoSocial: true, nomeFantasia: true } },
      metrics: { select: { totalReaberturas: true, csatNota: true } },
    },
  });

  const total = tickets.length;
  const reabertos = tickets.filter(t => (t.metrics?.totalReaberturas || 0) > 0);
  const percentual = total > 0 ? Math.round((reabertos.length / total) * 100) : 0;

  const agenteIds = new Set<string>();
  const clienteIds = new Set<string>();
  reabertos.forEach(t => {
    if (t.assigneeId) agenteIds.add(t.assigneeId);
    if (t.clientId) clienteIds.add(t.clientId);
  });

  const [usuarios, clientes] = await Promise.all([
    agenteIds.size > 0
      ? prisma.user.findMany({ where: { id: { in: Array.from(agenteIds) } }, select: { id: true, name: true } })
      : [],
    clienteIds.size > 0
      ? prisma.client.findMany({ where: { id: { in: Array.from(clienteIds) } }, select: { id: true, razaoSocial: true, nomeFantasia: true } })
      : [],
  ]);

  const nomeAgente = new Map(usuarios.map(u => [u.id, u.name]));
  const nomeCliente = new Map(clientes.map(c => [c.id, c.nomeFantasia || c.razaoSocial]));

  const porAnalista = Array.from(agenteIds).map(id => ({
    agenteId: id,
    agenteNome: nomeAgente.get(id) || 'Desconhecido',
    total: reabertos.filter(t => t.assigneeId === id).length,
  })).sort((a, b) => b.total - a.total);

  const porCliente = Array.from(clienteIds).map(id => ({
    clienteId: id,
    nome: nomeCliente.get(id) || 'Cliente',
    total: reabertos.filter(t => t.clientId === id).length,
  })).sort((a, b) => b.total - a.total);

  const catCount = new Map<string, number>();
  reabertos.forEach(t => {
    const cat = t.categoria || 'Sem categoria';
    catCount.set(cat, (catCount.get(cat) || 0) + 1);
  });
  const porCategoria = Array.from(catCount.entries())
    .map(([categoria, total]) => ({ categoria, total }))
    .sort((a, b) => b.total - a.total);

  return {
    total: reabertos.length,
    percentual,
    delta: null,
    tickets: reabertos.map(t => ({
      ticketId: t.id,
      protocolo: t.protocolo,
      contactName: t.contactName,
      clientId: t.clientId,
      clientNome: t.client ? (t.client.nomeFantasia || t.client.razaoSocial) : null,
      agenteId: t.assigneeId,
      agenteNome: t.assigneeId ? nomeAgente.get(t.assigneeId) : null,
      categoria: t.categoria,
      assunto: t.assunto,
      dataAbertura: t.dataAbertura,
      dataFechamento: t.dataFechamento,
      motivoStatus: t.motivoStatus,
      totalReaberturas: t.metrics?.totalReaberturas || 0,
      csatNota: t.metrics?.csatNota ?? null,
    })) as ReaberturaDetalhe[],
    porAnalista,
    porCliente,
    porCategoria,
  };
}

// ── Recorrência ──────────────────────────────────────────────────────────

async function calcularRecorrencia(
  inicio: Date,
  fim: Date,
  filtros?: FiltrosQualidade,
) {
  const whereBase: any = {
    createdAt: { gte: inicio, lte: fim },
    ...buildWhere(filtros || {}),
  };

  const tickets = await prisma.ticket.findMany({
    where: whereBase,
    select: {
      id: true,
      clientId: true,
      categoria: true,
      assunto: true,
      client: { select: { razaoSocial: true, nomeFantasia: true } },
      metrics: { select: { totalReaberturas: true } },
    },
  });

  const total = tickets.length;

  // Group by client + subject/category
  type GrupoRecorrencia = {
    problema: string;
    categoria: string | null;
    assunto: string | null;
    ocorrencias: number;
    clientes: Map<string, { clienteId: string; nome: string; quantidade: number }>;
    ticketIds: string[];
    retrabalho: number;
  };
  const grupos = new Map<string, GrupoRecorrencia>();

  for (const t of tickets) {
    const key = `${t.assunto || t.categoria || 'geral'}`;
    let g = grupos.get(key);
    if (!g) {
      g = {
        problema: t.assunto || t.categoria || 'Problema geral',
        categoria: t.categoria,
        assunto: t.assunto,
        ocorrencias: 0,
        clientes: new Map<string, { clienteId: string; nome: string; quantidade: number }>(),
        ticketIds: [],
        retrabalho: 0,
      };
      grupos.set(key, g);
    }
    g.ocorrencias += 1;
    g.ticketIds.push(t.id);
    if ((t.metrics?.totalReaberturas || 0) > 0) g.retrabalho += 1;

    if (t.clientId) {
      const cli = g.clientes.get(t.clientId) || {
        clienteId: t.clientId,
        nome: t.client?.nomeFantasia || t.client?.razaoSocial || 'Cliente',
        quantidade: 0,
      };
      cli.quantidade += 1;
      g.clientes.set(t.clientId, cli);
    }

    grupos.set(key, g);
  }

  const problemas = Array.from(grupos.values())
    .filter(g => g.ocorrencias >= 2)
    .sort((a, b) => b.ocorrencias - a.ocorrencias)
    .slice(0, 20)
    .map(g => ({
      problema: g.problema,
      categoria: g.categoria,
      assunto: g.assunto,
      ocorrencias: g.ocorrencias,
      clientesAfetados: g.clientes.size,
      clientes: Array.from(g.clientes.values()).sort((a, b) => b.quantidade - a.quantidade),
      ticketIds: g.ticketIds,
      retrabalho: g.retrabalho,
    }));

  const totalRecorrentes = problemas.reduce((acc, p) => acc + p.ocorrencias, 0);
  const percentual = total > 0 ? Math.round((totalRecorrentes / total) * 100) : 0;

  return {
    total: totalRecorrentes,
    percentual,
    delta: null,
    problemas,
  };
}

// ── Retrabalho ───────────────────────────────────────────────────────────

async function calcularRetrabalho(
  inicio: Date,
  fim: Date,
  filtros?: FiltrosQualidade,
) {
  const whereBase: any = {
    createdAt: { gte: inicio, lte: fim },
    ...buildWhere(filtros || {}),
  };

  const tickets = await prisma.ticket.findMany({
    where: whereBase,
    select: {
      id: true,
      protocolo: true,
      contactName: true,
      assigneeId: true,
      categoria: true,
      departamentoId: true,
      dataAbertura: true,
      dataFechamento: true,
      metrics: { select: { totalReaberturas: true, tempoTotalMin: true } },
    },
  });

  const auditorias = await prisma.auditoriaProfissional.findMany({
    where: {
      auditadoEm: { gte: inicio, lte: fim },
      OR: [
        { retrabalho: true },
        { classificacaoResolucao: 'REABERTO' },
        { reaberto: true },
      ],
    },
    select: {
      ticketId: true,
      agenteId: true,
      retrabalho: true,
      custoOperacionalMin: true,
      classificacaoResolucao: true,
    },
  });

  const ticketIds = new Set(auditorias.map(a => a.ticketId));
  const retrabalhoTickets = tickets.filter(t => ticketIds.has(t.id) || (t.metrics?.totalReaberturas || 0) > 0);

  const total = tickets.length;
  const reworkCount = retrabalhoTickets.length;
  const percentual = total > 0 ? Math.round((reworkCount / total) * 100) : 0;

  const tempoAdicionalMin = retrabalhoTickets.reduce((acc, t) => {
    const audit = auditorias.find(a => a.ticketId === t.id);
    return acc + (audit?.custoOperacionalMin || (t.metrics?.tempoTotalMin || 0) * 0.5);
  }, 0);

  const agenteIds = new Set<string>();
  retrabalhoTickets.forEach(t => { if (t.assigneeId) agenteIds.add(t.assigneeId); });

  const usuarios = agenteIds.size > 0
    ? await prisma.user.findMany({ where: { id: { in: Array.from(agenteIds) } }, select: { id: true, name: true } })
    : [];
  const nomeAgente = new Map(usuarios.map(u => [u.id, u.name]));

  const agenteMap = new Map<string, { total: number; tempoMin: number }>();
  retrabalhoTickets.forEach(t => {
    if (!t.assigneeId) return;
    const cur = agenteMap.get(t.assigneeId) || { total: 0, tempoMin: 0 };
    cur.total += 1;
    cur.tempoMin += t.metrics?.tempoTotalMin || 0;
    agenteMap.set(t.assigneeId, cur);
  });

  const porAnalista = Array.from(agenteMap.entries()).map(([id, data]) => ({
    agenteId: id,
    agenteNome: nomeAgente.get(id) || 'Desconhecido',
    total: data.total,
    tempoMin: data.tempoMin,
  })).sort((a, b) => b.total - a.total);

  const deptMap = new Map<string, number>();
  retrabalhoTickets.forEach(t => {
    const dept = t.departamentoId || 'Sem departamento';
    deptMap.set(dept, (deptMap.get(dept) || 0) + 1);
  });

  const deptIds = Array.from(deptMap.keys()).filter(id => id !== 'Sem departamento');
  const depts = deptIds.length > 0
    ? await prisma.departamento.findMany({ where: { id: { in: deptIds } }, select: { id: true, nome: true } })
    : [];
  const nomeDept = new Map(depts.map(d => [d.id, d.nome]));

  const porDepartamento = Array.from(deptMap.entries()).map(([id, total]) => ({
    departamento: nomeDept.get(id) || id,
    total,
  })).sort((a, b) => b.total - a.total);

  const catMap = new Map<string, number>();
  retrabalhoTickets.forEach(t => {
    const cat = t.categoria || 'Sem categoria';
    catMap.set(cat, (catMap.get(cat) || 0) + 1);
  });
  const porCategoria = Array.from(catMap.entries()).map(([categoria, total]) => ({ categoria, total })).sort((a, b) => b.total - a.total);

  return {
    total: reworkCount,
    percentual,
    tempoAdicionalMin: Math.round(tempoAdicionalMin),
    porAnalista,
    porDepartamento,
    porCategoria,
  };
}

// ── FCR ──────────────────────────────────────────────────────────────────

async function calcularFcr(inicio: Date, fim: Date) {
  const tickets = await prisma.ticket.findMany({
    where: {
      status: { in: ['fechado', 'resolvido'] },
      dataFechamento: { not: null, gte: inicio, lte: fim },
    },
    select: {
      id: true,
      resolvidoSemAjuda: true,
      agentesEnvolvidos: true,
      metrics: { select: { totalReaberturas: true } },
    },
  });

  const total = tickets.length;
  const resolvidos = tickets.filter(t => t.resolvidoSemAjuda !== false && (t.metrics?.totalReaberturas || 0) === 0).length;
  const naoResolvidos = total - resolvidos;
  const percentual = total > 0 ? Math.round((resolvidos / total) * 100) : 0;

  return {
    percentual,
    total,
    resolvidos,
    naoResolvidos,
    delta: null,
  };
}

// ── Alertas de Qualidade ─────────────────────────────────────────────────

async function gerarAlertasQualidade(inicio: Date, fim: Date): Promise<AlertaQualidade[]> {
  const alertas: AlertaQualidade[] = [];
  const metas = await getMetasIndicadores();
  const reaberturaMetaPct = 15;
  const retrabalhoMetaPct = metas.retrabalhoMetaPct;
  const fcrMetaPct = metas.fcrMetaPct;

  // Reaberturas elevadas
  const reabertos = await prisma.aIAgentClosureAudit.count({
    where: { tipo: 'reabertura', processadoEm: { gte: inicio, lte: fim } },
  });
  const totalPeriodo = await prisma.ticket.count({
    where: { createdAt: { gte: inicio, lte: fim } },
  });
  if (totalPeriodo > 0) {
    const taxa = (reabertos / totalPeriodo) * 100;
    if (taxa > reaberturaMetaPct) {
      alertas.push({
        nivel: 'critico',
        tipo: 'reabertura_aumento',
        titulo: 'Aumento significativo de reaberturas',
        mensagem: `${reabertos} chamado(s) reaberto(s) (${taxa.toFixed(1)}% do total). Taxa acima de ${reaberturaMetaPct}%.`,
        contagem: reabertos,
        icone: 'RotateCcw',
      });
    }
  }

  // Retrabalho elevado
  const rework = await prisma.auditoriaProfissional.count({
    where: {
      auditadoEm: { gte: inicio, lte: fim },
      OR: [{ retrabalho: true }, { classificacaoResolucao: 'REABERTO' }],
    },
  });
  if (totalPeriodo > 0) {
    const taxa = (rework / totalPeriodo) * 100;
    if (taxa > retrabalhoMetaPct) {
      alertas.push({
        nivel: 'atencao',
        tipo: 'retrabalho_acima_meta',
        titulo: 'Retrabalho acima da meta',
        mensagem: `${rework} caso(s) classificado(s) como retrabalho (${taxa.toFixed(1)}%). Meta: ≤${retrabalhoMetaPct}%.`,
        contagem: rework,
        icone: 'RefreshCw',
      });
    }
  }

  // FCR baixo
  const fcrTickets = await prisma.ticket.findMany({
    where: {
      status: { in: ['fechado', 'resolvido'] },
      dataFechamento: { not: null, gte: inicio, lte: fim },
    },
    select: { id: true, resolvidoSemAjuda: true, metrics: { select: { totalReaberturas: true } } },
  });
  const fcrTotal = fcrTickets.length;
  const fcrCount = fcrTickets.filter(t => t.resolvidoSemAjuda !== false && (t.metrics?.totalReaberturas || 0) === 0).length;
  const fcrPct = fcrTotal > 0 ? (fcrCount / fcrTotal) * 100 : 0;
  if (fcrTotal > 0 && fcrPct < fcrMetaPct) {
    alertas.push({
      nivel: 'atencao',
      tipo: 'fcr_abaixo_meta',
      titulo: 'FCR abaixo da meta',
      mensagem: `First Contact Resolution em ${fcrPct.toFixed(0)}% (${fcrCount}/${fcrTotal}). Meta: ${fcrMetaPct}%.`,
      contagem: fcrTotal - fcrCount,
      icone: 'Target',
    });
  }

  // Problema recorrente sistêmico
  const clientesRecorrentes = await prisma.ticket.groupBy({
    by: ['assunto', 'categoria'],
    where: { createdAt: { gte: inicio, lte: fim }, assunto: { not: null } },
    _count: { id: true },
    having: { id: { _count: { gte: 5 } } },
    orderBy: { _count: { id: 'desc' } },
    take: 5,
  });

  for (const rec of clientesRecorrentes) {
    alertas.push({
      nivel: 'critico',
      tipo: 'problema_recorrente_sistemico',
      titulo: 'Problema recorrente detectado',
      mensagem: `"${rec.assunto || rec.categoria}" aparece em ${rec._count.id} chamados. Possível problema sistêmico.`,
      contagem: rec._count.id,
      icone: 'AlertTriangle',
    });
  }

  return alertas;
}

// ── Sugestões de Melhoria ────────────────────────────────────────────────

async function gerarSugestoesQualidade(inicio: Date, fim: Date): Promise<SugestaoQualidade[]> {
  const sugestoes: SugestaoQualidade[] = [];

  // Treinamento: analistas com nota IA baixa
  const audits = await prisma.aIAgentAudit.groupBy({
    by: ['agentId'],
    where: { processadoEm: { gte: inicio, lte: fim } },
    _avg: { notaGeral: true },
    _count: { id: true },
    having: { notaGeral: { _avg: { lt: 6 } } },
  });

  if (audits.length > 0) {
    const ids = audits.map(a => a.agentId);
    const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
    const nomeMap = new Map(users.map(u => [u.id, u.name]));

    for (const a of audits.slice(0, 3)) {
      const nome = nomeMap.get(a.agentId) || 'Analista';
      const categorias = await prisma.aIAgentAudit.groupBy({
        by: ['treinamentoCategoria'],
        where: { agentId: a.agentId, processadoEm: { gte: inicio, lte: fim }, treinamentoNecessario: true },
        _count: { id: true },
      });
      const cat = categorias.length > 0 ? categorias[0].treinamentoCategoria : null;

      sugestoes.push({
        categoria: 'treinamento',
        titulo: `Treinamento necessário — ${nome}`,
        problema: `${nome} apresenta nota IA média de ${(a._avg.notaGeral || 0).toFixed(1)}/10 em ${a._count.id} avaliações.`,
        ocorrencias: a._count.id,
        clientesAfetados: 0,
        diagnostico: `O analista ${nome} necessita de capacitação${cat ? ` na área de "${cat}"` : ''}.`,
        sugestao: `Realizar treinamento${cat ? ` sobre ${cat}` : ' técnico'} com ${nome}.`,
        prioridade: (a._avg.notaGeral || 0) < 4 ? 'alta' : 'media',
      });
    }
  }

  // Processo: encerramentos sem resolução
  const semResolucao = await prisma.ticket.count({
    where: {
      createdAt: { gte: inicio, lte: fim },
      motivoStatus: 'encerrado_sem_resolucao',
    },
  });
  if (semResolucao > 3) {
    sugestoes.push({
      categoria: 'processo',
      titulo: 'Revisar processo de encerramento',
      problema: `${semResolucao} chamado(s) encerrado(s) sem resolução confirmada.`,
      ocorrencias: semResolucao,
      clientesAfetados: 0,
      diagnostico: 'Muitos chamados estão sendo encerrados sem que o problema tenha sido efetivamente resolvido.',
      sugestao: 'Revisar o fluxo de confirmação de resolução e orientar a equipe sobre o procedimento correto.',
      prioridade: 'alta',
    });
  }

  // Automação: tickets repetitivos por categoria
  const cats = await prisma.ticket.groupBy({
    by: ['categoria'],
    where: { createdAt: { gte: inicio, lte: fim }, categoria: { not: null } },
    _count: { id: true },
    having: { id: { _count: { gte: 10 } } },
    orderBy: { _count: { id: 'desc' } },
    take: 3,
  });

  for (const c of cats) {
    sugestoes.push({
      categoria: 'automacao',
      titulo: `Automatizar respostas — ${c.categoria}`,
      problema: `${c._count.id} chamados na categoria "${c.categoria}" no período.`,
      ocorrencias: c._count.id,
      clientesAfetados: 0,
      diagnostico: `Alta demanda recorrente na categoria "${c.categoria}". Possível automatização de respostas.`,
      sugestao: `Criar regra de automação ou robô para responder perguntas frequentes de "${c.categoria}".`,
      prioridade: c._count.id > 20 ? 'alta' : 'media',
    });
  }

  // Base de conhecimento: assuntos mais frequentes sem solução
  const assuntos = await prisma.ticket.groupBy({
    by: ['assunto'],
    where: { createdAt: { gte: inicio, lte: fim }, assunto: { not: null } },
    _count: { id: true },
    having: { id: { _count: { gte: 5 } } },
    orderBy: { _count: { id: 'desc' } },
    take: 3,
  });

  for (const a of assuntos) {
    sugestoes.push({
      categoria: 'base_conhecimento',
      titulo: `Criar artigo — ${a.assunto}`,
      problema: `${a._count.id} chamados sobre "${a.assunto}".`,
      ocorrencias: a._count.id,
      clientesAfetados: 0,
      diagnostico: `Assunto "${a.assunto}" gera demanda recorrente. Artigo na base de conhecimento poderia reduzir volume.`,
      sugestao: `Criar ou atualizar artigo na Base de Conhecimento sobre "${a.assunto}".`,
      prioridade: 'media',
    });
  }

  return sugestoes;
}

// ── Detalhes para Drill-Down ─────────────────────────────────────────────

export async function getReaberturaDetalhe(
  dias: number,
  filtros?: FiltrosQualidade,
) {
  const { inicio, fim } = range(dias);
  const resultado = await calcularReaberturas(inicio, fim, filtros);
  return resultado.tickets;
}

export async function getRecorrenciaDetalhe(
  dias: number,
  problema: string,
) {
  const { inicio, fim } = range(dias);
  const resultado = await calcularRecorrencia(inicio, fim);
  return resultado.problemas.find(p => p.problema === problema) || null;
}

export async function getRetrabalhoDetalhe(
  dias: number,
  filtros?: FiltrosQualidade,
) {
  const { inicio, fim } = range(dias);
  const resultado = await calcularRetrabalho(inicio, fim, filtros);

  const auditorias = await prisma.auditoriaProfissional.findMany({
    where: {
      auditadoEm: { gte: inicio, lte: fim },
      OR: [{ retrabalho: true }, { classificacaoResolucao: 'REABERTO' }, { reaberto: true }],
    },
    select: {
      ticketId: true,
      agenteId: true,
      retrabalho: true,
      custoOperacionalMin: true,
      classificacaoResolucao: true,
      ticket: { select: { protocolo: true, contactName: true, categoria: true } },
      agente: { select: { name: true } },
    },
    orderBy: { auditadoEm: 'desc' },
  });

  return auditorias.map(a => ({
    ticketId: a.ticketId,
    protocolo: a.ticket?.protocolo || null,
    contactName: a.ticket?.contactName || null,
    agenteId: a.agenteId,
    agenteNome: a.agente?.name || null,
    categoria: a.ticket?.categoria || null,
    motivo: a.classificacaoResolucao === 'REABERTO' ? 'Reaberto' : 'Retrabalho identificado',
    tempoMin: a.custoOperacionalMin || 0,
    custoOperacionalMin: a.custoOperacionalMin,
  }));
}

export async function getDiagnosticoIa(
  tipo: 'reabertura' | 'recorrencia' | 'retrabalho' | 'fcr',
  itemId?: string,
  dias?: number,
): Promise<DiagnosticoIa> {
  const d = dias || 30;
  const { inicio, fim } = range(d);

  switch (tipo) {
    case 'reabertura': {
      const reaberturas = await calcularReaberturas(inicio, fim);
      return {
        titulo: 'Análise de Reaberturas',
        dadosAnalisados: [
          `${reaberturas.total} chamado(s) reaberto(s) no período`,
          `${reaberturas.percentual}% do total de chamados`,
          `${reaberturas.porAnalista.length} analista(s) envolvido(s)`,
          `${reaberturas.porCliente.length} cliente(s) afetado(s)`,
        ],
        evidencias: reaberturas.porAnalista.slice(0, 3).map(a =>
          `${a.agenteNome}: ${a.total} reabertura(ões)`
        ),
        conclusao: reaberturas.percentual > 15
          ? 'Taxa de reabertura elevada. Indica possível problema na resolução inicial ou na comunicação com o cliente.'
          : reaberturas.percentual > 5
            ? 'Taxa de reabertura moderada. Alguns chamados precisam de atenção na resolução.'
            : 'Taxa de reabertura dentro de parâmetros aceitáveis.',
        recomendacao: reaberturas.percentual > 15
          ? 'Revisar procedimentos de resolução e confirmar entendimento do problema antes de encerrar.'
          : 'Manter monitoramento e acompanhar tendências.',
        confianca: null,
        modelo: 'Regras locais',
      };
    }

    case 'recorrencia': {
      const rec = await calcularRecorrencia(inicio, fim);
      return {
        titulo: 'Análise de Recorrência',
        dadosAnalisados: [
          `${rec.total} chamado(s) com problemas recorrentes`,
          `${rec.problemas.length} problema(s) identificado(s)`,
          `${rec.percentual}% dos chamados são recorrentes`,
        ],
        evidencias: rec.problemas.slice(0, 3).map(p =>
          `"${p.problema}": ${p.ocorrencias} ocorrências em ${p.clientesAfetados} cliente(s)`
        ),
        conclusao: rec.problemas.length > 0
          ? `Problema mais recorrente: "${rec.problemas[0].problema}" com ${rec.problemas[0].ocorrencias} ocorrências.`
          : 'Nenhuma recorrência significativa detectada no período.',
        recomendacao: rec.problemas.length > 0
          ? `Investigar causa raiz de "${rec.problemas[0].problema}" e criar solução definitiva.`
          : 'Manter monitoramento.',
        confianca: null,
        modelo: 'Regras locais',
      };
    }

    case 'retrabalho': {
      const ret = await calcularRetrabalho(inicio, fim);
      return {
        titulo: 'Análise de Retrabalho',
        dadosAnalisados: [
          `${ret.total} caso(s) de retrabalho`,
          `${ret.percentual}% do total`,
          `${ret.tempoAdicionalMin} minutos de trabalho adicional`,
        ],
        evidencias: ret.porAnalista.slice(0, 3).map(a =>
          `${a.agenteNome}: ${a.total} caso(s)`
        ),
        conclusao: ret.percentual > 10
          ? 'Índice de retrabalho acima da meta (10%). Necessita ação corretiva.'
          : 'Índice de retrabalho dentro da meta.',
        recomendacao: ret.percentual > 10
          ? 'Revisar casos de retrabalho para identificar padrões e treinar analistas quando necessário.'
          : 'Manter monitoramento.',
        confianca: null,
        modelo: 'Regras locais',
      };
    }

    case 'fcr': {
      const fcr = await calcularFcr(inicio, fim);
      return {
        titulo: 'Análise de FCR (First Contact Resolution)',
        dadosAnalisados: [
          `FCR: ${fcr.percentual}%`,
          `${fcr.resolvidos} resolvidos no primeiro contato`,
          `${fcr.naoResolvidos} não resolvidos no primeiro contato`,
        ],
        evidencias: [
          fcr.percentual >= 60 ? 'FCR dentro da meta (≥60%)' : 'FCR abaixo da meta (<60%)',
        ],
        conclusao: fcr.percentual >= 60
          ? 'Taxa de resolução no primeiro contato está adequada.'
          : 'Muitos chamados precisam de mais de um contato para resolução.',
        recomendacao: fcr.percentual < 60
          ? 'Capacitar analistas para resolver mais problemas no primeiro contato.'
          : 'Manter o desempenho atual.',
        confianca: null,
        modelo: 'Regras locais',
      };
    }

    default:
      return {
        titulo: 'Diagnóstico',
        dadosAnalisados: [],
        evidencias: [],
        conclusao: 'Tipo de diagnóstico não reconhecido.',
        recomendacao: '',
        confianca: null,
        modelo: 'N/A',
      };
  }
}

// ── Qualidade por Cliente ────────────────────────────────────────────────

export async function getQualidadeCliente(clientId: string, dias: number = 30) {
  const { inicio, fim } = range(dias);

  const tickets = await prisma.ticket.findMany({
    where: {
      clientId,
      createdAt: { gte: inicio, lte: fim },
    },
    select: {
      id: true,
      protocolo: true,
      contactName: true,
      categoria: true,
      assunto: true,
      status: true,
      resolvidoSemAjuda: true,
      dataAbertura: true,
      dataFechamento: true,
      metrics: { select: { totalReaberturas: true, tempoTotalMin: true, csatNota: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const total = tickets.length;
  const reabertos = tickets.filter(t => (t.metrics?.totalReaberturas || 0) > 0).length;

  const csatTickets = tickets.filter(t => t.metrics?.csatNota != null);
  const csatMedia = csatTickets.length > 0
    ? csatTickets.reduce((acc, t) => acc + (t.metrics!.csatNota || 0), 0) / csatTickets.length
    : null;

  const fechados = tickets.filter(t => t.status === 'fechado' || t.status === 'resolvido');
  const resolvidosPrimeiroContato = fechados.filter(t => t.resolvidoSemAjuda !== false && (t.metrics?.totalReaberturas || 0) === 0).length;
  const fcr = fechados.length > 0 ? Math.round((resolvidosPrimeiroContato / fechados.length) * 100) : null;

  const catMap = new Map<string, number>();
  tickets.forEach(t => {
    const cat = t.categoria || 'Sem categoria';
    catMap.set(cat, (catMap.get(cat) || 0) + 1);
  });
  const principaisProblemas = Array.from(catMap.entries())
    .map(([categoria, count]) => ({ categoria, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    clientId,
    periodo: { inicio, fim, dias },
    total,
    reabertos,
    csatMedia: csatMedia ? Math.round(csatMedia * 10) / 10 : null,
    fcr,
    tempoTotalMin: tickets.reduce((acc, t) => acc + (t.metrics?.tempoTotalMin || 0), 0),
    principaisProblemas,
    tickets: tickets.map(t => ({
      id: t.id,
      protocolo: t.protocolo,
      contactName: t.contactName,
      categoria: t.categoria,
      assunto: t.assunto,
      status: t.status,
      dataAbertura: t.dataAbertura,
      dataFechamento: t.dataFechamento,
      reaberturas: t.metrics?.totalReaberturas || 0,
      csatNota: t.metrics?.csatNota ?? null,
    })),
  };
}
