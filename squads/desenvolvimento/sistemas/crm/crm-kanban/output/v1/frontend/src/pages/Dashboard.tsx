import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../services/auth';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { TrendingUp, Users, CheckCircle, Clock } from 'lucide-react';
import { KpiData } from '../types';

export default function Dashboard() {
  const { user } = useAuth();
  const [kpis, setKpis] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data } = await api.get('/dashboard/kpis');
      setKpis(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" /></div>;

  const cards = [
    { label: 'Clientes', value: kpis?.cards?.totalClients || 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Tarefas Pendentes', value: kpis?.cards?.tasksPendentes || 0, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Tarefas Concluídas', value: kpis?.cards?.tasksConcluidas || 0, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
  ];

  const chartData = kpis?.charts?.tasksPerDay || [];
  const statusData = kpis?.charts?.tasksByStatus?.map((s) => ({
    name: s.status === 'aberta' ? 'A fazer' : s.status === 'em_andamento' ? 'Andamento' : s.status === 'concluida' ? 'Concluído' : 'Cancelado',
    value: s._count,
  })) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">Visão geral do seu desempenho</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="card flex items-center gap-4 p-4">
            <div className={`w-12 h-12 rounded-lg ${card.bg} flex items-center justify-center ${card.color}`}>
              <card.icon size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">{card.label}</p>
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-4">
          <h3 className="font-semibold text-gray-900 mb-4">Tarefas por Período</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="total" stroke="#0D7377" strokeWidth={2} dot={false} name="Total" />
              <Line type="monotone" dataKey="concluidas" stroke="#22C55E" strokeWidth={2} dot={false} name="Concluídas" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-4">
          <h3 className="font-semibold text-gray-900 mb-4">Tarefas por Status</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={statusData.length > 0 ? statusData : [{ name: 'Sem dados', value: 0 }]}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#0D7377" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
