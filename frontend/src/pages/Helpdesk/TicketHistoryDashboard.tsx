import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  Clock,
  MessageSquare,
  Bot,
  User,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Download,
  Filter,
} from 'lucide-react';
import api from '../../services/api';
import type { TicketReplayData, TicketEvent, TicketAiLog, TicketSlaLog } from '../../types';

interface TicketHistoryDashboardProps {
  ticketId: string;
}

type HistoryCategory =
  | 'all'
  | 'events'
  | 'timeline'
  | 'metrics'
  | 'sla'
  | 'activity'
  | 'wait_times'
  | 'ai_logs'
  | 'messages'
  | 'assignments'
  | 'priority_changes'
  | 'stage_changes'
  | 'notes'
  | 'escalations'
  | 'reopened'
  | 'closed';

const CATEGORY_LABELS: Record<HistoryCategory, string> = {
  all: 'Todos',
  events: 'Eventos',
  timeline: 'Timeline',
  metrics: 'Métricas',
  sla: 'SLA',
  activity: 'Atividades',
  wait_times: 'Tempos de Espera',
  ai_logs: 'Logs de IA',
  messages: 'Mensagens',
  assignments: 'Atribuições',
  priority_changes: 'Mudanças de Prioridade',
  stage_changes: 'Mudanças de Etapa',
  notes: 'Notas',
  escalations: 'Escalonamentos',
  reopened: 'Reaberturas',
  closed: 'Fechamentos',
};

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}min`;
}

export default function TicketHistoryDashboard({ ticketId }: TicketHistoryDashboardProps) {
  const [data, setData] = useState<TicketReplayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<HistoryCategory>('all');
  const [exporting, setExporting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: replayData } = await api.get(`/audit-ticket/tickets/${ticketId}/replay`);
      setData(replayData);
    } catch (err) {
      console.error('Erro ao carregar histórico:', err);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      setExporting(true);
      const { data } = await api.get(`/audit-ticket/tickets/${ticketId}/export`, {
        params: { format },
        responseType: format === 'json' ? 'json' : 'blob',
      });

      const blob = format === 'json'
        ? new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        : new Blob([data], { type: 'text/csv' });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ticket-${ticketId}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erro ao exportar:', err);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Calcular estatísticas
  const stats = {
    totalEvents: data.events.length,
    totalMessages: data.events.filter((e) => e.tipo.includes('message')).length,
    totalAiInteractions: data.aiLogs.length,
    totalSlaEvents: data.slaLogs.length,
    totalActivities: data.activities.length,
    totalWaitTimes: data.waitTimes.length,
    totalReaberturas: data.events.filter((e) => e.tipo === 'reopened').length,
    totalEscalonamentos: data.events.filter((e) => e.tipo === 'escalated').length,
    totalNotas: data.events.filter((e) => e.tipo === 'note_added').length,
    totalAtribuicoes: data.events.filter((e) => e.tipo === 'assignee_changed').length,
    totalMudancasPrioridade: data.events.filter((e) => e.tipo === 'priority_changed').length,
    totalMudancasEtapa: data.events.filter((e) => e.tipo === 'stage_changed').length,
    totalFechamentos: data.events.filter((e) => e.tipo === 'closed').length,
    tempoTotalMin: data.metrics?.tempoTotalMin || 0,
    slaStatus: data.metrics?.slaStatus || 'ok',
    custoTotalIa: data.aiLogs.reduce((acc, l) => acc + (l.custoUsd || 0), 0),
  };

  const categories: { key: HistoryCategory; count: number; icon: React.ReactNode }[] = [
    { key: 'all', count: stats.totalEvents, icon: <BarChart3 className="w-4 h-4" /> },
    { key: 'events', count: stats.totalEvents, icon: <Clock className="w-4 h-4" /> },
    { key: 'messages', count: stats.totalMessages, icon: <MessageSquare className="w-4 h-4" /> },
    { key: 'ai_logs', count: stats.totalAiInteractions, icon: <Bot className="w-4 h-4" /> },
    { key: 'sla', count: stats.totalSlaEvents, icon: <AlertTriangle className="w-4 h-4" /> },
    { key: 'activity', count: stats.totalActivities, icon: <User className="w-4 h-4" /> },
    { key: 'assignments', count: stats.totalAtribuicoes, icon: <User className="w-4 h-4" /> },
    { key: 'stage_changes', count: stats.totalMudancasEtapa, icon: <TrendingUp className="w-4 h-4" /> },
    { key: 'priority_changes', count: stats.totalMudancasPrioridade, icon: <TrendingDown className="w-4 h-4" /> },
    { key: 'notes', count: stats.totalNotas, icon: <MessageSquare className="w-4 h-4" /> },
    { key: 'escalations', count: stats.totalEscalonamentos, icon: <AlertTriangle className="w-4 h-4" /> },
    { key: 'reopened', count: stats.totalReaberturas, icon: <RefreshCw className="w-4 h-4" /> },
    { key: 'closed', count: stats.totalFechamentos, icon: <CheckCircle className="w-4 h-4" /> },
  ];

  // Filtrar dados baseado na categoria
  const getFilteredData = () => {
    switch (activeCategory) {
      case 'events':
        return data.events;
      case 'messages':
        return data.events.filter((e) => e.tipo.includes('message'));
      case 'ai_logs':
        return data.aiLogs;
      case 'sla':
        return data.slaLogs;
      case 'activity':
        return data.activities;
      case 'wait_times':
        return data.waitTimes;
      case 'assignments':
        return data.events.filter((e) => e.tipo === 'assignee_changed');
      case 'stage_changes':
        return data.events.filter((e) => e.tipo === 'stage_changed');
      case 'priority_changes':
        return data.events.filter((e) => e.tipo === 'priority_changed');
      case 'notes':
        return data.events.filter((e) => e.tipo === 'note_added');
      case 'escalations':
        return data.events.filter((e) => e.tipo === 'escalated');
      case 'reopened':
        return data.events.filter((e) => e.tipo === 'reopened');
      case 'closed':
        return data.events.filter((e) => e.tipo === 'closed');
      default:
        return data.events;
    }
  };

  const filteredData = getFilteredData();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-gray-500 dark:text-slate-400" />
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Histórico Completo
          </h3>
          <span className="text-xs text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
            {stats.totalEvents} eventos
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport('json')}
            disabled={exporting}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50"
          >
            <Download className="w-3 h-3" />
            JSON
          </button>
          <button
            onClick={() => handleExport('csv')}
            disabled={exporting}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50"
          >
            <Download className="w-3 h-3" />
            CSV
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-4 gap-4 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
        <div className="text-center">
          <div className="text-lg font-bold text-gray-900 dark:text-white">{stats.totalEvents}</div>
          <div className="text-[10px] text-gray-500 dark:text-slate-400 uppercase">Eventos</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-blue-600">{stats.totalMessages}</div>
          <div className="text-[10px] text-gray-500 dark:text-slate-400 uppercase">Mensagens</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-indigo-600">{stats.totalAiInteractions}</div>
          <div className="text-[10px] text-gray-500 dark:text-slate-400 uppercase">Interações IA</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-green-600">
            {stats.tempoTotalMin ? formatMinutes(stats.tempoTotalMin) : '—'}
          </div>
          <div className="text-[10px] text-gray-500 dark:text-slate-400 uppercase">Tempo Total</div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-1 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded-full whitespace-nowrap ${
                activeCategory === cat.key
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {cat.icon}
              {CATEGORY_LABELS[cat.key]}
              <span className="ml-1 opacity-70">({cat.count})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Data List */}
      <div className="max-h-96 overflow-y-auto">
        {filteredData.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-slate-400 text-sm">
            Nenhum dado nesta categoria
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {filteredData.slice(0, 100).map((item: any) => (
              <div key={item.id} className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-750">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {item.tipo || item.etapa || '—'}
                    </span>
                    {item.usuario && (
                      <span className="text-xs text-gray-500 dark:text-slate-400">
                        por {item.usuario.name}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(item.createdAt || item.dataEntrada).toLocaleString('pt-BR')}
                  </span>
                </div>
                {item.descricao && (
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{item.descricao}</p>
                )}
                {item.duracaoMin != null && (
                  <span className="text-xs text-gray-400">
                    Duração: {formatMinutes(item.duracaoMin)}
                  </span>
                )}
                {item.custoUsd != null && (
                  <span className="text-xs text-green-600">
                    Custo: ${item.custoUsd.toFixed(4)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
