import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Brain, Users, TrendingUp, AlertTriangle, Star, Award,
  RefreshCw, ChevronDown, ChevronUp, Search, BarChart3,
} from 'lucide-react';
import api from '../../services/api';

interface RankingAgente {
  agentId: string;
  agentName: string;
  totalMensagens: number;
  notaGeralMedia: number;
  profissionalismoMedio: number;
  cordialidadeMedia: number;
  clarezaMedia: number;
  empatiaMedia: number;
  classificacaoGeral: string;
  totalAlertas: number;
  totalSugestoes: number;
  encerramentos: {
    total: number;
    prematuros: number;
    resolucoesReais: number;
    reaberturas: number;
    taxaEncerramentoCorreto: number;
    notaMediaEncerramento: number;
    riscoAlto: number;
    riscoCritico: number;
    recomendaReabertura: number;
  } | null;
}

interface AvaliacaoDetalhada {
  id: string;
  ticketId: string;
  agentId: string;
  agentName?: string;
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
  processadoEm: string;
}

function classificacaoCor(c: string): string {
  switch (c) {
    case 'excelente': return 'text-emerald-400 bg-emerald-500/10';
    case 'bom': return 'text-blue-400 bg-blue-500/10';
    case 'regular': return 'text-amber-400 bg-amber-500/10';
    case 'neutro': return 'text-zinc-400 bg-zinc-500/10';
    case 'atencao': return 'text-amber-400 bg-amber-500/10';
    case 'critico': return 'text-red-400 bg-red-500/10';
    case 'ruim': return 'text-red-400 bg-red-500/10';
    default: return 'text-zinc-400 bg-zinc-500/10';
  }
}

function classificacaoLabel(c: string): string {
  switch (c) {
    case 'excelente': return 'Excelente';
    case 'bom': return 'Bom';
    case 'regular': return 'Regular';
    case 'neutro': return 'Neutro';
    case 'atencao': return 'Atenção';
    case 'critico': return 'Crítico';
    case 'ruim': return 'Ruim';
    default: return c;
  }
}

function medalha(rank: number): string {
  if (rank === 0) return '🥇';
  if (rank === 1) return '🥈';
  if (rank === 2) return '🥉';
  return `${rank + 1}º`;
}

function encerramentoTipoLabel(tipo: string): string {
  switch (tipo) {
    case 'encerramento_prematuro': return 'Encerramento prematuro';
    case 'resolucao_real': return 'Resolução real';
    case 'reabertura': return 'Reabertura';
    default: return 'Sem dados';
  }
}

function encerramentoTipoCor(tipo: string): string {
  switch (tipo) {
    case 'encerramento_prematuro': return 'text-red-400 bg-red-500/10';
    case 'reabertura': return 'text-amber-400 bg-amber-500/10';
    case 'resolucao_real': return 'text-emerald-400 bg-emerald-500/10';
    default: return 'text-zinc-400 bg-zinc-500/10';
  }
}

