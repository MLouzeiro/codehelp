import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../services/api';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { TrendingUp, Clock, FileText, MessageSquare, Users, AlertTriangle, Lightbulb, Target, BarChart3, Activity, Zap, Building2, Star, Bot, BellRing, ShieldAlert, ShieldCheck, RefreshCw, Circle, ChevronRight } from 'lucide-react';
import AlertDetailDrawer from '../../components/AlertDetailDrawer';

const COLORS = ['#3B82F6', '#60A5FA', '#2563EB', '#93C5FD', '#1D4ED8', '#BFDBFE'];

const NIVEL_ALERTA: Record<string, { label: string; bg: string; border: string; text: string; dot: string }> = {
  critico: { label: 'Crítico', bg: 'bg-red-50 dark:bg-red-950/40', border: 'border-red-200 dark:border-red-900/50', text: 'text-red-700 dark:text-red-400', dot: 'bg-red-500' },
  atencao: { label: 'Atenção', bg: 'bg-amber-50 dark:bg-amber-950/40', border: 'border-amber-200 dark:border-amber-900/50', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
  info: { label: 'Informação', bg: 'bg-blue-50 dark:bg-blue-950/40', border: 'border-blue-200 dark:border-blue-900/50', text: 'text-blue-700 dark:text-blue-400', dot: 'bg-blue-500' },
};

function formatarTempo(minutos: number): string {
  if (minutos < 60) return `${minutos}min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m > 0 ? `${h}h${m}min` : `${h}h`;
}

function formatarDelta(valor: number, invertido = false): { texto: string; cor: string } | null {
  if (valor === 0) return null;
  const positivo = invertido ? valor < 0 : valor > 0;
  const seta = valor > 0 ? '↑' : '↓';
  const abs = Math.abs(valor);
  return {
    texto: `${seta} ${abs}%`,
    cor: positivo ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
  };
}

export default function Dashboard() {
  const [kpis, setKpis] = useState<any>(null);
  const [dashboard, setDashboard] = useState<any>(null);
  const [insights, setInsights] = useState<any>(null);
  const [deptData, setDeptData] = useState<any[]>([]);
  const [csatTrend, setCsatTrend] = useState<any[]>([]);
  const [executivo, setExecutivo] = useState<any>(null);
  const [qualidade, setQualidade] = useState<any>(null);
  const [period, setPeriod] = useState('30');
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTipo, setDrawerTipo] = useState('');
  const [drawerDias, setDrawerDias] = useState(30);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [kpiRes, dashRes, insightRes, deptRes, csatRes, execRes, qualRes] = await Promise.all([
        api.get('/analytics/kpis'),
        api.get('/analytics/dashboard'),
        api.get('/analytics/insights'),
        api.get('/analytics/tickets-by-department'),
        api.get('/analytics/csat-trending'),
        api.get(`/analytics/executivo?dias=${period}`),
        api.get(`/helpdesk/qualidade?dias=${period}`),
      ]);
      setKpis(kpiRes.data);
      setDashboard(dashRes.data);
      setInsights(insightRes.data);
      setDeptData(deptRes.data);
      setCsatTrend(csatRes.data);
      setExecutivo(execRes.data);
      setQualidade(qualRes.data);
      setLastUpdate(new Date());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => { loadData(); }, 30000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, loadData]);

  if (loading && !executivo) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        <span className="text-sm text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>Carregando dados...</span>
      </div>
    </div>
  );

  const resumo = executivo?.resumo || {};
  const alertas = executivo?.alertas || [];
  const chartData = kpis?.charts?.ticketsPerDay || [];
  const categoryData = kpis?.charts?.ticketsByCategory?.map((c: any) => ({ name: c.categoria || 'Sem categoria', value: c._count })) || [];
  const agentData = dashboard?.agentPerformance?.map((a: any) => ({ name: a.agentName, tickets: a.totalTickets })) || [];
  const statusData = [
    { name: 'Abertos', value: resumo.ticketsAbertos || 0, color: '#f59e0b' },
    { name: 'Em Atendimento', value: resumo.ticketsEmAtendimento || 0, color: '#10b981' },
    { name: 'Fechados', value: resumo.ticketsFechados || 0, color: '#6366f1' },
    { name: 'Aguardando', value: resumo.ticketsAguardando || 0, color: '#0ea5e9' },
  ];
  const priorityData = [
    { name: 'Crítica', value: kpis?.cards?.ticketsCriticos || 0, color: '#ef4444' },
    { name: 'Alta', value: kpis?.cards?.ticketsAltos || 0, color: '#f97316' },
    { name: 'Média', value: kpis?.cards?.ticketsMedios || 0, color: '#3b82f6' },
    { name: 'Baixa', value: kpis?.cards?.ticketsBaixos || 0, color: '#10b981' },
  ];
  const channelData = [
    { name: 'WhatsApp', value: kpis?.charts?.ticketsByChannel?.whatsapp || 0, color: '#25d366' },
    { name: 'E-mail', value: kpis?.charts?.ticketsByChannel?.email || 0, color: '#3b82f6' },
    { name: 'Telefone', value: kpis?.charts?.ticketsByChannel?.telefone || 0, color: '#8b5cf6' },
    { name: 'Web', value: kpis?.charts?.ticketsByChannel?.web || 0, color: '#f59e0b' },
  ];
  const responseTimeData = kpis?.charts?.responseTimePerDay || [];

  const slaTotal = resumo.slaTotal || 0;
  const slaCumprido = resumo.slaCumprido || 0;
  const taxaSla = slaTotal > 0 ? slaCumprido / slaTotal : 0;
  const tmrMin = resumo.tempoMedioRespostaMin || 0;
  const csatMedio = resumo.csatMedio || 0;
  const fcr = resumo.fcr || 0;
  const taxaResolucao = resumo.taxaResolucao || 0;

  const temDados = (v: number) => v > 0;

  return (
    <div className="space-y-6">
      {/* ═══════════════════════════════════════════════════════════════
          1. CABEÇALHO — Limpo e funcional
         ═══════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight" style={{ fontFamily: 'Khand, sans-serif' }}>
            Dashboard
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1" style={{ fontFamily: 'Lexend, sans-serif' }}>
            Painel operacional
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Circle size={8} className={autoRefresh ? 'fill-green-500 text-green-500 animate-pulse' : 'fill-slate-400 text-slate-400'} />
            <span>{autoRefresh ? 'Tempo real' : 'Manual'}</span>
            <span className="text-slate-400 dark:text-slate-500">· Atualizado agora</span>
          </div>
          <button
            onClick={loadData}
            className="p-2 rounded-lg border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            title="Atualizar agora"
          >
            <RefreshCw size={16} />
          </button>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="input w-full sm:w-40 text-sm"
          >
            <option value="1">Hoje</option>
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
          </select>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          2. OPERAÇÃO AGORA — Estado atual dos atendimentos
         ═══════════════════════════════════════════════════════════════ */}
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/80 dark:to-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-700/50 p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide" style={{ fontFamily: 'Lexend, sans-serif' }}>
            Operação agora
          </h2>
          <span className="text-xs text-slate-400 dark:text-slate-500 ml-1">Situação atual dos atendimentos</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            { label: 'Em atendimento', value: resumo.ticketsEmAtendimento || 0, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500' },
            { label: 'Aguardando', value: resumo.ticketsAbertos || 0, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500' },
            { label: 'SLA em risco', value: resumo.slaEmRisco || 0, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500' },
            { label: 'Aguardando cliente', value: resumo.ticketsAguardandoCliente || 0, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-500' },
            { label: 'Aguardando OS', value: resumo.ticketsAguardandoOS || 0, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-500' },
          ].map((item) => (
            <div key={item.label} className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-100 dark:border-slate-700/50">
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-2 h-2 rounded-full ${item.bg}`} />
                <span className="text-xs text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>{item.label}</span>
              </div>
              <div className={`text-3xl font-bold ${item.color}`} style={{ fontFamily: 'Khand, sans-serif' }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          3. CHAMADOS DE HOJE — Volume acumulado do dia
         ═══════════════════════════════════════════════════════════════ */}
      <div className="card">
        <div className="flex items-center gap-2.5 mb-4">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide" style={{ fontFamily: 'Lexend, sans-serif' }}>
            Chamados
          </h2>
          <span className="text-xs text-slate-400 dark:text-slate-500">Resumo dos chamados recebidos e tratados hoje</span>
        </div>
        <div className="flex items-stretch gap-4">
          <div className="flex-shrink-0 bg-slate-900 dark:bg-slate-100 rounded-xl p-5 text-center min-w-[120px]">
            <div className="text-4xl font-bold text-white dark:text-slate-900" style={{ fontFamily: 'Khand, sans-serif' }}>
              {resumo.totalTickets || 0}
            </div>
            <div className="text-xs text-slate-300 dark:text-slate-600 mt-1" style={{ fontFamily: 'Lexend, sans-serif' }}>Total</div>
          </div>
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { label: 'Finalizados', value: resumo.ticketsFechados || 0, color: 'text-emerald-600 dark:text-emerald-400' },
              { label: 'Reabertos', value: resumo.ticketsReabertos || 0, color: 'text-orange-600 dark:text-orange-400' },
              { label: 'Cancelados', value: resumo.ticketsCancelados || 0, color: 'text-red-600 dark:text-red-400' },
              { label: 'Inatividade', value: resumo.ticketsInatividade || 0, color: 'text-slate-500 dark:text-slate-400' },
              { label: 'Não resolvidos', value: resumo.ticketsNaoResolvidos || 0, color: 'text-rose-600 dark:text-rose-400' },
            ].map((item) => (
              <div key={item.label} className="flex flex-col justify-center items-center py-3">
                <div className={`text-2xl font-bold ${item.color}`} style={{ fontFamily: 'Khand, sans-serif' }}>
                  {item.value}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5" style={{ fontFamily: 'Lexend, sans-serif' }}>
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          4. DESEMPENHO — Indicadores de qualidade
         ═══════════════════════════════════════════════════════════════ */}
      <div className="card">
        <div className="flex items-center gap-2.5 mb-4">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide" style={{ fontFamily: 'Lexend, sans-serif' }}>
            Desempenho
          </h2>
          <span className="text-xs text-slate-400 dark:text-slate-500">Qualidade da operação no período</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            {
              label: 'SLA',
              valor: temDados(slaTotal) ? `${(taxaSla * 100).toFixed(0)}%` : '—',
              sub: temDados(slaTotal) ? null : 'Sem dados suficientes',
              meta: 'Meta ≥ 95%',
              status: !temDados(slaTotal) ? 'sem_dados' : taxaSla >= 0.95 ? 'ok' : taxaSla >= 0.8 ? 'atencao' : 'ruim',
            },
            {
              label: 'Resolução',
              valor: temDados(resumo.totalTickets) ? `${taxaResolucao.toFixed(0)}%` : '—',
              sub: temDados(resumo.totalTickets) ? null : 'Sem dados suficientes',
              meta: 'Meta ≥ 80%',
              status: !temDados(resumo.totalTickets) ? 'sem_dados' : taxaResolucao >= 80 ? 'ok' : taxaResolucao >= 60 ? 'atencao' : 'ruim',
            },
            {
              label: 'Resposta média',
              valor: tmrMin > 0 ? formatarTempo(tmrMin) : '—',
              sub: tmrMin > 0 ? null : 'Sem atendimentos',
              meta: 'Meta ≤ 30min',
              status: tmrMin === 0 ? 'sem_dados' : tmrMin <= 30 ? 'ok' : tmrMin <= 60 ? 'atencao' : 'ruim',
            },
            {
              label: 'CSAT',
              valor: csatMedio > 0 ? csatMedio.toFixed(1) : '—',
              sub: csatMedio > 0 ? null : 'Sem avaliações',
              meta: 'Meta ≥ 4.0',
              status: csatMedio === 0 ? 'sem_dados' : csatMedio >= 4 ? 'ok' : csatMedio >= 3.5 ? 'atencao' : 'ruim',
            },
            {
              label: '1º contato',
              valor: temDados(resumo.totalTickets) ? `${(fcr * 100).toFixed(0)}%` : '—',
              sub: temDados(resumo.totalTickets) ? null : 'Sem dados suficientes',
              meta: 'Meta ≥ 80%',
              status: !temDados(resumo.totalTickets) ? 'sem_dados' : fcr >= 0.8 ? 'ok' : fcr >= 0.6 ? 'atencao' : 'ruim',
            },
            {
              label: 'Retrabalho',
              valor: qualidade?.retrabalho?.percentual != null ? `${qualidade.retrabalho.percentual}%` : '—',
              sub: qualidade?.retrabalho?.total != null ? `${qualidade.retrabalho.total} caso(s)` : 'Sem dados',
              meta: 'Meta ≤ 10%',
              status: qualidade?.retrabalho?.percentual == null ? 'sem_dados' : qualidade.retrabalho.percentual <= 5 ? 'ok' : qualidade.retrabalho.percentual <= 10 ? 'atencao' : 'ruim',
            },
          ].map((item) => {
            const statusColors = {
              ok: 'border-emerald-200 dark:border-emerald-900/50',
              atencao: 'border-amber-200 dark:border-amber-900/50',
              ruim: 'border-red-200 dark:border-red-900/50',
              sem_dados: 'border-slate-200 dark:border-slate-700',
            };
            const valueColors = {
              ok: 'text-emerald-600 dark:text-emerald-400',
              atencao: 'text-amber-600 dark:text-amber-400',
              ruim: 'text-red-600 dark:text-red-400',
              sem_dados: 'text-slate-400 dark:text-slate-500',
            };
            const icons = {
              ok: ShieldCheck,
              atencao: Activity,
              ruim: AlertTriangle,
              sem_dados: Target,
            };
            const Icon = icons[item.status];
            return (
              <div key={item.label} className={`rounded-xl p-4 border bg-white dark:bg-slate-800 ${statusColors[item.status]}`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <Icon size={14} className={valueColors[item.status]} />
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>{item.label}</span>
                </div>
                <div className={`text-2xl font-bold ${valueColors[item.status]}`} style={{ fontFamily: 'Khand, sans-serif' }}>
                  {item.valor}
                </div>
                {item.sub ? (
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1" style={{ fontFamily: 'Lexend, sans-serif' }}>{item.sub}</p>
                ) : (
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">{item.meta}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          5. ALERTAS — O que exige atenção
         ═══════════════════════════════════════════════════════════════ */}
      {alertas.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2.5 mb-4">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide" style={{ fontFamily: 'Lexend, sans-serif' }}>
              Alertas e atenção
            </h2>
            <span className="ml-auto text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300">
              {alertas.length} {alertas.length === 1 ? 'alerta' : 'alertas'}
            </span>
          </div>
          <div className="space-y-2">
            {alertas.slice(0, 5).map((alerta: any, idx: number) => {
              const nivel = NIVEL_ALERTA[alerta.nivel] || NIVEL_ALERTA.info;
              const Icone = alerta.nivel === 'critico' ? ShieldAlert : alerta.nivel === 'atencao' ? AlertTriangle : BellRing;
              return (
                <a
                  key={`${alerta.tipo}-${idx}`}
                  href={alerta.link || '#'}
                  onClick={(e) => {
                    e.preventDefault();
                    if (alerta.link) {
                      window.location.href = alerta.link;
                    } else {
                      setDrawerTipo(alerta.tipo);
                      setDrawerDias(parseInt(period) || 30);
                      setDrawerOpen(true);
                    }
                  }}
                  className={`flex items-center gap-3 ${nivel.bg} border ${nivel.border} rounded-xl px-4 py-3 hover:shadow-premium transition-all duration-200 cursor-pointer`}
                >
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${nivel.dot}`} />
                  <Icone size={16} className={nivel.text} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Lexend, sans-serif' }}>
                      {alerta.titulo}
                    </span>
                    {alerta.mensagem && (
                      <span className="text-xs text-slate-500 dark:text-slate-400 ml-2 hidden sm:inline">
                        — {alerta.mensagem}
                      </span>
                    )}
                  </div>
                  {alerta.contagem != null && (
                    <span className={`text-sm font-bold ${nivel.text}`}>{alerta.contagem}</span>
                  )}
                  <ChevronRight size={14} className="text-slate-400 dark:text-slate-500 flex-shrink-0" />
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          6. ANÁLISE — Gráficos e tendências
         ═══════════════════════════════════════════════════════════════ */}
      <div className="card">
        <div className="flex items-center gap-2.5 mb-4">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide" style={{ fontFamily: 'Lexend, sans-serif' }}>
            Análise
          </h2>
          <span className="text-xs text-slate-400 dark:text-slate-500">Gráficos e tendências do período</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-3" style={{ fontFamily: 'Lexend, sans-serif' }}>Evolução diária</h3>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <Tooltip contentStyle={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                <Line type="monotone" dataKey="count" stroke="#3B82F6" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div>
            <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-3" style={{ fontFamily: 'Lexend, sans-serif' }}>Distribuição por status</h3>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={statusData.filter(s => s.value > 0)} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {statusData.filter(s => s.value > 0).map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                </Pie>
                <Tooltip contentStyle={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div>
            <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-3" style={{ fontFamily: 'Lexend, sans-serif' }}>Chamados por categoria</h3>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={categoryData.length > 0 ? categoryData : [{ name: 'Sem dados', value: 1 }]} cx="50%" cy="50%" outerRadius={85} dataKey="value" label>
                  {(categoryData.length > 0 ? categoryData : [{ name: 'Sem dados', value: 1 }]).map((_: any, i: number) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                </Pie>
                <Tooltip contentStyle={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div>
            <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-3" style={{ fontFamily: 'Lexend, sans-serif' }}>Chamados por prioridade</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={priorityData.filter(p => p.value > 0)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <Tooltip contentStyle={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {priorityData.filter(p => p.value > 0).map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-3" style={{ fontFamily: 'Lexend, sans-serif' }}>Chamados por canal</h3>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={channelData.filter(c => c.value > 0)} cx="50%" cy="50%" outerRadius={85} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {channelData.filter(c => c.value > 0).map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                </Pie>
                <Tooltip contentStyle={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div>
            <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-3" style={{ fontFamily: 'Lexend, sans-serif' }}>Tempo de resposta</h3>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={responseTimeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <Tooltip contentStyle={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                <Area type="monotone" dataKey="avgMinutes" stroke="#8b5cf6" fill="#8b5cf620" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          7. OPERAÇÃO POR DEPARTAMENTO
         ═══════════════════════════════════════════════════════════════ */}
      {executivo?.porDepartamento && executivo.porDepartamento.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2.5 mb-4">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide" style={{ fontFamily: 'Lexend, sans-serif' }}>
              Operação por departamento
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500 dark:text-slate-400">Departamento</th>
                  <th className="text-center py-2.5 px-3 text-xs font-medium text-slate-500 dark:text-slate-400">Total</th>
                  <th className="text-center py-2.5 px-3 text-xs font-medium text-slate-500 dark:text-slate-400">Em atendimento</th>
                  <th className="text-center py-2.5 px-3 text-xs font-medium text-slate-500 dark:text-slate-400">Aguardando</th>
                  <th className="text-center py-2.5 px-3 text-xs font-medium text-slate-500 dark:text-slate-400">Finalizados</th>
                </tr>
              </thead>
              <tbody>
                {executivo.porDepartamento.map((dept: any) => (
                  <tr key={dept.nome} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">{dept.nome}</td>
                    <td className="py-2.5 px-3 text-center text-slate-700 dark:text-slate-300 font-medium">{dept.total || 0}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        {dept.emAtendimento || 0}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        {dept.aguardando || 0}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center text-emerald-600 dark:text-emerald-400 font-medium">{dept.fechados || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          8. INSIGHTS — IA
         ═══════════════════════════════════════════════════════════════ */}
      {insights?.insights && insights.insights.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-100 dark:border-blue-900/50 rounded-2xl p-5">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
              <Lightbulb size={18} className="text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="font-semibold text-slate-800 dark:text-slate-200" style={{ fontFamily: 'Khand, sans-serif' }}>Insights da Semana</h3>
          </div>
          <ul className="space-y-2">
            {insights.insights.map((text: string, i: number) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
                <span className="text-blue-500 mt-0.5 font-bold">•</span>
                {text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          9. GRÁFICOS COMPLEMENTARES
         ═══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
              <BarChart3 size={14} className="text-blue-600 dark:text-blue-400" />
            </div>
            Desempenho por Funcionário
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={agentData.length > 0 ? agentData : [{ name: 'Sem dados', tickets: 0 }]} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#94A3B8' }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#94A3B8' }} width={100} />
              <Tooltip contentStyle={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
              <Bar dataKey="tickets" fill="#3B82F6" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
            <div className="w-7 h-7 rounded-lg bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center">
              <Bot size={14} className="text-violet-600 dark:text-violet-400" />
            </div>
            Resolução por IA
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Só IA', value: kpis?.cards?.ticketsResolvidosSoloIa || 0, color: '#7C3AED' },
                    { name: 'IA + Humano', value: Math.max(0, (kpis?.cards?.ticketsResolvidosIa || 0) - (kpis?.cards?.ticketsResolvidosSoloIa || 0)), color: '#A78BFA' },
                    { name: 'Humano', value: Math.max(0, (kpis?.cards?.totalResolvidos || 0) - (kpis?.cards?.ticketsResolvidosIa || 0)), color: '#CBD5E1' },
                  ].filter(d => d.value > 0)}
                  cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value"
                >
                  {[{ name: 'Só IA', value: kpis?.cards?.ticketsResolvidosSoloIa || 0, color: '#7C3AED' }, { name: 'IA + Humano', value: Math.max(0, (kpis?.cards?.ticketsResolvidosIa || 0) - (kpis?.cards?.ticketsResolvidosSoloIa || 0)), color: '#A78BFA' }, { name: 'Humano', value: Math.max(0, (kpis?.cards?.totalResolvidos || 0) - (kpis?.cards?.ticketsResolvidosIa || 0)), color: '#CBD5E1' }].filter(d => d.value > 0).map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-violet-600" /><span className="text-slate-600 dark:text-slate-400">Só IA: <strong>{kpis?.cards?.ticketsResolvidosSoloIa || 0}</strong></span></div>
              <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-purple-400" /><span className="text-slate-600 dark:text-slate-400">IA + Humano: <strong>{Math.max(0, (kpis?.cards?.ticketsResolvidosIa || 0) - (kpis?.cards?.ticketsResolvidosSoloIa || 0))}</strong></span></div>
              <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-slate-300" /><span className="text-slate-600 dark:text-slate-400">Humano: <strong>{Math.max(0, (kpis?.cards?.totalResolvidos || 0) - (kpis?.cards?.ticketsResolvidosIa || 0))}</strong></span></div>
            </div>
          </div>
        </div>
      </div>

      <AlertDetailDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} tipo={drawerTipo} dias={drawerDias} />
    </div>
  );
}
