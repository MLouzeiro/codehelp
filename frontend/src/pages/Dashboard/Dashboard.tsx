import { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../services/auth';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { TrendingUp, Clock, FileText, MessageSquare, Users, AlertTriangle, Lightbulb, Target, BarChart3 } from 'lucide-react';

const COLORS = ['#3B82F6', '#60A5FA', '#2563EB', '#93C5FD', '#1D4ED8', '#BFDBFE'];

export default function Dashboard() {
  const { user } = useAuth();
  const [kpis, setKpis] = useState<any>(null);
  const [dashboard, setDashboard] = useState<any>(null);
  const [insights, setInsights] = useState<any>(null);
  const [period, setPeriod] = useState('30');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [period]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [kpiRes, dashRes, insightRes] = await Promise.all([
        api.get('/analytics/kpis'),
        api.get('/analytics/dashboard'),
        api.get('/analytics/insights'),
      ]);
      setKpis(kpiRes.data);
      setDashboard(dashRes.data);
      setInsights(insightRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        <span className="text-sm text-slate-500" style={{ fontFamily: 'Lexend, sans-serif' }}>Carregando dados...</span>
      </div>
    </div>
  );

  const cards = [
    { label: 'Chamados no Mês', value: kpis?.cards?.totalTicketsMonth || 0, icon: MessageSquare, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
    { label: 'Em Aberto', value: kpis?.cards?.ticketsAbertos || 0, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
    { label: 'Resolvidos', value: kpis?.cards?.ticketsFechados || 0, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
    { label: 'TMR Médio', value: `${kpis?.cards?.tmrMedia || 0}min`, icon: Clock, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100' },
    { label: 'TMRes Médio', value: `${kpis?.cards?.tmresMedia || 0}h`, icon: Clock, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100' },
    { label: 'OS no Mês', value: kpis?.cards?.totalOsMonth || 0, icon: FileText, color: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-100' },
    { label: 'OS Aguardando', value: kpis?.cards?.osAguardando || 0, icon: FileText, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100' },
    { label: 'Clientes Ativos', value: kpis?.cards?.totalClients || 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
  ];

  const chartData = kpis?.charts?.ticketsPerDay || [];
  const categoryData = kpis?.charts?.ticketsByCategory?.map((c: any) => ({ name: c.categoria || 'Sem categoria', value: c._count })) || [];
  const agentData = dashboard?.agentPerformance?.map((a: any) => ({ name: a.agentName, tickets: a.totalTickets })) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight" style={{ fontFamily: 'Khand, sans-serif' }}>
            Dashboard
          </h1>
          <p className="text-slate-500 text-sm mt-1" style={{ fontFamily: 'Lexend, sans-serif' }}>
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
              <Lightbulb size={18} className="text-blue-600" />
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
            className={`bg-white rounded-2xl border ${card.border} p-4 hover:shadow-premium transition-all duration-300 animate-fade-in`}
            style={{ animationDelay: `${idx * 50}ms` }}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center ${card.color}`}>
                <card.icon size={20} />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium" style={{ fontFamily: 'Lexend, sans-serif' }}>{card.label}</p>
                <p className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Khand, sans-serif' }}>{card.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
              <TrendingUp size={14} className="text-blue-600" />
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
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
              <Target size={14} className="text-blue-600" />
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
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
              <BarChart3 size={14} className="text-blue-600" />
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
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
              <FileText size={14} className="text-blue-600" />
            </div>
            Pipeline de Oportunidades
          </h3>
          <div className="space-y-3">
            {dashboard?.pipeline && (
              <>
                <div className="flex justify-between items-center p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-sm text-slate-600" style={{ fontFamily: 'Lexend, sans-serif' }}>Total em pipeline</span>
                  <span className="font-bold text-slate-900" style={{ fontFamily: 'Khand, sans-serif' }}>R$ {dashboard.pipeline.total?.toFixed(2) || '0,00'}</span>
                </div>
                <div className="flex justify-between items-center p-3.5 bg-blue-50 rounded-xl border border-blue-100">
                  <span className="text-sm text-blue-600" style={{ fontFamily: 'Lexend, sans-serif' }}>Valor ponderado</span>
                  <span className="font-bold text-blue-700" style={{ fontFamily: 'Khand, sans-serif' }}>R$ {dashboard.pipeline.weighted?.toFixed(2) || '0,00'}</span>
                </div>
                <div className="flex justify-between items-center p-3.5 bg-emerald-50 rounded-xl border border-emerald-100">
                  <span className="text-sm text-emerald-600" style={{ fontFamily: 'Lexend, sans-serif' }}>Oportunidades ativas</span>
                  <span className="font-bold text-emerald-700" style={{ fontFamily: 'Khand, sans-serif' }}>{dashboard.pipeline.count || 0}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