export default function AuditoriaAtendimento() {
  const navigate = useNavigate();
  const [ranking, setRanking] = useState<RankingAgente[]>([]);
  const [relatorioTicket, setRelatorioTicket] = useState<any>(null);
  const [ticketIdBusca, setTicketIdBusca] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingRelatorio, setLoadingRelatorio] = useState(false);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [filtroClassificacao, setFiltroClassificacao] = useState<string>('todos');

  const loadRanking = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/ai/agent-monitor/ranking', { params: { dias: 30 } });
      setRanking(data);
    } catch (err) {
      console.error('Erro ao carregar ranking:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRelatorio = useCallback(async () => {
    if (!ticketIdBusca.trim()) return;
    setLoadingRelatorio(true);
    try {
      const { data } = await api.get(`/ai/agent-monitor/relatorio/${ticketIdBusca.trim()}`);
      setRelatorioTicket(data);
    } catch {
      setRelatorioTicket(null);
    } finally {
      setLoadingRelatorio(false);
    }
  }, [ticketIdBusca]);

  useEffect(() => { loadRanking(); }, [loadRanking]);

  const rankingFiltrado = filtroClassificacao === 'todos'
    ? ranking
    : ranking.filter((r) => {
        const classif = r.notaGeralMedia >= 8 ? 'excelente' : r.notaGeralMedia >= 6 ? 'bom' : r.notaGeralMedia >= 4 ? 'regular' : 'ruim';
        return classif === filtroClassificacao;
      });

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="w-7 h-7 text-violet-400" />
            <div>
              <h1 className="text-xl font-bold text-zinc-100">Auditoria de Atendimento</h1>
              <p className="text-sm text-zinc-500">Coach IA — Avaliação automática de agentes</p>
            </div>
          </div>
          <button onClick={loadRanking} className="p-2 rounded-lg hover:bg-zinc-800 transition" title="Atualizar">
            <RefreshCw className={`w-5 h-5 text-zinc-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-zinc-500" />
              <span className="text-xs text-zinc-500">Agentes avaliados</span>
            </div>
            <p className="text-2xl font-bold text-zinc-100">{ranking.length}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-4 h-4 text-zinc-500" />
              <span className="text-xs text-zinc-500">Total avaliações</span>
            </div>
            <p className="text-2xl font-bold text-zinc-100">
              {ranking.reduce((sum, r) => sum + r.totalMensagens, 0)}
            </p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-zinc-500" />
              <span className="text-xs text-zinc-500">Média geral</span>
            </div>
            <p className="text-2xl font-bold text-zinc-100">
              {ranking.length > 0
                ? (ranking.reduce((sum, r) => sum + r.notaGeralMedia, 0) / ranking.length).toFixed(1)
                : '—'}
            </p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-zinc-500" />
              <span className="text-xs text-zinc-500">Total alertas</span>
            </div>
            <p className="text-2xl font-bold text-zinc-100">
              {ranking.reduce((sum, r) => sum + r.totalAlertas, 0)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={ticketIdBusca}
              onChange={(e) => setTicketIdBusca(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadRelatorio()}
              placeholder="Buscar relatório por Ticket ID..."
              className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500"
            />
          </div>
          <button
            onClick={loadRelatorio}
            disabled={!ticketIdBusca.trim() || loadingRelatorio}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm rounded-lg transition"
          >
            {loadingRelatorio ? 'Buscando...' : 'Buscar'}
          </button>
          <select
            value={filtroClassificacao}
            onChange={(e) => setFiltroClassificacao(e.target.value)}
            className="px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-300"
          >
            <option value="todos">Todos</option>
            <option value="excelente">Excelente</option>
            <option value="bom">Bom</option>
            <option value="neutro">Neutro</option>
            <option value="atencao">Atenção</option>
            <option value="critico">Crítico</option>
          </select>
        </div>

        {relatorioTicket && (
          <div className="bg-zinc-900 border border-violet-500/20 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-200">
                Relatório — Ticket {relatorioTicket.ticketId?.slice(0, 8)}
              </h2>
              <button onClick={() => setRelatorioTicket(null)} className="text-zinc-500 hover:text-zinc-300 text-xs">Fechar</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="text-center">
                <p className="text-xs text-zinc-500">Mensagens do agente</p>
                <p className="text-lg font-bold text-zinc-200">{relatorioTicket.totalMensagensAgente ?? 0}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-zinc-500">Média geral</p>
                <p className="text-lg font-bold text-zinc-200">{relatorioTicket.metricas?.notaGeralMedia?.toFixed(1) ?? '—'}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-zinc-500">Alertas</p>
                <p className="text-lg font-bold text-red-400">{relatorioTicket.metricas?.totalAlertas ?? 0}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-zinc-500">Sugestões</p>
                <p className="text-lg font-bold text-violet-400">{relatorioTicket.metricas?.totalSugestoes ?? 0}</p>
              </div>
            </div>
            {relatorioTicket.encerramento && (
              <div className="rounded-lg border border-zinc-700/60 bg-zinc-800/40 p-3 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-medium text-zinc-400">Encerramento:</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${encerramentoTipoCor(relatorioTicket.encerramento.tipo)}`}>
                    {encerramentoTipoLabel(relatorioTicket.encerramento.tipo)}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-700/50 text-zinc-300">
                    Risco {relatorioTicket.encerramento.riscoReabertura}
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    Nota <span className="font-mono text-zinc-300">{relatorioTicket.encerramento.nota.toFixed(1)}</span>/10
                  </span>
                </div>
                {relatorioTicket.encerramento.diagnostico && (
                  <p className="text-[11px] text-zinc-400 leading-relaxed">{relatorioTicket.encerramento.diagnostico}</p>
                )}
                {relatorioTicket.encerramento.recomendaReabertura && (
                  <p className="text-[10px] font-medium text-red-400">⚠️ Recomenda reabertura do ticket</p>
                )}
              </div>
            )}
            {relatorioTicket.avaliacoes?.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {relatorioTicket.avaliacoes.map((av: AvaliacaoDetalhada) => (
                  <div key={av.id} className="bg-zinc-800/50 rounded-lg p-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${classificacaoCor(av.classificacao)}`}>
                        {classificacaoLabel(av.classificacao)}
                      </span>
                      <span className="text-[10px] text-zinc-500">{av.notaGeral.toFixed(1)}/10</span>
                      <span className="text-[10px] text-zinc-600 ml-auto">
                        {new Date(av.processadoEm).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 line-clamp-2">{av.conteudoMensagem}</p>
                    {av.alertas.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {av.alertas.map((a, i) => (
                          <span key={i} className="text-[10px] text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded">{a}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-800 flex items-center gap-2">
            <Award className="w-4 h-4 text-zinc-500" />
            <h2 className="text-sm font-semibold text-zinc-300">Ranking de Agentes — Últimos 30 dias</h2>
          </div>
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <RefreshCw className="w-5 h-5 text-zinc-500 animate-spin" />
            </div>
          ) : rankingFiltrado.length === 0 ? (
            <div className="p-8 text-center text-sm text-zinc-500">
              Nenhum agente avaliado no período
            </div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {rankingFiltrado.map((r, idx) => {
                const isExpanded = expandedAgent === r.agentId;
                const classif = r.notaGeralMedia >= 8 ? 'excelente' : r.notaGeralMedia >= 6 ? 'bom' : r.notaGeralMedia >= 4 ? 'regular' : 'ruim';
                return (
                  <div key={r.agentId}>
                    <div
                      className="flex items-center gap-4 px-5 py-3 hover:bg-zinc-800/30 cursor-pointer transition"
                      onClick={() => setExpandedAgent(isExpanded ? null : r.agentId)}
                    >
                      <span className="text-sm w-8 text-center">{medalha(idx)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-200 truncate">{r.agentName}</p>
                        <p className="text-[11px] text-zinc-500">{r.totalMensagens} avaliações</p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${classificacaoCor(classif)}`}>
                        {classificacaoLabel(classif)}
                      </span>
                      <span className="text-sm font-mono text-zinc-300 w-12 text-right">{r.notaGeralMedia.toFixed(1)}</span>
                      <span className="text-[10px] text-red-400 w-16 text-right">{r.totalAlertas} alertas</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
                    </div>
                    {isExpanded && (
                      <div className="px-5 pb-4 bg-zinc-900/50 space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <p className="text-[10px] text-zinc-500 mb-0.5">Profissionalismo</p>
                            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                              <div className="h-full bg-violet-500 rounded-full" style={{ width: `${(r.profissionalismoMedio / 10) * 100}%` }} />
                            </div>
                            <p className="text-[10px] text-zinc-400 mt-0.5">{r.profissionalismoMedio.toFixed(1)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-zinc-500 mb-0.5">Cordialidade</p>
                            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(r.cordialidadeMedia / 10) * 100}%` }} />
                            </div>
                            <p className="text-[10px] text-zinc-400 mt-0.5">{r.cordialidadeMedia.toFixed(1)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-zinc-500 mb-0.5">Clareza</p>
                            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(r.clarezaMedia / 10) * 100}%` }} />
                            </div>
                            <p className="text-[10px] text-zinc-400 mt-0.5">{r.clarezaMedia.toFixed(1)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-zinc-500 mb-0.5">Empatia</p>
                            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                              <div className="h-full bg-amber-500 rounded-full" style={{ width: `${(r.empatiaMedia / 10) * 100}%` }} />
                            </div>
                            <p className="text-[10px] text-zinc-400 mt-0.5">{r.empatiaMedia.toFixed(1)}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${classificacaoCor(classif)}`}>
                            Classificação geral: {classificacaoLabel(classif)}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400">
                            {r.totalSugestoes} sugestões
                          </span>
                        </div>
                        {r.encerramentos && r.encerramentos.total > 0 && (
                          <div className="rounded-lg border border-zinc-700/60 bg-zinc-800/40 p-3 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-medium text-zinc-400">
                                Encerramentos auditados ({r.encerramentos.total})
                              </span>
                              <span className="text-[10px] text-zinc-500">
                                Taxa correta: <span className="text-emerald-400 font-medium">{r.encerramentos.taxaEncerramentoCorreto}%</span>
                              </span>
                            </div>
                            <div className="grid grid-cols-4 gap-2 text-center">
                              <div className="bg-zinc-800/50 rounded-lg p-2">
                                <p className="text-base font-bold text-emerald-400">{r.encerramentos.resolucoesReais}</p>
                                <p className="text-[9px] text-zinc-500">Resoluções</p>
                              </div>
                              <div className="bg-zinc-800/50 rounded-lg p-2">
                                <p className="text-base font-bold text-red-400">{r.encerramentos.prematuros}</p>
                                <p className="text-[9px] text-zinc-500">Prematuros</p>
                              </div>
                              <div className="bg-zinc-800/50 rounded-lg p-2">
                                <p className="text-base font-bold text-amber-400">{r.encerramentos.reaberturas}</p>
                                <p className="text-[9px] text-zinc-500">Reabertos</p>
                              </div>
                              <div className="bg-zinc-800/50 rounded-lg p-2">
                                <p className={`text-base font-bold ${(r.encerramentos.riscoAlto + r.encerramentos.riscoCritico) > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                  {r.encerramentos.riscoAlto + r.encerramentos.riscoCritico}
                                </p>
                                <p className="text-[9px] text-zinc-500">Alto/crítico</p>
                              </div>
                            </div>
                            <p className="text-[10px] text-zinc-500">
                              Nota média: <span className="text-zinc-300">{r.encerramentos.notaMediaEncerramento.toFixed(1)}</span>/10 · Recomendam reabertura: <span className="text-zinc-300">{r.encerramentos.recomendaReabertura}</span>
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
