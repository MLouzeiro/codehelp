import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import {
  RefreshCw, TrendingUp, TrendingDown, Clock, CheckCircle, Star, Zap,
  MessageSquare, Building2, FolderOpen, Users, Loader2, BarChart3, AlertTriangle, Activity,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts';
import { AcronymText } from '../../components/AcronymText';

interface DashboardExecutivo {
  atualizadoEm: string;
  periodo: { inicio: string; fim: string; label: string; dias: number };
  resumo: {
    totalTickets: number; ticketsFechados: number; ticketsAbertos: number; taxaResolucao: number;
    tempoMedioRespostaMin: number; tempoMedioResolucaoH: number;
    slaCumprido: number; slaTotal: number; taxaSla: number;
    csatMedio: number; csatTotal: number; fcr: number;
  };
  tendenciaDiaria: { dia: string; total: number; fechados: number }[];
  statusPorDia: { date: string; [k: string]: string | number }[];
  statuses: string[];
  porEtapa: { etapa: string; total: number }[];
  porCanal: { canal: string; total: number }[];
  porCategoria: { categoria: string; total: number }[];
  porDepartamento: { departamento: string; total: number; fechados: number }[];
  porAgente: { agente: string; atendidos: number; fechados: number; tempoMedioMin: number; csatMedio: number }[];
  tempoMedioPorFila: { fila: string; tempoMedioMin: number; total: number }[];
  csatTrending: { date: string; media: number; total: number }[];
  comparativo: { deltaTickets: number; deltaFechados: number; deltaTempoResposta: number; deltaCsat: number };
  alertas: Array<{
    nivel: 'info' | 'atencao' | 'critico';
    tipo: string;
    titulo: string;
    mensagem: string;
    contagem?: number;
    link?: string;
  }>;
}

const CANAL_CORES = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#ec4899'];
const ETAPA_CORES: Record<string, string> = {
  fila: '#94a3b8', triagem: '#f59e0b', em_atendimento: '#3b82f6',
  aguardando_cliente: '#8b5cf6', aguardando_os: '#06b6d4', concluido: '#10b981',
};

function formatarTempoMin(min: number): string {
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 24) return m === 0 ? `${h}h` : `${h}h${m}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
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

export default function DashboardExecutivo() {
  const [data, setData] = useState<DashboardExecutivo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dias, setDias] = useState(30);

  const carregar = useCallback(async (d: number) => {
    setLoading(true);
    setError('');
    try {
      const { data: res } = await api.get('/analytics/executivo', { params: { dias: d } });
      setData(res);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao carregar dashboard executivo');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(dias); }, [dias, carregar]);

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

  const d = data!;
  const cmp = d.comparativo;

  const cards = [
    { label: 'Total de Tickets', valor: String(d.resumo.totalTickets), icon: MessageSquare, cor: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/30', delta: <DeltaPill valor={cmp.deltaTickets} /> },
    { label: 'Resolvidos', valor: `${d.resumo.ticketsFechados} (${d.resumo.taxaResolucao}%)`, icon: CheckCircle, cor: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30', delta: <DeltaPill valor={cmp.deltaFechados} /> },
    { label: 'Abertos Agora', valor: String(d.resumo.ticketsAbertos), icon: AlertTriangle, cor: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/30' },
    { label: 'Tempo Médio Resposta', valor: formatarTempoMin(d.resumo.tempoMedioRespostaMin), icon: Clock, cor: 'text-violet-600 bg-violet-50 dark:text-violet-400 dark:bg-violet-900/30', delta: <DeltaPill valor={cmp.deltaTempoResposta} sufixo="min" invertido /> },
    { label: 'Tempo Médio Resolução', valor: `${d.resumo.tempoMedioResolucaoH}h`, icon: Clock, cor: 'text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-900/30' },
    { label: 'SLA Cumprido', valor: `${d.resumo.taxaSla}%`, icon: TrendingUp, cor: 'text-cyan-600 bg-cyan-50 dark:text-cyan-400 dark:bg-cyan-900/30' },
    { label: 'CSAT Médio', valor: `${d.resumo.csatMedio}/5`, icon: Star, cor: 'text-pink-600 bg-pink-50 dark:text-pink-400 dark:bg-pink-900/30', delta: <DeltaPill valor={cmp.deltaCsat} /> },
    { label: 'FCR', valor: `${d.resumo.fcr}%`, icon: Zap, cor: 'text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-900/30' },
  ];

  const statusColors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#94a3b8'];
  const statusChartData = d.statusPorDia.map(sd => {
    const out: any = { ...sd };
    d.statuses.forEach(st => { if (!(st in out)) out[st] = 0; });
    return out;
  });

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
            <BarChart3 size={24} className="text-blue-600 dark:text-blue-400" />
            Dashboard Executivo
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
            {d.periodo.label} · Atualizado {new Date(d.atualizadoEm).toLocaleString('pt-BR')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1">
            {[7, 30, 90].map(p => (
              <button key={p} onClick={() => setDias(p)}
                className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${dias === p ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                style={{ fontFamily: 'Lexend, sans-serif' }}>
                {p}d
              </button>
            ))}
          </div>
          <button onClick={() => carregar(dias)}
            className="flex items-center gap-2 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            style={{ fontFamily: 'Lexend, sans-serif' }}>
            <RefreshCw size={14} /> Atualizar
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm" style={{ fontFamily: 'Lexend, sans-serif' }}>{error}</div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map(c => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
              <div className="flex items-start justify-between">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.cor}`}><Icon size={18} /></div>
                {c.delta}
              </div>
              <div className="mt-3">
                <div className="text-xl font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>{c.valor}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}><AcronymText text={c.label} /></div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── ALERTAS E ATENÇÃO ──────────────────────────────────────── */}
      {d.alertas && d.alertas.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
            <AlertTriangle size={16} className="text-amber-500" /> Alertas e Atenção
            <span className="text-xs font-normal text-slate-400 dark:text-slate-500" style={{ fontFamily: 'Lexend, sans-serif' }}>
              baseado em dados reais do período
            </span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {d.alertas.map((a, i) => {
              const styleNivel =
                a.nivel === 'critico'
                  ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
                  : a.nivel === 'atencao'
                    ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20'
                    : 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20';
              const corIcone =
                a.nivel === 'critico'
                  ? 'text-red-600 dark:text-red-400'
                  : a.nivel === 'atencao'
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-blue-600 dark:text-blue-400';
              const rotulo =
                a.nivel === 'critico' ? 'CRÍTICO' : a.nivel === 'atencao' ? 'ATENÇÃO' : 'INFO';
              return (
                <div key={i} className={`flex items-start gap-3 rounded-xl border p-3 ${styleNivel}`}>
                  <AlertTriangle size={18} className={`shrink-0 mt-0.5 ${corIcone}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Lexend, sans-serif' }}>{a.titulo}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${a.nivel === 'critico' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : a.nivel === 'atencao' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'}`}>{rotulo}</span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5" style={{ fontFamily: 'Lexend, sans-serif' }}>{a.mensagem}</p>
                    {a.link && (
                      <a href={a.link} className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline mt-1 inline-block" style={{ fontFamily: 'Lexend, sans-serif' }}>Ver detalhes →</a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
            <Activity size={16} className="text-blue-600" /> Tendência de Tickets
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={d.tendenciaDiaria}>
              <defs>
                <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gFech" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
              <XAxis dataKey="dia" tick={{ fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} width={30} />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="total" name="Abertos" stroke="#3b82f6" fill="url(#gTotal)" />
              <Area type="monotone" dataKey="fechados" name="Resolvidos" stroke="#10b981" fill="url(#gFech)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
            <TrendingUp size={16} className="text-cyan-600" /> Tickets por Status (diário)
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={statusChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} width={30} />
              <Tooltip />
              <Legend />
              {d.statuses.map((st, i) => (
                <Bar key={st} dataKey={st} stackId="a" fill={statusColors[i % statusColors.length]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
            <Activity size={16} className="text-slate-600 dark:text-slate-400" /> Tickets por Etapa
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={d.porEtapa} dataKey="total" nameKey="etapa" innerRadius={55} outerRadius={85} paddingAngle={3}>
                {d.porEtapa.map((e, i) => (
                  <Cell key={e.etapa} fill={ETAPA_CORES[e.etapa] || CANAL_CORES[i % CANAL_CORES.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
            <MessageSquare size={16} className="text-violet-600" /> Tickets por Canal
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={d.porCanal} dataKey="total" nameKey="canal" innerRadius={55} outerRadius={85} paddingAngle={3}>
                {d.porCanal.map((_, i) => (
                  <Cell key={i} fill={CANAL_CORES[i % CANAL_CORES.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
            <Star size={16} className="text-pink-600" /> Evolução do <AcronymText text="CSAT" />
          </h2>
          {d.csatTrending.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={d.csatTrending}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
                <YAxis domain={[0, 5]} tick={{ fontSize: 10 }} tickLine={false} width={30} />
                <Tooltip />
                <Line type="monotone" dataKey="media" name="CSAT médio" stroke="#ec4899" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>Sem respostas CSAT no período</p>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
            <Clock size={16} className="text-indigo-600" /> Tempo Médio por Fila
          </h2>
          {d.tempoMedioPorFila.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={d.tempoMedioPorFila}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                <XAxis dataKey="fila" tick={{ fontSize: 10 }} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} width={40} />
                <Tooltip formatter={(v) => [formatarTempoMin(Number(v)), 'Tempo médio']} />
                <Bar dataKey="tempoMedioMin" name="Tempo (min)" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>Sem dados de fila no período</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-3">
            <Building2 size={16} className="text-blue-600 dark:text-blue-400" />
            <h2 className="font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>Top Clientes por Departamento</h2>
          </div>
          <div className="space-y-2 max-h-[260px] overflow-auto">
            {d.porDepartamento.map(dep => (
              <div key={dep.departamento} className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-300 truncate" style={{ fontFamily: 'Lexend, sans-serif' }}>{dep.departamento}</span>
                <span className="text-slate-400 text-xs" style={{ fontFamily: 'Lexend, sans-serif' }}>{dep.total} · {dep.fechados} resolvidos</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-3">
            <Users size={16} className="text-emerald-600 dark:text-emerald-400" />
            <h2 className="font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>Performance por Agente</h2>
          </div>
          <div className="space-y-3 max-h-[260px] overflow-auto">
            {d.porAgente.map(a => (
              <div key={a.agente} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-semibold flex-shrink-0" style={{ fontFamily: 'Lexend, sans-serif' }}>
                    {a.agente.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate" style={{ fontFamily: 'Lexend, sans-serif' }}>{a.agente}</div>
                    <div className="text-xs text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
                      {a.atendidos} atendidos · {formatarTempoMin(a.tempoMedioMin)} médio
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-200" style={{ fontFamily: 'Lexend, sans-serif' }}>{a.csatMedio ? `${a.csatMedio}/5` : '—'}</div>
                   <div className="text-xs text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}><AcronymText text="CSAT" /></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-3">
            <FolderOpen size={16} className="text-orange-600 dark:text-orange-400" />
            <h2 className="font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>Categorias</h2>
          </div>
          <div className="space-y-2">
            {d.porCategoria.map(c => (
              <div key={c.categoria} className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-300 truncate" style={{ fontFamily: 'Lexend, sans-serif' }}>{c.categoria}</span>
                <span className="text-slate-400 text-xs" style={{ fontFamily: 'Lexend, sans-serif' }}>{c.total}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
