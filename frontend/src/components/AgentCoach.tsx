import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Brain, AlertTriangle, ThumbsUp, ThumbsDown, TrendingUp, RefreshCw, X } from 'lucide-react';
import api from '../services/api';

interface AvaliacaoMensagem {
  id: string;
  ticketId: string;
  agentId: string;
  mensagemId: string;
  conteudoMensagem: string;
  notProfissionalismo: number;
  notCordialidade: number;
  notClareza: number;
  notEmpatia: number;
  notaGeral: number;
  classificacao: string;
  sugestaoResposta: string | null;
  alertas: string[];
  pontosFortes: string[];
  pontosMelhoria: string[];
  modeloUsado: string;
  custoTokens: number;
  processadoEm: string;
}

interface MetricasAgente {
  totalAvaliacoes: number;
  mediaGeral: number;
  mediaProfissionalismo: number;
  mediaCordialidade: number;
  mediaClareza: number;
  mediaEmpatia: number;
  distribuicaoClassificacoes: Record<string, number>;
  totalAlertas: number;
  totalSugestoes: number;
  periodo: { inicio: string; fim: string };
}

interface AgentCoachProps {
  ticketId: string;
  agentId?: string;
  onClose?: () => void;
  compact?: boolean;
}

function classificacaoCor(classificacao: string): string {
  switch (classificacao) {
    case 'excelente': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    case 'bom': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    case 'regular': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    case 'ruim': return 'text-red-400 bg-red-500/10 border-red-500/20';
    default: return 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20';
  }
}

function classificacaoLabel(classificacao: string): string {
  switch (classificacao) {
    case 'excelente': return 'Excelente';
    case 'bom': return 'Bom';
    case 'regular': return 'Regular';
    case 'ruim': return 'Precisa melhorar';
    default: return classificacao;
  }
}

function ScoreBar({ label, score, maxScore = 10 }: { label: string; score: number; maxScore?: number }) {
  const pct = Math.min((score / maxScore) * 100, 100);
  let color = 'bg-emerald-500';
  if (score < 4) color = 'bg-red-500';
  else if (score < 6) color = 'bg-amber-500';
  else if (score < 8) color = 'bg-blue-500';

  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-zinc-400 w-24 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] text-zinc-300 w-8 text-right font-mono">{score.toFixed(1)}</span>
    </div>
  );
}

