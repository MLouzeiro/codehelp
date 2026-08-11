import { useState, useEffect, useCallback, useMemo } from 'react';
import { Clock, Bot, ArrowRight, Loader2 } from 'lucide-react';
import api from '../../services/api';
import type { TicketEvent, TicketTimelineEntry } from '../../types';

interface TimelineExpandidaProps {
  ticketId: string;
  events: any[];
}

function getEventColor(tipo: string, dados?: string): string {
  if (tipo.startsWith('ai_')) return '#8b5cf6';
  if (tipo === 'created' || tipo === 'message_sent' || tipo === 'message_received') return '#3b82f6';
  if (tipo === 'closed' || tipo === 'sla_completed') return '#10b981';
  if (tipo === 'escalated' || tipo === 'sla_breached') return '#ef4444';
  if (tipo === 'reopened' || tipo === 'sla_paused') return '#f59e0b';
  if (tipo === 'stage_changed' && dados) {
    try {
      const p = JSON.parse(dados);
      if (p.para === 'aguardando_cliente') return '#f59e0b';
      if (p.para === 'concluido') return '#10b981';
    } catch { /* ignore */ }
  }
  return '#3b82f6';
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

function parseDados(dados?: string): Record<string, any> {
  if (!dados) return {};
  try { return JSON.parse(dados); } catch { return {}; }
}

const ETAPA_LABELS: Record<string, string> = {
  fila: 'Fila',
  triagem: 'Triagem',
  em_atendimento: 'Em Atendimento',
  aguardando_cliente: 'Aguardando Cliente',
  aguardando_os: 'Aguardando OS',
  concluido: 'Concluído',
};

const PROGRESS_BAR_MAX_MIN = 120;

export default function TimelineExpandida({ ticketId, events: initialEvents }: TimelineExpandidaProps) {
  const [events, setEvents] = useState<TicketEvent[]>(initialEvents || []);
  const [timeline, setTimeline] = useState<TicketTimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [emAtendimentoDesde, setEmAtendimentoDesde] = useState<string | null>(null);
  const [tempoAtual, setTempoAtual] = useState(0);

  const loadData = useCallback(async () => {
    try {
      const [eventsRes, timelineRes] = await Promise.all([
        api.get(`/audit-ticket/tickets/${ticketId}/events`).catch(() => ({ data: initialEvents || [] })),
        api.get(`/audit-ticket/tickets/${ticketId}/timeline`).catch(() => ({ data: [] })),
      ]);
      setEvents(eventsRes.data || initialEvents || []);
      setTimeline(timelineRes.data || []);

      const activeStage = (timelineRes.data || []).find(
        (e: TicketTimelineEntry) => e.etapa === 'em_atendimento' && !e.dataSaida
      );
      if (activeStage) {
        setEmAtendimentoDesde(activeStage.dataEntrada);
      }
    } catch (err) {
      console.error('Erro ao carregar timeline expandida:', err);
    } finally {
      setLoading(false);
    }
  }, [ticketId, initialEvents]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!emAtendimentoDesde) return;
    const tick = () => setTempoAtual(Math.floor((Date.now() - new Date(emAtendimentoDesde).getTime()) / 60000));
    tick();
    const interval = setInterval(tick, 10000);
    return () => clearInterval(interval);
  }, [emAtendimentoDesde]);

  const timelineMap = useMemo(() => {
    const map = new Map<string, TicketTimelineEntry>();
    for (const entry of timeline) {
      map.set(entry.etapa, entry);
    }
    return map;
  }, [timeline]);

  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [events]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 bg-slate-50 dark:bg-slate-900 rounded-lg">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 md:p-6">
      {emAtendimentoDesde && (
        <div className="mb-6 px-4 py-3 bg-[#fef9c3] dark:bg-amber-900/30 border border-[#fcd34d] dark:border-amber-700 rounded-lg flex items-center gap-2">
          <Clock className="w-4 h-4 text-yellow-700 dark:text-amber-400" />
          <span className="text-sm font-medium text-yellow-800 dark:text-amber-300">
            ⏱️ Atendimento atual: {formatDuracao(tempoAtual)}
          </span>
        </div>
      )}

      {sortedEvents.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-slate-400 text-sm">
          Nenhum evento registrado
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-20 top-0 bottom-0 w-0.5 bg-gray-300 dark:bg-slate-600" />

          <div className="space-y-4">
            {sortedEvents.map((event) => {
              const color = getEventColor(event.tipo, event.dados);
              const dados = parseDados(event.dados);
              const isIA = event.isAi || event.tipo.startsWith('ai_');
              const isTransferencia =
                event.tipo === 'escalated' ||
                dados.de === 'IA' ||
                dados.para === 'Humano' ||
                dados.de === 'N1' ||
                (dados.para === 'N2' && dados.de === 'N1') ||
                (dados.para === 'humano' && dados.de === 'ia');
              const borderColor = isIA ? '#8b5cf6' : color;

              const stageKey = event.tipo === 'stage_changed' ? (dados.para || '') : '';
              const timelineEntry = stageKey ? timelineMap.get(stageKey) : undefined;
              const isActiveStage = timelineEntry && !timelineEntry.dataSaida;
              const progressDuration = isActiveStage && stageKey === 'em_atendimento'
                ? tempoAtual
                : timelineEntry?.duracaoMinutos;

              return (
                <div key={event.id} className="relative flex items-start">
                  <div className="w-20 flex-shrink-0 pt-1.5 text-right pr-4">
                    <span className="text-xs font-mono text-gray-500 dark:text-slate-400">
                      {formatHorario(event.createdAt)}
                    </span>
                  </div>

                  <div className="relative z-10 flex-shrink-0" style={{ marginLeft: '-5px' }}>
                    <div
                      className="w-3 h-3 rounded-full border-2 border-white dark:border-slate-800 shadow-sm"
                      style={{ backgroundColor: color }}
                    />
                  </div>

                  <div
                    className="flex-1 ml-4 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden"
                    style={{ borderLeft: `4px solid ${borderColor}` }}
                  >
                    <div className="p-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-800 dark:text-slate-100">
                          {event.descricao || event.tipo.replace(/_/g, ' ')}
                        </span>
                        {isIA && (
                          <span className="inline-flex items-center gap-1 text-[10px] bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-400 px-1.5 py-0.5 rounded font-medium">
                            <Bot className="w-3 h-3" /> IA
                          </span>
                        )}
                        {isTransferencia && !isIA && (
                          <span className="inline-flex items-center gap-1 text-[10px] bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded font-medium">
                            <ArrowRight className="w-3 h-3" /> Transferência
                          </span>
                        )}
                      </div>

                      <div className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                        {event.usuario && (
                          <span>por {event.usuario.name}</span>
                        )}
                        {dados.de && dados.para && (
                          <span className="ml-1">
                            · {dados.de} → {dados.para}
                          </span>
                        )}
                      </div>

                      {progressDuration != null && progressDuration > 0 && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-slate-400 mb-1">
                            <span style={{ color }}>
                              {ETAPA_LABELS[stageKey] || 'Progresso'}
                            </span>
                            <span>{formatDuracao(progressDuration)}</span>
                          </div>
                          <div className="w-full h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-1000"
                              style={{
                                width: `${Math.min(100, (progressDuration / PROGRESS_BAR_MAX_MIN) * 100)}%`,
                                backgroundColor: color,
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
