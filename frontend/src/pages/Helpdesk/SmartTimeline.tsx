import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Clock,
  MessageSquare,
  Bot,
  User,
  RefreshCw,
  Volume2,
  VolumeX,
  TrendingUp,
  TrendingDown,
  Zap,
  Bell,
  BellOff,
  CheckCircle,
  XCircle,
  Info,
} from 'lucide-react';
import api from '../../services/api';
import type { TicketEvent, TicketMetrics } from '../../types';

interface SmartTimelineProps {
  ticketId: string;
  slaTotalMinutos?: number;
  metrics?: TicketMetrics | null;
}

type AlertType =
  | 'wait_time'
  | 'sla_warning'
  | 'sla_breach'
  | 'irritation_detected'
  | 'stopped_progress'
  | 'resolution_suggested'
  | 'speed_response'
  | 'audio_detected'
  | 'rechamado'
  | 'repeat_issue'
  | 'ai_suggestion'
  | 'closure_note';

interface SmartAlert {
  id: string;
  tipo: AlertType;
  titulo: string;
  descricao: string;
  severidade: 'info' | 'warning' | 'critical' | 'success';
  timestamp: string;
  dados?: Record<string, any>;
  lida: boolean;
}

const ALERT_CONFIG: Record<AlertType, { icon: React.ReactNode; color: string; bgColor: string }> = {
  wait_time: {
    icon: <Clock className="w-4 h-4" />,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50 border-yellow-200',
  },
  sla_warning: {
    icon: <AlertTriangle className="w-4 h-4" />,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 border-orange-200',
  },
  sla_breach: {
    icon: <XCircle className="w-4 h-4" />,
    color: 'text-red-600',
    bgColor: 'bg-red-50 border-red-200',
  },
  irritation_detected: {
    icon: <MessageSquare className="w-4 h-4" />,
    color: 'text-red-500',
    bgColor: 'bg-red-50 border-red-200',
  },
  stopped_progress: {
    icon: <RefreshCw className="w-4 h-4" />,
    color: 'text-gray-600',
    bgColor: 'bg-gray-50 border-gray-200',
  },
  resolution_suggested: {
    icon: <CheckCircle className="w-4 h-4" />,
    color: 'text-green-600',
    bgColor: 'bg-green-50 border-green-200',
  },
  speed_response: {
    icon: <Zap className="w-4 h-4" />,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 border-blue-200',
  },
  audio_detected: {
    icon: <Volume2 className="w-4 h-4" />,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 border-purple-200',
  },
  rechamado: {
    icon: <RefreshCw className="w-4 h-4" />,
    color: 'text-orange-500',
    bgColor: 'bg-orange-50 border-orange-200',
  },
  repeat_issue: {
    icon: <TrendingUp className="w-4 h-4" />,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50 border-yellow-200',
  },
  ai_suggestion: {
    icon: <Bot className="w-4 h-4" />,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50 border-indigo-200',
  },
  closure_note: {
    icon: <Info className="w-4 h-4" />,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50 border-blue-200',
  },
};

