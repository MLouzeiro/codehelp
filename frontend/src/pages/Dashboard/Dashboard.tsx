import { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../services/auth';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { TrendingUp, Clock, FileText, MessageSquare, Users, AlertTriangle, Lightbulb, Target } from 'lucide-react';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

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

  if (loading) return         <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" /></div>;

  const cards = [
    { label: 'Chamados no Mês', value: kpis?.cards?.totalTicketsMonth || 0, icon: MessageSquare, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Em Aberto', value: kpis?.cards?.ticketsAbertos || 0, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Resolvidos', value: kpis?.cards?.ticketsFechados || 0, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'TMR Médio', value: `${kpis?.cards?.tmrMedia || 0}min`, icon: Clock, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'TMRes Médio', value: `${kpis?.cards?.tmresMedia || 0}h`, icon: Clock, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'OS no Mês', value: kpis?.cards?.totalOsMonth || 0, icon: FileText, color: 'text-cyan-600', bg: 'bg-cyan-50' },
    { label: 'OS Aguardando', value: kpis?.cards?.osAguardando || 0, icon: FileText, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Clientes Ativos', value: kpis?.cards?.totalClients || 0, icon: Users, color: 'text-green-600', bg: 'bg-green-50' },
  ];

  const chartData = kpis?.charts?.ticketsPerDay || [];
  const categoryData = kpis?.charts?.ticketsByCategory?.map((c: any) => ({ name: c.categoria || 'Sem categoria', value: c._count })) || [];

  const agentData = dashboard?.agentPerformance?.map((a: any) => ({ name: a.agentName, tickets: a.totalTickets })) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">Visão geral do desempenho da Codemed</p>
        </div>
        <select value={period} onChange={(e) => setPeriod(e.target.value)} className="input w-40">
          <option value="7">7 dias</option>
          <option value="30">30 dias</option>
          <option value="90">90 dias</option>
        </select>
      </div>

      {insights?.insights && (
        <div className="bg-gradient-to-r from-codemed-50 to-purple-50 border border-codemed-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb size={20} className="text-amber-500" />
            <h3 className="font-semibold text-gray-900">Insights da Semana</h3>
          </div>
          <ul className="space-y-2">
            {insights.insights.map((text: string, i: number) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-codemed-600 mt-0.5">•</span>
                {text}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="card flex items-center gap-4 p-4">
            <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center ${card.color}`}>
              <card.icon size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-500">{card.label}</p>
              <p className="text-xl font-bold text-gray-900">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">📈 Chamados por Período</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">🥧 Chamados por Categoria</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={categoryData.length > 0 ? categoryData : [{ name: 'Sem dados', value: 1 }]} cx="50%" cy="50%" outerRadius={100} dataKey="value" label>
                {(categoryData.length > 0 ? categoryData : [{ name: 'Sem dados', value: 1 }]).map((_: any, i: number) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">📊 Desempenho por Funcionário</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={agentData.length > 0 ? agentData : [{ name: 'Sem dados', tickets: 0 }]} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} />
              <Tooltip />
              <Bar dataKey="tickets" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">💰 Pipeline de Oportunidades</h3>
          <div className="space-y-3">
            {dashboard?.pipeline && (
              <>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Total em pipeline</span>
                  <span className="font-bold text-gray-900">R$ {dashboard.pipeline.total?.toFixed(2) || '0,00'}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                  <span className="text-sm text-blue-600">Valor ponderado</span>
                  <span className="font-bold text-blue-700">R$ {dashboard.pipeline.weighted?.toFixed(2) || '0,00'}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                  <span className="text-sm text-green-600">Oportunidades ativas</span>
                  <span className="font-bold text-green-700">{dashboard.pipeline.count || 0}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
