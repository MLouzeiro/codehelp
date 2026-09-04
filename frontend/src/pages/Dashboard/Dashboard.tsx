import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { TrendingUp, Clock, FileText, MessageSquare, Users, AlertTriangle, Lightbulb, Target, BarChart3, Activity, Zap, Building2, Star, Bot, BellRing, ShieldAlert, ShieldCheck } from 'lucide-react';
import AlertDetailDrawer from '../../components/AlertDetailDrawer';

const COLORS = ['#3B82F6', '#60A5FA', '#2563EB', '#93C5FD', '#1D4ED8', '#BFDBFE'];

const NIVEL_ALERTA: Record<string, { label: string; bg: string; border: string; text: string }> = {
  critico: { label: 'Crítico', bg: 'bg-red-50 dark:bg-red-950/40', border: 'border-red-200 dark:border-red-900/50', text: 'text-red-700 dark:text-red-400' },
  atencao: { label: 'Atenção', bg: 'bg-amber-50 dark:bg-amber-950/40', border: 'border-amber-200 dark:border-amber-900/50', text: 'text-amber-700 dark:text-amber-400' },
  info: { label: 'Informação', bg: 'bg-blue-50 dark:bg-blue-950/40', border: 'border-blue-200 dark:border-blue-900/50', text: 'text-blue-700 dark:text-blue-400' },
};

interface IndicadorInterpretado {
  label: string;
  valor: string;
  meta: string;
  status: 'ok' | 'atencao' | 'ruim';
  icone: string;
  recomendacao: string;
}

function interpretarIndicadores(resumo: any): IndicadorInterpretado[] {
  const out: IndicadorInterpretado[] = [];
  const push = (label: string, valor: string, meta: string, status: 'ok' | 'atencao' | 'ruim', icone: string, recomendacao: string) =>
    out.push({ label, valor, meta, status, icone, recomendacao });
  if (!resumo) return out;

  const taxaSla = resumo.taxaSla ?? resumo.slaCumprido / Math.max(1, resumo.slaTotal);
  push('Cumprimento de SLA', `${(taxaSla * 100).toFixed(0)}%`, 'Meta ≥ 95%', taxaSla >= 0.95 ? 'ok' : taxaSla >= 0.8 ? 'atencao' : 'ruim', 'ShieldCheck',
    taxaSla >= 0.95 ? 'SLA em dia. Continue monitorando a fila diariamente.' : taxaSla >= 0.8 ? 'SLAs próximos do limite — priorize chamados em risco de estourar.' : 'Muitos chamados estourando SLA — revise a distribuição da fila.');

  push('Taxa de Resolução', `${(resumo.taxaResolucao ?? 0).toFixed(0)}%`, 'Meta ≥ 80%', (resumo.taxaResolucao ?? 0) >= 80 ? 'ok' : (resumo.taxaResolucao ?? 0) >= 60 ? 'atencao' : 'ruim', 'TrendingUp',
    (resumo.taxaResolucao ?? 0) >= 80 ? 'Resolução saudável no período.' : (resumo.taxaResolucao ?? 0) >= 60 ? 'Taxa de resolução em atenção — confirme que encerramentos estão corretos.' : 'Resolução baixa — verifique filas paradas e reaberturas.');

  const tmr = resumo.tempoMedioRespostaMin ?? 0;
  push('Tempo Médio de Resposta', `${tmr}min`, 'Meta ≤ 360min', tmr <= 360 ? 'ok' : tmr <= 480 ? 'atencao' : 'ruim', 'Clock',
    tmr <= 360 ? 'Resposta dentro da meta.' : tmr <= 480 ? 'Resposta acima da meta — reforce o acompanhamento da fila.' : 'Resposta muito lenta — reveja a escala de atendentes.');

  const csat = resumo.csatMedio ?? 0;
  push('CSAT', csat ? csat.toFixed(1) : '—', 'Meta ≥ 4.0', csat >= 4 ? 'ok' : csat >= 3.5 ? 'atencao' : 'ruim', 'Star',
    csat >= 4 ? 'Satisfação dos clientes está boa.' : csat >= 3.5 ? 'Satisfação em atenção — acompanhe avaliações baixas.' : 'Satisfação baixa — investigue as avaliações recentes.');

  const fcr = resumo.fcr ?? 0;
  push('Resolução no 1º Contato', `${(fcr * 100).toFixed(0)}%`, 'Meta ≥ 60%', fcr >= 0.6 ? 'ok' : fcr >= 0.4 ? 'atencao' : 'ruim', 'Zap',
    fcr >= 0.6 ? 'Boa resolução no primeiro contato.' : fcr >= 0.4 ? 'FCR em atenção — capacite os atendentes nos assuntos mais repetidos.' : 'FCR baixo — muitos chamados precisam de mais de um contato.');

  return out;
}