export default function SmartTimeline({ ticketId, slaTotalMinutos, metrics }: SmartTimelineProps) {
  const [alerts, setAlerts] = useState<SmartAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [filter, setFilter] = useState<AlertType | 'all'>('all');

  const generateAlerts = useCallback(async () => {
    try {
      setLoading(true);

      // Buscar eventos recentes
      const { data: events } = await api.get(`/audit-ticket/tickets/${ticketId}/events`, {
        params: { limit: 50 },
      });

      const generatedAlerts: SmartAlert[] = [];

      // 1. Wait Time Alert
      if (metrics?.tempoAguardandoClienteMin && metrics.tempoAguardandoClienteMin > 60) {
        generatedAlerts.push({
          id: `wait-${ticketId}`,
          tipo: 'wait_time',
          titulo: 'Cliente aguardando há muito tempo',
          descricao: `O ticket está aguardando resposta do cliente há ${metrics.tempoAguardandoClienteMin} minutos.`,
          severidade: metrics.tempoAguardandoClienteMin > 180 ? 'critical' : 'warning',
          timestamp: new Date().toISOString(),
          lida: false,
        });
      }

      // 2. SLA Warning
      if (slaTotalMinutos && metrics?.slaPercentualConsumido) {
        if (metrics.slaPercentualConsumido >= 90) {
          generatedAlerts.push({
            id: `sla-${ticketId}`,
            tipo: 'sla_breach',
            titulo: 'SLA prestes a ser violado',
            descricao: `SLA em ${Math.round(metrics.slaPercentualConsumido)}% - ${metrics.slaRestanteMinutos} minutos restantes.`,
            severidade: 'critical',
            timestamp: new Date().toISOString(),
            lida: false,
          });
        } else if (metrics.slaPercentualConsumido >= 75) {
          generatedAlerts.push({
            id: `sla-warn-${ticketId}`,
            tipo: 'sla_warning',
            titulo: 'Alerta de SLA',
            descricao: `SLA em ${Math.round(metrics.slaPercentualConsumido)}% - ${metrics.slaRestanteMinutos} minutos restantes.`,
            severidade: 'warning',
            timestamp: new Date().toISOString(),
            lida: false,
          });
        }
      }

      // 3. Stopped Progress
      if (metrics?.tempoParadoMin && metrics.tempoParadoMin > 120) {
        generatedAlerts.push({
          id: `stopped-${ticketId}`,
          tipo: 'stopped_progress',
          titulo: 'Ticket sem progresso',
          descricao: `O ticket está parado há ${metrics.tempoParadoMin} minutos.`,
          severidade: 'warning',
          timestamp: new Date().toISOString(),
          lida: false,
        });
      }

      // 4. AI Suggestion Available
      if (metrics?.iaTotalInteracoes && metrics.iaTotalInteracoes > 0 && !metrics.resolvidoPorIa) {
        generatedAlerts.push({
          id: `ai-suggest-${ticketId}`,
          tipo: 'ai_suggestion',
          titulo: 'Sugestão da IA disponível',
          descricao: 'A IA tem uma sugestão de resposta para este ticket.',
          severidade: 'info',
          timestamp: new Date().toISOString(),
          lida: false,
        });
      }

      // 5. Fast Response
      if (metrics?.tempoPrimeiraRespostaMin && metrics.tempoPrimeiraRespostaMin < 5) {
        generatedAlerts.push({
          id: `fast-${ticketId}`,
          tipo: 'speed_response',
          titulo: 'Resposta rápida',
          descricao: `Primeira resposta em ${metrics.tempoPrimeiraRespostaMin} minutos.`,
          severidade: 'success',
          timestamp: new Date().toISOString(),
          lida: false,
        });
      }

      // 6. Resolution Note
      if (metrics?.resolvidoPorIa && metrics.resolvidoPorIa) {
        generatedAlerts.push({
          id: `closure-${ticketId}`,
          tipo: 'closure_note',
          titulo: 'Resolvido por IA',
          descricao: 'Este ticket foi resolvido automaticamente pela IA.',
          severidade: 'success',
          timestamp: new Date().toISOString(),
          lida: false,
        });
      }

      setAlerts(generatedAlerts);
    } catch (err) {
      console.error('Erro ao gerar alertas:', err);
    } finally {
      setLoading(false);
    }
  }, [ticketId, slaTotalMinutos, metrics]);

  useEffect(() => {
    generateAlerts();
  }, [generateAlerts]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(generateAlerts, 30000);
    return () => clearInterval(interval);
  }, [generateAlerts]);

  const filteredAlerts = filter === 'all' ? alerts : alerts.filter((a) => a.tipo === filter);
  const unreadCount = alerts.filter((a) => !a.lida).length;

  const markAsRead = (id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, lida: true } : a))
    );
  };

  const markAllAsRead = () => {
    setAlerts((prev) => prev.map((a) => ({ ...a, lida: true })));
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Smart Timeline
          </h3>
          {unreadCount > 0 && (
            <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            title={soundEnabled ? 'Desativar som' : 'Ativar som'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              Marcar como lidas
            </button>
          )}
        </div>
      </div>

      {/* Filter */}
      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-1 overflow-x-auto">
          <button
            onClick={() => setFilter('all')}
            className={`px-2 py-1 text-xs rounded-full whitespace-nowrap ${
              filter === 'all'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
            }`}
          >
            Todos ({alerts.length})
          </button>
          {Object.entries(ALERT_CONFIG).map(([tipo, config]) => {
            const count = alerts.filter((a) => a.tipo === tipo).length;
            if (count === 0) return null;
            return (
              <button
                key={tipo}
                onClick={() => setFilter(tipo as AlertType)}
                className={`flex items-center gap-1 px-2 py-1 text-xs rounded-full whitespace-nowrap ${
                  filter === tipo
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                }`}
              >
                {config.icon}
                {count}
              </button>
            );
          })}
        </div>
      </div>

      {/* Alerts List */}
      <div className="max-h-80 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
            Nenhum alerta no momento
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {filteredAlerts.map((alert) => {
              const config = ALERT_CONFIG[alert.tipo];
              return (
                <div
                  key={alert.id}
                  className={`px-4 py-3 border-l-4 ${config.bgColor} ${
                    !alert.lida ? 'opacity-100' : 'opacity-60'
                  }`}
                  style={{ borderLeftColor: alert.severidade === 'critical' ? '#ef4444' : alert.severidade === 'warning' ? '#f97316' : alert.severidade === 'success' ? '#22c55e' : '#3b82f6' }}
                  onClick={() => markAsRead(alert.id)}
                >
                  <div className="flex items-start gap-3">
                    <span className={config.color}>{config.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {alert.titulo}
                        </span>
                        {!alert.lida && (
                          <span className="w-2 h-2 bg-blue-500 rounded-full" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{alert.descricao}</p>
                      <span className="text-[10px] text-gray-400">
                        {new Date(alert.timestamp).toLocaleString('pt-BR')}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
