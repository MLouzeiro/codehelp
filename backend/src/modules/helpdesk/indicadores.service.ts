import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { buildWhere, RelatorioFiltros } from '../analytics/relatorios.service';
import { calcularSlaRestanteMinutos } from './sla.service';

// ── Tipos ──────────────────────────────────────────────────────────────

export interface FiltrosIndicadores extends RelatorioFiltros {}

export type EstadoIndicador = 'dentro' | 'atencao' | 'fora';

export interface ClassificacaoIndicador {
  estado: EstadoIndicador;
  icone: '🟢' | '🟡' | '🔴';
  texto: string;
}

export interface MetasIndicadores {
  tmrMetaMin: number;
  tmeMetaMin: number;
  primeiraRespostaMetaMin: number;
  slaMetaPct: number;
  slaRiscoPct: number;
  retrabalhoMetaPct: number;
  fcrMetaPct: number;
}

export interface CardIndicador {
  label: string;
  valor: number;
  unidade: string;
  meta: number;
  classificacao: ClassificacaoIndicador;
  delta: number | null;
  deltaLabel: string;
  evolucao: 'melhorou' | 'piorou' | 'estavel';
}

export interface IndicadoresAtendimento {
  atualizadoEm: string;
  periodo: { inicio: Date; fim: Date; label: string; dias: number };
  metas: MetasIndicadores;
  cards: {
    totalTickets: CardIndicador;
    tmr: CardIndicador;
    tme: CardIndicador;
    primeiraResposta: CardIndicador;
    sla: CardIndicador;
    slaEmRisco: CardIndicador;
    slaViolado: CardIndicador;
    tempoTotal: CardIndicador;
  };
  sla: {
    total: number;
    cumprido: number;
    emRisco: number;
    violado: number;
    percentualCumprimento: number;
    percentualEmRisco: number;
    percentualViolado: number;
  };
  primeiraResposta: {
    total: number;
    dentroMeta: number;
    percentualDentro: number;
  };
  tempoTotalMin: number;
  porAnalista: AnalistaIndicador[];
  comparacaoPeriodoAnterior: {
    tmr: { anterior: number; atual: number; deltaPct: number };
    tme: { anterior: number; atual: number; deltaPct: number };
    primeiraResposta: { anterior: number; atual: number; deltaPct: number };
    sla: { anterior: number; atual: number; deltaPct: number };
    totalTickets: { anterior: number; atual: number; deltaPct: number };
  };
  rework: {
    reaberturas: number;
    retrabalho: number;
    taxaReabertura: number;
    taxaRetrabalho: number;
    classificacaoReabertura: ClassificacaoIndicador;
    classificacaoRetrabalho: ClassificacaoIndicador;
  };
}

export interface AnalistaIndicador {
  agenteId: string;
  agenteNome: string;
  tickets: number;
  resolvidos: number;
  tmrMin: number;
  tmeMin: number;
  primeiraRespostaMin: number;
  slaCumprido: number;
  slaTotal: number;
  taxaSla: number;
  csatMedia: number;
  fcr: number;
  reaberturas: number;
  retrabalho: number;
}

export interface AlertaIndicador {
  tipo: 'sla_em_risco' | 'sla_violado' | 'aguardando_resposta' | 'parado' | 'acima_da_meta';
  titulo: string;
  mensagem: string;
  gravidade: 'info' | 'atencao' | 'critico';
  ticketId: string;
  protocolo: string;
  detalhe?: string;
}

export interface SlaTicketIndicador {
  totalMinutos: number;
  restantesMinutos: number;
  percentualConsumido: number;
  pausado: boolean;
  fonte: string;
  finalizado: boolean;
  classificacao: ClassificacaoIndicador;
  slaRiscoPct: number;
  statusSla: string;
}

// ── Metas configuráveis (HelpdeskConfig slug metas_indicadores) ────────

export const METAS_INDICADORES_DEFAULT: MetasIndicadores = {
  tmrMetaMin: 360,
  tmeMetaMin: 30,
  primeiraRespostaMetaMin: 15,
  slaMetaPct: 95,
  slaRiscoPct: 80,
  retrabalhoMetaPct: 10,
  fcrMetaPct: 60,
};

const CONFIG_SLUG = 'metas_indicadores';

export async function getMetasIndicadores(): Promise<MetasIndicadores> {
  const cfg = await prisma.helpdeskConfig.findFirst({ where: { slug: CONFIG_SLUG } });
  if (!cfg || !cfg.descricao) return { ...METAS_INDICADORES_DEFAULT };
  try {
    const parsed = JSON.parse(cfg.descricao);
    return { ...METAS_INDICADORES_DEFAULT, ...parsed };
  } catch {
    return { ...METAS_INDICADORES_DEFAULT };
  }
}

