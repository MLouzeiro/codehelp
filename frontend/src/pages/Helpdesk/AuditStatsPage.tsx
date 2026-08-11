import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import {
  RefreshCw, Shield, BarChart3, Users, Calendar, Activity,
  TrendingUp, ArrowRight, Clock,
} from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, CartesianGrid, LineChart, Line,
} from 'recharts';
import type { AuditStats } from '../../types';

type Periodo = 7 | 30 | 90;

const ACAO_CORES: Record<string, string> = {
  criar: '#10b981',
  atualizar: '#3b82f6',
  deletar: '#ef4444',
  mover_etapa: '#f59e0b',
  atribuir: '#8b5cf6',
  concluir: '#22c55e',
  descartar: '#6b7280',
  login: '#06b6d4',
  sla_alerta: '#f97316',
  config_alterada: '#ec4899',
};

function formatarData(data: string): string {
  return new Date(data + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
}

export default function AuditStatsPage() {
  const [data, setData] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<Periodo>(30);

  const load = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const fim = new Date();
      const inicio = new Date(fim.getTime() - periodo * 24 * 60 * 60 * 1000);
      const { data: res } = await api.get<AuditStats>('/audit/stats', {
        params: { dataInicio: inicio.toISOString(), dataFim: fim.toISOString() },
      });
      setData(res);
    } catch (err: any) {
      setErro(err?.response?.data?.error || 'Erro ao carregar estatísticas');
    } finally {
      setLoading(false);
    }
  }, [periodo]);

  useEffect(() => { load(); }, [load]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="animate-spin text-emerald-600" size={32} />
      </div>
    );
  }

  if (erro && !data) {
    return (
      <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-6 max-w-2xl mx-auto mt-10">
        <p className="text-red-700 dark:text-red-400 font-medium">{erro}</p>
        <button onClick={load} className="mt-3 text-sm text-red-600 dark:text-red-400 underline">Tentar novamente</button>
      </div>
    );
  }

  if (!data) return null;

  const pieAcao = data.porAcao.slice(0, 8).map((item, i) => ({
    name: item.acao.replace(/_/g, ' '),
    value: item.total,
    color: ACAO_CORES[item.acao] || `hsl(${i * 45}, 60%, 50%)`,
  }));

  const pieEntidade = data.porEntidade.map((item, i) => ({
    name: item.entidade,
    value: item.total,
    color: `hsl(${i * 60 + 200}, 60%, 50%)`,
  }));

  const lineDia = data.porDia.map((item) => ({
    data: formatarData(item.data),
    total: item.total,
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 dark:text-slate-100 flex items-center gap-2">
            <Shield className="text-emerald-600" size={24} /> Auditoria & Logs
          </h1>
          <p className="text-neutral-500 dark:text-slate-400 text-sm mt-1">
            {data.totalAcoes} ações registradas no período
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-neutral-100 dark:bg-slate-700 rounded-lg p-0.5">
            {([7, 30, 90] as Periodo[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriodo(p)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  periodo === p ? 'bg-white dark:bg-slate-800 text-navy-900 dark:text-slate-100 shadow-sm' : 'text-neutral-500 dark:text-slate-400 hover:text-neutral-700 dark:hover:text-slate-300'
                }`}
              >
                {p}d
              </button>
            ))}
          </div>
          <button onClick={load} className="btn-secondary text-sm flex items-center gap-1.5">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-neutral-200 dark:border-slate-700 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Activity size={18} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <span className="text-xs font-semibold text-neutral-500 dark:text-slate-400 uppercase">Total</span>
          </div>
          <p className="text-3xl font-bold text-navy-900 dark:text-slate-100">{data.totalAcoes}</p>
          <p className="text-xs text-neutral-500 dark:text-slate-400 mt-1">ações registradas</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-neutral-200 dark:border-slate-700 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <BarChart3 size={18} className="text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-xs font-semibold text-neutral-500 dark:text-slate-400 uppercase">Tipos</span>
          </div>
          <p className="text-3xl font-bold text-navy-900 dark:text-slate-100">{data.porAcao.length}</p>
          <p className="text-xs text-neutral-500 dark:text-slate-400 mt-1">tipos de ação</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-neutral-200 dark:border-slate-700 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Users size={18} className="text-purple-600 dark:text-purple-400" />
            </div>
            <span className="text-xs font-semibold text-neutral-500 dark:text-slate-400 uppercase">Usuários</span>
          </div>
          <p className="text-3xl font-bold text-navy-900 dark:text-slate-100">{data.porUsuario.length}</p>
          <p className="text-xs text-neutral-500 dark:text-slate-400 mt-1">usuários ativos</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-neutral-200 dark:border-slate-700 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Clock size={18} className="text-amber-600 dark:text-amber-400" />
            </div>
            <span className="text-xs font-semibold text-neutral-500 dark:text-slate-400 uppercase">Entidades</span>
          </div>
          <p className="text-3xl font-bold text-navy-900 dark:text-slate-100">{data.porEntidade.length}</p>
          <p className="text-xs text-neutral-500 dark:text-slate-400 mt-1">entidades afetadas</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-neutral-200 dark:border-slate-700 p-4 shadow-sm">
          <h3 className="text-sm font-bold text-navy-900 dark:text-slate-100 mb-3 flex items-center gap-2">
            <BarChart3 size={16} className="text-emerald-600 dark:text-emerald-400" /> Ações por Tipo
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.porAcao.slice(0, 10)} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="acao" tick={{ fontSize: 11 }} width={80} />
                <Tooltip formatter={(value: number) => [`${value} ações`, 'Total']} />
                <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                  {data.porAcao.slice(0, 10).map((entry, index) => (
                    <Cell key={index} fill={ACAO_CORES[entry.acao] || `hsl(${index * 45}, 60%, 50%)`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-neutral-200 dark:border-slate-700 p-4 shadow-sm">
          <h3 className="text-sm font-bold text-navy-900 dark:text-slate-100 mb-3 flex items-center gap-2">
            <Shield size={16} className="text-emerald-600 dark:text-emerald-400" /> Ações por Entidade
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieEntidade}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {pieEntidade.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [`${value} ações`, 'Total']} />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value) => <span className="text-[11px] text-neutral-600 dark:text-slate-400">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-neutral-200 dark:border-slate-700 p-4 shadow-sm">
        <h3 className="text-sm font-bold text-navy-900 dark:text-slate-100 mb-3 flex items-center gap-2">
          <TrendingUp size={16} className="text-emerald-600 dark:text-emerald-400" /> Ações por Dia
        </h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineDia} margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="data" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value: number) => [`${value} ações`, 'Total']} />
              <Line type="monotone" dataKey="total" stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-neutral-200 dark:border-slate-700 p-4 shadow-sm">
          <h3 className="text-sm font-bold text-navy-900 dark:text-slate-100 mb-3 flex items-center gap-2">
            <Users size={16} className="text-emerald-600 dark:text-emerald-400" /> Top Usuários
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {data.porUsuario.map((u) => (
              <div key={u.usuarioId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-slate-700">
                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                  {u.nome.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-navy-900 dark:text-slate-100 truncate">{u.nome}</p>
                </div>
                <span className="text-sm font-bold text-emerald-600">{u.total}</span>
              </div>
            ))}
            {data.porUsuario.length === 0 && (
              <p className="text-center py-4 text-neutral-400 dark:text-slate-500 text-sm">Nenhum usuário com ações</p>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-neutral-200 dark:border-slate-700 p-4 shadow-sm">
          <h3 className="text-sm font-bold text-navy-900 dark:text-slate-100 mb-3 flex items-center gap-2">
            <BarChart3 size={16} className="text-emerald-600 dark:text-emerald-400" /> Entidades Mais Movimentadas
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {data.topEntidades.map((e, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-slate-700">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-700 dark:text-blue-400 text-xs font-bold">
                  {e.entidade.substring(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-navy-900 dark:text-slate-100">{e.entidade}</p>
                  <p className="text-[10px] text-neutral-400 dark:text-slate-500 font-mono truncate">{e.entidadeId}</p>
                </div>
                <span className="text-sm font-bold text-blue-600">{e.total}</span>
              </div>
            ))}
            {data.topEntidades.length === 0 && (
              <p className="text-center py-4 text-neutral-400 dark:text-slate-500 text-sm">Nenhuma entidade registrada</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
