import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import {
  RefreshCw, Download, Settings2, Loader2, Clock, Timer, Gauge,
  TrendingUp, TrendingDown, FileText, Filter, X, BellRing,
  AlertTriangle, XCircle, Info, Users,
} from 'lucide-react';
import { AcronymText } from '../../components/AcronymText';
import type {
  IndicadoresAtendimento,
  MetasIndicadores,
  AlertaIndicador,
  CardIndicador,
} from '../../types';

interface OpcoesFiltros {
  filas: { id: string; nome: string }[];
  departamentos: { id: string; nome: string }[];
  analistas: { id: string; name: string }[];
  clientes: { id: string; nome: string }[];
  canais: string[];
  prioridades: string[];
  statuses: string[];
  categorias: string[];
}

interface AssuntoOpcao {
  id: string;
  nome: string;
}

const PRESETS = [
  { label: '7 dias', dias: 7 },
  { label: '30 dias', dias: 30 },
  { label: '90 dias', dias: 90 },
];

function classPill(c: CardIndicador['classificacao']) {
  switch (c.estado) {
    case 'fora': return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border border-red-200 dark:border-red-800';
    case 'atencao': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800';
    default: return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800';
  }
}

function DeltaPill({ delta, invertido }: { delta: number | null; invertido?: boolean }) {
  if (delta === null) return null;
  const melhora = invertido ? delta < 0 : delta > 0;
  const cor = melhora
    ? 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30'
    : delta === 0
      ? 'text-slate-500 bg-slate-100 dark:text-slate-400 dark:bg-slate-800'
      : 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/30';
  const Icon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cor}`} style={{ fontFamily: 'Lexend, sans-serif' }}>
      {Icon && <Icon size={12} />}
      {delta > 0 ? '+' : ''}{delta}%
    </span>
  );
}

function CardIndicadorView({ card, invertido }: { card: CardIndicador; invertido?: boolean }) {
  const Icon = card.label.includes('TMR') || card.label.includes('Tempo') ? Timer : card.label.includes('TME') ? Clock : card.label.includes('SLA') ? Gauge : FileText;
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 flex flex-col gap-2 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide" style={{ fontFamily: 'Lexend, sans-serif' }}>
        <Icon size={14} className="text-blue-600 dark:text-blue-400" />
        <AcronymText text={card.label} />
      </div>
      <div className="flex items-end justify-between gap-2">
        <div>
          <span className="text-2xl font-bold text-slate-900 dark:text-white" style={{ fontFamily: 'Khand, sans-serif' }}>
            {card.valor}
          </span>
          <span className="ml-1 text-sm font-medium text-slate-400 dark:text-slate-500">{card.unidade}</span>
        </div>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${classPill(card.classificacao)}`} style={{ fontFamily: 'Lexend, sans-serif' }}>
          {card.classificacao.icone} {card.classificacao.texto}
        </span>
      </div>
      <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500" style={{ fontFamily: 'Lexend, sans-serif' }}>
        <span>{card.meta > 0 ? `Meta: ${card.meta} ${card.unidade}` : card.deltaLabel}</span>
        {card.delta !== null ? <DeltaPill delta={card.delta} invertido={invertido} /> : <span>{card.deltaLabel}</span>}
      </div>
    </div>
  );
}

const selectCls = 'px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/60';

