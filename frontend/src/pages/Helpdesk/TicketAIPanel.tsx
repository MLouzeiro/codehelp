import { useState, useEffect, useCallback } from 'react';
import { Bot, Brain, AlertTriangle, CheckCircle, MessageSquare, BarChart3, RefreshCw, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';
import api from '../../services/api';
import type { TicketAnalytics } from '../../types';

interface TicketAIPanelProps {
  ticketId: string;
  ticket: any;
}

export default function TicketAIPanel({ ticketId, ticket }: TicketAIPanelProps) {
  const [analytics, setAnalytics] = useState<TicketAnalytics | null>(null);
  const [sugestao, setSugestao] = useState<string>('');
  const [notaEncerramento, setNotaEncerramento] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingSugestao, setLoadingSugestao] = useState(false);
  const [loadingNota, setLoadingNota] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [tab, setTab] = useState<'resumo' | 'classificacao' | 'metricas'>('resumo');

  const loadAnalytics = useCallback(async () => {
    try {
      const { data } = await api.get(`/helpdesk/tickets/${ticketId}/analytics`);
      setAnalytics(data);
    } catch (err) {
      console.error('Erro ao carregar analytics IA:', err);
    }
  }, [ticketId]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const gerarSugestao = async () => {
    setLoadingSugestao(true);
    try {
      const { data } = await api.post(`/ai/ticket/${ticketId}/sugerir-resposta`);
      setSugestao(data.sugestao);
    } catch (err) {
      console.error('Erro ao gerar sugestão:', err);
    } finally {
      setLoadingSugestao(false);
    }
  };

  const gerarNotaEncerramento = async () => {
    setLoadingNota(true);
    try {
      const { data } = await api.post(`/ai/ticket/${ticketId}/nota-encerramento`);
      setNotaEncerramento(data.nota);
    } catch (err) {
      console.error('Erro ao gerar nota:', err);
    } finally {
      setLoadingNota(false);
    }
  };

  const classificacao = analytics?.classificacaoIa || (ticket?.iaClassificacao ? JSON.parse(ticket.iaClassificacao) : null);
  const avaliacao = analytics?.avaliacaoIa || (ticket?.iaAvaliacaoQualidade ? JSON.parse(ticket.iaAvaliacaoQualidade) : null);

  const formatarTempo = (min: number) => {
    if (min < 60) return `${min}min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  };

  const getConfiancaCor = (conf: number) => {
    if (conf >= 80) return 'text-emerald-600 bg-emerald-50';
    if (conf >= 50) return 'text-amber-600 bg-amber-50';
    return 'text-red-600 bg-red-50';
  };

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-50 to-indigo-50 hover:from-violet-100 hover:to-indigo-100 dark:from-violet-900/30 dark:to-indigo-900/30 dark:hover:from-violet-900/50 dark:hover:to-indigo-900/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          <span className="font-semibold text-slate-800 dark:text-slate-100">Análise de IA</span>
          {ticket?.resolvidoPorIa && (
            <span className="px-2 py-0.5 text-xs font-medium bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-400 rounded-full">
              Resolvido por IA
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-500 dark:text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-500 dark:text-slate-400" />}
      </button>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* Tabs */}
          <div className="flex gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
            {([
              { key: 'resumo', label: 'Resumo' },
              { key: 'classificacao', label: 'Classificação' },
              { key: 'metricas', label: 'Métricas' },
            ] as const).map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-colors ${
                  tab === t.key
                    ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab: Resumo */}
          {tab === 'resumo' && (
            <div className="space-y-3">
              {/* Resumo da IA */}
              {analytics?.resumoIa && (
                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Resumo do Problema</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{analytics.resumoIa}</p>
                </div>
              )}

              {/* Nota de encerramento */}
              {(analytics?.notaEncerramentoIa || notaEncerramento) && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg border border-emerald-100 dark:border-emerald-700">
                  <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1">Nota de Encerramento</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                    {notaEncerramento || analytics?.notaEncerramentoIa}
                  </p>
                </div>
              )}

              {/* Sugestão de resposta */}
              {(sugestao || analytics?.classificacaoIa) && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-lg border border-amber-100 dark:border-amber-700">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Sugestão de Resposta</p>
                    <button
                      onClick={gerarSugestao}
                      disabled={loadingSugestao}
                      className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 disabled:opacity-50 flex items-center gap-1"
                    >
                      <RefreshCw className={`w-3 h-3 ${loadingSugestao ? 'animate-spin' : ''}`} />
                      {loadingSugestao ? 'Gerando...' : 'Gerar nova'}
                    </button>
                  </div>
                  {sugestao && (
                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{sugestao}</p>
                  )}
                </div>
              )}

              {/* Ação */}
              <div className="flex gap-2">
                {!analytics?.notaEncerramentoIa && !notaEncerramento && (
                  <button
                    onClick={gerarNotaEncerramento}
                    disabled={loadingNota}
                    className="flex-1 py-2 px-3 text-xs font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 flex items-center justify-center gap-1"
                  >
                    <Brain className={`w-3.5 h-3.5 ${loadingNota ? 'animate-pulse' : ''}`} />
                    {loadingNota ? 'Gerando...' : 'Gerar Nota de Encerramento'}
                  </button>
                )}
                {!sugestao && (
                  <button
                    onClick={gerarSugestao}
                    disabled={loadingSugestao}
                    className="flex-1 py-2 px-3 text-xs font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 flex items-center justify-center gap-1"
                  >
                    <Lightbulb className={`w-3.5 h-3.5 ${loadingSugestao ? 'animate-pulse' : ''}`} />
                    {loadingSugestao ? 'Gerando...' : 'Sugerir Resposta'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Tab: Classificação */}
          {tab === 'classificacao' && (
            <div className="space-y-3">
              {classificacao ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Categoria</p>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                        {classificacao.categoria?.replace(/_/g, ' ') || '—'}
                      </p>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Prioridade</p>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                        {classificacao.prioridade || '—'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Confiança:</span>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getConfiancaCor(classificacao.confianca || 0)}`}>
                      {classificacao.confianca || 0}%
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">via {classificacao.metodo}</span>
                  </div>
                  {/* Barra de confiança */}
                  <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        (classificacao.confianca || 0) >= 80 ? 'bg-emerald-500' :
                        (classificacao.confianca || 0) >= 50 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${classificacao.confianca || 0}%` }}
                    />
                  </div>
                </>
              ) : (
                <div className="text-center py-6 text-slate-400 dark:text-slate-500">
                  <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Classificação ainda não realizada</p>
                </div>
              )}
            </div>
          )}

          {/* Tab: Métricas */}
          {tab === 'metricas' && analytics && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Tempo Total</p>
                  <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{formatarTempo(analytics.tempoTotalMin)}</p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">1ª Resposta</p>
                  <p className="text-lg font-bold text-slate-800 dark:text-slate-100">
                    {analytics.tempoPrimeiraRespostaMin != null ? formatarTempo(analytics.tempoPrimeiraRespostaMin) : '—'}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Em Atendimento</p>
                  <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{formatarTempo(analytics.tempoEmAtendimentoMin)}</p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Aguard. Cliente</p>
                  <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{formatarTempo(analytics.tempoAguardandoClienteMin)}</p>
                </div>
              </div>

              {/* Distribuição de mensagens */}
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Distribuição de Mensagens</p>
                <div className="flex gap-4">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-xs text-slate-600 dark:text-slate-400">Cliente: {analytics.distribuicaoMensagens.cliente}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="text-xs text-slate-600 dark:text-slate-400">Agente: {analytics.distribuicaoMensagens.agente}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-violet-500" />
                    <span className="text-xs text-slate-600 dark:text-slate-400">Bot: {analytics.distribuicaoMensagens.bot}</span>
                  </div>
                </div>
                {/* Barra de proporção */}
                {analytics.distribuicaoMensagens.total > 0 && (
                  <div className="flex rounded-full overflow-hidden h-2 mt-2">
                    <div
                      className="bg-blue-500"
                      style={{ width: `${(analytics.distribuicaoMensagens.cliente / analytics.distribuicaoMensagens.total) * 100}%` }}
                    />
                    <div
                      className="bg-emerald-500"
                      style={{ width: `${(analytics.distribuicaoMensagens.agente / analytics.distribuicaoMensagens.total) * 100}%` }}
                    />
                    <div
                      className="bg-violet-500"
                      style={{ width: `${(analytics.distribuicaoMensagens.bot / analytics.distribuicaoMensagens.total) * 100}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Média de resposta */}
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Tempo Médio de Resposta</p>
                <p className="text-lg font-bold text-slate-800 dark:text-slate-100">
                  {analytics.tempoMedioRespostaMin > 0 ? formatarTempo(analytics.tempoMedioRespostaMin) : '—'}
                </p>
              </div>

              {/* Avaliação de qualidade */}
              {avaliacao && (
                <div className="p-3 bg-violet-50 dark:bg-violet-900/30 rounded-lg border border-violet-100 dark:border-violet-700">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-violet-600 dark:text-violet-400">Avaliação de Qualidade</p>
                    <span className="px-2 py-0.5 text-sm font-bold bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-400 rounded-full">
                      {avaliacao.notaQualidade}/10
                    </span>
                  </div>
                  {avaliacao.resumo && (
                    <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">{avaliacao.resumo}</p>
                  )}
                  {avaliacao.pontosForts && avaliacao.pontosForts.length > 0 && (
                    <div className="mb-1">
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Pontos Fortes:</p>
                      <ul className="text-xs text-slate-600 dark:text-slate-400 list-disc list-inside">
                        {(Array.isArray(avaliacao.pontosForts) ? avaliacao.pontosForts : JSON.parse(avaliacao.pontosForts || '[]')).map((p: string, i: number) => (
                          <li key={i}>{p}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {avaliacao.pontosMelhoria && avaliacao.pontosMelhoria.length > 0 && (
                    <div>
                      <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Pontos de Melhoria:</p>
                      <ul className="text-xs text-slate-600 dark:text-slate-400 list-disc list-inside">
                        {(Array.isArray(avaliacao.pontosMelhoria) ? avaliacao.pontosMelhoria : JSON.parse(avaliacao.pontosMelhoria || '[]')).map((p: string, i: number) => (
                          <li key={i}>{p}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