export default function AgentCoach({ ticketId, agentId, onClose, compact = false }: AgentCoachProps) {
  const [avaliacao, setAvaliacao] = useState<AvaliacaoMensagem | null>(null);
  const [metricas, setMetricas] = useState<MetricasAgente | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadAvaliacao = useCallback(async () => {
    if (!ticketId) return;
    try {
      const { data } = await api.get(`/ai/agent-monitor/relatorio/${ticketId}`);
      const avaliacoes = data.avaliacoes || [];
      if (avaliacoes.length > 0) {
        setAvaliacao(avaliacoes[avaliacoes.length - 1]);
      }
      setError(null);
    } catch (err: any) {
      if (err?.response?.status !== 404) {
        setError('Erro ao carregar avaliação');
      }
    }
  }, [ticketId]);

  const loadMetricas = useCallback(async () => {
    if (!agentId) return;
    try {
      const { data } = await api.get(`/ai/agent-monitor/metricas/${agentId}`, { params: { dias: 30 } });
      setMetricas(data);
    } catch { /* ignore */ }
  }, [agentId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadAvaliacao(), loadMetricas()]).finally(() => setLoading(false));
  }, [loadAvaliacao, loadMetricas]);

  useEffect(() => {
    pollRef.current = setInterval(() => {
      loadAvaliacao();
      loadMetricas();
    }, 15000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadAvaliacao, loadMetricas]);

  if (loading && !avaliacao) {
    return (
      <div className="flex items-center justify-center p-6">
        <RefreshCw className="w-4 h-4 text-zinc-400 animate-spin" />
        <span className="ml-2 text-sm text-zinc-400">Carregando coach...</span>
      </div>
    );
  }

  if (!avaliacao && !metricas) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center">
        <Brain className="w-8 h-8 text-zinc-600 mb-2" />
        <p className="text-sm text-zinc-500">Nenhuma avaliação disponível</p>
        <p className="text-xs text-zinc-600 mt-1">Envie uma mensagem para iniciar a auditoria</p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="bg-zinc-900 border border-zinc-700/50 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-violet-400" />
            <span className="text-xs font-medium text-zinc-300">Coach IA</span>
          </div>
          {avaliacao && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${classificacaoCor(avaliacao.classificacao)}`}>
              {classificacaoLabel(avaliacao.classificacao)}
            </span>
          )}
        </div>
        {avaliacao && (
          <>
            <div className="space-y-1">
              <ScoreBar label="Profissionalismo" score={avaliacao.notProfissionalismo} />
              <ScoreBar label="Cordialidade" score={avaliacao.notCordialidade} />
              <ScoreBar label="Clareza" score={avaliacao.notClareza} />
              <ScoreBar label="Empatia" score={avaliacao.notEmpatia} />
            </div>
            {avaliacao.alertas.length > 0 && (
              <div className="flex items-start gap-1.5 mt-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                <p className="text-[11px] text-amber-300 leading-tight">{avaliacao.alertas[0]}</p>
              </div>
            )}
            {avaliacao.sugestaoResposta && (
              <div className="mt-2 p-2 bg-zinc-800 rounded text-[11px] text-zinc-300 leading-relaxed">
                <span className="text-zinc-500 font-medium">Sugestão:</span>{' '}
                {avaliacao.sugestaoResposta.length > 200
                  ? avaliacao.sugestaoResposta.slice(0, 200) + '...'
                  : avaliacao.sugestaoResposta}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-700/50 rounded-xl p-4 space-y-4 max-h-[70vh] overflow-y-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-violet-400" />
          <h3 className="text-sm font-semibold text-zinc-200">Coach IA — Tempo Real</h3>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { loadAvaliacao(); loadMetricas(); }} className="p-1 rounded hover:bg-zinc-800" title="Atualizar">
            <RefreshCw className="w-4 h-4 text-zinc-400" />
          </button>
          {onClose && (
            <button onClick={onClose} className="p-1 rounded hover:bg-zinc-800">
              <X className="w-4 h-4 text-zinc-400" />
            </button>
          )}
        </div>
      </div>

      {avaliacao && (
        <>
          <div className="flex items-center gap-3">
            <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${classificacaoCor(avaliacao.classificacao)}`}>
              {classificacaoLabel(avaliacao.classificacao)}
            </span>
            <span className="text-xs text-zinc-500">
              Nota: <span className="text-zinc-300 font-mono">{avaliacao.notaGeral.toFixed(1)}</span>/10
            </span>
            <span className="text-[10px] text-zinc-600">
              {new Date(avaliacao.processadoEm).toLocaleTimeString('pt-BR')}
            </span>
          </div>

          <div className="space-y-2">
            <ScoreBar label="Profissionalismo" score={avaliacao.notProfissionalismo} />
            <ScoreBar label="Cordialidade" score={avaliacao.notCordialidade} />
            <ScoreBar label="Clareza" score={avaliacao.notClareza} />
            <ScoreBar label="Empatia" score={avaliacao.notEmpatia} />
          </div>

          {avaliacao.pontosFortes.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <ThumbsUp className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[11px] font-medium text-emerald-400">Pontos fortes</span>
              </div>
              {avaliacao.pontosFortes.map((p, i) => (
                <p key={i} className="text-[11px] text-zinc-400 pl-5 leading-relaxed">{p}</p>
              ))}
            </div>
          )}

          {avaliacao.pontosMelhoria.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] font-medium text-amber-400">Pontos de melhoria</span>
              </div>
              {avaliacao.pontosMelhoria.map((p, i) => (
                <p key={i} className="text-[11px] text-zinc-400 pl-5 leading-relaxed">{p}</p>
              ))}
            </div>
          )}

          {avaliacao.alertas.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                <span className="text-[11px] font-medium text-red-400">Alertas</span>
              </div>
              {avaliacao.alertas.map((a, i) => (
                <p key={i} className="text-[11px] text-red-300/80 pl-5 leading-relaxed">{a}</p>
              ))}
            </div>
          )}

          {avaliacao.sugestaoResposta && (
            <div className="bg-zinc-800/50 border border-zinc-700/30 rounded-lg p-3 space-y-1">
              <span className="text-[11px] font-medium text-violet-400">Sugestão de resposta</span>
              <p className="text-[11px] text-zinc-300 leading-relaxed whitespace-pre-wrap">{avaliacao.sugestaoResposta}</p>
            </div>
          )}
        </>
      )}

      {metricas && (
        <div className="border-t border-zinc-800 pt-3 space-y-2">
          <span className="text-[11px] font-medium text-zinc-400">Métricas 30 dias</span>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-zinc-800/50 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-zinc-200">{metricas.totalAvaliacoes}</p>
              <p className="text-[10px] text-zinc-500">Avaliações</p>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-zinc-200">{metricas.mediaGeral.toFixed(1)}</p>
              <p className="text-[10px] text-zinc-500">Média geral</p>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-red-400">{metricas.totalAlertas}</p>
              <p className="text-[10px] text-zinc-500">Alertas</p>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-violet-400">{metricas.totalSugestoes}</p>
              <p className="text-[10px] text-zinc-500">Sugestões</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
