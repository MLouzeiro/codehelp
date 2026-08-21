import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, RefreshCw } from 'lucide-react';
import api from '../../services/api';

interface TemporalBarChartProps {
  ticketId: string;
  compact?: boolean;
}

interface TemporalData {
  received: number;
  aiProcessed: number;
  queueWait: number;
  humanHandled: number;
  clientWait: number;
  finished: number;
}

const COLORS = {
  received: '#3b82f6',    // Blue
  aiProcessed: '#8b5cf6', // Purple
  queueWait: '#f59e0b',   // Amber
  humanHandled: '#10b981', // Green
  clientWait: '#f97316',   // Orange
  finished: '#6b7280',     // Gray
};

const LABELS = {
  received: 'Recebidos',
  aiProcessed: 'IA',
  queueWait: 'Fila',
  humanHandled: 'Humano',
  clientWait: 'Cliente',
  finished: 'Concluídos',
};

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) return `${hours}h ${mins}min`;
  const days = Math.floor(hours / 24);
  const remainHours = hours % 24;
  return `${days}d ${remainHours}h`;
}

export default function TemporalBarChart({ ticketId, compact = false }: TemporalBarChartProps) {
  const [data, setData] = useState<TemporalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredBar, setHoveredBar] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: metrics } = await api.get(`/audit-ticket/tickets/${ticketId}/metrics`);

      if (metrics) {
        setData({
          received: metrics.totalMensagens || 0,
          aiProcessed: metrics.mensagensBot || 0,
          queueWait: metrics.tempoFilaMin || 0,
          humanHandled: metrics.mensagensAgente || 0,
          clientWait: metrics.tempoAguardandoClienteMin || 0,
          finished: metrics.tempoTotalMin || 0,
        });
      }
    } catch (err) {
      console.error('Erro ao carregar dados temporais:', err);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const total = Object.values(data).reduce((a, b) => a + b, 0);
  if (total === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="text-center py-8 text-gray-500 dark:text-slate-400 text-sm">
          Sem dados temporais disponíveis
        </div>
      </div>
    );
  }

  const bars = Object.entries(data)
    .filter(([, value]) => value > 0)
    .map(([key, value]) => ({
      key,
      value,
      percentage: (value / total) * 100,
      color: COLORS[key as keyof typeof COLORS],
      label: LABELS[key as keyof typeof LABELS],
    }));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      {!compact && (
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <BarChart3 className="w-5 h-5 text-gray-500 dark:text-slate-400" />
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Distribuição Temporal
          </h3>
        </div>
      )}

      <div className={compact ? 'p-3' : 'p-4'}>
        {/* Proportional Bar */}
        <div className="relative h-8 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
          {bars.map((bar) => (
            <div
              key={bar.key}
              className="absolute top-0 bottom-0 transition-all duration-300 cursor-pointer"
              style={{
                left: `${bars
                  .slice(0, bars.indexOf(bar))
                  .reduce((acc, b) => acc + b.percentage, 0)}%`,
                width: `${bar.percentage}%`,
                backgroundColor: bar.color,
                opacity: hoveredBar && hoveredBar !== bar.key ? 0.5 : 1,
              }}
              onMouseEnter={() => setHoveredBar(bar.key)}
              onMouseLeave={() => setHoveredBar(null)}
            />
          ))}
        </div>

        {/* Legend */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          {bars.map((bar) => (
            <div
              key={bar.key}
              className={`flex items-center gap-2 text-xs ${
                hoveredBar === bar.key ? 'opacity-100' : 'opacity-70'
              }`}
            >
              <div
                className="w-3 h-3 rounded-sm flex-shrink-0"
                style={{ backgroundColor: bar.color }}
              />
              <span className="text-gray-600 dark:text-gray-400 truncate">{bar.label}</span>
              <span className="font-medium text-gray-700 dark:text-gray-300 ml-auto">
                {formatMinutes(bar.value)}
              </span>
            </div>
          ))}
        </div>

        {/* Tooltip */}
        {hoveredBar && (
          <div className="mt-2 text-center text-xs text-gray-500 dark:text-slate-400">
            {LABELS[hoveredBar as keyof typeof LABELS]}:{' '}
            <span className="font-medium">
              {formatMinutes(data[hoveredBar as keyof typeof data])}
            </span>{' '}
            ({Math.round((data[hoveredBar as keyof typeof data] / total) * 100)}%)
          </div>
        )}
      </div>
    </div>
  );
}