export async function setMetasIndicadores(metas: Partial<MetasIndicadores>): Promise<MetasIndicadores> {
  const atual = await getMetasIndicadores();
  const novo: MetasIndicadores = {
    tmrMetaMin: metas.tmrMetaMin ?? atual.tmrMetaMin,
    tmeMetaMin: metas.tmeMetaMin ?? atual.tmeMetaMin,
    primeiraRespostaMetaMin: metas.primeiraRespostaMetaMin ?? atual.primeiraRespostaMetaMin,
    slaMetaPct: metas.slaMetaPct ?? atual.slaMetaPct,
    slaRiscoPct: metas.slaRiscoPct ?? atual.slaRiscoPct,
    retrabalhoMetaPct: metas.retrabalhoMetaPct ?? atual.retrabalhoMetaPct,
    fcrMetaPct: metas.fcrMetaPct ?? atual.fcrMetaPct,
  };
  novo.tmrMetaMin = Math.max(1, Math.round(novo.tmrMetaMin));
  novo.tmeMetaMin = Math.max(1, Math.round(novo.tmeMetaMin));
  novo.primeiraRespostaMetaMin = Math.max(1, Math.round(novo.primeiraRespostaMetaMin));
  novo.slaMetaPct = Math.min(100, Math.max(1, Math.round(novo.slaMetaPct)));
  novo.slaRiscoPct = Math.min(100, Math.max(1, Math.round(novo.slaRiscoPct)));
  novo.retrabalhoMetaPct = Math.min(100, Math.max(0, Math.round(novo.retrabalhoMetaPct)));
  novo.fcrMetaPct = Math.min(100, Math.max(0, Math.round(novo.fcrMetaPct)));

  const existing = await prisma.helpdeskConfig.findFirst({ where: { slug: CONFIG_SLUG } });
  if (existing) {
    await prisma.helpdeskConfig.update({
      where: { id: existing.id },
      data: { descricao: JSON.stringify(novo), updatedAt: new Date() },
    });
  } else {
    await prisma.helpdeskConfig.create({
      data: { slug: CONFIG_SLUG, nome: 'Metas de indicadores', descricao: JSON.stringify(novo) },
    });
  }
  return novo;
}

// ── Classificação visual (SEMPRE com ícone + texto + valor) ────────────

export function classificarTempo(valor: number, meta: number): ClassificacaoIndicador {
  if (valor <= meta) return { estado: 'dentro', icone: '🟢', texto: 'Dentro do limite' };
  if (valor <= meta * 1.1) return { estado: 'atencao', icone: '🟡', texto: 'Atenção' };
  return { estado: 'fora', icone: '🔴', texto: 'Fora do limite' };
}

export function classificarPercentual(valor: number, meta: number): ClassificacaoIndicador {
  if (valor >= meta) return { estado: 'dentro', icone: '🟢', texto: 'Dentro da meta' };
  if (valor >= meta * 0.92) return { estado: 'atencao', icone: '🟡', texto: 'Atenção' };
  return { estado: 'fora', icone: '🔴', texto: 'Fora da meta' };
}

function calcDelta(atual: number, anterior: number): { delta: number | null; deltaLabel: string; evolucao: 'melhorou' | 'piorou' | 'estavel' } {
  if (!anterior) return { delta: null, deltaLabel: '—', evolucao: 'estavel' };
  const deltaPct = ((atual - anterior) / anterior) * 100;
  const rounded = Math.round(deltaPct * 10) / 10;
  const deltaLabel = `${rounded > 0 ? '+' : ''}${rounded}%`;
  const evolucao = Math.abs(rounded) < 0.05 ? 'estavel' : rounded > 0 ? 'piorou' : 'melhorou';
  return { delta: rounded, deltaLabel, evolucao };
}

// ── Cálculo de TME (tempo de espera do cliente) via mensagens ─────────

interface MsgLite {
  ticketId: string;
  fromMe: boolean;
  createdAt: Date;
}

function calcularTmePorTicket(mensagens: MsgLite[], agora: Date): { tmeMin: number | null; aguardandoResposta: boolean } {
  if (mensagens.length === 0) return { tmeMin: null, aguardandoResposta: false };
  const ordenadas = [...mensagens].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  let soma = 0;
  let cont = 0;
  let ultimaClienteAt: Date | null = null;
  let pendente = false;
  for (const m of ordenadas) {
    if (!m.fromMe) {
      ultimaClienteAt = m.createdAt;
      pendente = true;
    } else if (pendente && ultimaClienteAt) {
      soma += Math.max(0, (m.createdAt.getTime() - ultimaClienteAt.getTime()) / 60000);
      cont++;
      pendente = false;
      ultimaClienteAt = null;
    }
  }
  if (pendente && ultimaClienteAt) {
    soma += Math.max(0, (agora.getTime() - ultimaClienteAt.getTime()) / 60000);
    cont++;
  }
  return { tmeMin: cont > 0 ? Math.round(soma / cont) : null, aguardandoResposta: pendente };
}

// ── Agregação principal ────────────────────────────────────────────────

interface TicketInd {
  id: string;
  protocolo: string | null;
  dataAbertura: Date;
  dataFechamento: Date | null;
  dataPrimeiraResposta: Date | null;
  status: string;
  etapa: string;
  slaTotalMinutos: number | null;
  slaPausadoEm: Date | null;
  slaPausadoTotalMin: number;
  assigneeId: string | null;
  clienteNome: string;
  updatedAt: Date;
}

const STATUS_FINALIZADO = ['fechado', 'cancelado', 'concluido'];
const ETAPAS_FINALIZADAS = ['concluido', 'descartado'];

