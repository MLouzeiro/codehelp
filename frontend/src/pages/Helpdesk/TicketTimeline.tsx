import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  MessageSquare,
  UserPlus,
  AlertTriangle,
  CheckCircle,
  Bot,
  RefreshCw,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Play,
  Pause,
  Eye,
  Edit3,
  Tag,
  Zap,
} from 'lucide-react';
import api from '../../services/api';
import type { TicketEvent, TicketTimelineEntry } from '../../types';

interface TicketTimelineProps {
  ticketId: string;
  isExpanded?: boolean;
  onToggle?: () => void;
}

const EVENT_ICONS: Record<string, React.ReactNode> = {
  created: <Play className="w-4 h-4" />,
  message_sent: <MessageSquare className="w-4 h-4" />,
  message_received: <MessageSquare className="w-4 h-4" />,
  stage_changed: <ArrowRight className="w-4 h-4" />,
  assignee_changed: <UserPlus className="w-4 h-4" />,
  priority_changed: <Tag className="w-4 h-4" />,
  sla_started: <Clock className="w-4 h-4" />,
  sla_paused: <Pause className="w-4 h-4" />,
  sla_resumed: <Play className="w-4 h-4" />,
  sla_breached: <AlertTriangle className="w-4 h-4" />,
  sla_completed: <CheckCircle className="w-4 h-4" />,
  ai_classified: <Bot className="w-4 h-4" />,
  ai_responded: <Bot className="w-4 h-4" />,
  ai_evaluated: <Bot className="w-4 h-4" />,
  note_added: <Edit3 className="w-4 h-4" />,
  escalated: <Zap className="w-4 h-4" />,
  reopened: <RefreshCw className="w-4 h-4" />,
  closed: <CheckCircle className="w-4 h-4" />,
  viewed: <Eye className="w-4 h-4" />,
  edited: <Edit3 className="w-4 h-4" />,
};

const EVENT_COLORS: Record<string, string> = {
  created: 'bg-green-500',
  message_sent: 'bg-blue-500',
  message_received: 'bg-blue-400',
  stage_changed: 'bg-purple-500',
  assignee_changed: 'bg-yellow-500',
  priority_changed: 'bg-orange-500',
  sla_started: 'bg-cyan-500',
  sla_paused: 'bg-gray-500',
  sla_resumed: 'bg-cyan-400',
  sla_breached: 'bg-red-500',
  sla_completed: 'bg-green-600',
  ai_classified: 'bg-indigo-500',
  ai_responded: 'bg-indigo-400',
  ai_evaluated: 'bg-indigo-600',
  note_added: 'bg-gray-400',
  escalated: 'bg-red-400',
  reopened: 'bg-yellow-400',
  closed: 'bg-green-700',
  viewed: 'bg-gray-300',
  edited: 'bg-gray-400',
};

const ETAPA_LABELS: Record<string, string> = {
  fila: 'Fila',
  triagem: 'Triagem',
  em_atendimento: 'Em Atendimento',
  aguardando_cliente: 'Aguardando Cliente',
  aguardando_terceiro: 'Aguardando Terceiro',
  aguardando_os: 'Aguardando OS',
  concluido: 'Concluído',
  descartado: 'Descartado',
};

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) return `${hours}h ${mins}min`;
  const days = Math.floor(hours / 24);
  const remainHours = hours % 24;
  return `${days}d ${remainHours}h`;
}

function formatDelta(prev: string, curr: string): string {
  const diff = new Date(curr).getTime() - new Date(prev).getTime();
  const minutes = Math.floor(diff / 60000);
  return formatDuration(minutes);
}

function parseDados(dados?: string): Record<string, any> {
  if (!dados) return {};
  try {
    return JSON.parse(dados);
  } catch {
    return {};
  }
}

