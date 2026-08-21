import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import {
  RefreshCw, TrendingUp, TrendingDown, Clock, CheckCircle, Star, Zap,
  Users, Loader2, BarChart3, AlertTriangle, Brain, Bot, ShieldAlert, Activity,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';

interface Classificacao {
  estado: 'dentro' | 'atencao' | 'fora';
  icone: '🟢' | '🟡' | '🔴';
  texto: string;
}

interface CardIndicador {
  label: string;
  valor: number;
  unidade: string;
  meta: number;
  classificacao: Classificacao;
  delta: number | null;
  deltaLabel: string;
  evolucao: 'melhorou' | 'piorou' | 'estavel';
}

interface Alerta {
  tipo: string;
  titulo: string;
  mensagem: string;
  gravidade: 'info' | 'atencao' | 'critico';
  ticketId: string;
  protocolo: string;
  detalhe?: string;
}

interface EncerramentosAnalista {
  auditados: number;
  prematuros: number;
  resolucoesReais: number;
  reaberturas: number;
  semDados: number;
  notaMedia: number;
}

interface AnalistaIa {
  agenteId: string;
  agenteNome: string;
  tickets: number;
  resolvidos: number;
  tmrMin: number;
  tmeMin: number;
  primeiraRespostaMin: number;
  taxaSla: number;
  csatMedia: number;
  fcr: number;
  retrabalho: number;
  reaberturas: number;
  notaIa: number | null;
  auditoriasIa: number;
  encerramentos: EncerramentosAnalista;
}

interface Insight {
  texto: string;
  gravidade: 'info' | 'atencao' | 'critico';
}

interface DashboardIa {
  atualizadoEm: string;
  periodo: { inicio: string; fim: string; label: string; dias: number };
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
  sla: { total: number; cumprido: number; emRisco: number; violado: number; percentualCumprimento: number };
  primeiraResposta: { total: number; dentroMeta: number; percentualDentro: number };
  porAnalista: AnalistaIa[];
  porDia: { dia: string; total: number; fechados: number }[];
  comparativo: { deltaTickets: number; deltaFechados: number; deltaTempoResposta: number; deltaCsat: number; deltaSla: number };
  topTicketsProblema: { ticketId: string; protocolo: string; cliente: string; assunto: string; tempoHoras: number; csat: number | null }[];
  alertas: Alerta[];
  insights: Insight[];
  fonte: 'claude' | 'local';
}

const INSIGHT_CORES: Record<Insight['gravidade'], string> = {
  info: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800',
  atencao: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800',
  critico: 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/30 border-red-200 dark:border-red-800',
};

const ALERTA_CORES: Record<Alerta['gravidade'], string> = {
  info: 'text-blue-600 bg-blue-50 dark:text-blue-900/30',
  atencao: 'text-amber-600 bg-amber-50 dark:text-amber-900/30',
  critico: 'text-red-600 bg-red-50 dark:text-red-900/30',
};

function formatarTempoMin(min: number): string {
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 24) return m === 0 ? `${h}h` : `${h}h${m}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

function DeltaPill({ valor, sufixo, invertido }: { valor: number | null; sufixo?: string; invertido?: boolean }) {
  if (valor == null) return null;
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

function ClassificacaoPill({ cls }: { cls: Classificacao }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
      cls.estado === 'fora' ? 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/30'
      : cls.estado === 'atencao' ? 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/30'
      : 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30'
    }`} style={{ fontFamily: 'Lexend, sans-serif' }}>
      <span>{cls.icone}</span> {cls.texto}
    </span>
  );
}

