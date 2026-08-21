import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  TrendingUp,
  TrendingDown,
  MessageSquare,
  Bot,
  User,
  AlertTriangle,
  CheckCircle,
  Timer,
  BarChart3,
  Zap,
  RefreshCw,
} from 'lucide-react';
import api from '../../services/api';
import type { TicketMetrics } from '../../types';

interface TicketMetricsPanelProps {
  ticketId: string;
  slaTotalMinutos?: number;
  slaPausadoEm?: string | null;
  slaPausadoTotalMin?: number;
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) return `${hours}h ${mins}min`;
  const days = Math.floor(hours / 24);
  const remainHours = hours % 24;
  return `${days}d ${remainHours}h`;
}

function getSlaColor(percentual: number): string {
  if (percentual >= 100) return 'text-red-600 bg-red-50';
  if (percentual >= 90) return 'text-red-500 bg-red-50';
  if (percentual >= 75) return 'text-orange-500 bg-orange-50';
  if (percentual >= 50) return 'text-yellow-500 bg-yellow-50';
  return 'text-green-600 bg-green-50';
}

function getSlaStatusIcon(status?: string): React.ReactNode {
  switch (status) {
    case 'violado':
      return <AlertTriangle className="w-4 h-4 text-red-500" />;
    case 'alerta_90':
      return <AlertTriangle className="w-4 h-4 text-orange-500" />;
    case 'alerta_75':
      return <Clock className="w-4 h-4 text-yellow-500" />;
    case 'concluido':
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    default:
      return <CheckCircle className="w-4 h-4 text-green-500" />;
  }
}

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtitle?: string;
  color?: string;
}

function MetricCard({ icon, label, value, subtitle, color = 'text-gray-700 dark:text-slate-300' }: MetricCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-gray-400">{icon}</span>
        <span className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide">{label}</span>
      </div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
      {subtitle && <div className="text-xs text-gray-400 mt-0.5">{subtitle}</div>}
    </div>
  );
}