export default function TicketTimeline({ ticketId, isExpanded = false, onToggle }: TicketTimelineProps) {
  const [events, setEvents] = useState<TicketEvent[]>([]);
  const [timeline, setTimeline] = useState<TicketTimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(isExpanded);
  const [showSystemEvents, setShowSystemEvents] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [eventsRes, timelineRes] = await Promise.all([
        api.get(`/audit-ticket/tickets/${ticketId}/events`),
        api.get(`/audit-ticket/tickets/${ticketId}/timeline`),
      ]);
      setEvents(eventsRes.data);
      setTimeline(timelineRes.data);
    } catch (err) {
      console.error('Erro ao carregar timeline:', err);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredEvents = showSystemEvents
    ? events
    : events.filter((e) => !e.isSystem);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750"
        onClick={() => {
          setExpanded(!expanded);
          onToggle?.();
        }}
      >
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Timeline
          </h3>
          <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
            {events.length} eventos
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label
            className="flex items-center gap-1 text-xs text-gray-500"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={showSystemEvents}
              onChange={(e) => setShowSystemEvents(e.target.checked)}
              className="rounded border-gray-300"
            />
            Sistema
          </label>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </div>

      {/* Content */}
      {expanded && (
        <div className="px-4 pb-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Horizontal Timeline Bar */}
              {timeline.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
                    Etapas
                  </h4>
                  <div className="flex items-center gap-1 overflow-x-auto pb-2">
                    {timeline.map((entry, idx) => {
                      const duration = entry.duracaoMinutos || 0;
                      const width = Math.max(40, Math.min(200, duration * 2));
                      return (
                        <div key={entry.id} className="flex items-center">
                          <div
                            className="flex flex-col items-center min-w-[60px]"
                            style={{ width }}
                          >
                            <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                              {ETAPA_LABELS[entry.etapa] || entry.etapa}
                            </div>
                            <div className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 rounded-full"
                                style={{
                                  width: entry.dataSaida ? '100%' : '60%',
                                  opacity: entry.dataSaida ? 1 : 0.6,
                                }}
                              />
                            </div>
                            <div className="text-[10px] text-gray-500 mt-1">
                              {entry.duracaoMinutos != null
                                ? formatDuration(entry.duracaoMinutos)
                                : 'Atual'}
                            </div>
                          </div>
                          {idx < timeline.length - 1 && (
                            <ArrowRight className="w-3 h-3 text-gray-300 mx-1 flex-shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Vertical Event List */}
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-600" />
                <div className="space-y-3">
                  {filteredEvents.map((event, idx) => {
                    const icon = EVENT_ICONS[event.tipo] || <Clock className="w-4 h-4" />;
                    const color = EVENT_COLORS[event.tipo] || 'bg-gray-400';
                    const dados = parseDados(event.dados);
                    const prevEvent = idx > 0 ? filteredEvents[idx - 1] : null;
                    const delta = prevEvent ? formatDelta(prevEvent.createdAt, event.createdAt) : null;

                    return (
                      <div key={event.id} className="relative flex items-start gap-3">
                        {/* Icon */}
                        <div
                          className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full ${color} text-white flex-shrink-0`}
                        >
                          {icon}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {event.descricao || event.tipo.replace(/_/g, ' ')}
                            </span>
                            {event.isAi && (
                              <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-medium">
                                IA
                              </span>
                            )}
                            {event.usuario && (
                              <span className="text-xs text-gray-500">
                                por {event.usuario.name}
                              </span>
                            )}
                          </div>

                          {/* Dados extras */}
                          {Object.keys(dados).length > 0 && (
                            <div className="mt-1 text-xs text-gray-500">
                              {dados.de && dados.para && (
                                <span>
                                  {dados.de} → {dados.para}
                                </span>
                              )}
                              {dados.campo && dados.valorAnterior && dados.valorNovo && (
                                <span>
                                  {dados.campo}: {dados.valorAnterior} → {dados.valorNovo}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Timestamp + Delta */}
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[11px] text-gray-400">
                              {new Date(event.createdAt).toLocaleString('pt-BR')}
                            </span>
                            {delta && (
                              <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                                +{delta}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {filteredEvents.length === 0 && (
                    <div className="text-center py-8 text-gray-500 text-sm">
                      Nenhum evento registrado
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
