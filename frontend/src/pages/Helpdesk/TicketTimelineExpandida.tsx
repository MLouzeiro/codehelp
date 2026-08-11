import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Loader2 } from 'lucide-react';
import api from '../../services/api';
import type { TicketEvent, TicketTimelineEntry, HelpdeskTicket } from '../../types';

interface TimelineEvent {
  id: string;
  tipo: string;
  descricao: string;
  emoji: string;
  dotColor: string;
  borderColor?: string;
  subtitulo?: string;
  barColor?: string;
  barLabel?: string;
  barWidth?: number;
  dados?: string;
}

const ETAPA_LABELS: Record<string, string> = {
  fila: 'Fila',
  triagem: 'Triagem',
  em_atendimento: 'Em Atendimento',
  aguardando_cliente: 'Aguardando Cliente',
  aguardando_os: 'Aguardando OS',
  concluido: 'Concluído',
};

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  aberto: { label: 'Aberto', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400' },
  em_andamento: { label: 'Em andamento', cls: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400' },
  pendente: { label: 'Pendente', cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400' },
  escalonado: { label: 'Escalonado', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400' },
  resolvido: { label: 'Resolvido', cls: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400' },
  fechado: { label: 'Fechado', cls: 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-400' },
  cancelado: { label: 'Cancelado', cls: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400' },
};

function getEventVisuals(event: TicketEvent, timeline: TicketTimelineEntry[]): TimelineEvent {
  const tipo = event.tipo;
  const dados = parseDados(event.dados);
  const isIa = event.isAi || tipo.startsWith('ai_');

  if (tipo === 'created') {
    const via = dados.via || dados.origem || 'WhatsApp';
    return {
      id: event.id,
      tipo,
      descricao: `📩 Ticket aberto via ${via}`,
      emoji: '📩',
      dotColor: 'blue',
      subtitulo: [
        dados.categoria && `Categoria: ${dados.categoria}`,
        dados.prioridade && `Prioridade: ${dados.prioridade}`,
        event.usuario && `por ${event.usuario.name}`,
      ].filter(Boolean).join(' · ') || undefined,
    };
  }

  if (tipo === 'ai_responded' || tipo === 'ai_classified' || tipo === 'ai_evaluated' || isIa) {
    const ativaEntrada = timeline.find(t => t.etapa === 'em_atendimento' && !t.dataSaida);
    const minutos = ativaEntrada?.duracaoMinutos || 0;
    return {
      id: event.id,
      tipo,
      descricao: '🤖 IA respondeu automaticamente',
      emoji: '🤖',
      dotColor: 'blue',
      subtitulo: event.descricao || dados.resumo || dados.diagnostico || undefined,
      barColor: 'green',
      barLabel: `🔧 Em atendimento: ${minutos}min`,
      barWidth: Math.min(100, (minutos / 120) * 100),
    };
  }

  if (tipo === 'stage_changed') {
    const para = dados.para || '';
    const de = dados.de || '';

    if (para === 'aguardando_cliente') {
      return {
        id: event.id,
        tipo,
        descricao: '⏳ Aguardando cliente',
        emoji: '⏳',
        dotColor: 'yellow',
        borderColor: '#f59e0b',
        subtitulo: event.descricao || dados.motivo || undefined,
        barColor: 'yellow',
        barLabel: `⏳ Aguardando cliente: ${dados.duracaoMinutos || '?'}min`,
        barWidth: Math.min(100, ((dados.duracaoMinutos || 0) / 120) * 100),
      };
    }

    if (para === 'em_atendimento' && de && (de.includes('ia') || de === 'IA')) {
      return {
        id: event.id,
        tipo,
        descricao: `👤 Humano assumiu${dados.agente ? ` — ${dados.agente}` : ''}`,
        emoji: '👤',
        dotColor: 'green',
        borderColor: '#3b82f6',
        subtitulo: dados.motivo || `Transferido da IA${dados.nivelAnterior ? ` (${dados.nivelAnterior} → ${dados.nivelNovo || ''})` : ''}`,
        barColor: 'green',
        barLabel: `🔧 Em atendimento: ${dados.duracaoMinutos || '?'}min`,
        barWidth: Math.min(100, ((dados.duracaoMinutos || 0) / 120) * 100),
      };
    }

    if (para === 'concluido') {
      return {
        id: event.id,
        tipo,
        descricao: '✅ Resolução concluída',
        emoji: '✅',
        dotColor: 'green',
        borderColor: '#10b981',
        subtitulo: event.descricao || dados.resumo || undefined,
      };
    }

    return {
      id: event.id,
      tipo,
      descricao: `📌 ${ETAPA_LABELS[para] || para}`,
      emoji: '📌',
      dotColor: 'blue',
      subtitulo: event.descricao || `${de} → ${para}`,
    };
  }

  if (tipo === 'message_received') {
    return {
      id: event.id,
      tipo,
      descricao: '💬 Cliente confirmou',
      emoji: '💬',
      dotColor: 'green',
      borderColor: '#10b981',
      subtitulo: dados.conteudo || event.descricao || undefined,
    };
  }

  if (tipo === 'note_added' || tipo.startsWith('tool_')) {
    return {
      id: event.id,
      tipo,
      descricao: `🛠️ ${event.descricao || 'Ação executada'}`,
      emoji: '🛠️',
      dotColor: 'purple',
      subtitulo: dados.detalhes || dados.resultado || undefined,
    };
  }

  if (tipo === 'escalated') {
    return {
      id: event.id,
      tipo,
      descricao: `⚡ Ticket escalonado`,
      emoji: '⚡',
      dotColor: 'red',
      subtitulo: event.descricao || `Nível ${dados.nivelNovo || ''}`,
    };
  }

  if (tipo === 'closed' || tipo === 'sla_completed') {
    return {
      id: event.id,
      tipo,
      descricao: '✅ Resolução concluída',
      emoji: '✅',
      dotColor: 'green',
      borderColor: '#10b981',
      subtitulo: event.descricao || undefined,
    };
  }

  if (tipo === 'reopened') {
    return {
      id: event.id,
      tipo,
      descricao: '🔄 Ticket reaberto',
      emoji: '🔄',
      dotColor: 'yellow',
      subtitulo: event.descricao || dados.motivo || undefined,
    };
  }

  if (tipo === 'message_sent') {
    return {
      id: event.id,
      tipo,
      descricao: `💬 ${isIa ? 'IA' : 'Operador'} respondeu`,
      emoji: '💬',
      dotColor: 'blue',
      subtitulo: event.descricao || undefined,
    };
  }

  return {
    id: event.id,
    tipo,
    descricao: event.descricao || tipo.replace(/_/g, ' '),
    emoji: '📌',
    dotColor: 'blue',
  };
}

function parseDados(dados?: string): Record<string, any> {
  if (!dados) return {};
  try { return JSON.parse(dados); } catch { return {}; }
}

function formatHorario(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDuracao(minutos: number): string {
  if (minutos < 60) return `${minutos}min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${h}h ${m}min`;
}

export default function TicketTimelineExpandida() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();

  const [ticket, setTicket] = useState<HelpdeskTicket | null>(null);
  const [events, setEvents] = useState<TicketEvent[]>([]);
  const [timeline, setTimeline] = useState<TicketTimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tempoAtual, setTempoAtual] = useState(0);

  const emAtendimentoDesde = useMemo(() => {
    const active = timeline.find(t => t.etapa === 'em_atendimento' && !t.dataSaida);
    return active?.dataEntrada || null;
  }, [timeline]);

  const loadData = useCallback(async () => {
    if (!ticketId) return;
    try {
      setLoading(true);
      const [historyRes, eventsRes, timelineRes] = await Promise.all([
        api.get(`/helpdesk/tickets/${ticketId}/history`),
        api.get(`/audit-ticket/tickets/${ticketId}/events`).catch(() => ({ data: [] })),
        api.get(`/audit-ticket/tickets/${ticketId}/timeline`).catch(() => ({ data: [] })),
      ]);

      const t = historyRes.data.ticket || historyRes.data;
      setTicket(t);
      setEvents(eventsRes.data || []);
      setTimeline(timelineRes.data || []);
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setNotFound(true);
      }
      console.error('Erro ao carregar timeline expandida:', err);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!emAtendimentoDesde) return;
    const tick = () => setTempoAtual(Math.floor((Date.now() - new Date(emAtendimentoDesde).getTime()) / 60000));
    tick();
    const interval = setInterval(tick, 10000);
    return () => clearInterval(interval);
  }, [emAtendimentoDesde]);

  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [events]);

  const visualEvents = useMemo(() => {
    return sortedEvents.map(e => getEventVisuals(e, timeline));
  }, [sortedEvents, timeline]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900 gap-4">
        <span className="text-6xl">🔍</span>
        <h2 className="text-xl font-bold text-gray-700 dark:text-slate-200">Ticket não encontrado</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400">O ticket solicitado não existe ou foi removido.</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
        >
          ← Voltar
        </button>
      </div>
    );
  }

  const statusInfo = STATUS_LABELS[ticket?.status || 'aberto'] || STATUS_LABELS.aberto;
  const clientName = ticket?.client?.razaoSocial || ticket?.contactName || 'Cliente';
  const protocolo = ticket?.protocolo || `#${ticketId?.slice(0, 8)}`;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-4 flex-wrap">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm font-medium hidden sm:inline">Voltar</span>
            </button>

            <div className="h-6 w-px bg-gray-200 dark:bg-slate-600 hidden sm:block" />

            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-gray-800 dark:text-slate-100 truncate">
                📋 Timeline do Ticket {protocolo} — {clientName}
              </h1>
            </div>

            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${statusInfo.cls}`}>
              {statusInfo.label}
            </span>
          </div>
        </div>
      </div>

      {/* Live Indicator */}
      {emAtendimentoDesde && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#fef9c3] dark:bg-amber-900/30 border border-[#fcd34d] dark:border-amber-700 rounded-lg">
            <Clock className="w-4 h-4 text-yellow-700 dark:text-amber-400" />
            <span className="text-sm font-semibold text-yellow-800 dark:text-amber-300">
              ⏱️ Atendimento atual: {formatDuracao(tempoAtual)}
            </span>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {visualEvents.length === 0 ? (
          <div className="text-center py-16 text-gray-500 dark:text-slate-400 text-sm bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            Nenhum evento registrado
          </div>
        ) : (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[120px] top-0 bottom-0 w-[3px] bg-slate-200 dark:bg-slate-700 rounded-full hidden sm:block" />

            <div className="space-y-6">
              {visualEvents.map((ev) => (
                <div key={ev.id} className="relative flex items-start">
                  {/* Time */}
                  <div className="w-[110px] flex-shrink-0 text-right pr-5 pt-1 hidden sm:block">
                    <span className="text-sm font-medium text-gray-500 dark:text-slate-400">
                      {formatHorario(sortedEvents.find(e => e.id === ev.id)?.createdAt || '')}
                    </span>
                  </div>

                  {/* Dot */}
                  <div className="relative z-10 flex-shrink-0 hidden sm:block">
                    <div
                      className={`w-5 h-5 rounded-full border-[3px] bg-white dark:bg-slate-800 shadow-sm timeline-exp-dot ${ev.dotColor}`}
                    />
                  </div>

                  {/* Mobile dot */}
                  <div className="relative z-10 flex-shrink-0 sm:hidden mr-3 mt-1">
                    <div
                      className={`w-4 h-4 rounded-full border-2 bg-white dark:bg-slate-800 shadow-sm timeline-exp-dot ${ev.dotColor}`}
                    />
                  </div>

                  {/* Card */}
                  <div className="flex-1 sm:ml-5">
                    <div
                      className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
                      style={ev.borderColor ? { borderLeftWidth: '3px', borderLeftColor: ev.borderColor } : undefined}
                    >
                      {/* Mobile time */}
                      <div className="sm:hidden text-xs text-gray-400 dark:text-slate-500 mb-1">
                        {formatHorario(sortedEvents.find(e => e.id === ev.id)?.createdAt || '')}
                      </div>

                      {/* Description */}
                      <div className="text-sm font-semibold text-gray-800 dark:text-slate-100">
                        {ev.descricao}
                      </div>

                      {/* Subtitle */}
                      {ev.subtitulo && (
                        <div className="mt-1 text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
                          {ev.subtitulo}
                        </div>
                      )}

                      {/* Progress bar */}
                      {ev.barColor && ev.barLabel && (
                        <div className="mt-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-2 rounded-full"
                              style={{
                                width: `${Math.max(60, ev.barWidth || 60)}px`,
                                backgroundColor: ev.barColor === 'green' ? '#a7f3d0' : '#fde68a',
                              }}
                            />
                            <span className="text-xs font-medium text-gray-600 dark:text-slate-400">
                              {ev.barLabel}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
