import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useSSE } from '../../hooks/useSSE';
import {
  RefreshCw, Users, Clock, AlertTriangle, Eye, Filter, Search,
  ChevronDown, ChevronRight, Wifi, WifiOff, Timer, Pause, Play,
  MessageSquare, XCircle, BarChart3, Activity, Zap, Bell, Target,
} from 'lucide-react';

interface AnalystOperational {
  userId: string;
  name: string;
  email: string;
  role: string;
  avatar?: string | null;
  departmentNames: string[];
  status: string;
  statusLabel: string;
  statusIcon: string;
  currentTicketId?: string;
  currentTicketProtocolo?: string;
  currentTicketSubject?: string;
  currentClientName?: string;
  currentDepartment?: string;
  currentChannel?: string;
  currentPriority?: string;
  currentSlaPercent?: number;
  currentSlaStatus?: string;
  timeInStatusMs: number;
  timeInStatusLabel: string;
  lastActivityAt?: string;
  lastActivityType?: string;
  lastActivityLabel?: string;
  idleMs: number;
  idleLevel: string;
  idleLabel: string;
  activeTicketsCount: number;
  totalTicketsToday: number;
  pause?: { startedAt: string; reason?: string; durationMs: number };
  online: boolean;
  lastSeenAt?: string;
}

interface OperationalSnapshot {
  timestamp: string;
  analysts: AnalystOperational[];
  summary: {
    totalOnline: number;
    emAtendimento: number;
    disponiveis: number;
    aguardandoCliente: number;
    emPausa: number;
    offline: number;
    semAtividade: number;
  };
  queue: {
    total: number;
    averageWaitLabel: string;
    oldestWaitLabel: string;
    byDepartment: { departmentId: string; departmentName: string; count: number }[];
  };
  alerts: {
    id: string;
    type: string;
    severity: string;
    title: string;
    description: string;
    userId?: string;
    ticketId?: string;
    departmentName?: string;
    timestamp: string;
  }[];
}

