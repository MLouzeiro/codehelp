import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { formatDuration } from '../../lib/formatDuration';
import {
  RefreshCw, Download, FileText, Printer, TrendingUp, TrendingDown,
  Users, Building2, Clock, CheckCircle, AlertTriangle, BarChart3,
  Loader2, Filter, X, ChevronDown, ChevronRight, Layers,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';

// ── Types ────────────────────────────────────────────────────────────────

interface Opcoes {
  filas: { id: string; nome: string }[];
  departamentos: { id: string; nome: string }[];
  analistas: { id: string; name: string }[];
  clientes: { id: string; nome: string }[];
  canais: string[];
  prioridades: string[];
  statuses: string[];
  categorias: string[];
}

interface Relatorio {
  atualizadoEm: string;
  periodo: { inicio: string; fim: string; label: string; dias: number };
  resumo: {
    totalTickets: number; ticketsFechados: number; ticketsAbertos: number;
    taxaResolucao: number; tempoMedioRespostaMin: number; tempoMedioResolucaoH: number;
    slaCumprido: number; slaTotal: number; taxaSla: number;
    csatMedio: number; csatTotal: number; fcr: number;
  };
  comparativo: {
    deltaTickets: number; deltaFechados: number; deltaTempoResposta: number;
    deltaTempoResolucao: number; deltaCsat: number; deltaSla: number; deltaFcr: number;
  };
  tendenciaDiaria: { dia: string; total: number; fechados: number }[];
  porCanal: { valor: string; total: number }[];
  porPrioridade: { valor: string; total: number }[];
  porStatus: { valor: string; total: number }[];
  porCategoria: { valor: string; total: number; fechados: number }[];
  porDepartamento: { valor: string; total: number; fechados: number }[];
  porFila: { valor: string; total: number; fechados: number }[];
  porAnalista: { valor: string; atendidos: number; fechados: number; tempoMedioMin: number; csatMedio: number }[];
  porCliente: { valor: string; total: number; fechados: number }[];
  porAssunto: { valor: string; total: number }[];
  tempoPorTipo: { valor: string; totalMin: number; qtd: number }[];
  tempoPorDepartamento: { valor: string; totalMin: number }[];
  horasDev: { totalH: number; porTicket: number };
  implantacoes: { total: number; concluidas: number; mediaHorasDev: number; horasSuporteTotal: number };
  porNivel: { nivel: string; total: number; custoUnitario: number; custoTotal: number }[];
  custoEstimado: { total: number; porChamado: number; porNivel: { nivel: string; total: number }[] };
  retrabalho: { reaberturas: number; chamadosRecorrentes: number; taxaReabertura: number; taxaRecorrencia: number };
  transferencias: { total: number; chamadosComTransferencia: number; taxaTransferencia: number };
  comparePeriodoAnterior: {
    totalTickets: number; ticketsFechados: number; taxaResolucao: number;
    tempoMedioRespostaMin: number; tempoMedioResolucaoH: number; csatMedio: number;
  } | null;
}

interface Filtros {
  dias: number; inicio: string; fim: string; filaId: string; canal: string;
  prioridade: string; status: string; departamentoId: string; analistaId: string;
  clienteId: string; categoria: string; assunto: string;
}

// ── Constants ────────────────────────────────────────────────────────────

const CORES = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#ec4899', '#f97316'];
const CORES_NIVEL: Record<string, string> = { N1: '#10b981', N2: '#f59e0b', N3: '#ef4444' };
const PERIODOS = [
  { label: 'Hoje', dias: 1 },
  { label: '7 dias', dias: 7 },
  { label: '30 dias', dias: 30 },
  { label: '90 dias', dias: 90 },
  { label: '6 meses', dias: 180 },
  { label: 'Ano', dias: 365 },
];

const TABS = [
  { key: 'resumo', label: 'Resumo', icon: BarChart3 },
  { key: 'volume', label: 'Volume', icon: TrendingUp },
  { key: 'clientes', label: 'Clientes', icon: Users },
  { key: 'atendentes', label: 'Atendentes', icon: Users },
  { key: 'tecnico', label: 'Técnico', icon: Layers },
  { key: 'tempos', label: 'Tempos', icon: Clock },
  { key: 'decisao', label: 'Decisão', icon: AlertTriangle },
];

// ── Helpers ──────────────────────────────────────────────────────────────

function fmtTempo(min: number): string {
  return formatDuration(min);
}

function fmtMoeda(n: number): string {
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function classificarNivel(texto: string): 'N1' | 'N2' | 'N3' {
  const lower = texto.toLowerCase();
  const n3 = ['calibração', 'banco de dados', 'integração', 'desenvolvimento', 'crítico', 'servidor', 'infraestrutura', 'migração', 'replicação', 'cluster', 'segurança', 'firewall', 'api', 'webservice', 'customização', 'automação'];
  const n2 = ['host-link', 'hostlink', 'interface', 'impressora', 'laudo', 'procedimento', 'rede', 'configuração', 'ajuste', 'relatório', 'importação', 'exportação', 'layout', 'atualização', 'manutenção', 'lentidão', 'timeout', 'conexão', 'login', 'senha', 'permissão'];
  for (const kw of n3) { if (lower.includes(kw)) return 'N3'; }
  for (const kw of n2) { if (lower.includes(kw)) return 'N2'; }
  return 'N1';
}

// ── Component ────────────────────────────────────────────────────────────

export default function RelatoriosConsolidadosPage() {
  const [dados, setDados] = useState<Relatorio | null>(null);
  const [opcoes, setOpcoes] = useState<Opcoes | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [aba, setAba] = useState('resumo');
  const [exportando, setExportando] = useState(false);
  const [filtros, setFiltros] = useState<Filtros>({
    dias: 30, inicio: '', fim: '', filaId: '', canal: '', prioridade: '',
    status: '', departamentoId: '', analistaId: '', clienteId: '', categoria: '', assunto: '',
  });
  const [showFiltros, setShowFiltros] = useState(false);
  const [drillDown, setDrillDown] = useState<{ titulo: string; dados: any[] } | null>(null);

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    try {
      const params: Record<string, any> = {};
      if (filtros.inicio) params.inicio = filtros.inicio;
      if (filtros.fim) params.fim = filtros.fim;
      if (filtros.filaId) params.filaId = filtros.filaId;
      if (filtros.canal) params.canal = filtros.canal;
      if (filtros.prioridade) params.prioridade = filtros.prioridade;
      if (filtros.status) params.status = filtros.status;
      if (filtros.departamentoId) params.departamentoId = filtros.departamentoId;
      if (filtros.analistaId) params.analistaId = filtros.analistaId;
      if (filtros.clienteId) params.clienteId = filtros.clienteId;
      if (filtros.categoria) params.categoria = filtros.categoria;
      if (filtros.assunto) params.assunto = filtros.assunto;

      const [relRes, opcoesRes] = await Promise.all([
        api.get('/analytics/relatorios', { params }),
        api.get('/analytics/relatorios/opcoes'),
      ]);
      setDados(relRes.data);
      setOpcoes(opcoesRes.data);
    } catch (err) {
      console.error('Erro ao carregar relatórios:', err);
    } finally {
      setCarregando(false);
    }
  }, [filtros]);

  useEffect(() => { carregarDados(); }, [carregarDados]);

  const setPeriodo = (dias: number) => {
    const fim = new Date();
    const inicio = new Date();
    inicio.setDate(fim.getDate() - (dias - 1));
    setFiltros(f => ({
      ...f, dias,
      inicio: inicio.toISOString().split('T')[0],
      fim: fim.toISOString().split('T')[0],
    }));
  };

  const exportarHtml = async () => {
    setExportando(true);
    try {
      const params: Record<string, any> = { nome: 'Relatório Consolidado de Atendimento' };
      if (filtros.inicio) params.inicio = filtros.inicio;
      if (filtros.fim) params.fim = filtros.fim;
      if (filtros.canal) params.canal = filtros.canal;
      if (filtros.departamentoId) params.departamentoId = filtros.departamentoId;
      if (filtros.analistaId) params.analistaId = filtros.analistaId;
      if (filtros.clienteId) params.clienteId = filtros.clienteId;

      const res = await api.get('/analytics/relatorios/html', { params, responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio-${new Date().toISOString().slice(0, 10)}.html`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erro ao exportar HTML:', err);
    } finally {
      setExportando(false);
    }
  };

  const exportarCsv = async () => {
    try {
      const params: Record<string, any> = {};
      if (filtros.inicio) params.inicio = filtros.inicio;
      if (filtros.fim) params.fim = filtros.fim;
      const res = await api.get('/analytics/relatorios/csv', { params, responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) { console.error('Erro ao exportar CSV:', err); }
  };

  if (carregando && !dados) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!dados) return null;

  const r = dados.resumo;
  const c = dados.comparativo;
  const prev = dados.comparePeriodoAnterior;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white" style={{ fontFamily: 'Lexend, sans-serif' }}>
            Relatórios Consolidados
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Período: {dados.periodo.label} • {r.totalTickets} chamados analisados
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowFiltros(!showFiltros)}
            className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
            <Filter size={16} /> Filtros
          </button>
          <button onClick={exportarHtml} disabled={exportando}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:opacity-50">
            {exportando ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            HTML
          </button>
          <button onClick={exportarCsv}
            className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 transition-colors">
            <FileText size={16} /> CSV
          </button>
          <button onClick={() => window.print()}
            className="flex items-center gap-2 px-3 py-2 bg-slate-600 text-white rounded-lg text-sm hover:bg-slate-700 transition-colors">
            <Printer size={16} /> Imprimir
          </button>
        </div>
      </div>

      {/* Período rápido */}
      <div className="flex gap-2 flex-wrap">
        {PERIODOS.map(p => (
          <button key={p.dias} onClick={() => setPeriodo(p.dias)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filtros.dias === p.dias
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Filtros avançados */}
      {showFiltros && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-900 dark:text-white">Filtros</h3>
            <button onClick={() => setShowFiltros(false)}><X size={18} /></button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-slate-500">Canal</label>
              <select value={filtros.canal} onChange={e => setFiltros(f => ({ ...f, canal: e.target.value }))}
                className="w-full mt-1 px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm">
                <option value="">Todos</option>
                {opcoes?.canais.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">Departamento</label>
              <select value={filtros.departamentoId} onChange={e => setFiltros(f => ({ ...f, departamentoId: e.target.value }))}
                className="w-full mt-1 px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm">
                <option value="">Todos</option>
                {opcoes?.departamentos.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">Atendente</label>
              <select value={filtros.analistaId} onChange={e => setFiltros(f => ({ ...f, analistaId: e.target.value }))}
                className="w-full mt-1 px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm">
                <option value="">Todos</option>
                {opcoes?.analistas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">Cliente</label>
              <select value={filtros.clienteId} onChange={e => setFiltros(f => ({ ...f, clienteId: e.target.value }))}
                className="w-full mt-1 px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm">
                <option value="">Todos</option>
                {opcoes?.clientes.map(cl => <option key={cl.id} value={cl.id}>{cl.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">Prioridade</label>
              <select value={filtros.prioridade} onChange={e => setFiltros(f => ({ ...f, prioridade: e.target.value }))}
                className="w-full mt-1 px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm">
                <option value="">Todas</option>
                {opcoes?.prioridades.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">Status</label>
              <select value={filtros.status} onChange={e => setFiltros(f => ({ ...f, status: e.target.value }))}
                className="w-full mt-1 px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm">
                <option value="">Todos</option>
                {opcoes?.statuses.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">Categoria</label>
              <select value={filtros.categoria} onChange={e => setFiltros(f => ({ ...f, categoria: e.target.value }))}
                className="w-full mt-1 px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm">
                <option value="">Todas</option>
                {opcoes?.categorias.map(ct => <option key={ct} value={ct}>{ct}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">Assunto</label>
              <input value={filtros.assunto} onChange={e => setFiltros(f => ({ ...f, assunto: e.target.value }))}
                placeholder="Buscar..."
                className="w-full mt-1 px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm" />
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.key} onClick={() => setAba(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                aba === tab.key
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
              }`}>
              <Icon size={16} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* ═══════ ABA: RESUMO ═══════ */}
      {aba === 'resumo' && (
        <div className="space-y-6">
          {/* Cards KPI */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <KpiCard label="Total Chamados" valor={String(r.totalTickets)}
              delta={c.deltaTickets} deltaLabel="vs anterior" invertido />
            <KpiCard label="Taxa Resolução" valor={`${r.taxaResolucao}%`}
              delta={c.deltaFechados} invertido />
            <KpiCard label="Tempo Resposta" valor={fmtTempo(r.tempoMedioRespostaMin)}
              delta={c.deltaTempoResposta} invertido />
            <KpiCard label="SLA Cumprido" valor={`${r.taxaSla}%`}
              delta={c.deltaSla} />
            <KpiCard label="CSAT" valor={`${r.csatMedio}/5`}
              delta={c.deltaCsat} />
          </div>

          {/* Cards secundários */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <div className="text-xs text-slate-500 uppercase">Em Aberto</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{r.ticketsAbertos}</div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <div className="text-xs text-slate-500 uppercase">Tempo Resolução</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{r.tempoMedioResolucaoH}h</div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <div className="text-xs text-slate-500 uppercase">FCR</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{r.fcr}%</div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <div className="text-xs text-slate-500 uppercase">Custo Estimado</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{fmtMoeda(dados.custoEstimado.total)}</div>
              <div className="text-xs text-slate-500">{fmtMoeda(dados.custoEstimado.porChamado)}/chamado</div>
            </div>
          </div>

          {/* Comparativo com período anterior */}
          {prev && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Comparativo com Período Anterior</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <CompareItem label="Chamados" atual={r.totalTickets} anterior={prev.totalTickets} />
                <CompareItem label="Resolvidos" atual={r.ticketsFechados} anterior={prev.ticketsFechados} />
                <CompareItem label="Taxa Resol." atual={r.taxaResolucao} anterior={prev.taxaResolucao} sufixo="%" />
                <CompareItem label="TMR" atual={r.tempoMedioRespostaMin} anterior={prev.tempoMedioRespostaMin} sufixo="min" invertido />
                <CompareItem label="CSAT" atual={r.csatMedio} anterior={prev.csatMedio} />
                <CompareItem label="Resolução" atual={r.tempoMedioResolucaoH} anterior={prev.tempoMedioResolucaoH} sufixo="h" invertido />
              </div>
            </div>
          )}

          {/* N1/N2/N3 + Custo */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Classificação Nível</h3>
              <div className="flex gap-4">
                {dados.porNivel.map(n => (
                  <div key={n.nivel} className="flex-1 text-center p-3 rounded-lg" style={{ background: `${CORES_NIVEL[n.nivel]}15` }}>
                    <div className="text-xs font-medium" style={{ color: CORES_NIVEL[n.nivel] }}>{n.nivel}</div>
                    <div className="text-xl font-bold text-slate-900 dark:text-white">{n.total}</div>
                    <div className="text-xs text-slate-500">{fmtMoeda(n.custoTotal)}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Retrabalho & Transferências</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                  <div className="text-xs text-amber-600 dark:text-amber-400">Reaberturas</div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white">{dados.retrabalho.reaberturas}</div>
                  <div className="text-xs text-slate-500">{dados.retrabalho.taxaReabertura}%</div>
                </div>
                <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="text-xs text-blue-600 dark:text-blue-400">Recorrentes</div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white">{dados.retrabalho.chamadosRecorrentes}</div>
                  <div className="text-xs text-slate-500">{dados.retrabalho.taxaRecorrencia}%</div>
                </div>
                <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <div className="text-xs text-purple-600 dark:text-purple-400">Transferências</div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white">{dados.transferencias.total}</div>
                  <div className="text-xs text-slate-500">{dados.transferencias.taxaTransferencia}%</div>
                </div>
                <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                  <div className="text-xs text-emerald-600 dark:text-emerald-400">CSAT Respostas</div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white">{r.csatTotal}</div>
                  <div className="text-xs text-slate-500">{r.csatMedio}/5</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ ABA: VOLUME ═══════ */}
      {aba === 'volume' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Evolução Diária</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dados.tendenciaDiaria}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="total" stroke="#3b82f6" name="Total" strokeWidth={2} />
                <Line type="monotone" dataKey="fechados" stroke="#10b981" name="Fechados" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Por Canal</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={dados.porCanal} dataKey="total" nameKey="valor" cx="50%" cy="50%" outerRadius={80}>
                    {dados.porCanal.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Por Prioridade</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={dados.porPrioridade} dataKey="total" nameKey="valor" cx="50%" cy="50%" outerRadius={80}>
                    {dados.porPrioridade.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Por Categoria</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dados.porCategoria.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="valor" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ═══════ ABA: CLIENTES ═══════ */}
      {aba === 'clientes' && (
        <div className="space-y-6">
          <TabelaOrdenavel
            titulo="Volume por Cliente"
            colunas={['Cliente', 'Chamados', 'Fechados', '% Resol.']}
            dados={dados.porCliente.map(c => ({
              Cliente: c.valor, Chamados: c.total, 'Fechados': c.fechados,
              '% Resol.': c.total > 0 ? `${Math.round((c.fechados / c.total) * 100)}%` : '0%',
            }))}
          />
        </div>
      )}

      {/* ═══════ ABA: ATENDENTES ═══════ */}
      {aba === 'atendentes' && (
        <div className="space-y-6">
          <TabelaOrdenavel
            titulo="Performance por Atendente"
            colunas={['Atendente', 'Atendidos', 'Fechados', 'Taxa Resol.', 'Tempo Médio', 'CSAT']}
            dados={dados.porAnalista.map(a => ({
              Atendente: a.valor, Atendidos: a.atendidos, Fechados: a.fechados,
              'Taxa Resol.': a.atendidos > 0 ? `${Math.round((a.fechados / a.atendidos) * 100)}%` : '0%',
              'Tempo Médio': fmtTempo(a.tempoMedioMin),
              CSAT: a.csatMedio > 0 ? `${a.csatMedio}/5` : '-',
            }))}
          />
        </div>
      )}

      {/* ═══════ ABA: TÉCNICO ═══════ */}
      {aba === 'tecnico' && (
        <div className="space-y-6">
          <TabelaOrdenavel
            titulo="Por Assunto (com Classificação Nível)"
            colunas={['Assunto', 'Chamados', 'Nível']}
            dados={dados.porAssunto.map(a => ({
              Assunto: a.valor, Chamados: a.total, Nível: classificarNivel(a.valor),
            }))}
          />
          <TabelaOrdenavel
            titulo="Por Departamento"
            colunas={['Departamento', 'Chamados', 'Fechados', '%']}
            dados={dados.porDepartamento.map(d => ({
              Departamento: d.valor, Chamados: d.total, Fechados: d.fechados,
              '%': d.total > 0 ? `${Math.round((d.fechados / d.total) * 100)}%` : '0%',
            }))}
          />
        </div>
      )}

      {/* ═══════ ABA: TEMPOS ═══════ */}
      {aba === 'tempos' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Tempo por Tipo de Atividade</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dados.tempoPorTipo}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="valor" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="totalMin" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Minutos" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <TabelaOrdenavel
            titulo="Tempo por Departamento"
            colunas={['Departamento', 'Total Min', 'Horas']}
            dados={dados.tempoPorDepartamento.map(t => ({
              Departamento: t.valor, 'Total Min': t.totalMin, Horas: fmtTempo(t.totalMin),
            }))}
          />
        </div>
      )}

      {/* ═══════ ABA: DECISÃO ═══════ */}
      {aba === 'decisao' && (
        <div className="space-y-6">
          {gerarInsights(dados).map((insight, i) => (
            <div key={i} className={`rounded-xl p-4 border ${
              insight.tipo === 'critico' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' :
              insight.tipo === 'atencao' ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' :
              'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
            }`}>
              <h4 className="font-semibold text-slate-900 dark:text-white mb-2">{insight.titulo}</h4>
              <p className="text-sm text-slate-700 dark:text-slate-300 mb-1">{insight.evidencia}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-2 italic">{insight.interpretacao}</p>
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{insight.acao}</p>
            </div>
          ))}
          {gerarInsights(dados).length === 0 && (
            <p className="text-slate-500 dark:text-slate-400 text-center py-8">
              Nenhum alerta crítico detectado com base nos critérios configurados.
            </p>
          )}
        </div>
      )}

      {/* Drill-down modal */}
      {drillDown && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setDrillDown(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-3xl max-h-[80vh] overflow-auto w-full p-6"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">{drillDown.titulo}</h3>
              <button onClick={() => setDrillDown(null)}><X size={20} /></button>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              {drillDown.dados.length} registros encontrados. Use os filtros para refinar.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-componentes ──────────────────────────────────────────────────────

function KpiCard({ label, valor, delta, deltaLabel, invertido }: {
  label: string; valor: string; delta?: number; deltaLabel?: string; invertido?: boolean;
}) {
  const ruim = invertido ? delta && delta > 0 : delta && delta < 0;
  const bom = invertido ? delta && delta < 0 : delta && delta > 0;
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
      <div className="text-xs text-slate-500 uppercase">{label}</div>
      <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{valor}</div>
      {delta !== undefined && delta !== 0 && (
        <div className={`text-xs mt-1 ${ruim ? 'text-red-500' : bom ? 'text-emerald-500' : 'text-slate-500'}`}>
          {delta > 0 ? '↑' : '↓'} {Math.abs(delta)}{deltaLabel ? ` ${deltaLabel}` : ''}
        </div>
      )}
    </div>
  );
}

function CompareItem({ label, atual, anterior, sufixo, invertido }: {
  label: string; atual: number; anterior: number; sufixo?: string; invertido?: boolean;
}) {
  const delta = anterior > 0 ? ((atual - anterior) / anterior) * 100 : 0;
  const ruim = invertido ? delta > 0 : delta < 0;
  return (
    <div className="text-center p-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-lg font-bold text-slate-900 dark:text-white">{atual}{sufixo || ''}</div>
      <div className={`text-xs ${ruim ? 'text-red-500' : 'text-emerald-500'}`}>
        {delta > 0 ? '+' : ''}{delta.toFixed(1)}% vs anterior
      </div>
    </div>
  );
}

function TabelaOrdenavel({ titulo, colunas, dados }: {
  titulo: string; colunas: string[]; dados: any[];
}) {
  const [sortCol, setSortCol] = useState(colunas[0]);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const dadosOrdenados = [...dados].sort((a, b) => {
    const va = a[sortCol] ?? '';
    const vb = b[sortCol] ?? '';
    const na = parseFloat(String(va).replace(/[^\d,.-]/g, '').replace(',', '.'));
    const nb = parseFloat(String(vb).replace(/[^\d,.-]/g, '').replace(',', '.'));
    if (!isNaN(na) && !isNaN(nb)) return sortDir === 'asc' ? na - nb : nb - na;
    return sortDir === 'asc' ? String(va).localeCompare(String(vb), 'pt-BR') : String(vb).localeCompare(String(va), 'pt-BR');
  });

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
      <h3 className="font-semibold text-slate-900 dark:text-white mb-3">{titulo}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              {colunas.map(c => (
                <th key={c} onClick={() => toggleSort(c)}
                  className="text-left px-3 py-2 text-xs font-medium text-slate-500 cursor-pointer hover:text-slate-700 dark:hover:text-slate-300">
                  {c} {sortCol === c ? (sortDir === 'asc' ? '↑' : '↓') : '⇅'}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dadosOrdenados.map((row, i) => (
              <tr key={i} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                {colunas.map(c => (
                  <td key={c} className="px-3 py-2 text-slate-700 dark:text-slate-300">
                    {c === 'Nível' ? (
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                        row[c] === 'N1' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                        row[c] === 'N2' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>{row[c]}</span>
                    ) : row[c]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Insights de tomada de decisão (ETAPA 19) ─────────────────────────────

function gerarInsights(dados: Relatorio): { titulo: string; evidencia: string; interpretacao: string; acao: string; tipo: 'info' | 'atencao' | 'critico' }[] {
  const insights: { titulo: string; evidencia: string; interpretacao: string; acao: string; tipo: 'info' | 'atencao' | 'critico' }[] = [];
  const r = dados.resumo;

  if (r.totalTickets > 0 && r.ticketsAbertos / r.totalTickets > 0.3) {
    insights.push({
      titulo: '⚠️ Alta taxa de chamados em aberto',
      evidencia: `${(r.ticketsAbertos / r.totalTickets * 100).toFixed(1)}% dos chamados (${r.ticketsAbertos} de ${r.totalTickets}) ainda estão em aberto.`,
      interpretacao: 'Pode indicar sobrecarga da equipe ou gargalo nos processos de resolução.',
      acao: 'Ação: Revisar capacidade da equipe, verificar tickets parados e realocar recursos.',
      tipo: 'atencao',
    });
  }

  if (r.csatMedio > 0 && r.csatMedio < 3.5) {
    insights.push({
      titulo: '⚠️ CSAT abaixo da meta',
      evidencia: `CSAT médio de ${r.csatMedio}/5 com ${r.csatTotal} respostas.`,
      interpretacao: 'Clientes não estão satisfeitos com a qualidade do atendimento.',
      acao: 'Ação: Realizar pesquisa de causas raiz, treinar equipe em comunicação e resolução.',
      tipo: 'atencao',
    });
  }

  const nivelN3 = dados.porNivel.find(n => n.nivel === 'N3');
  if (nivelN3 && nivelN3.total > 0 && r.totalTickets > 0 && (nivelN3.total / r.totalTickets) > 0.25) {
    insights.push({
      titulo: '📊 Alto volume de chamados N3',
      evidencia: `${(nivelN3.total / r.totalTickets * 100).toFixed(1)}% dos chamados são N3 (suporte avançado), custo estimado de ${fmtMoeda(nivelN3.custoTotal)}.`,
      interpretacao: 'Problemas complexos estão consumindo recursos especializados.',
      acao: 'Ação: Criar procedimentos preventivos, melhorar documentação N2 para reduzir escalação.',
      tipo: 'info',
    });
  }

  if (r.taxaSla > 0 && r.taxaSla < 80) {
    insights.push({
      titulo: '🔴 SLA abaixo da meta',
      evidencia: `Apenas ${r.taxaSla}% dos chamados com SLA foram cumpridos.`,
      interpretacao: 'Tempos de resposta estão acima do contratado/estabelecido.',
      acao: 'Ação: Revisar processos de triagem, priorização e atribuição automática.',
      tipo: 'critico',
    });
  }

  if (dados.custoEstimado.porChamado > 100) {
    insights.push({
      titulo: '💰 Custo médio por chamado elevado',
      evidencia: `Custo médio estimado de ${fmtMoeda(dados.custoEstimado.porChamado)} por chamado (total: ${fmtMoeda(dados.custoEstimado.total)}).`,
      interpretacao: 'Proporção elevada de chamados N2/N3 encarece o atendimento.',
      acao: 'Ação: Investir em base de conhecimento, autoatendimento e capacitação N1.',
      tipo: 'info',
    });
  }

  if (dados.porCliente.length > 0) {
    const top = dados.porCliente[0];
    const pct = r.totalTickets > 0 ? (top.total / r.totalTickets * 100) : 0;
    if (pct > 15) {
      insights.push({
        titulo: '📋 Concentração em único cliente',
        evidencia: `"${top.valor}" representa ${pct.toFixed(1)}% dos chamados (${top.total} tickets).`,
        interpretacao: 'Alta dependência de um único cliente pode indicar problema recorrente.',
        acao: 'Ação: Investigar causas recorrentes, propor solução definitiva ou contrato de suporte dedicado.',
        tipo: 'info',
      });
    }
  }

  return insights;
}