export default function IndicadoresAtendimentoPage() {
  const [data, setData] = useState<IndicadoresAtendimento | null>(null);
  const [alertas, setAlertas] = useState<AlertaIndicador[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [opcoes, setOpcoes] = useState<OpcoesFiltros | null>(null);
  const [assuntos, setAssuntos] = useState<AssuntoOpcao[]>([]);

  const [dias, setDias] = useState(30);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [filtroFila, setFiltroFila] = useState('');
  const [filtroAnalista, setFiltroAnalista] = useState('');
  const [filtroCliente, setFiltroCliente] = useState('');
  const [filtroDepartamento, setFiltroDepartamento] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroAssunto, setFiltroAssunto] = useState('');
  const [filtroPrioridade, setFiltroPrioridade] = useState('');
  const [filtroCanal, setFiltroCanal] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');

  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [modalMetas, setModalMetas] = useState(false);
  const [metas, setMetas] = useState<MetasIndicadores | null>(null);
  const [salvandoMetas, setSalvandoMetas] = useState(false);

  const montarParams = useCallback(() => {
    const params: Record<string, string> = { dias: String(dias) };
    if (dataInicio) params.inicio = dataInicio;
    if (dataFim) params.fim = dataFim;
    if (filtroFila) params.filaId = filtroFila;
    if (filtroAnalista) params.analistaId = filtroAnalista;
    if (filtroCliente) params.clienteId = filtroCliente;
    if (filtroDepartamento) params.departamentoId = filtroDepartamento;
    if (filtroCategoria) params.categoria = filtroCategoria;
    if (filtroAssunto) params.assunto = filtroAssunto;
    if (filtroPrioridade) params.prioridade = filtroPrioridade;
    if (filtroCanal) params.canal = filtroCanal;
    if (filtroStatus) params.status = filtroStatus;
    return params;
  }, [dias, dataInicio, dataFim, filtroFila, filtroAnalista, filtroCliente, filtroDepartamento, filtroCategoria, filtroAssunto, filtroPrioridade, filtroCanal, filtroStatus]);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = montarParams();
      const { data: res } = await api.get('/helpdesk/indicadores', { params });
      setData(res);
      const { data: alertasRes } = await api.get('/helpdesk/indicadores/alertas', { params });
      setAlertas(alertasRes.alertas || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao carregar indicadores');
    } finally {
      setLoading(false);
    }
  }, [montarParams]);

  const carregarOpcoes = useCallback(async () => {
    try {
      const { data } = await api.get('/analytics/relatorios/opcoes');
      setOpcoes(data);
      const { data: assuntosRes } = await api.get('/helpdesk/assuntos');
      setAssuntos(Array.isArray(assuntosRes) ? assuntosRes : []);
    } catch { /* opções não carregam não impedem a página */ }
  }, []);

  const carregarMetas = useCallback(async () => {
    try {
      const { data } = await api.get('/helpdesk/indicadores/metas');
      setMetas(data);
    } catch { /* metas padrão assumidas */ }
  }, []);

  useEffect(() => {
    carregarOpcoes();
    carregarMetas();
  }, [carregarOpcoes, carregarMetas]);

  useEffect(() => {
    carregar();
    const id = setInterval(carregar, 60000);
    return () => clearInterval(id);
  }, [carregar]);

  const limparFiltros = () => {
    setDataInicio('');
    setDataFim('');
    setFiltroFila('');
    setFiltroAnalista('');
    setFiltroCliente('');
    setFiltroDepartamento('');
    setFiltroCategoria('');
    setFiltroAssunto('');
    setFiltroPrioridade('');
    setFiltroCanal('');
    setFiltroStatus('');
  };

  const exportarCsv = async () => {
    try {
      const params = montarParams();
      const { data } = await api.get('/helpdesk/indicadores/exportar-csv', { params, responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `indicadores-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* erro de exportação silencioso */ }
  };

  const salvarMetas = async () => {
    if (!metas) return;
    setSalvandoMetas(true);
    try {
      await api.put('/helpdesk/indicadores/metas', metas);
      setModalMetas(false);
      carregar();
    } catch { /* erro ao salvar */ } finally {
      setSalvandoMetas(false);
    }
  };

  const setMeta = (campo: keyof MetasIndicadores, valor: string) => {
    if (!metas) return;
    setMetas({ ...metas, [campo]: Number(valor) || 0 });
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-6">
        <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400" style={{ fontFamily: 'Lexend, sans-serif' }}>{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-5" style={{ fontFamily: 'Lexend, sans-serif' }}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white" style={{ fontFamily: 'Khand, sans-serif' }}>
            Indicadores de Atendimento
          </h1>
          {data && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Período: {data.periodo.label} · Atualizado {new Date(data.atualizadoEm).toLocaleTimeString('pt-BR')}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.dias}
              onClick={() => setDias(p.dias)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${dias === p.dias
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={carregar}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Atualizar
          </button>
          <button
            onClick={() => setModalMetas(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <Settings2 className="w-4 h-4" /> Metas
          </button>
          <button
            onClick={exportarCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
          >
            <Download className="w-4 h-4" /> CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm">{error}</div>
      )}

      {/* Filtros */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
        <button
          onClick={() => setMostrarFiltros(!mostrarFiltros)}
          className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200"
        >
          <Filter size={15} className="text-blue-600 dark:text-blue-400" /> Filtros
          <span className="ml-1 text-xs text-slate-400 dark:text-slate-500">(recalculam todos os indicadores)</span>
          {mostrarFiltros ? <X size={14} /> : <span className="text-xs">▼</span>}
        </button>
        {mostrarFiltros && (
          <div className="mt-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              Data início
              <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className={selectCls} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              Data fim
              <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className={selectCls} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              Fila
              <select value={filtroFila} onChange={(e) => setFiltroFila(e.target.value)} className={selectCls}>
                <option value="">Todas</option>
                {(opcoes?.filas || []).map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              Analista
              <select value={filtroAnalista} onChange={(e) => setFiltroAnalista(e.target.value)} className={selectCls}>
                <option value="">Todos</option>
                {(opcoes?.analistas || []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              Cliente
              <select value={filtroCliente} onChange={(e) => setFiltroCliente(e.target.value)} className={selectCls}>
                <option value="">Todos</option>
                {(opcoes?.clientes || []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              Departamento
              <select value={filtroDepartamento} onChange={(e) => setFiltroDepartamento(e.target.value)} className={selectCls}>
                <option value="">Todos</option>
                {(opcoes?.departamentos || []).map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              Categoria
              <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} className={selectCls}>
                <option value="">Todas</option>
                {(opcoes?.categorias || []).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              Assunto
              <select value={filtroAssunto} onChange={(e) => setFiltroAssunto(e.target.value)} className={selectCls}>
                <option value="">Todos</option>
                {assuntos.map((a) => <option key={a.id} value={a.nome}>{a.nome}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              Prioridade
              <select value={filtroPrioridade} onChange={(e) => setFiltroPrioridade(e.target.value)} className={selectCls}>
                <option value="">Todas</option>
                {(opcoes?.prioridades || []).map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              Canal
              <select value={filtroCanal} onChange={(e) => setFiltroCanal(e.target.value)} className={selectCls}>
                <option value="">Todos</option>
                {(opcoes?.canais || []).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              Status
              <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className={selectCls}>
                <option value="">Todos</option>
                {(opcoes?.statuses || []).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <button onClick={limparFiltros} className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-800">
              <X size={14} /> Limpar
            </button>
          </div>
        )}
      </div>

      {data && (
        <>
          {/* Cards (8) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <CardIndicadorView card={data.cards.totalTickets} />
            <CardIndicadorView card={data.cards.tmr} invertido />
            <CardIndicadorView card={data.cards.tme} invertido />
            <CardIndicadorView card={data.cards.primeiraResposta} invertido />
            <CardIndicadorView card={data.cards.sla} />
            <CardIndicadorView card={data.cards.slaEmRisco} />
            <CardIndicadorView card={data.cards.slaViolado} />
            <CardIndicadorView card={data.cards.tempoTotal} />
          </div>
          {/* Distribuição SLA + Primeira resposta + Comparação */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 mb-3" style={{ fontFamily: 'Lexend, sans-serif' }}>
                <Gauge size={15} className="text-blue-600 dark:text-blue-400" /> Distribuição de SLA
              </h2>
              <div className="flex h-3 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 mb-3">
                <div className="bg-emerald-500 transition-all" style={{ width: `${data.sla.percentualCumprimento}%` }} />
                <div className="bg-amber-500 transition-all" style={{ width: `${data.sla.percentualEmRisco}%` }} />
                <div className="bg-red-500 transition-all" style={{ width: `${data.sla.percentualViolado}%` }} />
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400">
                  <span>🟢 Cumprido</span><span className="font-bold">{data.sla.cumprido} ({data.sla.percentualCumprimento}%)</span>
                </div>
                <div className="flex items-center justify-between text-amber-700 dark:text-amber-400">
                  <span>🟡 Em risco</span><span className="font-bold">{data.sla.emRisco} ({data.sla.percentualEmRisco}%)</span>
                </div>
                <div className="flex items-center justify-between text-red-700 dark:text-red-400">
                  <span>🔴 Violado</span><span className="font-bold">{data.sla.violado} ({data.sla.percentualViolado}%)</span>
                </div>
                <div className="pt-1.5 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-slate-500 dark:text-slate-400">
                  <span>Meta de cumprimento</span><span className="font-bold">{data.metas.slaMetaPct}%</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 mb-3" style={{ fontFamily: 'Lexend, sans-serif' }}>
                <Timer size={15} className="text-blue-600 dark:text-blue-400" /> Primeira Resposta
              </h2>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Tickets com primeira resposta</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">{data.primeiraResposta.total}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Dentro da meta ({data.metas.primeiraRespostaMetaMin} min)</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{data.primeiraResposta.dentroMeta}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Percentual dentro da meta</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">{data.primeiraResposta.percentualDentro}%</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 mt-2">
                  <div className="h-full bg-emerald-500 transition-all" style={{ width: `${data.primeiraResposta.percentualDentro}%` }} />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 mb-3" style={{ fontFamily: 'Lexend, sans-serif' }}>
                <TrendingUp size={15} className="text-blue-600 dark:text-blue-400" /> Comparação com período anterior
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-400 dark:text-slate-500 uppercase">
                      <th className="text-left py-1 pr-2 font-semibold">Indicador</th>
                      <th className="text-right py-1 px-2 font-semibold">Atual</th>
                      <th className="text-right py-1 px-2 font-semibold">Anterior</th>
                      <th className="text-right py-1 pl-2 font-semibold">Δ</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700 dark:text-slate-200">
                    {[
                      { nome: 'Total de tickets', cur: data.comparacaoPeriodoAnterior.totalTickets.atual, ant: data.comparacaoPeriodoAnterior.totalTickets.anterior, delta: data.comparacaoPeriodoAnterior.totalTickets.deltaPct },
                      { nome: 'TMR (min)', cur: data.comparacaoPeriodoAnterior.tmr.atual, ant: data.comparacaoPeriodoAnterior.tmr.anterior, delta: data.comparacaoPeriodoAnterior.tmr.deltaPct },
                      { nome: 'TME (min)', cur: data.comparacaoPeriodoAnterior.tme.atual, ant: data.comparacaoPeriodoAnterior.tme.anterior, delta: data.comparacaoPeriodoAnterior.tme.deltaPct },
                      { nome: 'Primeira resposta (min)', cur: data.comparacaoPeriodoAnterior.primeiraResposta.atual, ant: data.comparacaoPeriodoAnterior.primeiraResposta.anterior, delta: data.comparacaoPeriodoAnterior.primeiraResposta.deltaPct },
                      { nome: 'SLA cumprido (%)', cur: data.comparacaoPeriodoAnterior.sla.atual, ant: data.comparacaoPeriodoAnterior.sla.anterior, delta: data.comparacaoPeriodoAnterior.sla.deltaPct },
                    ].map((linha) => (
                      <tr key={linha.nome} className="border-t border-slate-100 dark:border-slate-700">
                        <td className="py-1.5 pr-2">{linha.nome}</td>
                        <td className="text-right py-1.5 px-2 font-semibold">{linha.cur}</td>
                        <td className="text-right py-1.5 px-2 text-slate-400 dark:text-slate-500">{linha.ant}</td>
                        <td className="text-right py-1.5 pl-2">
                          <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${linha.delta > 0 ? 'text-red-600 dark:text-red-400' : linha.delta < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                            {linha.delta > 0 ? '+' : ''}{linha.delta}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Alertas operacionais */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 mb-3" style={{ fontFamily: 'Lexend, sans-serif' }}>
              <BellRing size={15} className="text-blue-600 dark:text-blue-400" /> Alertas operacionais
              {alertas.length > 0 && (
                <span className="ml-auto text-xs font-semibold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-2 py-0.5 rounded-full">{alertas.length}</span>
              )}
            </h2>
            {alertas.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500">Nenhum alerta no período. 🎉</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {alertas.map((alerta, i) => {
                  const borda = alerta.gravidade === 'critico'
                    ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20'
                    : alerta.gravidade === 'atencao'
                      ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30';
                  const iconCor = alerta.gravidade === 'critico' ? 'text-red-600 dark:text-red-400' : alerta.gravidade === 'atencao' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400';
                  const Icone = alerta.gravidade === 'critico' ? XCircle : alerta.gravidade === 'atencao' ? AlertTriangle : Info;
                  return (
                    <div key={i} className={`rounded-xl border p-3 ${borda}`}>
                      <div className="flex items-start gap-2">
                        <Icone size={16} className={`mt-0.5 flex-shrink-0 ${iconCor}`} />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{alerta.titulo} — <span className="text-slate-500 dark:text-slate-400 font-normal">{alerta.protocolo}</span></p>
                          <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{alerta.mensagem}</p>
                          {alerta.detalhe && <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{alerta.detalhe}</p>}
                          <Link to={`/app/helpdesk/ticket/${alerta.ticketId}`} className="inline-block mt-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                            Abrir ticket →
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Por analista */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 mb-3" style={{ fontFamily: 'Lexend, sans-serif' }}>
              <Users size={15} className="text-blue-600 dark:text-blue-400" /> Análise por analista
            </h2>
            {data.porAnalista.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500">Nenhum ticket com analista atribuído no período.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-400 dark:text-slate-500 uppercase">
                      <th className="text-left py-1.5 pr-2 font-semibold">Analista</th>
                      <th className="text-center py-1.5 px-2 font-semibold">Tickets</th>
                      <th className="text-center py-1.5 px-2 font-semibold">Resolvidos</th>
                      <th className="text-center py-1.5 px-2 font-semibold"><AcronymText text="TMR" /></th>
                      <th className="text-center py-1.5 px-2 font-semibold"><AcronymText text="TME" /></th>
                      <th className="text-center py-1.5 px-2 font-semibold">1ª Resp.</th>
                      <th className="text-center py-1.5 px-2 font-semibold"><AcronymText text="SLA" /></th>
                      <th className="text-center py-1.5 px-2 font-semibold"><AcronymText text="CSAT" /></th>
                      <th className="text-center py-1.5 px-2 font-semibold"><AcronymText text="FCR" /></th>
                      <th className="text-center py-1.5 px-2 font-semibold">Reab.</th>
                      <th className="text-center py-1.5 pl-2 font-semibold">Retrab.</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700 dark:text-slate-200">
                    {data.porAnalista.map((a) => (
                      <tr key={a.agenteId} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                        <td className="py-2 pr-2 font-semibold">{a.agenteNome}</td>
                        <td className="text-center py-2 px-2">{a.tickets}</td>
                        <td className="text-center py-2 px-2">{a.resolvidos}</td>
                        <td className="text-center py-2 px-2">{a.tmrMin > 0 ? `${a.tmrMin}min` : '—'}</td>
                        <td className="text-center py-2 px-2">{a.tmeMin > 0 ? `${a.tmeMin}min` : '—'}</td>
                        <td className="text-center py-2 px-2">{a.primeiraRespostaMin > 0 ? `${a.primeiraRespostaMin}min` : '—'}</td>
                        <td className="text-center py-2 px-2">
                          {a.slaTotal > 0 ? (
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-semibold ${a.taxaSla >= data.metas.slaMetaPct
                              ? 'text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-900/40'
                              : a.taxaSla >= data.metas.slaMetaPct * 0.92
                                ? 'text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/40'
                                : 'text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/40'}`}>
                              {a.taxaSla}%
                            </span>
                          ) : '—'}
                        </td>
                        <td className="text-center py-2 px-2">{a.csatMedia > 0 ? `${a.csatMedia}/5` : '—'}</td>
                        <td className="text-center py-2 px-2">{a.tickets > 0 ? `${a.fcr}%` : '—'}</td>
                        <td className="text-center py-2 px-2">{a.reaberturas > 0 ? <span className="text-red-600 dark:text-red-400 font-semibold">{a.reaberturas}</span> : a.reaberturas}</td>
                        <td className="text-center py-2 pl-2">{a.retrabalho > 0 ? <span className="text-amber-600 dark:text-amber-400 font-semibold">{a.retrabalho}</span> : a.retrabalho}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal de metas */}
      {modalMetas && metas && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setModalMetas(false)}>
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4" style={{ fontFamily: 'Khand, sans-serif' }}>Metas de Indicadores</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <AcronymText text="TMR" /> (Resolução) — min
                <input type="number" min={1} value={metas.tmrMetaMin} onChange={(e) => setMeta('tmrMetaMin', e.target.value)} className={selectCls} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <AcronymText text="TME" /> (Espera) — min
                <input type="number" min={1} value={metas.tmeMetaMin} onChange={(e) => setMeta('tmeMetaMin', e.target.value)} className={selectCls} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                Primeira Resposta — min
                <input type="number" min={1} value={metas.primeiraRespostaMetaMin} onChange={(e) => setMeta('primeiraRespostaMetaMin', e.target.value)} className={selectCls} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <AcronymText text="SLA" /> meta — %
                <input type="number" min={1} max={100} value={metas.slaMetaPct} onChange={(e) => setMeta('slaMetaPct', e.target.value)} className={selectCls} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <AcronymText text="SLA" /> em risco a partir de — %
                <input type="number" min={1} max={100} value={metas.slaRiscoPct} onChange={(e) => setMeta('slaRiscoPct', e.target.value)} className={selectCls} />
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setModalMetas(false)} className="px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600">
                Cancelar
              </button>
              <button onClick={salvarMetas} disabled={salvandoMetas} className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5">
                {salvandoMetas && <Loader2 className="w-4 h-4 animate-spin" />} Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}