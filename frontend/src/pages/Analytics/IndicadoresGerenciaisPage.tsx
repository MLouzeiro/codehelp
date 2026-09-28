import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import {
  RefreshCw, TrendingUp, TrendingDown, Clock, CheckCircle, Users, Loader2,
  BarChart3, AlertTriangle, Target, DollarSign, MessageSquare, Award,
} from 'lucide-react';

interface IndicadorGeral {
  totalChamados: number;
  chamadosPorMes: number;
  mediaPorCliente: number;
  top10Clientes: { clienteId: string; clienteNome: string; total: number }[];
  tempoMedioResolucaoHoras: number;
  taxaResolucao: number;
  top10Motivos: { motivo: string; total: number }[];
  custoEstimado: number;
}

interface PerformanceAnalista {
  analistaId: string;
  analistaNome: string;
  totalChamados: number;
  chamadosResolvidos: number;
  taxaResolucao: number;
  tempoMedioResolucaoMin: number;
  csatMedio: number;
  ticketsPorCategoria: { categoria: string; total: number }[];
  ultimaAtividade: string | null;
  analiseQualitativa: string;
}

interface IndicadoresResponse {
  periodo: { inicio: string; fim: string; dias: number };
  indicadores: IndicadorGeral;
  performancePorAnalista: PerformanceAnalista[];
}

const PRESETS = [
  { label: '7 dias', value: 7 },
  { label: '30 dias', value: 30 },
  { label: '90 dias', value: 90 },
];