export default function DashboardIA() {
  const [data, setData] = useState<DashboardIa | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dias, setDias] = useState(7);

  const carregar = useCallback(async (d: number) => {
    setLoading(true);
    setError('');
    try {
      const { data: res } = await api.get('/analytics/dashboard-ia', { params: { dias: d } });
      setData(res);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao carregar dashboard IA');
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
  const cards: CardIndicador[] = [
    d.cards.totalTickets,
    d.cards.tmr,
    d.cards.tme,
    d.cards.primeiraResposta,
    d.cards.sla,
    d.cards.slaEmRisco,
    d.cards.slaViolado,
    d.cards.tempoTotal,
  ];

  const cardIcon = (label: string) => {
    if (label.includes('Tickets')) return Users;
    if (label.includes('TMR') || label.includes('Tempo Total')) return Clock;
    if (label.includes('Espera')) return Clock;
    if (label.includes('Primeira Resposta')) return Activity;
    if (label.includes('SLA')) return CheckCircle;
    return BarChart3;
  };

  const chartData = d.porDia.map(p => ({ ...p, nome: p.dia }));

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
            <Brain size={24} className="text-violet-600 dark:text-violet-400" />
            Dashboard IA
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
            {d.periodo.label} · Atualizado {new Date(d.atualizadoEm).toLocaleString('pt-BR')}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1">
            {[1, 7, 30].map(p => (
              <button key={p} onClick={() => setDias(p)}
                className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${dias === p ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                style={{ fontFamily: 'Lexend, sans-serif' }}>
                {p === 1 ? 'Hoje' : `${p}d`}
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

      <div className="bg-gradient-to-br from-violet-50 via-indigo-50 to-blue-50 dark:from-violet-900/20 dark:via-indigo-900/20 dark:to-blue-900/20 border border-violet-200 dark:border-violet-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Zap size={18} className="text-violet-600 dark:text-violet-400" />
            <h2 className="font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>
              Insights Gerenciais
            </h2>
          </div>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
            d.fonte === 'claude' ? 'text-violet-600 bg-violet-50 dark:text-violet-400 dark:bg-violet-900/30' : 'text-slate-600 bg-slate-100 dark:text-slate-300 dark:bg-slate-800'
          }`} style={{ fontFamily: 'Lexend, sans-serif' }}>
            {d.fonte === 'claude' ? <Brain size={12} /> : <Bot size={12} />}
            {d.fonte === 'claude' ? 'Claude' : 'Regras locais'}
          </span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {d.insights.map((ins, i) => (
            <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${INSIGHT_CORES[ins.gravidade]}`}>
              <span className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold bg-current opacity-80">
                <span className="text-white">{i + 1}</span>
              </span>
              <p className="text-sm" style={{ fontFamily: 'Lexend, sans-serif' }}>{ins.texto}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map(c => {
          const Icon = cardIcon(c.label);
          return (
            <div key={c.label} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400">
                  <Icon size={18} />
                </div>
                <DeltaPill valor={c.delta} sufixo={c.unidade === '%' ? '%' : undefined} invertido={c.label.includes('TMR') || c.label.includes('Espera') || c.label.includes('Primeira Resposta')} />
              </div>
              <div className="mt-3 space-y-1">
                <div className="text-xl font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>
                  {c.valor}{c.unidade ? ` ${c.unidade === 'min' ? 'min' : c.unidade === 'tickets' ? '' : c.unidade}` : ''}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>{c.label}</div>
                <div className="flex items-center gap-1 flex-wrap">
                  <ClassificacaoPill cls={c.classificacao} />
                  {c.meta > 0 && (
                    <span className="text-[10px] text-slate-400 dark:text-slate-500" style={{ fontFamily: 'Lexend, sans-serif' }}>
                      meta {c.meta}{c.unidade === '%' ? '%' : 'min'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
            <ShieldAlert size={16} className="text-red-500" /> Alertas Ativos
          </h2>
          {d.alertas.length > 0 ? (
            <div className="space-y-2 max-h-[260px] overflow-auto">
              {d.alertas.map(a => (
                <div key={a.ticketId} className={`p-2.5 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ALERTA_CORES[a.gravidade].split(' ')[0]}`} />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200" style={{ fontFamily: 'Lexend, sans-serif' }}>{a.titulo}</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1" style={{ fontFamily: 'Lexend, sans-serif' }}>{a.mensagem}</p>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium" style={{ fontFamily: 'Lexend, sans-serif' }}>#{a.protocolo}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>Nenhum alerta ativo no período.</p>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-4" style={{ fontFamily: 'Khand, sans-serif' }}>
            Evolução de Tickets
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
              <XAxis dataKey="nome" tick={{ fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} width={30} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="total" name="Abertos" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="fechados" name="Resolvidos" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/30">
              <div className="text-xs text-blue-600 dark:text-blue-400 font-medium" style={{ fontFamily: 'Lexend, sans-serif' }}>SLA Cumprido</div>
              <div className="text-lg font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>{d.sla.percentualCumprimento}%</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>{d.sla.cumprido}/{d.sla.total} tickets</div>
            </div>
            <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/30">
              <div className="text-xs text-indigo-600 dark:text-indigo-400 font-medium" style={{ fontFamily: 'Lexend, sans-serif' }}>Primeira Resposta</div>
              <div className="text-lg font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>{d.primeiraResposta.percentualDentro}%</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>{d.primeiraResposta.dentroMeta}/{d.primeiraResposta.total} dentro da meta</div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} className="text-red-600 dark:text-red-400" />
            <h2 className="font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>Tickets Problema</h2>
          </div>
          <div className="space-y-2 max-h-[260px] overflow-auto">
            {d.topTicketsProblema.length > 0 ? d.topTicketsProblema.map(t => (
              <div key={t.ticketId} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-700/40">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-300 font-medium" style={{ fontFamily: 'Lexend, sans-serif' }}>#{t.protocolo} · {t.cliente}</span>
                  <span className="text-red-500 font-semibold" style={{ fontFamily: 'Lexend, sans-serif' }}>{t.tempoHoras}h</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5" style={{ fontFamily: 'Lexend, sans-serif' }}>{t.assunto}</p>
                {t.csat != null && (
                  <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontFamily: 'Lexend, sans-serif' }}>CSAT {t.csat}/5</div>
                )}
              </div>
            )) : (
              <p className="text-sm text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>Nenhum ticket problemático no período.</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
        <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-4" style={{ fontFamily: 'Khand, sans-serif' }}>
          Performance por Analista
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-700">
                <th className="py-2 pr-3 font-medium" style={{ fontFamily: 'Lexend, sans-serif' }}>Analista</th>
                <th className="py-2 px-3 font-medium" style={{ fontFamily: 'Lexend, sans-serif' }}>Tickets</th>
                <th className="py-2 px-3 font-medium" style={{ fontFamily: 'Lexend, sans-serif' }}>FCR</th>
                <th className="py-2 px-3 font-medium" style={{ fontFamily: 'Lexend, sans-serif' }}>CSAT</th>
                <th className="py-2 px-3 font-medium" style={{ fontFamily: 'Lexend, sans-serif' }}>TMR</th>
                <th className="py-2 px-3 font-medium" style={{ fontFamily: 'Lexend, sans-serif' }}>SLA</th>
                <th className="py-2 px-3 font-medium" style={{ fontFamily: 'Lexend, sans-serif' }}>Nota IA</th>
                <th className="py-2 px-3 font-medium" style={{ fontFamily: 'Lexend, sans-serif' }}>Encerramentos</th>
                <th className="py-2 pl-3 font-medium" style={{ fontFamily: 'Lexend, sans-serif' }}>Retrabalho</th>
              </tr>
            </thead>
            <tbody>
              {d.porAnalista.map(a => (
                <tr key={a.agenteId} className="border-b border-slate-50 dark:border-slate-800">
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 flex items-center justify-center text-xs font-semibold flex-shrink-0" style={{ fontFamily: 'Lexend, sans-serif' }}>
                        {(a.agenteNome || '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-700 dark:text-slate-200" style={{ fontFamily: 'Lexend, sans-serif' }}>{a.agenteNome}</div>
                        <div className="text-[10px] text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>{a.resolvidos} resolvidos</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300" style={{ fontFamily: 'Lexend, sans-serif' }}>{a.tickets}</td>
                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300" style={{ fontFamily: 'Lexend, sans-serif' }}>{a.fcr}%</td>
                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300" style={{ fontFamily: 'Lexend, sans-serif' }}>{a.csatMedia ? `${a.csatMedia}/5` : '—'}</td>
                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300" style={{ fontFamily: 'Lexend, sans-serif' }}>{a.tmrMin ? formatarTempoMin(a.tmrMin) : '—'}</td>
                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300" style={{ fontFamily: 'Lexend, sans-serif' }}>{a.taxaSla}%</td>
                  <td className="py-2.5 px-3">
                    {a.notaIa != null ? (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                        a.notaIa >= 8 ? 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30'
                        : a.notaIa >= 6 ? 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/30'
                        : 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/30'
                      }`} style={{ fontFamily: 'Lexend, sans-serif' }}>
                        {a.notaIa}/10
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>—</span>
                    )}
                    {a.auditoriasIa > 0 && (
                      <span className="text-[10px] text-slate-400 block" style={{ fontFamily: 'Lexend, sans-serif' }}>{a.auditoriasIa} auditorias</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex flex-wrap gap-1">
                      {a.encerramentos.auditados > 0 ? (
                        <>
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-[10px] font-semibold text-slate-500 dark:text-slate-300" style={{ fontFamily: 'Lexend, sans-serif' }}>
                            {a.encerramentos.auditados} aud.
                          </span>
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-red-50 dark:bg-red-900/30 text-[10px] font-semibold text-red-600 dark:text-red-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
                            {a.encerramentos.prematuros} premat.
                          </span>
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-900/30 text-[10px] font-semibold text-amber-600 dark:text-amber-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
                            {a.encerramentos.reaberturas} reab.
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>—</span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 pl-3">
                    <div className="flex flex-wrap gap-1">
                      {a.retrabalho > 0 && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-orange-50 dark:bg-orange-900/30 text-[10px] font-semibold text-orange-600 dark:text-orange-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
                          {a.retrabalho} retrab.
                        </span>
                      )}
                      {a.reaberturas > 0 && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-red-50 dark:bg-red-900/30 text-[10px] font-semibold text-red-600 dark:text-red-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
                          {a.reaberturas} reab.
                        </span>
                      )}
                      {a.retrabalho === 0 && a.reaberturas === 0 && (
                        <span className="text-xs text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>—</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}