export default function Dashboard() {
  const [kpis, setKpis] = useState<any>(null);
  const [dashboard, setDashboard] = useState<any>(null);
  const [insights, setInsights] = useState<any>(null);
  const [deptData, setDeptData] = useState<any[]>([]);
  const [csatTrend, setCsatTrend] = useState<any[]>([]);
  const [executivo, setExecutivo] = useState<any>(null);
  const [period, setPeriod] = useState('30');
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTipo, setDrawerTipo] = useState('');
  const [drawerDias, setDrawerDias] = useState(30);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [kpiRes, dashRes, insightRes, deptRes, csatRes, execRes] = await Promise.all([
        api.get('/analytics/kpis'),
        api.get('/analytics/dashboard'),
        api.get('/analytics/insights'),
        api.get('/analytics/tickets-by-department'),
        api.get('/analytics/csat-trending'),
        api.get(`/analytics/executivo?dias=${period}`),
      ]);
      setKpis(kpiRes.data);
      setDashboard(dashRes.data);
      setInsights(insightRes.data);
      setDeptData(deptRes.data);
      setCsatTrend(csatRes.data);
      setExecutivo(execRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        <span className="text-sm text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>Carregando dados...</span>
      </div>
    </div>
  );

  const cards = [
    { label: 'Chamados no Mês', value: kpis?.cards?.totalTicketsMonth || 0, icon: MessageSquare, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/30', border: 'border-blue-100' },
    { label: 'Em Aberto', value: kpis?.cards?.ticketsAbertos || 0, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/30', border: 'border-amber-100' },
    { label: 'Resolvidos', value: kpis?.cards?.ticketsFechados || 0, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/30', border: 'border-emerald-100' },
    { label: 'Resolvidos 100% IA', value: kpis?.cards?.ticketsResolvidosSoloIa || 0, icon: Bot, color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-900/30', border: 'border-violet-200', subtitle: kpis?.cards?.totalResolvidos > 0 ? (Math.round((kpis?.cards?.ticketsResolvidosSoloIa || 0) / kpis?.cards?.totalResolvidos * 100) + '% do total') : '' },
    { label: 'TMR Médio', value: `${kpis?.cards?.tmrMedia || 0}min`, icon: Clock, color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-900/30', border: 'border-violet-100' },
    { label: 'TMRes Médio', value: `${kpis?.cards?.tmresMedia || 0}h`, icon: Clock, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100' },
    { label: 'OS no Mês', value: kpis?.cards?.totalOsMonth || 0, icon: FileText, color: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-100' },
    { label: 'OS Aguardando', value: kpis?.cards?.osAguardando || 0, icon: FileText, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100' },
    { label: 'Clientes Ativos', value: kpis?.cards?.totalClients || 0, icon: Users, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/30', border: 'border-blue-100' },
  ];

  const chartData = kpis?.charts?.ticketsPerDay || [];
  const categoryData = kpis?.charts?.ticketsByCategory?.map((c: any) => ({ name: c.categoria || 'Sem categoria', value: c._count })) || [];
  const agentData = dashboard?.agentPerformance?.map((a: any) => ({ name: a.agentName, tickets: a.totalTickets })) || [];

  const statusData = [
    { name: 'Abertos', value: kpis?.cards?.ticketsAbertos || 0, color: '#f59e0b' },
    { name: 'Em Atendimento', value: kpis?.cards?.ticketsEmAtendimento || 0, color: '#10b981' },
    { name: 'Fechados', value: kpis?.cards?.ticketsFechados || 0, color: '#6366f1' },
    { name: 'Aguardando', value: kpis?.cards?.ticketsAguardando || 0, color: '#0ea5e9' },
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight" style={{ fontFamily: 'Khand, sans-serif' }}>
            Dashboard
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1" style={{ fontFamily: 'Lexend, sans-serif' }}>
            Visão geral do desempenho da Codemed
          </p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="input w-full sm:w-40 text-sm"
        >
          <option value="7">Últimos 7 dias</option>
          <option value="30">Últimos 30 dias</option>
          <option value="90">Últimos 90 dias</option>
        </select>
      </div>

      {/* ── SAÚDE DO ATENDIMENTO (indicadores interpretados) ────────── */}
      {executivo && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {interpretarIndicadores(executivo.resumo).map((ind, idx) => (
            <div
              key={ind.label}
              className={`card p-4 animate-fade-in ${
                ind.status === 'ruim' ? 'border-red-200 dark:border-red-900/50' : ind.status === 'atencao' ? 'border-amber-200 dark:border-amber-900/50' : 'border-emerald-200 dark:border-emerald-900/50'
              }`}
              style={{ animationDelay: `${idx * 60}ms` }}
              title={ind.recomendacao}
            >
              <div className="flex items-center gap-2 mb-1">
                {ind.status === 'ruim' ? (
                  <AlertTriangle size={14} className="text-red-500" />
                ) : ind.status === 'atencao' ? (
                  <Activity size={14} className="text-amber-500" />
                ) : (
                  <ShieldCheck size={14} className="text-emerald-500" />
                )}
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>{ind.label}</span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className={`text-xl font-bold ${ind.status === 'ruim' ? 'text-red-600 dark:text-red-400' : ind.status === 'atencao' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-slate-100'}`} style={{ fontFamily: 'Khand, sans-serif' }}>
                  {ind.valor}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">{ind.meta}</span>
              </div>
              <p className="text-[11px] leading-tight mt-1.5 text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
                {ind.recomendacao}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ── ALERTAS E ATENÇÃO ─────────────────────────────────────── */}
      {executivo?.alertas?.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-950/40 flex items-center justify-center">
              <BellRing size={17} className="text-red-600 dark:text-red-400" />
            </div>
            <h3 className="font-semibold text-slate-800 dark:text-slate-200" style={{ fontFamily: 'Khand, sans-serif' }}>
              Alertas e Atenção
            </h3>
            <span className="ml-auto text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300">
              {executivo.alertas.length} {executivo.alertas.length === 1 ? 'alerta' : 'alertas'} no período
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {executivo.alertas.map((alerta: any, idx: number) => {
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
                  className={`${nivel.bg} border ${nivel.border} rounded-xl p-3.5 hover:shadow-premium transition-all duration-200 block cursor-pointer`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <Icone size={15} className={nivel.text} />
                    <span className={`text-[10px] font-bold uppercase tracking-wide ${nivel.text}`}>{nivel.label}</span>
                    {alerta.contagem != null && (
                      <span className={`ml-auto text-xs font-bold ${nivel.text}`}>{alerta.contagem}</span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Lexend, sans-serif' }}>{alerta.titulo}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-snug" style={{ fontFamily: 'Lexend, sans-serif' }}>{alerta.mensagem}</p>
                  {alerta.acao && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 italic" style={{ fontFamily: 'Lexend, sans-serif' }}>
                      Sugestão: {alerta.acao}
                    </p>
                  )}
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* Insights */}
      {insights?.insights && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-5 animate-fade-in">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <Lightbulb size={18} className="text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="font-semibold text-slate-800 dark:text-slate-200" style={{ fontFamily: 'Khand, sans-serif' }}>Insights da Semana</h3>
          </div>
          <ul className="space-y-2.5">
            {insights.insights.map((text: string, i: number) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
                <span className="text-blue-500 mt-0.5 font-bold">•</span>
                {text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((card, idx) => (
          <div
            key={card.label}
            className={`bg-white dark:bg-slate-800 rounded-2xl border ${card.border} p-4 hover:shadow-premium transition-all duration-300 animate-fade-in`}
            style={{ animationDelay: `${idx * 50}ms` }}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center ${card.color}`}>
                <card.icon size={20} />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium" style={{ fontFamily: 'Lexend, sans-serif' }}>{card.label}</p>
                <p className="text-xl font-bold text-slate-900 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>{card.value}</p>
                {card.subtitle && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{card.subtitle}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
              <TrendingUp size={14} className="text-blue-600 dark:text-blue-400" />
            </div>
            Chamados por Período
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94A3B8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} />
              <Tooltip
                contentStyle={{
                  background: 'white',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                }}
              />
              <Line type="monotone" dataKey="count" stroke="#3B82F6" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
              <Target size={14} className="text-blue-600 dark:text-blue-400" />
            </div>
            Chamados por Categoria
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={categoryData.length > 0 ? categoryData : [{ name: 'Sem dados', value: 1 }]} cx="50%" cy="50%" outerRadius={100} dataKey="value" label>
                {(categoryData.length > 0 ? categoryData : [{ name: 'Sem dados', value: 1 }]).map((_: any, i: number) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: 'white',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
              <BarChart3 size={14} className="text-blue-600 dark:text-blue-400" />
            </div>
            Desempenho por Funcionário
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={agentData.length > 0 ? agentData : [{ name: 'Sem dados', tickets: 0 }]} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#94A3B8' }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#94A3B8' }} width={100} />
              <Tooltip
                contentStyle={{
                  background: 'white',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                }}
              />
              <Bar dataKey="tickets" fill="#3B82F6" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
              <FileText size={14} className="text-blue-600 dark:text-blue-400" />
            </div>
            Pipeline de Oportunidades
          </h3>
          <div className="space-y-3">
            {dashboard?.pipeline && (
              <>
                <div className="flex justify-between items-center p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700/50">
                  <span className="text-sm text-slate-600 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>Total em pipeline</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>R$ {dashboard.pipeline.total?.toFixed(2) || '0,00'}</span>
                </div>
                <div className="flex justify-between items-center p-3.5 bg-blue-50 dark:bg-blue-900/30 rounded-xl border border-blue-100">
                  <span className="text-sm text-blue-600 dark:text-blue-400" style={{ fontFamily: 'Lexend, sans-serif' }}>Valor ponderado</span>
                  <span className="font-bold text-blue-700" style={{ fontFamily: 'Khand, sans-serif' }}>R$ {dashboard.pipeline.weighted?.toFixed(2) || '0,00'}</span>
                </div>
                <div className="flex justify-between items-center p-3.5 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl border border-emerald-100">
                  <span className="text-sm text-emerald-600" style={{ fontFamily: 'Lexend, sans-serif' }}>Oportunidades ativas</span>
                  <span className="font-bold text-emerald-700" style={{ fontFamily: 'Khand, sans-serif' }}>{dashboard.pipeline.count || 0}</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="card">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
              <Activity size={14} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            Distribuição por Status
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusData.filter(s => s.value > 0)}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {statusData.filter(s => s.value > 0).map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: 'white',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
            <div className="w-7 h-7 rounded-lg bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center">
              <Zap size={14} className="text-orange-600 dark:text-orange-400" />
            </div>
            Chamados por Prioridade
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={priorityData.filter(p => p.value > 0)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94A3B8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} />
              <Tooltip
                contentStyle={{
                  background: 'white',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                }}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {priorityData.filter(p => p.value > 0).map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
            <div className="w-7 h-7 rounded-lg bg-green-50 dark:bg-green-900/30 flex items-center justify-center">
              <MessageSquare size={14} className="text-green-600 dark:text-green-400" />
            </div>
            Chamados por Canal
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={channelData.filter(c => c.value > 0)}
                cx="50%"
                cy="50%"
                outerRadius={100}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {channelData.filter(c => c.value > 0).map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: 'white',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* ── GRÁFICO DE IA: RESOLVIDOS POR IA ─────────────────── */}
        <div className="card lg:col-span-2">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
            <div className="w-7 h-7 rounded-lg bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center">
              <Bot size={14} className="text-violet-600 dark:text-violet-400" />
            </div>
            Resolução por IA
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Resolvido só IA', value: kpis?.cards?.ticketsResolvidosSoloIa || 0, color: '#7C3AED' },
                      { name: 'Resolvido IA + Humano', value: Math.max(0, (kpis?.cards?.ticketsResolvidosIa || 0) - (kpis?.cards?.ticketsResolvidosSoloIa || 0)), color: '#A78BFA' },
                      { name: 'Humano sem IA', value: Math.max(0, (kpis?.cards?.totalResolvidos || 0) - (kpis?.cards?.ticketsResolvidosIa || 0)), color: '#CBD5E1' },
                    ].filter(d => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                  >
                    {[
                      { name: 'Resolvido só IA', value: kpis?.cards?.ticketsResolvidosSoloIa || 0, color: '#7C3AED' },
                      { name: 'Resolvido IA + Humano', value: Math.max(0, (kpis?.cards?.ticketsResolvidosIa || 0) - (kpis?.cards?.ticketsResolvidosSoloIa || 0)), color: '#A78BFA' },
                      { name: 'Humano sem IA', value: Math.max(0, (kpis?.cards?.totalResolvidos || 0) - (kpis?.cards?.ticketsResolvidosIa || 0)), color: '#CBD5E1' },
                    ].filter(d => d.value > 0).map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-4">
              <div className="p-4 bg-violet-50 dark:bg-violet-900/20 rounded-xl border border-violet-100 dark:border-violet-900/30">
                <div className="flex items-center gap-2 mb-2">
                  <Bot className="w-5 h-5 text-violet-600" />
                  <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">Resolvido 100% pela IA</span>
                </div>
                <p className="text-3xl font-bold text-violet-700">{kpis?.cards?.ticketsResolvidosSoloIa || 0}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {kpis?.cards?.totalResolvidos > 0
                    ? `${Math.round((kpis?.cards?.ticketsResolvidosSoloIa || 0) / kpis?.cards?.totalResolvidos * 100)}% dos chamados resolvidos no período`
                    : 'Nenhum chamado resolvido no período'}
                </p>
              </div>
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-100 dark:border-purple-900/30">
                <div className="flex items-center gap-2 mb-2">
                  <Bot className="w-5 h-5 text-purple-600" />
                  <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">Resolvido com IA + Humano</span>
                </div>
                <p className="text-3xl font-bold text-purple-700">
                  {Math.max(0, (kpis?.cards?.ticketsResolvidosIa || 0) - (kpis?.cards?.ticketsResolvidosSoloIa || 0))}
                </p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                  <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">Humano sem IA</span>
                </div>
                <p className="text-3xl font-bold text-slate-600 dark:text-slate-400">
                  {Math.max(0, (kpis?.cards?.totalResolvidos || 0) - (kpis?.cards?.ticketsResolvidosIa || 0))}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
            <div className="w-7 h-7 rounded-lg bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center">
              <Clock size={14} className="text-violet-600 dark:text-violet-400" />
            </div>
            Tempo de Resposta (min)
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={responseTimeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94A3B8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} />
              <Tooltip
                contentStyle={{
                  background: 'white',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                }}
              />
              <Area type="monotone" dataKey="avgMinutes" stroke="#8b5cf6" fill="#8b5cf620" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* ── NOVOS GRÁFICOS DE BI ──────────────────────────────────── */}

        <div className="card">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
            <div className="w-7 h-7 rounded-lg bg-cyan-50 dark:bg-cyan-900/30 flex items-center justify-center">
              <Building2 size={14} className="text-cyan-600 dark:text-cyan-400" />
            </div>
            Chamados por Departamento
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={deptData.length > 0 ? deptData : [{ departamento: 'Sem dados', count: 0 }]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="departamento" tick={{ fontSize: 11, fill: '#94A3B8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} />
              <Tooltip
                contentStyle={{
                  background: 'white',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                }}
              />
              <Bar dataKey="count" fill="#06B6D4" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
            <div className="w-7 h-7 rounded-lg bg-yellow-50 dark:bg-yellow-900/30 flex items-center justify-center">
              <Star size={14} className="text-yellow-600 dark:text-yellow-400" />
            </div>
            CSAT - Satisfacao do Cliente
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={csatTrend.length > 0 ? csatTrend : [{ date: 'Sem dados', media: 0 }]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94A3B8' }} />
              <YAxis domain={[0, 5]} tick={{ fontSize: 11, fill: '#94A3B8' }} />
              <Tooltip
                contentStyle={{
                  background: 'white',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                }}
              />
              <Area type="monotone" dataKey="media" stroke="#EAB308" fill="#EAB30820" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <AlertDetailDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        tipo={drawerTipo}
        dias={drawerDias}
      />
    </div>
  );
}
