import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { TrendingUp, Clock, FileText, MessageSquare, Users, AlertTriangle, Lightbulb, Target, BarChart3, Activity, Zap, Building2, Star, Bot } from 'lucide-react';

const COLORS = ['#3B82F6', '#60A5FA', '#2563EB', '#93C5FD', '#1D4ED8', '#BFDBFE'];

export default function Dashboard() {
  const [kpis, setKpis] = useState<any>(null);
  const [dashboard, setDashboard] = useState<any>(null);
  const [insights, setInsights] = useState<any>(null);
  const [deptData, setDeptData] = useState<any[]>([]);
  const [csatTrend, setCsatTrend] = useState<any[]>([]);
  const [period, setPeriod] = useState('30');
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [kpiRes, dashRes, insightRes, deptRes, csatRes] = await Promise.all([
        api.get('/analytics/kpis'),
        api.get('/analytics/dashboard'),
        api.get('/analytics/insights'),
        api.get('/analytics/tickets-by-department'),
        api.get('/analytics/csat-trending'),
      ]);
      setKpis(kpiRes.data);
      setDashboard(dashRes.data);
      setInsights(insightRes.data);
      setDeptData(deptRes.data);
      setCsatTrend(csatRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

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

      {/* Insights */}
      {insights?.insights && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-5 animate-fade-in">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <Lightbulb size={18} className="text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="font-semibold text-slate-800" style={{ fontFamily: 'Khand, sans-serif' }}>Insights da Semana</h3>
          </div>
          <ul className="space-y-2.5">
            {insights.insights.map((text: string, i: number) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600" style={{ fontFamily: 'Lexend, sans-serif' }}>
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
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
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
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
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
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
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
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
              <FileText size={14} className="text-blue-600 dark:text-blue-400" />
            </div>
            Pipeline de Oportunidades
          </h3>
          <div className="space-y-3">
            {dashboard?.pipeline && (
              <>
                <div className="flex justify-between items-center p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700/50">
                  <span className="text-sm text-slate-600" style={{ fontFamily: 'Lexend, sans-serif' }}>Total em pipeline</span>
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
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
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
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
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
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
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
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
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
              <div className="p-4 bg-violet-50 rounded-xl border border-violet-100">
                <div className="flex items-center gap-2 mb-2">
                  <Bot className="w-5 h-5 text-violet-600" />
                  <span className="font-semibold text-sm text-slate-800">Resolvido 100% pela IA</span>
                </div>
                <p className="text-3xl font-bold text-violet-700">{kpis?.cards?.ticketsResolvidosSoloIa || 0}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {kpis?.cards?.totalResolvidos > 0
                    ? `${Math.round((kpis?.cards?.ticketsResolvidosSoloIa || 0) / kpis?.cards?.totalResolvidos * 100)}% dos chamados resolvidos no período`
                    : 'Nenhum chamado resolvido no período'}
                </p>
              </div>
              <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
                <div className="flex items-center gap-2 mb-2">
                  <Bot className="w-5 h-5 text-purple-600" />
                  <span className="font-semibold text-sm text-slate-800">Resolvido com IA + Humano</span>
                </div>
                <p className="text-3xl font-bold text-purple-700">
                  {Math.max(0, (kpis?.cards?.ticketsResolvidosIa || 0) - (kpis?.cards?.ticketsResolvidosSoloIa || 0))}
                </p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-5 h-5 text-slate-600" />
                  <span className="font-semibold text-sm text-slate-800">Humano sem IA</span>
                </div>
                <p className="text-3xl font-bold text-slate-600">
                  {Math.max(0, (kpis?.cards?.totalResolvidos || 0) - (kpis?.cards?.ticketsResolvidosIa || 0))}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
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
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
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
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
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
    </div>
  );
}