function isFinalizado(t: { status: string; etapa: string }): boolean {
  return STATUS_FINALIZADO.includes(t.status) || ETAPAS_FINALIZADAS.includes(t.etapa);
}

async function coletarTickets(where: Prisma.TicketWhereInput): Promise<{ tickets: TicketInd[]; mensagens: MsgLite[]; csatMap: Map<string, number>; retrabalhoMap: Map<string, { retrabalho: number; reaberto: number }> }> {
  const rows = await prisma.ticket.findMany({
    where,
    select: {
      id: true,
      protocolo: true,
      dataAbertura: true,
      dataFechamento: true,
      dataPrimeiraResposta: true,
      status: true,
      etapa: true,
      slaTotalMinutos: true,
      slaPausadoEm: true,
      slaPausadoTotalMin: true,
      assigneeId: true,
      updatedAt: true,
      client: { select: { razaoSocial: true, nomeFantasia: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const tickets: TicketInd[] = rows.map(r => ({
    id: r.id,
    protocolo: r.protocolo,
    dataAbertura: r.dataAbertura,
    dataFechamento: r.dataFechamento,
    dataPrimeiraResposta: r.dataPrimeiraResposta,
    status: r.status,
    etapa: r.etapa,
    slaTotalMinutos: r.slaTotalMinutos,
    slaPausadoEm: r.slaPausadoEm,
    slaPausadoTotalMin: r.slaPausadoTotalMin,
    assigneeId: r.assigneeId,
    clienteNome: r.client ? r.client.nomeFantasia || r.client.razaoSocial || 'Cliente' : 'Cliente',
    updatedAt: r.updatedAt,
  }));

  const ids = tickets.map(t => t.id);
  const [mensagens, csats, auditorias] = await Promise.all([
    ids.length > 0
      ? prisma.message.findMany({
          where: { ticketId: { in: ids } },
          select: { ticketId: true, fromMe: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        })
      : [],
    ids.length > 0
      ? prisma.cSATResposta.findMany({
          where: { ticketId: { in: ids }, respondidoEm: { not: null }, nota: { not: null } },
          select: { ticketId: true, nota: true },
        })
      : [],
    ids.length > 0
      ? prisma.auditoriaProfissional.findMany({
          where: { ticketId: { in: ids } },
          select: { ticketId: true, agenteId: true, retrabalho: true, classificacaoResolucao: true },
        })
      : [],
  ]);

  const csatMap = new Map<string, number>();
  for (const c of csats) if (c.nota != null) csatMap.set(c.ticketId, c.nota);

  const retrabalhoMap = new Map<string, { retrabalho: number; reaberto: number }>();
  for (const a of auditorias) {
    const cur = retrabalhoMap.get(a.ticketId) || { retrabalho: 0, reaberto: 0 };
    if (a.retrabalho) cur.retrabalho++;
    if (a.classificacaoResolucao === 'REABERTO') cur.reaberto++;
    retrabalhoMap.set(a.ticketId, cur);
  }

  return { tickets, mensagens, csatMap, retrabalhoMap };
}

interface MetricasSet {
  totalTickets: number;
  tmrSoma: number;
  tmrCont: number;
  tmeSoma: number;
  tmeCont: number;
  prSoma: number;
  prCont: number;
  prDentro: number;
  slaCumprido: number;
  slaEmRisco: number;
  slaViolado: number;
  slaTotal: number;
  tempoTotalMin: number;
  aguardandoResposta: number;
  acimaMeta: number;
}

function computarMetricas(
  tickets: TicketInd[],
  mensagens: MsgLite[],
  metas: MetasIndicadores,
  agora: Date,
): MetricasSet {
  const msgsPorTicket = new Map<string, MsgLite[]>();
  for (const m of mensagens) {
    const arr = msgsPorTicket.get(m.ticketId) || [];
    arr.push(m);
    msgsPorTicket.set(m.ticketId, arr);
  }

  const acc: MetricasSet = {
    totalTickets: tickets.length,
    tmrSoma: 0,
    tmrCont: 0,
    tmeSoma: 0,
    tmeCont: 0,
    prSoma: 0,
    prCont: 0,
    prDentro: 0,
    slaCumprido: 0,
    slaEmRisco: 0,
    slaViolado: 0,
    slaTotal: 0,
    tempoTotalMin: 0,
    aguardandoResposta: 0,
    acimaMeta: 0,
  };

  for (const t of tickets) {
    const finalizado = isFinalizado(t);
    const slaInfo = t.slaTotalMinutos
      ? calcularSlaRestanteMinutos({
          dataAbertura: t.dataAbertura,
          slaTotalMinutos: t.slaTotalMinutos,
          slaPausadoEm: t.slaPausadoEm,
          slaPausadoTotalMin: t.slaPausadoTotalMin,
          agora,
        })
      : null;

    // Tempo de resolução (TMR) e tempo total
    if (t.dataFechamento) {
      const pausaMs = (t.slaPausadoTotalMin || 0) * 60 * 1000;
      const durMin = Math.max(0, (t.dataFechamento.getTime() - t.dataAbertura.getTime() - pausaMs) / 60000);
      acc.tmrSoma += durMin;
      acc.tmrCont++;
      acc.tempoTotalMin += durMin;
    } else {
      acc.tempoTotalMin += Math.max(0, (agora.getTime() - t.dataAbertura.getTime()) / 60000);
    }

    // Primeira resposta
    if (t.dataPrimeiraResposta) {
      const prMin = Math.max(0, (t.dataPrimeiraResposta.getTime() - t.dataAbertura.getTime()) / 60000);
      acc.prSoma += prMin;
      acc.prCont++;
      if (prMin <= metas.primeiraRespostaMetaMin) acc.prDentro++;
    }

    // SLA
    if (slaInfo) {
      acc.slaTotal++;
      if (finalizado) {
        if (slaInfo.percentual <= 100) acc.slaCumprido++;
        else acc.slaViolado++;
      } else if (slaInfo.percentual >= 100) {
        acc.slaViolado++;
      } else if (slaInfo.percentual >= metas.slaRiscoPct) {
        acc.slaEmRisco++;
      } else {
        acc.slaCumprido++;
      }
    }

    // TME
    const tme = calcularTmePorTicket(msgsPorTicket.get(t.id) || [], agora);
    if (tme.tmeMin != null) {
      acc.tmeSoma += tme.tmeMin;
      acc.tmeCont++;
    }
    if (!finalizado && tme.aguardandoResposta) acc.aguardandoResposta++;

    // Acima da meta (aberto além do TMR meta)
    if (!finalizado) {
      const decorrido = Math.max(0, (agora.getTime() - t.dataAbertura.getTime()) / 60000);
      if (decorrido > metas.tmrMetaMin) acc.acimaMeta++;
    }
  }

  return acc;
}

function media(soma: number, cont: number): number {
  return cont > 0 ? Math.round(soma / cont) : 0;
}

interface AnalistaAcc {
  agenteId: string;
  agenteNome: string;
  tickets: number;
  resolvidos: number;
  tmrSoma: number;
  tmrCont: number;
  tmeSoma: number;
  tmeCont: number;
  prSoma: number;
  prCont: number;
  slaCumprido: number;
  slaTotal: number;
  csatSoma: number;
  csatCont: number;
  fcrDentro: number;
  reaberturas: number;
  retrabalho: number;
}

function coletarPorAnalista(
  tickets: TicketInd[],
  mensagens: MsgLite[],
  csatMap: Map<string, number>,
  retrabalhoMap: Map<string, { retrabalho: number; reaberto: number }>,
  metas: MetasIndicadores,
  agora: Date,
): AnalistaIndicador[] {
  const msgsPorTicket = new Map<string, MsgLite[]>();
  for (const m of mensagens) {
    const arr = msgsPorTicket.get(m.ticketId) || [];
    arr.push(m);
    msgsPorTicket.set(m.ticketId, arr);
  }

  const map = new Map<string, AnalistaAcc>();

  for (const t of tickets) {
    if (!t.assigneeId) continue;
    const a = map.get(t.assigneeId) || {
      agenteId: t.assigneeId,
      agenteNome: 'Analista',
      tickets: 0,
      resolvidos: 0,
      tmrSoma: 0,
      tmrCont: 0,
      tmeSoma: 0,
      tmeCont: 0,
      prSoma: 0,
      prCont: 0,
      slaCumprido: 0,
      slaTotal: 0,
      csatSoma: 0,
      csatCont: 0,
      fcrDentro: 0,
      reaberturas: 0,
      retrabalho: 0,
    };
    a.tickets++;

    const finalizado = isFinalizado(t);
    if (finalizado) a.resolvidos++;

    if (t.dataFechamento) {
      const pausaMs = (t.slaPausadoTotalMin || 0) * 60 * 1000;
      a.tmrSoma += Math.max(0, (t.dataFechamento.getTime() - t.dataAbertura.getTime() - pausaMs) / 60000);
      a.tmrCont++;
    }
    if (t.dataPrimeiraResposta) {
      const prMin = Math.max(0, (t.dataPrimeiraResposta.getTime() - t.dataAbertura.getTime()) / 60000);
      a.prSoma += prMin;
      a.prCont++;
      if (prMin <= 1440) a.fcrDentro++;
    }

    const tme = calcularTmePorTicket(msgsPorTicket.get(t.id) || [], agora);
    if (tme.tmeMin != null) {
      a.tmeSoma += tme.tmeMin;
      a.tmeCont++;
    }

    if (t.slaTotalMinutos) {
      a.slaTotal++;
      const slaInfo = calcularSlaRestanteMinutos({
        dataAbertura: t.dataAbertura,
        slaTotalMinutos: t.slaTotalMinutos,
        slaPausadoEm: t.slaPausadoEm,
        slaPausadoTotalMin: t.slaPausadoTotalMin,
        agora,
      });
      if (finalizado ? slaInfo.percentual <= 100 : slaInfo.percentual < metas.slaRiscoPct) a.slaCumprido++;
    }

    const csat = csatMap.get(t.id);
    if (csat != null) {
      a.csatSoma += csat;
      a.csatCont++;
    }

    const r = retrabalhoMap.get(t.id);
    if (r) {
      a.retrabalho += r.retrabalho;
      a.reaberturas += r.reaberto;
    }

    map.set(t.assigneeId, a);
  }

  const resultado: AnalistaIndicador[] = [];
  for (const [id, a] of map) {
    resultado.push({
      agenteId: id,
      agenteNome: a.agenteNome,
      tickets: a.tickets,
      resolvidos: a.resolvidos,
      tmrMin: a.tmrCont > 0 ? Math.round(a.tmrSoma / a.tmrCont) : 0,
      tmeMin: a.tmeCont > 0 ? Math.round(a.tmeSoma / a.tmeCont) : 0,
      primeiraRespostaMin: a.prCont > 0 ? Math.round(a.prSoma / a.prCont) : 0,
      slaCumprido: a.slaCumprido,
      slaTotal: a.slaTotal,
      taxaSla: a.slaTotal > 0 ? Math.round((a.slaCumprido / a.slaTotal) * 100) : 0,
      csatMedia: a.csatCont > 0 ? Math.round((a.csatSoma / a.csatCont) * 10) / 10 : 0,
      fcr: a.tickets > 0 ? Math.round((a.fcrDentro / a.tickets) * 100) : 0,
      reaberturas: a.reaberturas,
      retrabalho: a.retrabalho,
    });
  }

  return resultado.sort((x, y) => y.tickets - x.tickets);
}

function fmtPeriodo(inicio: Date, fim: Date): string {
  const f = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return `${f(inicio)} a ${f(fim)}`;
}

// ── Endpoint principal ─────────────────────────────────────────────────

export async function getIndicadoresAtendimento(filtros: FiltrosIndicadores = {}): Promise<IndicadoresAtendimento> {
  const agora = new Date();
  const inicio = filtros.inicio || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const fim = filtros.fim || agora;
  const metas = await getMetasIndicadores();

  const where = buildWhere({ ...filtros, inicio, fim });
  const duracao = Math.max(1, fim.getTime() - inicio.getTime());
  const fimPrev = new Date(inicio.getTime() - 1);
  const inicioPrev = new Date(inicio.getTime() - duracao);
  const wherePrev = buildWhere({ ...filtros, inicio: inicioPrev, fim: fimPrev });

  const [cur, prev] = await Promise.all([
    coletarTickets(where),
    coletarTickets(wherePrev),
  ]);

  const mCur = computarMetricas(cur.tickets, cur.mensagens, metas, agora);
  const mPrev = computarMetricas(prev.tickets, prev.mensagens, metas, agora);

  const tmrCur = media(mCur.tmrSoma, mCur.tmrCont);
  const tmrPrev = media(mPrev.tmrSoma, mPrev.tmrCont);
  const tmeCur = media(mCur.tmeSoma, mCur.tmeCont);
  const tmePrev = media(mPrev.tmeSoma, mPrev.tmeCont);
  const prCur = media(mCur.prSoma, mCur.prCont);
  const prPrev = media(mPrev.prSoma, mPrev.prCont);

  const slaCur = mCur.slaTotal > 0 ? Math.round((mCur.slaCumprido / mCur.slaTotal) * 100) : 0;
  const slaPrev = mPrev.slaTotal > 0 ? Math.round((mPrev.slaCumprido / mPrev.slaTotal) * 100) : 0;

  const porAnalista = coletarPorAnalista(cur.tickets, cur.mensagens, cur.csatMap, cur.retrabalhoMap, metas, agora);
  const agentesIds = Array.from(new Set(porAnalista.map(a => a.agenteId)));
  if (agentesIds.length > 0) {
    const usuarios = await prisma.user.findMany({ where: { id: { in: agentesIds } }, select: { id: true, name: true } });
    const nomeMap = new Map(usuarios.map(u => [u.id, u.name]));
    for (const a of porAnalista) {
      if (nomeMap.has(a.agenteId)) a.agenteNome = nomeMap.get(a.agenteId)!;
    }
  }

  const slaPctEmRisco = mCur.slaTotal > 0 ? Math.round((mCur.slaEmRisco / mCur.slaTotal) * 100) : 0;
  const slaPctViolado = mCur.slaTotal > 0 ? Math.round((mCur.slaViolado / mCur.slaTotal) * 100) : 0;

  const deltaTmr = calcDelta(tmrCur, tmrPrev);
  const deltaTme = calcDelta(tmeCur, tmePrev);
  const deltaPr = calcDelta(prCur, prPrev);
  const deltaSla = calcDelta(slaCur, slaPrev);
  const deltaTotal = calcDelta(mCur.totalTickets, mPrev.totalTickets);

  const totalReaberturas = porAnalista.reduce((s, a) => s + a.reaberturas, 0);
  const totalRetrabalho = porAnalista.reduce((s, a) => s + a.retrabalho, 0);
  const totalResolvidos = porAnalista.reduce((s, a) => s + a.resolvidos, 0);

  return {
    atualizadoEm: agora.toISOString(),
    periodo: { inicio, fim, label: fmtPeriodo(inicio, fim), dias: Math.round(duracao / 86400000) },
    metas,
    cards: {
      totalTickets: {
        label: 'Total de Tickets',
        valor: mCur.totalTickets,
        unidade: 'tickets',
        meta: 0,
        classificacao: mCur.totalTickets > 0 ? { estado: 'dentro', icone: '🟢', texto: 'Registrados' } : { estado: 'atencao', icone: '🟡', texto: 'Sem tickets' },
        delta: deltaTotal.delta,
        deltaLabel: deltaTotal.deltaLabel,
        evolucao: deltaTotal.evolucao,
      },
      tmr: {
        label: 'TMR — Resolução',
        valor: tmrCur,
        unidade: 'min',
        meta: metas.tmrMetaMin,
        classificacao: classificarTempo(tmrCur, metas.tmrMetaMin),
        delta: deltaTmr.delta,
        deltaLabel: deltaTmr.deltaLabel,
        evolucao: deltaTmr.evolucao,
      },
      tme: {
        label: 'TME — Espera do Cliente',
        valor: tmeCur,
        unidade: 'min',
        meta: metas.tmeMetaMin,
        classificacao: classificarTempo(tmeCur, metas.tmeMetaMin),
        delta: deltaTme.delta,
        deltaLabel: deltaTme.deltaLabel,
        evolucao: deltaTme.evolucao,
      },
      primeiraResposta: {
        label: 'Primeira Resposta',
        valor: prCur,
        unidade: 'min',
        meta: metas.primeiraRespostaMetaMin,
        classificacao: classificarTempo(prCur, metas.primeiraRespostaMetaMin),
        delta: deltaPr.delta,
        deltaLabel: deltaPr.deltaLabel,
        evolucao: deltaPr.evolucao,
      },
      sla: {
        label: 'SLA Cumprido',
        valor: slaCur,
        unidade: '%',
        meta: metas.slaMetaPct,
        classificacao: classificarPercentual(slaCur, metas.slaMetaPct),
        delta: deltaSla.delta,
        deltaLabel: deltaSla.deltaLabel,
        evolucao: deltaSla.evolucao,
      },
      slaEmRisco: {
        label: 'SLA em Risco',
        valor: mCur.slaEmRisco,
        unidade: 'tickets',
        meta: 0,
        classificacao: mCur.slaEmRisco === 0 ? { estado: 'dentro', icone: '🟢', texto: 'Nenhum em risco' } : mCur.slaEmRisco <= 5 ? { estado: 'atencao', icone: '🟡', texto: 'Poucos em risco' } : { estado: 'fora', icone: '🔴', texto: 'Muitos em risco' },
        delta: null,
        deltaLabel: `${slaPctEmRisco}% do total`,
        evolucao: 'estavel',
      },
      slaViolado: {
        label: 'SLA Violado',
        valor: mCur.slaViolado,
        unidade: 'tickets',
        meta: 0,
        classificacao: mCur.slaViolado === 0 ? { estado: 'dentro', icone: '🟢', texto: 'Nenhum violado' } : mCur.slaViolado <= 3 ? { estado: 'atencao', icone: '🟡', texto: 'Poucos violados' } : { estado: 'fora', icone: '🔴', texto: 'Muitos violados' },
        delta: null,
        deltaLabel: `${slaPctViolado}% do total`,
        evolucao: 'estavel',
      },
      tempoTotal: {
        label: 'Tempo Total de Atendimento',
        valor: mCur.tempoTotalMin,
        unidade: 'min',
        meta: 0,
        classificacao: { estado: 'dentro', icone: '🟢', texto: 'Somado do período' },
        delta: null,
        deltaLabel: `${Math.round(mCur.tempoTotalMin / 60)}h somadas`,
        evolucao: 'estavel',
      },
    },
    sla: {
      total: mCur.slaTotal,
      cumprido: mCur.slaCumprido,
      emRisco: mCur.slaEmRisco,
      violado: mCur.slaViolado,
      percentualCumprimento: slaCur,
      percentualEmRisco: slaPctEmRisco,
      percentualViolado: slaPctViolado,
    },
    primeiraResposta: {
      total: mCur.prCont,
      dentroMeta: mCur.prDentro,
      percentualDentro: mCur.prCont > 0 ? Math.round((mCur.prDentro / mCur.prCont) * 100) : 0,
    },
    tempoTotalMin: Math.round(mCur.tempoTotalMin),
    porAnalista,
    comparacaoPeriodoAnterior: {
      tmr: { anterior: tmrPrev, atual: tmrCur, deltaPct: deltaTmr.delta || 0 },
      tme: { anterior: tmePrev, atual: tmeCur, deltaPct: deltaTme.delta || 0 },
      primeiraResposta: { anterior: prPrev, atual: prCur, deltaPct: deltaPr.delta || 0 },
      sla: { anterior: slaPrev, atual: slaCur, deltaPct: deltaSla.delta || 0 },
      totalTickets: { anterior: mPrev.totalTickets, atual: mCur.totalTickets, deltaPct: deltaTotal.delta || 0 },
    },
    rework: {
      reaberturas: totalReaberturas,
      retrabalho: totalRetrabalho,
      taxaReabertura: totalResolvidos > 0 ? Math.round((totalReaberturas / totalResolvidos) * 1000) / 10 : 0,
      taxaRetrabalho: totalResolvidos > 0 ? Math.round((totalRetrabalho / totalResolvidos) * 1000) / 10 : 0,
      classificacaoReabertura: classificarPercentual(totalResolvidos > 0 ? Math.round((totalReaberturas / totalResolvidos) * 100) : 0, 15),
      classificacaoRetrabalho: classificarPercentual(totalResolvidos > 0 ? Math.round((totalRetrabalho / totalResolvidos) * 100) : 0, 10),
    },
  };
}

// ── SLA em tempo real de um ticket ─────────────────────────────────────

export async function getSlaTicketIndicador(ticketId: string): Promise<SlaTicketIndicador | null> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      status: true,
      etapa: true,
      slaTotalMinutos: true,
      slaPausadoEm: true,
      slaPausadoTotalMin: true,
      dataAbertura: true,
      prioridade: true,
      idFila: true,
    },
  });
  if (!ticket) return null;

  const metas = await getMetasIndicadores();
  const slaTotal = ticket.slaTotalMinutos || 240;
  const finalizado = isFinalizado(ticket);
  const calc = calcularSlaRestanteMinutos({
    dataAbertura: ticket.dataAbertura,
    slaTotalMinutos: slaTotal,
    slaPausadoEm: ticket.slaPausadoEm,
    slaPausadoTotalMin: ticket.slaPausadoTotalMin,
  });

  let classificacao: ClassificacaoIndicador;
  if (finalizado) {
    classificacao = calc.percentual <= 100 ? { estado: 'dentro', icone: '🟢', texto: 'Concluído dentro do SLA' } : { estado: 'fora', icone: '🔴', texto: 'Concluído após o SLA' };
  } else if (calc.percentual >= 100) {
    classificacao = { estado: 'fora', icone: '🔴', texto: 'SLA violado' };
  } else if (calc.percentual >= metas.slaRiscoPct) {
    classificacao = { estado: 'atencao', icone: '🟡', texto: 'SLA em risco' };
  } else {
    classificacao = { estado: 'dentro', icone: '🟢', texto: 'Dentro do prazo' };
  }

  return {
    totalMinutos: slaTotal,
    restantesMinutos: calc.restantes,
    percentualConsumido: Math.round(calc.percentual * 100) / 100,
    pausado: calc.pausado,
    fonte: ticket.idFila ? 'Fila' : ticket.prioridade ? 'Prioridade' : 'Padrão',
    finalizado,
    classificacao,
    slaRiscoPct: metas.slaRiscoPct,
    statusSla: finalizado ? 'concluido' : calc.percentual >= 100 ? 'violado' : calc.percentual >= metas.slaRiscoPct ? 'em_risco' : 'ok',
  };
}

// ── Alertas operacionais ───────────────────────────────────────────────

const PARADO_HORAS = 48;

export async function getAlertasIndicadores(filtros: FiltrosIndicadores = {}): Promise<{ alertas: AlertaIndicador[]; total: number }> {
  const agora = new Date();
  const metas = await getMetasIndicadores();
  const inicio = filtros.inicio || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const fim = filtros.fim || agora;
  const where = buildWhere({ ...filtros, inicio, fim });
  const whereAbertos = {
    ...where,
    status: { in: ['aberto', 'em_atendimento', 'pendente', 'escalonado'] },
    etapa: { notIn: ETAPAS_FINALIZADAS },
  };

  const tickets = await prisma.ticket.findMany({
    where: whereAbertos,
    select: {
      id: true,
      protocolo: true,
      dataAbertura: true,
      status: true,
      etapa: true,
      slaTotalMinutos: true,
      slaPausadoEm: true,
      slaPausadoTotalMin: true,
      updatedAt: true,
    },
    orderBy: { dataAbertura: 'asc' },
  });

  const ids = tickets.map(t => t.id);
  const mensagens = ids.length > 0
    ? await prisma.message.findMany({
        where: { ticketId: { in: ids } },
        select: { ticketId: true, fromMe: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      })
    : [];
  const msgsPorTicket = new Map<string, MsgLite[]>();
  for (const m of mensagens) {
    const arr = msgsPorTicket.get(m.ticketId) || [];
    arr.push(m);
    msgsPorTicket.set(m.ticketId, arr);
  }

  const alertas: AlertaIndicador[] = [];
  for (const t of tickets) {
    const calc = t.slaTotalMinutos
      ? calcularSlaRestanteMinutos({
          dataAbertura: t.dataAbertura,
          slaTotalMinutos: t.slaTotalMinutos,
          slaPausadoEm: t.slaPausadoEm,
          slaPausadoTotalMin: t.slaPausadoTotalMin,
          agora,
        })
      : null;
    const protocolo = t.protocolo || t.id.slice(0, 8);
    const pct = calc ? Math.round(calc.percentual) : 0;

    if (calc && pct >= 100) {
      alertas.push({
        tipo: 'sla_violado',
        titulo: 'SLA violado',
        mensagem: `O ticket ${protocolo} ultrapassou o prazo de SLA (${t.slaTotalMinutos} min consumidos ${pct}%).`,
        gravidade: 'critico',
        ticketId: t.id,
        protocolo,
        detalhe: 'Atenda com urgência e registre a justificativa do atraso.',
      });
    } else if (calc && pct >= metas.slaRiscoPct) {
      alertas.push({
        tipo: 'sla_em_risco',
        titulo: 'SLA em risco',
        mensagem: `O ticket ${protocolo} consumiu ${pct}% do SLA (restam ${calc.restantes} min).`,
        gravidade: 'atencao',
        ticketId: t.id,
        protocolo,
        detalhe: `${calc.restantes} min restantes para o vencimento.`,
      });
    }

    const tme = calcularTmePorTicket(msgsPorTicket.get(t.id) || [], agora);
    if (tme.aguardandoResposta && t.status !== 'aguardando_cliente') {
      const tempoEspera = mediaEsperaPendente(msgsPorTicket.get(t.id) || [], agora);
      if (tempoEspera >= metas.tmeMetaMin) {
        alertas.push({
          tipo: 'aguardando_resposta',
          titulo: 'Aguardando resposta do agente',
          mensagem: `O cliente do ticket ${protocolo} aguarda resposta há ${Math.round(tempoEspera)} min.`,
          gravidade: 'atencao',
          ticketId: t.id,
          protocolo,
          detalhe: 'A última mensagem foi do cliente.',
        });
      }
    }

    const horasParado = Math.max(0, (agora.getTime() - t.updatedAt.getTime()) / 3600000);
    if (horasParado >= PARADO_HORAS && t.status === 'aberto') {
      alertas.push({
        tipo: 'parado',
        titulo: 'Ticket parado',
        mensagem: `O ticket ${protocolo} está sem movimentação há ${Math.round(horasParado)}h.`,
        gravidade: 'atencao',
        ticketId: t.id,
        protocolo,
        detalhe: 'Sem atualização há mais de 48h.',
      });
    }

    const decorrido = Math.max(0, (agora.getTime() - t.dataAbertura.getTime()) / 60000);
    if (decorrido > metas.tmrMetaMin && t.status !== 'aberto') {
      // ticket já movimentado mas acima da meta — sem ação extra
    } else if (decorrido > metas.tmrMetaMin) {
      alertas.push({
        tipo: 'acima_da_meta',
        titulo: 'Acima da meta de resolução',
        mensagem: `O ticket ${protocolo} está aberto há ${Math.round(decorrido)} min (meta TMR: ${metas.tmrMetaMin} min).`,
        gravidade: 'info',
        ticketId: t.id,
        protocolo,
        detalhe: 'Considere priorizar este atendimento.',
      });
    }
  }

  alertas.sort((a, b) => {
    const peso = { critico: 0, atencao: 1, info: 2 } as const;
    return peso[a.gravidade] - peso[b.gravidade];
  });

  return { alertas, total: alertas.length };
}

function mediaEsperaPendente(mensagens: MsgLite[], agora: Date): number {
  if (mensagens.length === 0) return 0;
  const ordenadas = [...mensagens].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  let ultimaClienteAt: Date | null = null;
  let pendente = false;
  for (const m of ordenadas) {
    if (!m.fromMe) {
      ultimaClienteAt = m.createdAt;
      pendente = true;
    } else {
      pendente = false;
    }
  }
  if (pendente && ultimaClienteAt) {
    return Math.max(0, (agora.getTime() - ultimaClienteAt.getTime()) / 60000);
  }
  return 0;
}

// ── Exportação CSV ─────────────────────────────────────────────────────

export async function exportarIndicadoresCsv(filtros: FiltrosIndicadores = {}): Promise<string> {
  const dados = await getIndicadoresAtendimento(filtros);
  const linhas: string[] = [];
  linhas.push(`Indicadores de Atendimento - ${dados.periodo.label}`);
  linhas.push('Indicador;Valor;Meta;Classificação');
  const cards = dados.cards as Record<string, CardIndicador>;
  for (const key of Object.keys(cards)) {
    const c = cards[key];
    linhas.push(`${c.label};${c.valor} ${c.unidade};${c.meta ? `${c.meta} ${c.unidade}` : '-'};${c.classificacao.icone} ${c.classificacao.texto}`);
  }
  linhas.push('');
  linhas.push('SLA;Total;Cumprido;Em risco;Violado;Cumprimento %');
  linhas.push(`SLA;${dados.sla.total};${dados.sla.cumprido};${dados.sla.emRisco};${dados.sla.violado};${dados.sla.percentualCumprimento}`);
  linhas.push('');
  linhas.push('Primeira resposta;Total;Dentro da meta;% dentro');
  linhas.push(`Primeira resposta;${dados.primeiraResposta.total};${dados.primeiraResposta.dentroMeta};${dados.primeiraResposta.percentualDentro}`);
  linhas.push('');
  linhas.push('Analista;Tickets;Resolvidos;TMR (min);TME (min);Primeira resposta (min);SLA cumprido;SLA total;Taxa SLA %;CSAT;FCR %;Reaberturas;Retrabalho');
  for (const a of dados.porAnalista) {
    linhas.push(`${a.agenteNome};${a.tickets};${a.resolvidos};${a.tmrMin};${a.tmeMin};${a.primeiraRespostaMin};${a.slaCumprido};${a.slaTotal};${a.taxaSla};${a.csatMedia};${a.fcr};${a.reaberturas};${a.retrabalho}`);
  }
  return linhas.join('\n');
}
