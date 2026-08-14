import { useState, useEffect, useCallback } from 'react';
import {
  Play, Pause, Clock, Plus, Trash2, Filter, Download,
  Calendar, User, Tag, FileText, CheckCircle2, Timer,
  BarChart3, TrendingUp, DollarSign,
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../services/auth';
import { useThemeSettings } from '../../services/ThemeContext';

interface TimeEntry {
  id: string;
  tipo: string;
  descricao: string | null;
  dataInicio: string;
  dataFim: string | null;
  duracaoMin: number | null;
  billable: boolean;
  faturado: boolean;
  tags: string[];
  usuario: { id: string; name: string };
  ticket: { id: string; assunto: string; protocolo: string } | null;
  order: { id: string; numeroOs: string; tipoServico: string } | null;
}

interface ConsumptionRow {
  id: string;
  nome: string;
  atendimentoMin: number;
  desenvolvimentoMin: number;
  implantacaoMin: number;
  outroMin: number;
  totalMin: number;
  entradas: number;
}

interface Summary {
  totalHoras: number;
  totalBillableHoras: number;
  totalFaturadoHoras: number;
  totalEntradas: number;
  byType: Record<string, { total: number; billable: number; count: number }>;
  byUser: Record<string, { total: number; billable: number; count: number }>;
  byDay: Record<string, number>;
}

const TIPOS = [
  { value: 'dev', label: 'Desenvolvimento', color: '#6366f1' },
  { value: 'suporte', label: 'Suporte', color: '#22c55e' },
  { value: 'implantacao', label: 'Implantação', color: '#f59e0b' },
  { value: 'treinamento', label: 'Treinamento', color: '#3b82f6' },
  { value: 'reuniao', label: 'Reunião', color: '#8b5cf6' },
  { value: 'outro', label: 'Outro', color: '#6b7280' },
];

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m}m`;
}

function formatHours(h: number): string {
  return `${h.toFixed(1)}h`;
}

function formatElapsed(start: string): string {
  const diff = Date.now() - new Date(start).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function TimeTrackingPage() {
  const { user } = useAuth();
  const { theme } = useThemeSettings();
  const isDark = theme === 'dark';
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [running, setRunning] = useState<TimeEntry | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    tipo: 'suporte',
    descricao: '',
    duracaoMin: 60,
    billable: true,
    ticketId: '',
    orderId: '',
    tags: '',
  });
  const [filters, setFilters] = useState({
    tipo: '',
    from: '',
    to: '',
    billable: '' as string,
  });
  const [elapsed, setElapsed] = useState('');
  const [now, setNow] = useState(Date.now());
  const [consumption, setConsumption] = useState<ConsumptionRow[]>([]);
  const [showConsumption, setShowConsumption] = useState(false);

  // Tick every second to update elapsed time
  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [running]);

  useEffect(() => {
    if (running) {
      setElapsed(formatElapsed(running.dataInicio));
    }
  }, [now, running]);

  const loadEntries = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filters.tipo) params.tipo = filters.tipo;
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;
      if (filters.billable) params.billable = filters.billable;

      const [entriesRes, runningRes, summaryRes] = await Promise.all([
        api.get('/timetracking', { params }),
        api.get('/timetracking/running'),
        api.get('/timetracking/summary', {
          params: { from: filters.from || undefined, to: filters.to || undefined },
        }),
      ]);
      setEntries(entriesRes.data);
      setRunning(runningRes.data);
      setSummary(summaryRes.data);
      if (showConsumption) {
        const consumptionRes = await api.get('/timetracking/consumption/client', {
          params: { from: filters.from || undefined, to: filters.to || undefined },
        });
        setConsumption(consumptionRes.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters, showConsumption]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const handleStart = async (tipo?: string) => {
    try {
      const { data } = await api.post('/timetracking/start', {
        tipo: tipo || 'suporte',
        descricao: '',
      });
      setRunning(data);
      loadEntries();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao iniciar timer');
    }
  };

  const handleStop = async () => {
    if (!running) return;
    try {
      await api.post(`/timetracking/${running.id}/stop`);
      setRunning(null);
      loadEntries();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao parar timer');
    }
  };

  const handleCreateManual = async () => {
    try {
      await api.post('/timetracking', {
        tipo: form.tipo,
        descricao: form.descricao || undefined,
        duracaoMin: form.duracaoMin,
        billable: form.billable,
        ticketId: form.ticketId || undefined,
        orderId: form.orderId || undefined,
        tags: form.tags ? form.tags.split(',').map((t) => t.trim()) : [],
      });
      setShowForm(false);
      setForm({ tipo: 'suporte', descricao: '', duracaoMin: 60, billable: true, ticketId: '', orderId: '', tags: '' });
      loadEntries();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao criar entrada');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta entrada de tempo?')) return;
    try {
      await api.delete(`/timetracking/${id}`);
      loadEntries();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao excluir');
    }
  };

  const loadConsumption = useCallback(async () => {
    try {
      const res = await api.get('/timetracking/consumption/client', {
        params: { from: filters.from || undefined, to: filters.to || undefined },
      });
      setConsumption(res.data);
    } catch (err) {
      console.error(err);
    }
  }, [filters.from, filters.to]);

  const toggleConsumption = () => {
    setShowConsumption((v) => {
      const next = !v;
      if (next) loadConsumption();
      return next;
    });
  };

  const tipoMap = Object.fromEntries(TIPOS.map((t) => [t.value, t]));

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-2xl font-bold flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>
            <Timer size={24} /> Time Tracking
          </h1>
          <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Registre suas horas de desenvolvimento e implantação</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleConsumption}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${showConsumption ? 'bg-blue-600 border-blue-600 text-white' : isDark ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
          >
            <BarChart3 size={16} /> Consumo por Cliente
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
          >
            <Plus size={16} /> Entrada Manual
          </button>
        </div>
      </div>

      {/* Running Timer */}
      {running ? (
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-80 mb-1">Timer rodando</p>
              <div className="text-4xl font-mono font-bold tracking-wider">{elapsed}</div>
              <div className="flex items-center gap-3 mt-2 text-sm opacity-90">
                <span className="flex items-center gap-1">
                  <Tag size={14} />
                  {tipoMap[running.tipo]?.label || running.tipo}
                </span>
                {running.descricao && (
                  <span className="flex items-center gap-1">
                    <FileText size={14} />
                    {running.descricao}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={handleStop}
              className="flex items-center gap-2 px-6 py-3 bg-white/20 hover:bg-white/30 rounded-xl font-medium transition-colors"
            >
              <Pause size={20} /> Parar
            </button>
          </div>
        </div>
      ) : (
        <div className={`border-2 border-dashed rounded-2xl p-6 ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-gray-200'}`}>
          <p className={`mb-3 font-medium ${isDark ? 'text-slate-300' : 'text-gray-500'}`}>Iniciar novo timer</p>
          <div className="flex flex-wrap gap-2">
            {TIPOS.map((t) => (
              <button
                key={t.value}
                onClick={() => handleStart(t.value)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105"
                style={{ backgroundColor: t.color + '15', color: t.color, border: `1px solid ${t.color}30` }}
              >
                <Play size={14} /> {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Manual Entry Form */}
      {showForm && (
        <div className={`border rounded-xl p-6 shadow-sm ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
          <h3 className={`font-semibold mb-4 ${isDark ? 'text-slate-100' : 'text-gray-800'}`}>Nova Entrada Manual</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className={`text-xs font-medium mb-1 block ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Tipo</label>
              <select
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                className="input w-full"
              >
                {TIPOS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={`text-xs font-medium mb-1 block ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Duração (minutos)</label>
              <input
                type="number"
                value={form.duracaoMin}
                onChange={(e) => setForm({ ...form, duracaoMin: parseInt(e.target.value) || 0 })}
                className="input w-full"
                min={1}
              />
            </div>
            <div className="md:col-span-2">
              <label className={`text-xs font-medium mb-1 block ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Descrição</label>
              <input
                type="text"
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                placeholder="Ex: Correção de bug no módulo de pedidos"
                className="input w-full"
              />
            </div>
            <div>
              <label className={`text-xs font-medium mb-1 block ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Ticket ID (opcional)</label>
              <input
                type="text"
                value={form.ticketId}
                onChange={(e) => setForm({ ...form, ticketId: e.target.value })}
                className="input w-full"
              />
            </div>
            <div>
              <label className={`text-xs font-medium mb-1 block ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>OS ID (opcional)</label>
              <input
                type="text"
                value={form.orderId}
                onChange={(e) => setForm({ ...form, orderId: e.target.value })}
                className="input w-full"
              />
            </div>
            <div>
              <label className={`text-xs font-medium mb-1 block ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Tags (separadas por vírgula)</label>
              <input
                type="text"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="Ex: frontend, bug, urgente"
                className="input w-full"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.billable}
                  onChange={(e) => setForm({ ...form, billable: e.target.checked })}
                  className="rounded"
                />
                <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>Cobrável</span>
              </label>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleCreateManual} className="btn-primary text-sm">Salvar</button>
            <button onClick={() => setShowForm(false)} className="btn-secondary text-sm">Cancelar</button>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className={`border rounded-xl p-4 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
            <div className={`flex items-center gap-2 text-sm mb-1 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
              <Clock size={14} /> Total
            </div>
            <div className={`text-2xl font-bold ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>{formatHours(summary.totalHoras)}</div>
            <div className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>{summary.totalEntradas} entradas</div>
          </div>
          <div className={`border rounded-xl p-4 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center gap-2 text-green-600 text-sm mb-1">
              <DollarSign size={14} /> Cobrável
            </div>
            <div className="text-2xl font-bold text-green-600">{formatHours(summary.totalBillableHoras)}</div>
            <div className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
              {summary.totalHoras > 0 ? Math.round((summary.totalBillableHoras / summary.totalHoras) * 100) : 0}% do total
            </div>
          </div>
          <div className={`border rounded-xl p-4 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center gap-2 text-blue-600 text-sm mb-1">
              <CheckCircle2 size={14} /> Faturado
            </div>
            <div className="text-2xl font-bold text-blue-600">{formatHours(summary.totalFaturadoHoras)}</div>
            <div className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
              {summary.totalBillableHoras > 0 ? Math.round((summary.totalFaturadoHoras / summary.totalBillableHoras) * 100) : 0}% do cobrável
            </div>
          </div>
          <div className={`border rounded-xl p-4 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center gap-2 text-purple-600 text-sm mb-1">
              <BarChart3 size={14} /> Por Tipo
            </div>
            <div className="space-y-1 mt-2">
              {Object.entries(summary.byType)
                .sort((a, b) => b[1].total - a[1].total)
                .slice(0, 3)
                .map(([tipo, data]) => (
                  <div key={tipo} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tipoMap[tipo]?.color || '#6b7280' }} />
                      {tipoMap[tipo]?.label || tipo}
                    </span>
                    <span className="font-medium">{formatHours(data.total / 60)}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Consumo por Cliente */}
      {showConsumption && (
        <div className={`border rounded-xl overflow-hidden ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
          <div className={`px-4 py-3 border-b flex items-center justify-between ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <BarChart3 size={16} className="text-blue-500" />
              <span className={isDark ? 'text-slate-200' : 'text-gray-800'}>Consumo por Cliente</span>
            </div>
            <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
              {consumption.length} clientes
            </div>
          </div>
          {consumption.length === 0 ? (
            <div className={`text-center py-8 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
              <p className="text-sm">Nenhum consumo registrado no período</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={`border-b ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
                  <tr>
                    <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Cliente</th>
                    <th className={`px-4 py-3 text-right text-xs font-medium uppercase text-green-600`}>Atendimento</th>
                    <th className={`px-4 py-3 text-right text-xs font-medium uppercase text-indigo-600`}>Desenvolvimento</th>
                    <th className={`px-4 py-3 text-right text-xs font-medium uppercase text-amber-600`}>Implantação</th>
                    <th className={`px-4 py-3 text-right text-xs font-medium uppercase ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Outro</th>
                    <th className={`px-4 py-3 text-right text-xs font-medium uppercase ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>Total</th>
                    <th className={`px-4 py-3 text-center text-xs font-medium uppercase ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Entradas</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-slate-700' : 'divide-gray-100'}`}>
                  {consumption.map((row) => (
                    <tr key={row.id} className="hover:bg-opacity-50">
                      <td className={`px-4 py-3 text-sm font-medium ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>{row.nome}</td>
                      <td className="px-4 py-3 text-right text-sm text-green-600">{formatMinutes(row.atendimentoMin)}</td>
                      <td className="px-4 py-3 text-right text-sm text-indigo-600">{formatMinutes(row.desenvolvimentoMin)}</td>
                      <td className="px-4 py-3 text-right text-sm text-amber-600">{formatMinutes(row.implantacaoMin)}</td>
                      <td className={`px-4 py-3 text-right text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{formatMinutes(row.outroMin)}</td>
                      <td className={`px-4 py-3 text-right text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>{formatMinutes(row.totalMin)}</td>
                      <td className={`px-4 py-3 text-center text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{row.entradas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className={`border rounded-xl p-4 flex flex-wrap items-end gap-3 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
        <div className={`flex items-center gap-2 text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
          <Filter size={14} /> Filtros
        </div>
        <div>
          <label className={`text-xs block mb-1 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Tipo</label>
          <select
            value={filters.tipo}
            onChange={(e) => setFilters({ ...filters, tipo: e.target.value })}
            className="input text-sm"
          >
            <option value="">Todos</option>
            {TIPOS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={`text-xs block mb-1 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>De</label>
          <input
            type="date"
            value={filters.from}
            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
            className="input text-sm"
          />
        </div>
        <div>
          <label className={`text-xs block mb-1 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Até</label>
          <input
            type="date"
            value={filters.to}
            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
            className="input text-sm"
          />
        </div>
        <div>
          <label className={`text-xs block mb-1 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Cobrável</label>
          <select
            value={filters.billable}
            onChange={(e) => setFilters({ ...filters, billable: e.target.value })}
            className="input text-sm"
          >
            <option value="">Todos</option>
            <option value="true">Sim</option>
            <option value="false">Não</option>
          </select>
        </div>
        <button
          onClick={() => setFilters({ tipo: '', from: '', to: '', billable: '' })}
          className={`text-sm underline ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Limpar
        </button>
      </div>

      {/* Timesheet Table */}
      <div className={`border rounded-xl overflow-hidden ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className={`w-8 h-8 border-2 rounded-full animate-spin ${isDark ? 'border-slate-600 border-t-blue-500' : 'border-gray-200 border-t-blue-600'}`} />
          </div>
        ) : entries.length === 0 ? (
          <div className={`text-center py-12 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
            <Timer size={40} className="mx-auto mb-2 opacity-30" />
            <p className="font-medium">Nenhuma entrada registrada</p>
            <p className="text-sm mt-1">Inicie um timer ou crie uma entrada manual</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className={`border-b ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
              <tr>
                <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Data</th>
                <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Tipo</th>
                <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Descrição</th>
                <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Vinculado</th>
                <th className={`px-4 py-3 text-right text-xs font-medium uppercase ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Duração</th>
                <th className={`px-4 py-3 text-center text-xs font-medium uppercase ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Cobrável</th>
                <th className={`px-4 py-3 text-center text-xs font-medium uppercase ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Faturado</th>
                <th className={`px-4 py-3 text-right text-xs font-medium uppercase ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Ações</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-slate-700' : 'divide-gray-100'}`}>
              {entries.map((entry) => {
                const t = tipoMap[entry.tipo];
                return (
                  <tr key={entry.id} className={isDark ? 'hover:bg-slate-700/50' : 'hover:bg-gray-50'}>
                    <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>
                      {new Date(entry.dataInicio).toLocaleDateString('pt-BR')}
                      <br />
                      <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                        {new Date(entry.dataInicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        {entry.dataFim && ` — ${new Date(entry.dataFim).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ backgroundColor: (t?.color || '#6b7280') + '15', color: t?.color || '#6b7280' }}
                      >
                        {t?.label || entry.tipo}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-sm max-w-xs truncate ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>{entry.descricao || '—'}</td>
                    <td className={`px-4 py-3 text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                      {entry.ticket && <div>Ticket: {entry.ticket.protocolo || entry.ticket.id.slice(0, 8)}</div>}
                      {entry.order && <div>OS: {entry.order.numeroOs}</div>}
                      {!entry.ticket && !entry.order && '—'}
                    </td>
                    <td className={`px-4 py-3 text-sm font-medium text-right ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>
                      {entry.dataFim && entry.duracaoMin ? formatMinutes(entry.duracaoMin) : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {entry.billable ? (
                        <CheckCircle2 size={14} className="text-green-500 mx-auto" />
                      ) : (
                        <span className={isDark ? 'text-slate-600' : 'text-gray-300'}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {entry.faturado ? (
                        <CheckCircle2 size={14} className="text-blue-500 mx-auto" />
                      ) : (
                        <span className={isDark ? 'text-slate-600' : 'text-gray-300'}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className={`transition-colors ${isDark ? 'text-slate-500 hover:text-red-400' : 'text-gray-400 hover:text-red-500'}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