export default function TicketMetricsPanel({
  ticketId,
  slaTotalMinutos,
  slaPausadoEm,
  slaPausadoTotalMin = 0,
}: TicketMetricsPanelProps) {
  const [metrics, setMetrics] = useState<TicketMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);

  const loadMetrics = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/audit-ticket/tickets/${ticketId}/metrics`);
      setMetrics(data);
    } catch (err) {
      console.error('Erro ao carregar métricas:', err);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  const handleRecalculate = async () => {
    try {
      setCalculating(true);
      const { data } = await api.post(`/audit-ticket/tickets/${ticketId}/metrics/recalculate`);
      setMetrics(data);
    } catch (err) {
      console.error('Erro ao recalcular métricas:', err);
    } finally {
      setCalculating(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
        </div>
      </div>
    );
  }

  // Calcular SLA em tempo real se nao temos metricas
  const slaPercentual = slaTotalMinutos
    ? Math.min(100, ((metrics?.slaConsumidoMinutos || 0) / slaTotalMinutos) * 100)
    : 0;
  const slaRestante = slaTotalMinutos
    ? Math.max(0, slaTotalMinutos - (metrics?.slaConsumidoMinutos || 0))
    : 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-gray-500 dark:text-slate-400" />
          <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 dark:text-gray-300">
            Métricas
          </h3>
        </div>
        <button
          onClick={handleRecalculate}
          disabled={calculating}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${calculating ? 'animate-spin' : ''}`} />
          Recalcular
        </button>
      </div>

      {/* SLA Countdown */}
      {slaTotalMinutos && (
        <div className={`px-4 py-3 ${getSlaColor(slaPercentual)}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {getSlaStatusIcon(metrics?.slaStatus)}
              <span className="text-sm font-medium">
                SLA: {formatMinutes(slaRestante)} restantes
              </span>
            </div>
            <span className="text-sm font-bold">
              {Math.round(slaPercentual)}%
            </span>
          </div>
          <div className="w-full h-2 bg-white/50 dark:bg-black/20 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                slaPercentual >= 100
                  ? 'bg-red-500'
                  : slaPercentual >= 90
                  ? 'bg-orange-500'
                  : slaPercentual >= 75
                  ? 'bg-yellow-500'
                  : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(100, slaPercentual)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 text-[10px] opacity-75">
            <span>0%</span>
            <span>{formatMinutes(slaTotalMinutos)}</span>
          </div>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
        {/* Tempos */}
        <MetricCard
          icon={<Clock className="w-4 h-4" />}
          label="Total"
          value={formatMinutes(metrics?.tempoTotalMin || 0)}
          color="text-gray-900 dark:text-white"
        />
        <MetricCard
          icon={<Timer className="w-4 h-4" />}
          label="1ª Resposta"
          value={metrics?.tempoPrimeiraRespostaMin != null ? formatMinutes(metrics.tempoPrimeiraRespostaMin) : '—'}
          color="text-blue-600"
        />
        <MetricCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="Atendimento"
          value={formatMinutes(metrics?.tempoEmAtendimentoMin || 0)}
          color="text-purple-600"
        />
        <MetricCard
          icon={<Clock className="w-4 h-4" />}
          label="Fila"
          value={formatMinutes(metrics?.tempoFilaMin || 0)}
          color="text-yellow-600"
        />
        <MetricCard
          icon={<TrendingDown className="w-4 h-4" />}
          label="Aguard. Cliente"
          value={formatMinutes(metrics?.tempoAguardandoClienteMin || 0)}
          color="text-orange-600"
        />
        <MetricCard
          icon={<Clock className="w-4 h-4" />}
          label="Parado"
          value={formatMinutes(metrics?.tempoParadoMin || 0)}
          color="text-red-600"
        />

        {/* Mensagens */}
        <MetricCard
          icon={<MessageSquare className="w-4 h-4" />}
          label="Total Msgs"
          value={metrics?.totalMensagens || 0}
          subtitle={`Cliente: ${metrics?.mensagensCliente || 0} | Agente: ${metrics?.mensagensAgente || 0}`}
        />
        <MetricCard
          icon={<Bot className="w-4 h-4" />}
          label="Msgs Bot"
          value={metrics?.mensagensBot || 0}
          color="text-indigo-600"
        />
        <MetricCard
          icon={<RefreshCw className="w-4 h-4" />}
          label="Reaberturas"
          value={metrics?.totalReaberturas || 0}
          color={metrics?.totalReaberturas ? 'text-red-600' : 'text-gray-700 dark:text-slate-300'}
        />

        {/* IA */}
        <MetricCard
          icon={<Bot className="w-4 h-4" />}
          label="Resolvido IA"
          value={metrics?.resolvidoPorIa ? 'Sim' : 'Não'}
          color={metrics?.resolvidoPorIa ? 'text-indigo-600' : 'text-gray-500 dark:text-slate-400'}
        />
        <MetricCard
          icon={<Zap className="w-4 h-4" />}
          label="Confiança IA"
          value={metrics?.iaConfiancaMedia ? `${Math.round(metrics.iaConfiancaMedia)}%` : '—'}
          color="text-indigo-600"
        />
        <MetricCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="Custo IA"
          value={metrics?.iaCustoTotalUsd ? `$${metrics.iaCustoTotalUsd.toFixed(4)}` : '—'}
          subtitle={metrics?.iaCustoTotalBrl ? `R$ ${metrics.iaCustoTotalBrl.toFixed(4)}` : undefined}
          color="text-green-600"
        />

        {/* CSAT */}
        <MetricCard
          icon={<CheckCircle className="w-4 h-4" />}
          label="CSAT"
          value={metrics?.csatNota ? `${metrics.csatNota}/5` : '—'}
          subtitle={metrics?.csatRespondido ? 'Respondido' : 'Não respondido'}
          color={metrics?.csatNota ? (metrics.csatNota >= 4 ? 'text-green-600' : metrics.csatNota >= 3 ? 'text-yellow-600' : 'text-red-600') : 'text-gray-500 dark:text-slate-400'}
        />
      </div>
    </div>
  );
}