function formatCurrency(val: number): string {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}min`;
  return `${h}h`;
}

function StatusBadge({ value, thresholds }: { value: number; thresholds: [number, number] }) {
  const [bom, ruim] = thresholds;
  let color = 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
  let label = 'Bom';
  if (value < ruim) {
    color = 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    label = 'Crítico';
  } else if (value < bom) {
    color = 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
    label = 'Atenção';
  }
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{label}</span>;
}

export default function IndicadoresGerenciaisPage() {
  const [data, setData] = useState<IndicadoresResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [dias, setDias] = useState(30);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: result } = await api.get(`/analytics/indicadores-gerenciais?dias=${dias}`);
      setData(result);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Erro ao carregar indicadores');
    }
    setLoading(false);
  }, [dias]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-8 text-center">
        <AlertTriangle className="mx-auto text-red-500 mb-3" size={40} />
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <button onClick={loadData} className="btn-primary mt-4">Tentar novamente</button>
      </div>
    );
  }

  if (!data) return null;

  const { indicadores, performancePorAnalista, periodo } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Indicadores Gerenciais</h1>
          <p className="text-gray-500 dark:text-slate-400">
            Período: {periodo.dias} dias ({new Date(periodo.inicio).toLocaleDateString('pt-BR')} a {new Date(periodo.fim).toLocaleDateString('pt-BR')})
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex bg-gray-100 dark:bg-slate-700 rounded-lg p-1">
            {PRESETS.map(p => (
              <button
                key={p.value}
                onClick={() => setDias(p.value)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  dias === p.value
                    ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-slate-100 shadow-sm font-medium'
                    : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button onClick={loadData} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400">
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* Cards de Indicadores */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <CardIndicador
          icon={<BarChart3 size={20} />}
          label="Total Chamados"
          value={String(indicadores.totalChamados)}
          sub={`${indicadores.chamadosPorMes}/mês`}
          color="blue"
        />
        <CardIndicador
          icon={<Users size={20} />}
          label="Média/Cliente"
          value={String(indicadores.mediaPorCliente)}
          sub={`${indicadores.top10Clientes.length} clientes ativos`}
          color="purple"
        />
        <CardIndicador
          icon={<Clock size={20} />}
          label="Tempo Resolução"
          value={formatHours(indicadores.tempoMedioResolucaoHoras)}
          sub={<StatusBadge value={indicadores.tempoMedioResolucaoHoras} thresholds={[4, 24]} />}
          color="amber"
        />
        <CardIndicador
          icon={<CheckCircle size={20} />}
          label="Taxa Resolução"
          value={`${indicadores.taxaResolucao}%`}
          sub={<StatusBadge value={indicadores.taxaResolucao} thresholds={[70, 50]} />}
          color="green"
        />
        <CardIndicador
          icon={<DollarSign size={20} />}
          label="Custo Estimado"
          value={formatCurrency(indicadores.custoEstimado)}
          sub={`${indicadores.totalChamados} chamados`}
          color="red"
        />
      </div>

      {/* Top 10 Clientes */}
      <div className="card p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <Users size={18} /> Top 10 Clientes
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-slate-700">
                <th className="text-left py-2 px-3 text-gray-500 dark:text-slate-400 font-medium">#</th>
                <th className="text-left py-2 px-3 text-gray-500 dark:text-slate-400 font-medium">Cliente</th>
                <th className="text-right py-2 px-3 text-gray-500 dark:text-slate-400 font-medium">Chamados</th>
                <th className="text-right py-2 px-3 text-gray-500 dark:text-slate-400 font-medium">% do Total</th>
              </tr>
            </thead>
            <tbody>
              {indicadores.top10Clientes.map((c, i) => (
                <tr key={c.clienteId} className="border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50">
                  <td className="py-2 px-3 text-gray-400 dark:text-slate-500">{i + 1}</td>
                  <td className="py-2 px-3 text-gray-900 dark:text-slate-100 font-medium">{c.clienteNome}</td>
                  <td className="py-2 px-3 text-right text-gray-700 dark:text-slate-300">{c.total}</td>
                  <td className="py-2 px-3 text-right text-gray-500 dark:text-slate-400">
                    {indicadores.totalChamados > 0 ? Math.round((c.total / indicadores.totalChamados) * 100) : 0}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top 10 Motivos */}
      <div className="card p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <AlertTriangle size={18} /> Top 10 Motivos
        </h2>
        <div className="space-y-2">
          {indicadores.top10Motivos.map((m, i) => {
            const maxTotal = indicadores.top10Motivos[0]?.total || 1;
            const pct = Math.round((m.total / maxTotal) * 100);
            return (
              <div key={i} className="flex items-center gap-3">
                <span className="text-sm text-gray-500 dark:text-slate-400 w-6 text-right">{i + 1}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-900 dark:text-slate-100">{m.motivo}</span>
                    <span className="text-sm text-gray-500 dark:text-slate-400">{m.total}</span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Performance por Analista */}
      <div className="card p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <Award size={18} /> Performance por Analista
        </h2>
        {performancePorAnalista.length === 0 ? (
          <p className="text-gray-500 dark:text-slate-400 text-center py-4">Nenhum analista com chamados no período</p>
        ) : (
          <div className="space-y-4">
            {performancePorAnalista.map(a => (
              <div key={a.analistaId} className="border border-gray-200 dark:border-slate-700 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <span className="text-blue-600 dark:text-blue-400 font-bold text-sm">
                        {a.analistaNome.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-slate-100">{a.analistaNome}</h3>
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        {a.totalChamados} chamados · {a.chamadosResolvidos} resolvidos
                      </p>
                    </div>
                  </div>
                  <StatusBadge value={a.taxaResolucao} thresholds={[70, 50]} />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                  <div className="text-center">
                    <p className="text-lg font-bold text-gray-900 dark:text-slate-100">{a.taxaResolucao}%</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">Taxa Resolução</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-gray-900 dark:text-slate-100">{formatHours(a.tempoMedioResolucaoMin / 60)}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">Tempo Médio</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-gray-900 dark:text-slate-100">
                      {a.csatMedio > 0 ? `${a.csatMedio}/5` : 'N/A'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">CSAT</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-gray-900 dark:text-slate-100">{a.totalChamados}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">Total</p>
                  </div>
                </div>

                {a.ticketsPorCategoria.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Categorias:</p>
                    <div className="flex flex-wrap gap-1">
                      {a.ticketsPorCategoria.map(c => (
                        <span key={c.categoria} className="px-2 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 rounded text-xs">
                          {c.categoria} ({c.total})
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-3">
                  <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Análise Qualitativa:</p>
                  <p className="text-sm text-gray-700 dark:text-slate-300">{a.analiseQualitativa}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CardIndicador({
  icon, label, value, sub, color,
}: {
  icon: React.ReactNode; label: string; value: string; sub: React.ReactNode; color: string;
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
  };
  return (
    <div className="card p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorMap[color] || colorMap.blue}`}>
          {icon}
        </div>
        <span className="text-sm text-gray-500 dark:text-slate-400">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{value}</p>
      <div className="mt-1">{typeof sub === 'string' ? <p className="text-xs text-gray-500 dark:text-slate-400">{sub}</p> : sub}</div>
    </div>
  );
}
