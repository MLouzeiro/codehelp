import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import {
  RefreshCw, Download, FileText, FileSpreadsheet, Printer, TrendingUp, TrendingDown, Clock,
  CheckCircle, Star, Zap, Users, Building2, FolderOpen, Layers, Loader2, Timer, Cpu, Rocket, Calendar,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';

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

interface Resumo {
  totalTickets: number; ticketsFechados: number; ticketsAbertos: number; taxaResolucao: number;
  tempoMedioRespostaMin: number; tempoMedioResolucaoH: number; slaCumprido: number; slaTotal: number;
  taxaSla: number; csatMedio: number; csatTotal: number; fcr: number;
}

interface Comparativo {
  deltaTickets: number; deltaFechados: number; deltaTempoResposta: number;
  deltaTempoResolucao: number; deltaCsat: number; deltaSla: number; deltaFcr: number;
}

interface Relatorio {
  atualizadoEm: string;
  periodo: { inicio: string; fim: string; label: string; dias: number };
  resumo: Resumo;
  comparativo: Comparativo;
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
}

interface Filtros {
  dias: number;
  inicio: string;
  fim: string;
  filaId: string;
  canal: string;
  prioridade: string;
  status: string;
  departamentoId: string;
  analistaId: string;
  clienteId: string;
  categoria: string;
  assunto: string;
}

const CORES = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#ec4899', '#f97316'];

const TIPO_LABEL: Record<string, string> = {
  dev: 'Desenvolvimento', suporte: 'Suporte', implantacao: 'Implantação',
  outro_setor: 'Outro Setor', treinamento: 'Treinamento', reuniao: 'Reunião', outro: 'Outro',
};

function formatarTempo(minutos: number): string {
  if (minutos < 60) return `${minutos}min`;
  const horas = Math.floor(minutos / 60);
  const mins = minutos % 60;
  if (horas < 24) return mins === 0 ? `${horas}h` : `${horas}h${mins}m`;
  const dias = Math.floor(horas / 24);
  return `${dias}d ${horas % 24}h`;
}

function DeltaPill({ valor, sufixo, invertido }: { valor: number; sufixo?: string; invertido?: boolean }) {
  const ruim = invertido ? valor > 0 : valor < 0;
  const bom = invertido ? valor < 0 : valor > 0;
  const Icon = valor > 0 ? TrendingUp : valor < 0 ? TrendingDown : null;
  const cor = ruim ? 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/30'
    : bom ? 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30'
    : 'text-slate-500 bg-slate-100 dark:text-slate-400 dark:bg-slate-800';
  const sinal = valor > 0 ? '+' : '';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cor}`} style={{ fontFamily: 'Lexend, sans-serif' }}>
      {Icon && <Icon size={12} />}
      {sinal}{valor}{sufixo || ''}
    </span>
  );
}

function aba(label: string, ativo: boolean, onClick: () => void) {
  return (
    <button
      key={label}
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${ativo
        ? 'bg-blue-600 text-white'
        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
      style={{ fontFamily: 'Lexend, sans-serif' }}
    >
      {label}
    </button>
  );
}

export default function RelatorioAnalitico() {
  const [opcoes, setOpcoes] = useState<Opcoes | null>(null);
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'desempenho' | 'tempo'>('desempenho');
  const [filtros, setFiltros] = useState<Filtros>({
    dias: 30, inicio: '', fim: '', filaId: '', canal: '', prioridade: '', status: '',
    departamentoId: '', analistaId: '', clienteId: '', categoria: '', assunto: '',
  });

  useEffect(() => {
    api.get('/analytics/relatorios/opcoes')
      .then(({ data }) => setOpcoes(data))
      .catch(() => {});
  }, []);

  const montarParams = useCallback((f: Filtros) => {
    const params: Record<string, string> = {};
    const fim = f.fim || new Date().toISOString();
    if (f.inicio) {
      params.inicio = new Date(f.inicio).toISOString();
      params.fim = new Date(fim).toISOString();
    } else {
      const dFim = new Date();
      const dIni = new Date();
      dIni.setDate(dFim.getDate() - (f.dias - 1));
      params.inicio = dIni.toISOString();
      params.fim = dFim.toISOString();
    }
    if (f.filaId) params.filaId = f.filaId;
    if (f.canal) params.canal = f.canal;
    if (f.prioridade) params.prioridade = f.prioridade;
    if (f.status) params.status = f.status;
    if (f.departamentoId) params.departamentoId = f.departamentoId;
    if (f.analistaId) params.analistaId = f.analistaId;
    if (f.clienteId) params.clienteId = f.clienteId;
    if (f.categoria) params.categoria = f.categoria;
    if (f.assunto.trim()) params.assunto = f.assunto.trim();
    return params;
  }, []);

  const carregar = useCallback(async (f: Filtros) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/analytics/relatorios', { params: montarParams(f) });
      setRelatorio(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao carregar relatório');
    } finally {
      setLoading(false);
    }
  }, [montarParams]);

  useEffect(() => {
    carregar(filtros);
  }, [carregar, filtros]);

  const setCampo = (campo: keyof Filtros, valor: string) => {
    setFiltros(prev => {
      const next = { ...prev, [campo]: valor };
      if (campo === 'dias') {
        next.inicio = '';
        next.fim = '';
      }
      return next;
    });
  };

  const limpar = () => {
    setFiltros({ dias: 30, inicio: '', fim: '', filaId: '', canal: '', prioridade: '', status: '', departamentoId: '', analistaId: '', clienteId: '', categoria: '', assunto: '' });
  };

  const urlExportar = (tipo: 'csv' | 'pdf' | 'excel') => {
    const params = new URLSearchParams(montarParams(filtros));
    return `${window.location.origin}/api/analytics/relatorios/${tipo}?${params.toString()}`;
  };

  const selectCls = 'px-2.5 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg text-sm text-slate-700 dark:text-slate-200';
  const inputCls = 'px-2.5 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg text-sm text-slate-700 dark:text-slate-200';

  if (loading && !relatorio) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  const r = relatorio!;
  const cmp = r.comparativo;

  const cards = [
    { label: 'Total de Tickets', valor: String(r.resumo.totalTickets), icon: Zap, cor: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/30', delta: <DeltaPill valor={cmp.deltaTickets} /> },
    { label: 'Resolvidos', valor: `${r.resumo.ticketsFechados} (${r.resumo.taxaResolucao}%)`, icon: CheckCircle, cor: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30', delta: <DeltaPill valor={cmp.deltaFechados} /> },
    { label: 'Tempo Médio Resposta', valor: formatarTempo(r.resumo.tempoMedioRespostaMin), icon: Clock, cor: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/30', delta: <DeltaPill valor={cmp.deltaTempoResposta} sufixo="min" invertido /> },
    { label: 'Tempo Médio Resolução', valor: `${r.resumo.tempoMedioResolucaoH}h`, icon: Clock, cor: 'text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-900/30', delta: <DeltaPill valor={cmp.deltaTempoResolucao} sufixo="h" invertido /> },
    { label: 'SLA Cumprido', valor: `${r.resumo.taxaSla}%`, icon: TrendingUp, cor: 'text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-900/30', delta: <DeltaPill valor={cmp.deltaSla} sufixo="%" /> },
    { label: 'CSAT Médio', valor: `${r.resumo.csatMedio}/5`, icon: Star, cor: 'text-pink-600 bg-pink-50 dark:text-pink-400 dark:bg-pink-900/30', delta: <DeltaPill valor={cmp.deltaCsat} /> },
    { label: 'FCR', valor: `${r.resumo.fcr}%`, icon: Zap, cor: 'text-cyan-600 bg-cyan-50 dark:text-cyan-400 dark:bg-cyan-900/30', delta: <DeltaPill valor={cmp.deltaFcr} sufixo="%" /> },
    { label: 'Abertos Agora', valor: String(r.resumo.ticketsAbertos), icon: Users, cor: 'text-slate-600 bg-slate-100 dark:text-slate-300 dark:bg-slate-800' },
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>
            Relatório Analítico
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
            Período: {r.periodo.label}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => carregar(filtros)}
            className="flex items-center gap-2 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            style={{ fontFamily: 'Lexend, sans-serif' }}
          >
            <RefreshCw size={14} /> Atualizar
          </button>
          <button
            onClick={() => window.open(urlExportar('csv'), '_blank')}
            className="flex items-center gap-2 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            style={{ fontFamily: 'Lexend, sans-serif' }}
          >
            <Download size={14} /> CSV
          </button>
          <button
            onClick={() => window.open(urlExportar('excel'), '_blank')}
            className="flex items-center gap-2 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            style={{ fontFamily: 'Lexend, sans-serif' }}
          >
            <FileSpreadsheet size={14} /> Excel
          </button>
          <button
            onClick={() => window.open(urlExportar('pdf'), '_blank')}
            className="flex items-center gap-2 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            style={{ fontFamily: 'Lexend, sans-serif' }}
          >
            <FileText size={14} /> PDF
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            style={{ fontFamily: 'Lexend, sans-serif' }}
          >
            <Printer size={14} /> Imprimir
          </button>
        </div>
      </div>

      {/* ── Barra de filtros combinados ── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide" style={{ fontFamily: 'Lexend, sans-serif' }}>
            Período:
          </span>
          {[{ v: 7, l: '7 dias' }, { v: 14, l: '14 dias' }, { v: 30, l: '30 dias' }, { v: 90, l: '90 dias' }].map(p => (
            <button
              key={p.v}
              onClick={() => setCampo('dias', String(p.v))}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${filtros.dias === p.v && !filtros.inicio
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
              style={{ fontFamily: 'Lexend, sans-serif' }}
            >
              {p.l}
            </button>
          ))}
          <input type="date" value={filtros.inicio} onChange={e => setCampo('inicio', e.target.value)} className={inputCls} />
          <input type="date" value={filtros.fim} onChange={e => setCampo('fim', e.target.value)} className={inputCls} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {opcoes && (
            <>
              <select value={filtros.filaId} onChange={e => setCampo('filaId', e.target.value)} className={selectCls}>
                <option value="">Todas as filas</option>
                {opcoes.filas.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
              <select value={filtros.canal} onChange={e => setCampo('canal', e.target.value)} className={selectCls}>
                <option value="">Todos os canais</option>
                {opcoes.canais.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={filtros.prioridade} onChange={e => setCampo('prioridade', e.target.value)} className={selectCls}>
                <option value="">Todas prioridades</option>
                {opcoes.prioridades.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select value={filtros.status} onChange={e => setCampo('status', e.target.value)} className={selectCls}>
                <option value="">Todos status</option>
                {opcoes.statuses.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={filtros.departamentoId} onChange={e => setCampo('departamentoId', e.target.value)} className={selectCls}>
                <option value="">Todos departamentos</option>
                {opcoes.departamentos.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
              </select>
              <select value={filtros.analistaId} onChange={e => setCampo('analistaId', e.target.value)} className={selectCls}>
                <option value="">Todos analistas</option>
                {opcoes.analistas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <select value={filtros.clienteId} onChange={e => setCampo('clienteId', e.target.value)} className={selectCls}>
                <option value="">Todos clientes</option>
                {opcoes.clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
              <select value={filtros.categoria} onChange={e => setCampo('categoria', e.target.value)} className={selectCls}>
                <option value="">Todas categorias</option>
                {opcoes.categorias.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input
                type="text"
                placeholder="Assunto..."
                value={filtros.assunto}
                onChange={e => setCampo('assunto', e.target.value)}
                className={inputCls}
              />
            </>
          )}
          <button
            onClick={limpar}
            className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
            style={{ fontFamily: 'Lexend, sans-serif' }}
          >
            Limpar filtros
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm" style={{ fontFamily: 'Lexend, sans-serif' }}>
          {error}
        </div>
      )}

      {/* ── Cards de indicadores ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map(c => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
              <div className="flex items-start justify-between">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.cor}`}>
                  <Icon size={18} />
                </div>
                {c.delta}
              </div>
              <div className="mt-3">
                <div className="text-xl font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>{c.valor}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>{c.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {aba('Desempenho', tab === 'desempenho', () => setTab('desempenho'))}
        {aba('Tempo / Dev / Implantação', tab === 'tempo', () => setTab('tempo'))}
      </div>

      {tab === 'desempenho' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
              <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-4" style={{ fontFamily: 'Khand, sans-serif' }}>
                Tickets por Dia
              </h2>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={r.tendenciaDiaria}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                  <XAxis dataKey="dia" tick={{ fontSize: 10 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} width={30} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="total" name="Abertos" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="fechados" name="Resolvidos" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
              <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-4" style={{ fontFamily: 'Khand, sans-serif' }}>
                Por Canal
              </h2>
              {r.porCanal.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={r.porCanal} dataKey="total" nameKey="valor" innerRadius={55} outerRadius={85} paddingAngle={3}>
                      {r.porCanal.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>Sem dados no período</p>}
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
              <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-4" style={{ fontFamily: 'Khand, sans-serif' }}>
                Por Prioridade
              </h2>
              {r.porPrioridade.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={r.porPrioridade}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                    <XAxis dataKey="valor" tick={{ fontSize: 10 }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} width={30} />
                    <Tooltip />
                    <Bar dataKey="total" name="Total" radius={[4, 4, 0, 0]}>
                      {r.porPrioridade.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>Sem dados no período</p>}
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
              <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-4" style={{ fontFamily: 'Khand, sans-serif' }}>
                Top Categorias
              </h2>
              {r.porCategoria.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={r.porCategoria}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                    <XAxis dataKey="valor" tick={{ fontSize: 10 }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} width={30} />
                    <Tooltip />
                    <Bar dataKey="total" name="Total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="fechados" name="Resolvidos" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>Sem dados no período</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-3">
                <Users size={16} className="text-blue-600 dark:text-blue-400" />
                <h2 className="font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>Por Analista</h2>
              </div>
              <div className="space-y-2 max-h-[320px] overflow-auto">
                {r.porAnalista.map(a => (
                  <div key={a.valor} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-300 truncate" style={{ fontFamily: 'Lexend, sans-serif' }}>{a.valor}</span>
                    <span className="text-slate-400 text-xs" style={{ fontFamily: 'Lexend, sans-serif' }}>
                      {a.atendidos} · {a.fechados} fechados · {formatarTempo(a.tempoMedioMin)} · CSAT {a.csatMedio || '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-3">
                <Building2 size={16} className="text-indigo-600 dark:text-indigo-400" />
                <h2 className="font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>Por Cliente</h2>
              </div>
              <div className="space-y-2 max-h-[320px] overflow-auto">
                {r.porCliente.map(c => (
                  <div key={c.valor} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-300 truncate" style={{ fontFamily: 'Lexend, sans-serif' }}>{c.valor}</span>
                    <span className="text-slate-400 text-xs" style={{ fontFamily: 'Lexend, sans-serif' }}>{c.total} · {c.fechados} fechados</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-2 mb-3">
                  <FolderOpen size={16} className="text-cyan-600 dark:text-cyan-400" />
                  <h2 className="font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>Por Departamento</h2>
                </div>
                <div className="space-y-2">
                  {r.porDepartamento.map(d => (
                    <div key={d.valor} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-300 truncate" style={{ fontFamily: 'Lexend, sans-serif' }}>{d.valor}</span>
                      <span className="text-slate-400 text-xs" style={{ fontFamily: 'Lexend, sans-serif' }}>{d.total} · {d.fechados} resolvidos</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-2 mb-3">
                  <Layers size={16} className="text-amber-600 dark:text-amber-400" />
                  <h2 className="font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>Por Fila / Assunto</h2>
                </div>
                <div className="space-y-2">
                  {r.porFila.map(f => (
                    <div key={f.valor} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-300 truncate" style={{ fontFamily: 'Lexend, sans-serif' }}>{f.valor}</span>
                      <span className="text-slate-400 text-xs" style={{ fontFamily: 'Lexend, sans-serif' }}>{f.total}</span>
                    </div>
                  ))}
                  {r.porAssunto.slice(0, 5).map(a => (
                    <div key={a.valor} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-300 truncate" style={{ fontFamily: 'Lexend, sans-serif' }}>· {a.valor}</span>
                      <span className="text-slate-400 text-xs" style={{ fontFamily: 'Lexend, sans-serif' }}>{a.total}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'tempo' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-4">
              <Timer size={16} className="text-blue-600 dark:text-blue-400" />
              <h2 className="font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>
                Tempo por Tipo (Timetracking)
              </h2>
            </div>
            {r.tempoPorTipo.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={r.tempoPorTipo.map(t => ({ ...t, valor: TIPO_LABEL[t.valor] || t.valor }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                  <XAxis dataKey="valor" tick={{ fontSize: 10 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} width={35} />
                  <Tooltip />
                  <Bar dataKey="totalMin" name="Minutos" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>Sem apontamentos no período</p>}
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-4">
              <Timer size={16} className="text-indigo-600 dark:text-indigo-400" />
              <h2 className="font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>
                Tempo por Departamento
              </h2>
            </div>
            {r.tempoPorDepartamento.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={r.tempoPorDepartamento}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                  <XAxis dataKey="valor" tick={{ fontSize: 10 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} width={35} />
                  <Tooltip />
                  <Bar dataKey="totalMin" name="Minutos" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>Sem dados no período</p>}
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-4">
              <Cpu size={16} className="text-cyan-600 dark:text-cyan-400" />
              <h2 className="font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>
                Desenvolvimento
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-cyan-50 dark:bg-cyan-900/20 p-4">
                <div className="text-2xl font-semibold text-cyan-700 dark:text-cyan-300" style={{ fontFamily: 'Khand, sans-serif' }}>{r.horasDev.totalH}h</div>
                <div className="text-xs text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>Total de horas dev</div>
              </div>
              <div className="rounded-xl bg-sky-50 dark:bg-sky-900/20 p-4">
                <div className="text-2xl font-semibold text-sky-700 dark:text-sky-300" style={{ fontFamily: 'Khand, sans-serif' }}>{r.horasDev.porTicket}h</div>
                <div className="text-xs text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>Média por ticket</div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-4">
              <Rocket size={16} className="text-fuchsia-600 dark:text-fuchsia-400" />
              <h2 className="font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>
                Implantação
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-fuchsia-50 dark:bg-fuchsia-900/20 p-4">
                <div className="text-2xl font-semibold text-fuchsia-700 dark:text-fuchsia-300" style={{ fontFamily: 'Khand, sans-serif' }}>{r.implantacoes.total}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>Implantações ({r.implantacoes.concluidas} concluídas)</div>
              </div>
              <div className="rounded-xl bg-purple-50 dark:bg-purple-900/20 p-4">
                <div className="text-2xl font-semibold text-purple-700 dark:text-purple-300" style={{ fontFamily: 'Khand, sans-serif' }}>{r.implantacoes.mediaHorasDev}h</div>
                <div className="text-xs text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>Média horas dev / implantação</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}