interface TimelineEntry {
  timestamp: string;
  type: string;
  label: string;
  ticketId?: string;
  ticketProtocolo?: string;
  details?: string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string; border: string }> = {
  em_atendimento: { bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500', border: 'border-emerald-200 dark:border-emerald-800' },
  disponivel: { bg: 'bg-blue-50 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-400', dot: 'bg-blue-500', border: 'border-blue-200 dark:border-blue-800' },
  aguardando_cliente: { bg: 'bg-purple-50 dark:bg-purple-950/40', text: 'text-purple-700 dark:text-purple-400', dot: 'bg-purple-500', border: 'border-purple-200 dark:border-purple-800' },
  aguardando_departamento: { bg: 'bg-purple-50 dark:bg-purple-950/40', text: 'text-purple-700 dark:text-purple-400', dot: 'bg-purple-500', border: 'border-purple-200 dark:border-purple-800' },
  aguardando_sistema: { bg: 'bg-purple-50 dark:bg-purple-950/40', text: 'text-purple-700 dark:text-purple-400', dot: 'bg-purple-500', border: 'border-purple-200 dark:border-purple-800' },
  em_pausa: { bg: 'bg-orange-50 dark:bg-orange-950/40', text: 'text-orange-700 dark:text-orange-400', dot: 'bg-orange-500', border: 'border-orange-200 dark:border-orange-800' },
  offline: { bg: 'bg-red-50 dark:bg-red-950/40', text: 'text-red-700 dark:text-red-400', dot: 'bg-red-500', border: 'border-red-200 dark:border-red-800' },
  sem_atividade: { bg: 'bg-slate-50 dark:bg-slate-800', text: 'text-slate-500 dark:text-slate-400', dot: 'bg-slate-400', border: 'border-slate-200 dark:border-slate-700' },
};

const PRIORITY_COLORS: Record<string, string> = {
  urgente: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  critica: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  alta: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  media: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  baixa: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
};

const IDLE_COLORS: Record<string, string> = {
  nenhum: 'text-emerald-600 dark:text-emerald-400',
  recente: 'text-emerald-600 dark:text-emerald-400',
  baixa: 'text-yellow-600 dark:text-yellow-400',
  ociosidade: 'text-orange-600 dark:text-orange-400',
  ociosidade_elevada: 'text-red-600 dark:text-red-400',
  critica: 'text-red-700 dark:text-red-300 font-bold',
};

const SEVERITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  critico: { bg: 'bg-red-50 dark:bg-red-950/40', text: 'text-red-700 dark:text-red-400', border: 'border-red-200 dark:border-red-800' },
  atencao: { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800' },
  info: { bg: 'bg-blue-50 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800' },
};

function formatMs(ms: number): string {
  if (ms < 0) return '0s';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return rs > 0 ? `${m}min ${rs}s` : `${m}min`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}h ${rm}min` : `${h}h`;
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '-';
  const ms = Date.now() - new Date(dateStr).getTime();
  return formatMs(ms);
}

export default function CentralOperacaoPage() {
  const [snapshot, setSnapshot] = useState<OperationalSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroDepto, setFiltroDepto] = useState('');
  const [busca, setBusca] = useState('');
  const [selectedAnalyst, setSelectedAnalyst] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'tabela'>('cards');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchSnapshot = useCallback(async () => {
    try {
      const res = await api.get('/helpdesk/operacao/snapshot');
      setSnapshot(res.data);
      setLastUpdate(new Date());
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSnapshot();
    const interval = setInterval(fetchSnapshot, 30000);
    return () => clearInterval(interval);
  }, [fetchSnapshot]);

  const { connected, lastEventTime } = useSSE({
    url: '/api/helpdesk/operacao/sse',
    onEvent: useCallback((data: any) => {
      if (data.type === 'heartbeat') return;
      fetchSnapshot();
    }, [fetchSnapshot]),
  });

  const fetchTimeline = useCallback(async (userId: string) => {
    setTimelineLoading(true);
    try {
      const res = await api.get(`/helpdesk/operacao/analista/${userId}/timeline`);
      setTimeline(res.data);
    } catch {
      setTimeline([]);
    } finally {
      setTimelineLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedAnalyst) fetchTimeline(selectedAnalyst);
  }, [selectedAnalyst, fetchTimeline]);

  const departments = useMemo(() => {
    if (!snapshot) return [];
    const deptMap = new Map<string, string>();
    for (const a of snapshot.analysts) {
      for (const d of a.departmentNames) deptMap.set(d, d);
    }
    return Array.from(deptMap.values()).sort();
  }, [snapshot]);

  const filteredAnalysts = useMemo(() => {
    if (!snapshot) return [];
    let list = snapshot.analysts;
    if (filtroStatus !== 'todos') {
      list = list.filter(a => a.status === filtroStatus);
    }
    if (filtroDepto) {
      list = list.filter(a => a.departmentNames.includes(filtroDepto));
    }
    if (busca) {
      const q = busca.toLowerCase();
      list = list.filter(a => a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q));
    }
    return list;
  }, [snapshot, filtroStatus, filtroDepto, busca]);

  if (loading && !snapshot) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
          <span className="text-sm text-slate-500">Carregando Central de Operação...</span>
        </div>
      </div>
    );
  }

  if (error && !snapshot) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <button onClick={fetchSnapshot} className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  const s = snapshot?.summary;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
            <Activity className="w-7 h-7 text-blue-600" />
            Central de Operação
          </h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              {connected ? (
                <><Wifi className="w-3.5 h-3.5 text-emerald-500" /> <span className="text-emerald-600 dark:text-emerald-400">Conectado</span></>
              ) : (
                <><WifiOff className="w-3.5 h-3.5 text-red-500" /> <span className="text-red-600 dark:text-red-400">Desconectado</span></>
              )}
            </span>
            <span>Atualizado: {lastUpdate.toLocaleTimeString('pt-BR')}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode(viewMode === 'cards' ? 'tabela' : 'cards')}
            className="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            {viewMode === 'cards' ? '📊 Tabela' : '🃏 Cards'}
          </button>
          <button onClick={fetchSnapshot} className="p-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {s && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          {[
            { label: 'Online', value: s.totalOnline, icon: <Wifi className="w-4 h-4" />, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
            { label: 'Em Atendimento', value: s.emAtendimento, icon: <MessageSquare className="w-4 h-4" />, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
            { label: 'Disponíveis', value: s.disponiveis, icon: <Users className="w-4 h-4" />, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/40' },
            { label: 'Aguardando', value: s.aguardandoCliente, icon: <Clock className="w-4 h-4" />, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950/40' },
            { label: 'Em Pausa', value: s.emPausa, icon: <Pause className="w-4 h-4" />, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950/40' },
            { label: 'Offline', value: s.offline, icon: <WifiOff className="w-4 h-4" />, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/40' },
            { label: 'Fila', value: snapshot?.queue.total || 0, icon: <Target className="w-4 h-4" />, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/40' },
          ].map((card) => (
            <div key={card.label} className={`${card.bg} rounded-xl border border-slate-200 dark:border-slate-700 p-3`}>
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                <span className={card.color}>{card.icon}</span>
                {card.label}
              </div>
              <div className={`text-2xl font-bold ${card.color}`} style={{ fontFamily: 'Khand, sans-serif' }}>
                {card.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Queue Info */}
      {snapshot?.queue && snapshot.queue.total > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-amber-600" />
            <span className="font-semibold text-amber-800 dark:text-amber-300">Fila de Atendimento</span>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="text-amber-700 dark:text-amber-400">{snapshot.queue.total} aguardando</span>
            <span className="text-amber-600 dark:text-amber-500">Espera média: {snapshot.queue.averageWaitLabel}</span>
            <span className="text-amber-600 dark:text-amber-500">Mais antigo: {snapshot.queue.oldestWaitLabel}</span>
          </div>
          {snapshot.queue.byDepartment.length > 0 && (
            <div className="flex flex-wrap gap-3 mt-2">
              {snapshot.queue.byDepartment.map(d => (
                <span key={d.departmentId} className="text-xs bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">
                  {d.departmentName}: {d.count}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Alerts */}
      {snapshot?.alerts && snapshot.alerts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Bell className="w-4 h-4" />
            Atenção Agora ({snapshot.alerts.length})
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {snapshot.alerts.slice(0, 9).map(alert => {
              const sev = SEVERITY_COLORS[alert.severity] || SEVERITY_COLORS.info;
              return (
                <div
                  key={alert.id}
                  className={`${sev.bg} border ${sev.border} rounded-lg p-3 cursor-pointer hover:shadow-sm transition-shadow`}
                  onClick={() => alert.userId && setSelectedAnalyst(alert.userId)}
                >
                  <div className={`text-sm font-medium ${sev.text}`}>{alert.title}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{alert.description}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar analista..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
          />
        </div>
        <select
          value={filtroStatus}
          onChange={e => setFiltroStatus(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
        >
          <option value="todos">Todos</option>
          <option value="em_atendimento">Em Atendimento</option>
          <option value="disponivel">Disponíveis</option>
          <option value="aguardando_cliente">Aguardando Cliente</option>
          <option value="em_pausa">Em Pausa</option>
          <option value="offline">Offline</option>
        </select>
        <select
          value={filtroDepto}
          onChange={e => setFiltroDepto(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
        >
          <option value="">Todos departamentos</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {/* Analysts View */}
      {viewMode === 'cards' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredAnalysts.map(analyst => {
            const colors = STATUS_COLORS[analyst.status] || STATUS_COLORS.sem_atividade;
            const isSelected = selectedAnalyst === analyst.userId;
            return (
              <div
                key={analyst.userId}
                className={`rounded-xl border ${colors.border} ${colors.bg} p-4 cursor-pointer hover:shadow-md transition-all ${isSelected ? 'ring-2 ring-blue-500 shadow-lg' : ''}`}
                onClick={() => setSelectedAnalyst(isSelected ? null : analyst.userId)}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${colors.dot} ${analyst.online ? 'animate-pulse' : ''}`} />
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white text-sm">{analyst.name}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{analyst.departmentNames.join(', ') || 'Sem depto.'}</div>
                    </div>
                  </div>
                  <span className={`text-xs font-medium ${colors.text}`}>{analyst.statusIcon} {analyst.statusLabel}</span>
                </div>

                {/* Current Ticket */}
                {analyst.currentTicketId && (
                  <div className="bg-white/60 dark:bg-slate-800/60 rounded-lg p-2.5 mb-3 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="font-mono text-slate-600 dark:text-slate-300">#{analyst.currentTicketProtocolo || analyst.currentTicketId.slice(0, 8)}</span>
                      {analyst.currentPriority && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[analyst.currentPriority] || ''}`}>
                          {analyst.currentPriority}
                        </span>
                      )}
                    </div>
                    {analyst.currentClientName && (
                      <div className="text-xs text-slate-600 dark:text-slate-300 truncate">{analyst.currentClientName}</div>
                    )}
                    {analyst.currentTicketSubject && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{analyst.currentTicketSubject}</div>
                    )}
                    <div className="flex flex-wrap gap-2 text-[10px] text-slate-400 dark:text-slate-500">
                      {analyst.currentChannel && <span>{analyst.currentChannel}</span>}
                      {analyst.currentDepartment && <span>{analyst.currentDepartment}</span>}
                    </div>
                    {analyst.currentSlaPercent !== undefined && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${analyst.currentSlaPercent > 90 ? 'bg-red-500' : analyst.currentSlaPercent > 75 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${Math.min(analyst.currentSlaPercent, 100)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-500">{Math.round(analyst.currentSlaPercent)}%</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 dark:text-slate-500">Tempo no estado:</span>
                    <div className="font-medium text-slate-700 dark:text-slate-300">{analyst.timeInStatusLabel}</div>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500">Última atividade:</span>
                    <div className="font-medium text-slate-700 dark:text-slate-300">{analyst.lastActivityLabel || '-'}</div>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500">Faz:</span>
                    <div className={`font-medium ${IDLE_COLORS[analyst.idleLevel] || ''}`}>{analyst.idleLabel}</div>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500">Chamados hoje:</span>
                    <div className="font-medium text-slate-700 dark:text-slate-300">{analyst.totalTicketsToday} ({analyst.activeTicketsCount} ativos)</div>
                  </div>
                </div>

                {/* Pause Info */}
                {analyst.pause && (
                  <div className="mt-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg p-2 text-xs">
                    <div className="font-medium text-orange-700 dark:text-orange-400">
                      🟠 Em pausa{analyst.pause.reason ? `: ${analyst.pause.reason}` : ''}
                    </div>
                    <div className="text-orange-600 dark:text-orange-500">
                      Início: {new Date(analyst.pause.startedAt).toLocaleTimeString('pt-BR')} — {formatMs(analyst.pause.durationMs)}
                    </div>
                  </div>
                )}

                {/* Link */}
                {analyst.currentTicketId && (
                  <Link
                    to={`/helpdesk/ticket/${analyst.currentTicketId}`}
                    onClick={e => e.stopPropagation()}
                    className="mt-2 flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <Eye className="w-3 h-3" /> Ver atendimento
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">Analista</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">Status</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">Atividade</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">Cliente</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">Chamado</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">Depto</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">Canal</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">Estado</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">Atendimento</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">Última Ativ.</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">Chamados</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">SLA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredAnalysts.map(a => {
                const colors = STATUS_COLORS[a.status] || STATUS_COLORS.sem_atividade;
                return (
                  <tr key={a.userId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer" onClick={() => setSelectedAnalyst(selectedAnalyst === a.userId ? null : a.userId)}>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
                        <div>
                          <div className="font-medium text-slate-900 dark:text-white">{a.name}</div>
                          <div className="text-[10px] text-slate-400">{a.departmentNames.join(', ')}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2"><span className={`text-xs font-medium ${colors.text}`}>{a.statusIcon} {a.statusLabel}</span></td>
                    <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-300">{a.lastActivityLabel || '-'}</td>
                    <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-300 max-w-[120px] truncate">{a.currentClientName || '-'}</td>
                    <td className="px-3 py-2 text-xs font-mono text-slate-600 dark:text-slate-300">{a.currentTicketProtocolo ? `#${a.currentTicketProtocolo}` : '-'}</td>
                    <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-300">{a.currentDepartment || '-'}</td>
                    <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-300">{a.currentChannel || '-'}</td>
                    <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-300">{a.timeInStatusLabel}</td>
                    <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                      {a.currentTicketId ? (
                        <Link to={`/helpdesk/ticket/${a.currentTicketId}`} onClick={e => e.stopPropagation()} className="text-blue-600 dark:text-blue-400 hover:underline">
                          Ver
                        </Link>
                      ) : '-'}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-300">{timeAgo(a.lastActivityAt)}</td>
                    <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-300">{a.totalTicketsToday} ({a.activeTicketsCount})</td>
                    <td className="px-3 py-2">
                      {a.currentSlaPercent !== undefined ? (
                        <div className="flex items-center gap-1">
                          <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${a.currentSlaPercent > 90 ? 'bg-red-500' : a.currentSlaPercent > 75 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(a.currentSlaPercent, 100)}%` }} />
                          </div>
                          <span className="text-[10px] text-slate-500">{Math.round(a.currentSlaPercent)}%</span>
                        </div>
                      ) : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Timeline Drawer */}
      {selectedAnalyst && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 shadow-2xl z-50 overflow-y-auto">
          <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 p-4 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">
                {snapshot?.analysts.find(a => a.userId === selectedAnalyst)?.name}
              </h3>
              <p className="text-xs text-slate-500">Timeline do dia</p>
            </div>
            <button onClick={() => setSelectedAnalyst(null)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
              <XCircle className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          <div className="p-4">
            {timelineLoading ? (
              <div className="flex justify-center py-8"><RefreshCw className="w-6 h-6 text-blue-500 animate-spin" /></div>
            ) : timeline.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">Nenhum evento registrado hoje.</p>
            ) : (
              <div className="space-y-3">
                {timeline.map((entry, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-500 mt-1" />
                      {i < timeline.length - 1 && <div className="w-0.5 flex-1 bg-slate-200 dark:bg-slate-700 mt-1" />}
                    </div>
                    <div className="pb-4">
                      <div className="text-xs text-slate-400 dark:text-slate-500">
                        {new Date(entry.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{entry.label}</div>
                      {entry.ticketProtocolo && (
                        <Link to={`/helpdesk/ticket/${entry.ticketId}`} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                          #{entry.ticketProtocolo}
                        </Link>
                      )}
                      {entry.details && <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{entry.details}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
