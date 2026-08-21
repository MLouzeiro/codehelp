import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  FastForward,
  RotateCcw,
  Filter,
  Clock,
  Bot,
  User,
  MessageSquare,
} from 'lucide-react';
import api from '../../services/api';
import type { TicketEvent, TicketReplayData } from '../../types';

interface TicketReplayPlayerProps {
  ticketId: string;
}

type Speed = 1 | 2 | 4 | 8;

const SPEED_OPTIONS: Speed[] = [1, 2, 4, 8];

const EVENT_TYPE_COLORS: Record<string, string> = {
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
};

export default function TicketReplayPlayer({ ticketId }: TicketReplayPlayerProps) {
  const [data, setData] = useState<TicketReplayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [filter, setFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: replayData } = await api.get(`/audit-ticket/tickets/${ticketId}/replay`);
      setData(replayData);
    } catch (err) {
      console.error('Erro ao carregar replay:', err);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter events
  const filteredEvents = data?.events.filter((e) => {
    if (filter === 'all') return true;
    if (filter === 'ai') return e.isAi;
    if (filter === 'human') return !e.isSystem && !e.isAi;
    if (filter === 'system') return e.isSystem;
    return e.tipo === filter;
  }) || [];

  // Playback logic
  useEffect(() => {
    if (!playing || filteredEvents.length === 0) return;

    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev >= filteredEvents.length - 1) {
          setPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1000 / speed);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [playing, speed, filteredEvents.length]);

  const handlePlay = () => {
    if (currentIndex >= filteredEvents.length - 1) {
      setCurrentIndex(0);
    }
    setPlaying(true);
  };

  const handlePause = () => {
    setPlaying(false);
  };

  const handleReset = () => {
    setPlaying(false);
    setCurrentIndex(0);
  };

  const handleSkipBack = () => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  };

  const handleSkipForward = () => {
    setCurrentIndex((prev) => Math.min(filteredEvents.length - 1, prev + 1));
  };

  const handleSpeedChange = () => {
    setSpeed((prev) => {
      const idx = SPEED_OPTIONS.indexOf(prev);
      return SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
    });
  };

  const currentEvent = filteredEvents[currentIndex];
  const progress = filteredEvents.length > 0 ? ((currentIndex + 1) / filteredEvents.length) * 100 : 0;

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      </div>
    );
  }

  if (!data || filteredEvents.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="text-center py-12 text-gray-500 dark:text-slate-400">
          <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Nenhum evento para reproduzir</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Play className="w-5 h-5 text-gray-500 dark:text-slate-400" />
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Replay Temporal
          </h3>
          <span className="text-xs text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
            {currentIndex + 1} / {filteredEvents.length}
          </span>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`p-1.5 rounded ${showFilters ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
        >
          <Filter className="w-4 h-4" />
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-1 overflow-x-auto">
            {['all', 'ai', 'human', 'system', 'message_sent', 'stage_changed', 'assignee_changed'].map((f) => (
              <button
                key={f}
                onClick={() => {
                  setFilter(f);
                  setCurrentIndex(0);
                }}
                className={`px-2 py-1 text-xs rounded-full whitespace-nowrap ${
                  filter === f
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                }`}
              >
                {f === 'all' ? 'Todos' : f === 'ai' ? 'IA' : f === 'human' ? 'Humano' : f === 'system' ? 'Sistema' : f.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Progress Bar */}
      <div className="px-4 py-3">
        <div className="relative h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full bg-blue-500 transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
          {/* Event markers */}
          {filteredEvents.map((event, idx) => (
            <div
              key={event.id}
              className={`absolute top-0 w-1 h-full ${
                EVENT_TYPE_COLORS[event.tipo] || 'bg-gray-400'
              } ${idx === currentIndex ? 'opacity-100' : 'opacity-30'}`}
              style={{ left: `${((idx + 0.5) / filteredEvents.length) * 100}%` }}
            />
          ))}
        </div>

        {/* Time display */}
        <div className="flex justify-between mt-1 text-[10px] text-gray-400">
          <span>{filteredEvents[0] ? new Date(filteredEvents[0].createdAt).toLocaleTimeString('pt-BR') : '—'}</span>
          <span>{currentEvent ? new Date(currentEvent.createdAt).toLocaleTimeString('pt-BR') : '—'}</span>
          <span>{filteredEvents.length > 0 ? new Date(filteredEvents[filteredEvents.length - 1].createdAt).toLocaleTimeString('pt-BR') : '—'}</span>
        </div>
      </div>

      {/* Current Event Display */}
      {currentEvent && (
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
          <div className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${
                EVENT_TYPE_COLORS[currentEvent.tipo] || 'bg-gray-400'
              }`}
            >
              {currentEvent.isAi ? (
                <Bot className="w-4 h-4" />
              ) : currentEvent.isSystem ? (
                <Clock className="w-4 h-4" />
              ) : (
                <User className="w-4 h-4" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {currentEvent.descricao || currentEvent.tipo.replace(/_/g, ' ')}
                </span>
                {currentEvent.isAi && (
                  <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-medium">
                    IA
                  </span>
                )}
              </div>
              {currentEvent.usuario && (
                <span className="text-xs text-gray-500 dark:text-slate-400">
                  por {currentEvent.usuario.name}
                </span>
              )}
            </div>
            <span className="text-xs text-gray-400">
              {new Date(currentEvent.createdAt).toLocaleString('pt-BR')}
            </span>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={handleReset}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            title="Reiniciar"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={handleSkipBack}
            disabled={currentIndex === 0}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
            title="Anterior"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            onClick={playing ? handlePause : handlePlay}
            className="p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600"
          >
            {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>
          <button
            onClick={handleSkipForward}
            disabled={currentIndex >= filteredEvents.length - 1}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
            title="Próximo"
          >
            <SkipForward className="w-4 h-4" />
          </button>
          <button
            onClick={handleSpeedChange}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded"
            title="Velocidade"
          >
            <FastForward className="w-3 h-3" />
            {speed}x
          </button>
        </div>
      </div>

      {/* Event List */}
      <div className="max-h-48 overflow-y-auto border-t border-gray-200 dark:border-gray-700">
        {filteredEvents.map((event, idx) => (
          <div
            key={event.id}
            className={`px-4 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 ${
              idx === currentIndex ? 'bg-blue-50 dark:bg-blue-900/20' : ''
            }`}
            onClick={() => {
              setCurrentIndex(idx);
              setPlaying(false);
            }}
          >
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  EVENT_TYPE_COLORS[event.tipo] || 'bg-gray-400'
                } ${idx === currentIndex ? 'ring-2 ring-blue-400' : ''}`}
              />
              <span className="text-xs text-gray-700 dark:text-gray-300 flex-1 truncate">
                {event.descricao || event.tipo.replace(/_/g, ' ')}
              </span>
              <span className="text-[10px] text-gray-400">
                {new Date(event.createdAt).toLocaleTimeString('pt-BR')}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
