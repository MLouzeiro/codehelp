import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  Headphones, Clock, Users, Code, Settings, DollarSign,
  AlertCircle, Loader2
} from 'lucide-react';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

interface HelpdeskMetrics {
  periodo: { inicio: string; fim: string; label: string };
  helpdesk: {
    totalChamadosMes: number;
    tempoMedioAtendimentoMin: number;
    ticketsComTempoResolvido: number;
    topClienteChamados: { clientId: string; nome: string; totalChamados: number } | null;
    rankingChamadosPorCliente: Array<{ clientId: string; nome: string; totalChamados: number }>;
  };
  horasDev: {
    totalMes: number;
    topCliente: { clientId: string; nome: string; horasDev: number } | null;
    rankingPorCliente: Array<{ clientId: string; nome: string; horasDev: number; totalOs: number }>;
    implantacoes: {
      total: number;
      concluidas: number;
      mediaHorasDevPorImplantacao: number;
    };
  };
  horasSuporte: {
    totalMes: number;
    porCategoria: Array<{ tipo: string; horasSuporte: number; totalOs: number; mediaPorOs: number }>;
  };
  implantacao: {
    precoMedio: number;
    totalComPreco: number;
  };
}

const tipoLabels: Record<string, string> = {
  treinamento: 'Treinamento',
  migracao: 'Migracao',
  configuracao: 'Configuracao',
  implantacao: 'Implantacao',
};

export default function HelpdeskBusinessMetrics() {
  const [metrics, setMetrics] = useState<HelpdeskMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/analytics/helpdesk-metrics');
      setMetrics(data);
    } catch (err: any) {
      console.error('[HelpdeskBusinessMetrics] Erro ao carregar:', err);
      setError(err?.response?.data?.error || 'Erro ao carregar metricas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMetrics(); }, [loadMetrics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={40} className="animate-spin text-codemed-500" />
          <span className="text-sm text-gray-500 dark:text-slate-400">Carregando metricas...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle size={40} className="text-red-400 mx-auto mb-2" />
          <p className="text-red-600 text-sm">{error}</p>
          <button onClick={loadMetrics} className="mt-3 text-sm text-codemed-600 hover:text-codemed-700 font-medium">
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  const formatHoras = (min: number) => {
    if (min < 60) return `${min}min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  };

  const formatCurrency = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Metricas de Helpdesk & Implantacao
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Periodo: {metrics.periodo.label}
          </p>
        </div>
        <button
          onClick={loadMetrics}
          className="px-4 py-2 text-sm bg-codemed-600 hover:bg-codemed-700 text-white rounded-lg font-medium transition-colors"
        >
          Atualizar
        </button>
      </div>

      {/* ═══════════════ HELPDESK / SUPORTE ═══════════════ */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Headphones size={20} className="text-codemed-500" />
          Helpdesk & Suporte
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Card 1: Total chamados */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Headphones size={20} className="text-blue-600" />
              </div>
              <span className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Chamados no Mes</span>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {metrics.helpdesk.totalChamadosMes}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {metrics.helpdesk.ticketsComTempoResolvido} resolvidos com tempo calculado
            </p>
          </div>

          {/* Card 2: Tempo medio */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <Clock size={20} className="text-amber-600" />
              </div>
              <span className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Tempo Medio</span>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {formatHoras(metrics.helpdesk.tempoMedioAtendimentoMin)}
            </p>
            <p className="text-xs text-gray-400 mt-1">por chamado atendido</p>
          </div>

          {/* Card 3: Top cliente */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <Users size={20} className="text-red-600" />
              </div>
              <span className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Mais Aciona</span>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {metrics.helpdesk.topClienteChamados?.totalChamados || 0}
            </p>
            <p className="text-xs text-gray-400 mt-1 truncate">
              {metrics.helpdesk.topClienteChamados?.nome || 'Nenhum'}
            </p>
          </div>

          {/* Card 4: Horas dev total */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Code size={20} className="text-purple-600" />
              </div>
              <span className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Horas Dev (Mes)</span>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {metrics.horasDev.totalMes.toFixed(1)}h
            </p>
            <p className="text-xs text-gray-400 mt-1 truncate">
              Top: {metrics.horasDev.topCliente?.nome || 'Nenhum'} ({metrics.horasDev.topCliente?.horasDev?.toFixed(1) || 0}h)
            </p>
          </div>
        </div>

        {/* Ranking de chamados por cliente */}
        {metrics.helpdesk.rankingChamadosPorCliente.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 p-5 mb-6">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
              Chamados por Cliente (Top 10)
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={metrics.helpdesk.rankingChamadosPorCliente} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" />
                <YAxis dataKey="nome" type="category" width={180} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="totalChamados" fill="#3B82F6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ═══════════════ IMPLANTACAO ═══════════════ */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Settings size={20} className="text-green-500" />
          Implantacao
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Card: Media horas dev implantacao */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <Code size={20} className="text-green-600" />
              </div>
              <span className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Horas Dev / Implantacao</span>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {metrics.horasDev.implantacoes.mediaHorasDevPorImplantacao}h
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {metrics.horasDev.implantacoes.concluidas} de {metrics.horasDev.implantacoes.total} concluidas
            </p>
          </div>

          {/* Card: Horas suporte */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <Headphones size={20} className="text-amber-600" />
              </div>
              <span className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Horas Suporte (Mes)</span>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {metrics.horasSuporte.totalMes.toFixed(1)}h
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Treinamento, Migracao, Configuracao
            </p>
          </div>

          {/* Card: Preco medio implantacao */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <DollarSign size={20} className="text-emerald-600" />
              </div>
              <span className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Preco Implantacao</span>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {metrics.implantacao.precoMedio > 0 ? formatCurrency(metrics.implantacao.precoMedio) : 'R$ 0,00'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {metrics.implantacao.totalComPreco} implantacoes com preco definido
            </p>
          </div>
        </div>

        {/* Horas de suporte por categoria */}
        {metrics.horasSuporte.porCategoria.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
                Horas de Suporte por Categoria
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={metrics.horasSuporte.porCategoria}
                    dataKey="horasSuporte"
                    nameKey="tipo"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ tipo, horasSuporte }) => `${tipoLabels[tipo] || tipo}: ${horasSuporte}h`}
                  >
                    {metrics.horasSuporte.porCategoria.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
                Detalhamento por Categoria
              </h3>
              <div className="space-y-3">
                {metrics.horasSuporte.porCategoria.map((cat) => (
                  <div key={cat.tipo} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {tipoLabels[cat.tipo] || cat.tipo}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">{cat.totalOs} OS realizadas</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{cat.horasSuporte}h</p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">Media: {cat.mediaPorOs}h/OS</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Ranking horas dev por cliente */}
        {metrics.horasDev.rankingPorCliente.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
              Horas de Dev por Cliente (Top 10)
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={metrics.horasDev.rankingPorCliente} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tickFormatter={(v) => `${v}h`} />
                <YAxis dataKey="nome" type="category" width={180} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => `${v}h`} />
                <Bar dataKey="horasDev" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
