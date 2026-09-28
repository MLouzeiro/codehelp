import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../services/auth';
import api from '../../services/api';
import { formatDuration } from '../../lib/formatDuration';
import {
  InteligenciaCompleta,
  AnaliseAssunto,
  AnaliseCliente,
  ProgressoChamado,
  RecomendacaoAssunto,
} from '../../types';

// ── Helpers ─────────────────────────────────────────────────────────────

function formatTempo(min: number): string {
  return formatDuration(min);
}

function classificacaoRisco(r: string): { cor: string; bg: string; label: string } {
  switch (r) {
    case 'critico': return { cor: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30', label: 'Crítico' };
    case 'alto': return { cor: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/30', label: 'Alto' };
    case 'atencao': return { cor: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900/30', label: 'Atenção' };
    default: return { cor: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30', label: 'Baixo' };
  }
}

function classificacaoProgresso(p: string): { cor: string; icone: string; label: string } {
  switch (p) {
    case 'critico': return { cor: 'text-red-600', icone: '🔴', label: 'Crítico' };
    case 'parado': return { cor: 'text-orange-600', icone: '🟠', label: 'Parado' };
    case 'atencao': return { cor: 'text-yellow-600', icone: '🟡', label: 'Atenção' };
    default: return { cor: 'text-green-600', icone: '🟢', label: 'Em progresso' };
  }
}

function prioridadeCor(p: string): string {
  switch (p) {
    case 'urgente': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    case 'alta': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
    case 'media': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    default: return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
  }
}

// ── Component ───────────────────────────────────────────────────────────

export default function InteligenciaOperacionalPage() {
  const { user } = useAuth();
  const [data, setData] = useState<InteligenciaCompleta | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<'resumo' | 'assuntos' | 'clientes' | 'progresso' | 'automacao'>('resumo');
  const [dias, setDias] = useState(30);
  const [assuntoSelecionado, setAssuntoSelecionado] = useState<AnaliseAssunto | null>(null);
  const [clienteSelecionado, setClienteSelecionado] = useState<AnaliseCliente | null>(null);

  const carregarDados = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const { data: result } = await api.get('/helpdesk/inteligencia/completa', { params: { dias } });
      setData(result);
    } catch (err: any) {
      setErro(err.response?.data?.error || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [dias]);

  useEffect(() => { carregarDados(); }, [carregarDados]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Carregando inteligência operacional...</p>
        </div>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-300">{erro}</p>
          <button onClick={carregarDados} className="mt-2 text-sm text-red-600 hover:underline">Tentar novamente</button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { resumoExecutivo: r } = data;

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Inteligência Operacional</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Período: {data.periodo.label} | Atualizado: {new Date(data.atualizadoEm).toLocaleString('pt-BR')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {[7, 15, 30, 60, 90].map(d => (
            <button
              key={d}
              onClick={() => setDias(d)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                dias === d
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {d}d
            </button>
          ))}
          <button
            onClick={carregarDados}
            disabled={loading}
            className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            {loading ? '...' : '🔄'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg overflow-x-auto">
        {([
          { key: 'resumo', label: 'Resumo Executivo' },
          { key: 'assuntos', label: 'Análise por Assunto' },
          { key: 'clientes', label: 'Clientes em Risco' },
          { key: 'progresso', label: 'Chamados Parados' },
          { key: 'automacao', label: 'Automação & Bugs' },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setAbaAtiva(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${
              abaAtiva === tab.key
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Aba: Resumo Executivo ────────────────────────────────────── */}
      {abaAtiva === 'resumo' && (
        <div className="space-y-6">
          {/* Cards principais */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <CardResumo label="Total" valor={r.totalChamados} cor="text-gray-900 dark:text-white" />
            <CardResumo label="Abertos" valor={r.abertos} cor="text-blue-600" />
            <CardResumo label="Resolvidos" valor={r.resolvidos} cor="text-green-600" />
            <CardResumo label="Reabertos" valor={r.reabertos} cor="text-orange-600" />
            <CardResumo label="Parados" valor={r.parados} cor="text-red-600" />
            <CardResumo label="SLA Excedido" valor={r.slaEmRisco} cor="text-red-600" />
          </div>

          {/* N1/N2/N3 + Clientes em risco */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Distribuição N1/N2/N3</h3>
              <div className="space-y-2">
                {[
                  { label: 'N1', value: r.n1, total: r.totalChamados, cor: 'bg-green-500' },
                  { label: 'N2', value: r.n2, total: r.totalChamados, cor: 'bg-yellow-500' },
                  { label: 'N3', value: r.n3, total: r.totalChamados, cor: 'bg-red-500' },
                ].map(n => (
                  <div key={n.label} className="flex items-center gap-3">
                    <span className="text-sm font-medium w-8">{n.label}</span>
                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                      <div
                        className={`h-full ${n.cor} rounded-full transition-all`}
                        style={{ width: `${n.total > 0 ? (n.value / n.total) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-600 dark:text-gray-400 w-16 text-right">
                      {n.value} ({n.total > 0 ? Math.round((n.value / n.total) * 100) : 0}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Alertas</h3>
              {r.principaisAlertas.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-sm">Nenhum alerta crítico</p>
              ) : (
                <div className="space-y-2">
                  {r.principaisAlertas.map((a, i) => (
                    <div key={i} className={`p-2 rounded-lg text-sm ${
                      a.nivel === 'critico' ? 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300' :
                      a.nivel === 'alto' ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-300' :
                      'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300'
                    }`}>
                      <span className="font-medium">{a.titulo}</span>
                      <p className="text-xs mt-0.5 opacity-80">{a.descricao}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Principais assuntos */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Principais Assuntos</h3>
            <div className="space-y-2">
              {r.principaisAssuntos.map((a, i) => (
                <div key={i} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-gray-400 dark:text-gray-500 w-8">{i + 1}º</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{a.assunto}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{a.total}</span>
                    {a.variacao !== 0 && (
                      <span className={`text-xs ${a.variacao > 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {a.variacao > 0 ? '↑' : '↓'} {Math.abs(a.variacao)}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Decisões recomendadas */}
          {r.decisoesRecomendadas.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Decisões Recomendadas</h3>
              <div className="space-y-3">
                {r.decisoesRecomendadas.map((rec, i) => (
                  <RecomendacaoCard key={i} rec={rec} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Aba: Análise por Assunto ─────────────────────────────────── */}
      {abaAtiva === 'assuntos' && (
        <div className="space-y-4">
          {data.analiseAssuntos.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">Nenhum assunto encontrado</p>
          ) : (
            <>
              {/* Ranking */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Ranking de Assuntos</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {data.rankingAssuntos.map(r => (
                    <button
                      key={r.posicao}
                      onClick={() => setAssuntoSelecionado(data.analiseAssuntos.find(a => a.assuntoNome === r.assunto) || null)}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-left transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-gray-400">{r.posicao}º</span>
                        <div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{r.assunto}</span>
                          <span className="block text-xs text-gray-500">{r.total} chamados</span>
                        </div>
                      </div>
                      <span className={`text-sm font-bold px-2 py-0.5 rounded ${
                        r.score >= 80 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                        r.score >= 60 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' :
                        r.score >= 40 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                        'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                      }`}>
                        {r.score.toFixed(0)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Detalhe do assunto selecionado */}
              {assuntoSelecionado && (
                <DetalheAssunto assunto={assuntoSelecionado} onFechar={() => setAssuntoSelecionado(null)} />
              )}

              {/* Tabela completa */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left p-3 font-medium text-gray-500">Assunto</th>
                        <th className="text-right p-3 font-medium text-gray-500">Total</th>
                        <th className="text-right p-3 font-medium text-gray-500">%</th>
                        <th className="text-center p-3 font-medium text-gray-500">N1/N2/N3</th>
                        <th className="text-right p-3 font-medium text-gray-500">SLA</th>
                        <th className="text-right p-3 font-medium text-gray-500">CSAT</th>
                        <th className="text-center p-3 font-medium text-gray-500">Tendência</th>
                        <th className="text-right p-3 font-medium text-gray-500">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.analiseAssuntos.map(a => (
                        <tr
                          key={a.assuntoId || a.assuntoNome}
                          className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer"
                          onClick={() => setAssuntoSelecionado(a)}
                        >
                          <td className="p-3 font-medium text-gray-900 dark:text-white">{a.assuntoNome}</td>
                          <td className="p-3 text-right font-bold">{a.total}</td>
                          <td className="p-3 text-right text-gray-600 dark:text-gray-400">{a.percentual}%</td>
                          <td className="p-3 text-center">
                            <span className="text-green-600">{a.porNivel.N1}</span>
                            <span className="text-gray-400">/</span>
                            <span className="text-yellow-600">{a.porNivel.N2}</span>
                            <span className="text-gray-400">/</span>
                            <span className="text-red-600">{a.porNivel.N3}</span>
                          </td>
                          <td className="p-3 text-right">
                            <span className={a.sla.percentual >= 90 ? 'text-green-600' : a.sla.percentual >= 75 ? 'text-yellow-600' : 'text-red-600'}>
                              {a.sla.percentual}%
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            {a.csatMedio !== null ? (
                              <span className={a.csatMedio >= 4 ? 'text-green-600' : a.csatMedio >= 3 ? 'text-yellow-600' : 'text-red-600'}>
                                {a.csatMedio}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="p-3 text-center">
                            <span className={a.tendencia.direcao === 'crescendo' ? 'text-red-500' : a.tendencia.direcao === 'diminuindo' ? 'text-green-500' : 'text-gray-400'}>
                              {a.tendencia.direcao === 'crescendo' ? '↑' : a.tendencia.direcao === 'diminuindo' ? '↓' : '→'} {Math.abs(a.tendencia.variacaoPct)}%
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <span className={`font-bold ${
                              a.prioridadeOperacional >= 80 ? 'text-red-600' :
                              a.prioridadeOperacional >= 60 ? 'text-orange-600' :
                              a.prioridadeOperacional >= 40 ? 'text-yellow-600' :
                              'text-green-600'
                            }`}>
                              {a.prioridadeOperacional.toFixed(0)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Aba: Clientes em Risco ───────────────────────────────────── */}
      {abaAtiva === 'clientes' && (
        <div className="space-y-4">
          {data.clientesEmRisco.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">Nenhum cliente em risco identificado</p>
          ) : (
            <>
              {data.clientesEmRisco.map(c => (
                <div
                  key={c.clienteId}
                  className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white">{c.clienteNome}</h4>
                      <p className="text-sm text-gray-500">{c.totalChamadosPeriodo} chamados no período</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${classificacaoRisco(c.risco).bg} ${classificacaoRisco(c.risco).cor}`}>
                      {classificacaoRisco(c.risco).label} ({c.scoreRisco})
                    </span>
                  </div>

                  {/* Fatores */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                    <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <div className="text-lg font-bold text-gray-900 dark:text-white">{c.chamadosAbertos}</div>
                      <div className="text-xs text-gray-500">Abertos</div>
                    </div>
                    <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <div className="text-lg font-bold text-orange-600">{c.reaberturas}</div>
                      <div className="text-xs text-gray-500">Reaberturas</div>
                    </div>
                    <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <div className="text-lg font-bold text-yellow-600">{c.transferencias}</div>
                      <div className="text-xs text-gray-500">Transferências</div>
                    </div>
                    <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <div className="text-lg font-bold text-red-600">{c.slaExcedidos}</div>
                      <div className="text-xs text-gray-500">SLA Excedido</div>
                    </div>
                  </div>

                  {/* Fatores de risco */}
                  {c.fatores.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-gray-500 mb-1">Por que este risco?</p>
                      <div className="flex flex-wrap gap-1">
                        {c.fatores.map((f, i) => (
                          <span key={i} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-1 rounded">
                            {f.descricao}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recomendações */}
                  {c.recomendacoes.length > 0 && (
                    <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
                      <p className="text-xs font-medium text-gray-500 mb-1">Recomendações</p>
                      {c.recomendacoes.map((rec, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                            rec.prioridade === 'urgente' ? 'bg-red-500' :
                            rec.prioridade === 'alta' ? 'bg-orange-500' :
                            rec.prioridade === 'media' ? 'bg-yellow-500' : 'bg-blue-500'
                          }`} />
                          <div>
                            <span className="font-medium text-gray-900 dark:text-white">{rec.titulo}</span>
                            <span className="text-gray-500 dark:text-gray-400"> — {rec.descricao}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* ── Aba: Chamados Parados ────────────────────────────────────── */}
      {abaAtiva === 'progresso' && (
        <div className="space-y-4">
          {data.chamadosParados.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">Nenhum chamado parado ou crítico</p>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left p-3 font-medium text-gray-500">Protocolo</th>
                      <th className="text-left p-3 font-medium text-gray-500">Cliente</th>
                      <th className="text-left p-3 font-medium text-gray-500">Analista</th>
                      <th className="text-center p-3 font-medium text-gray-500">Progresso</th>
                      <th className="text-right p-3 font-medium text-gray-500">Sem Atividade</th>
                      <th className="text-right p-3 font-medium text-gray-500">SLA</th>
                      <th className="text-left p-3 font-medium text-gray-500">Fatores</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.chamadosParados.map(c => {
                      const p = classificacaoProgresso(c.progresso);
                      return (
                        <tr key={c.ticketId} className="border-b border-gray-100 dark:border-gray-700/50">
                          <td className="p-3 font-medium text-gray-900 dark:text-white">
                            {c.protocolo || c.ticketId.slice(0, 8)}
                          </td>
                          <td className="p-3 text-gray-600 dark:text-gray-400">{c.clienteNome || '—'}</td>
                          <td className="p-3 text-gray-600 dark:text-gray-400">{c.assigneeNome || 'Não atribuído'}</td>
                          <td className="p-3 text-center">
                            <span className={`text-sm ${p.cor}`}>{p.icone} {p.label}</span>
                          </td>
                          <td className="p-3 text-right font-medium">
                            <span className={c.tempoSemProgressoMin >= 480 ? 'text-red-600' : c.tempoSemProgressoMin >= 240 ? 'text-orange-600' : 'text-yellow-600'}>
                              {formatTempo(c.tempoSemProgressoMin)}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            {c.slaRestanteMin !== null ? (
                              <span className={c.slaRestanteMin <= 0 ? 'text-red-600 font-bold' : c.slaRestanteMin <= 120 ? 'text-orange-600' : 'text-gray-600'}>
                                {c.slaRestanteMin <= 0 ? 'Excedido' : `${formatTempo(c.slaRestanteMin)} restante`}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-1">
                              {c.fatores.map((f, i) => (
                                <span key={i} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded">
                                  {f}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Aba: Automação & Bugs ────────────────────────────────────── */}
      {abaAtiva === 'automacao' && (
        <div className="space-y-6">
          {/* Oportunidades de Automação */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Oportunidades de Automação</h3>
            {data.oportunidadesAutomacao.length === 0 ? (
              <p className="text-gray-500 text-sm">Nenhuma oportunidade detectada</p>
            ) : (
              <div className="space-y-2">
                {data.oportunidadesAutomacao.map((o, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{o.assunto}</span>
                      <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                        o.tipo === 'chatbot' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                        o.tipo === 'base_conhecimento' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                        'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                      }`}>
                        {o.tipo.replace(/_/g, ' ')}
                      </span>
                      <p className="text-xs text-gray-500 mt-0.5">{o.motivo}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-gray-900 dark:text-white">{o.volumePotencial} tickets</div>
                      <div className="text-xs text-green-600">-{formatTempo(o.tempoEconomizadoMin)} economizados</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Possíveis Bugs */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Possíveis Problemas Sistêmicos</h3>
            {data.possiveisBugs.length === 0 ? (
              <p className="text-gray-500 text-sm">Nenhum possível bug detectado</p>
            ) : (
              <div className="space-y-3">
                {data.possiveisBugs.map((b, i) => (
                  <div key={i} className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="font-semibold text-red-800 dark:text-red-300">{b.assunto}</span>
                        <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                          b.confianca === 'alta' ? 'bg-red-200 text-red-800 dark:bg-red-800/30 dark:text-red-300' :
                          'bg-yellow-200 text-yellow-800 dark:bg-yellow-800/30 dark:text-yellow-300'
                        }`}>
                          Confiança: {b.confianca}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                      <div className="text-center">
                        <div className="text-lg font-bold text-red-700 dark:text-red-300">{b.clientesAfetados}</div>
                        <div className="text-xs text-gray-500">Clientes</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-red-700 dark:text-red-300">{b.totalChamados}</div>
                        <div className="text-xs text-gray-500">Chamados</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-red-700 dark:text-red-300">+{b.crescimentoPct}%</div>
                        <div className="text-xs text-gray-500">Crescimento</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-red-700 dark:text-red-300">{b.reaberturas}</div>
                        <div className="text-xs text-gray-500">Reaberturas</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {b.evidencias.map((e, j) => (
                        <span key={j} className="text-xs bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-1 rounded border border-red-200 dark:border-red-800">
                          {e}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Escalonamento */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Escalonamento N1 → N2 → N3</h3>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{data.escalonamento.taxaN1ParaN2}%</div>
                <div className="text-xs text-gray-500">N1 → N2</div>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">{data.escalonamento.taxaN2ParaN3}%</div>
                <div className="text-xs text-gray-500">N2 → N3</div>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{data.escalonamento.total}</div>
                <div className="text-xs text-gray-500">Total escalonamentos</div>
              </div>
            </div>
            {data.escalonamento.porAssunto.length > 0 && (
              <div className="space-y-1">
                {data.escalonamento.porAssunto.slice(0, 5).map((a, i) => (
                  <div key={i} className="flex items-center justify-between text-sm p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                    <span className="text-gray-900 dark:text-white">{a.assunto}</span>
                    <span className="text-gray-500">{a.n1ParaN2 + a.n2ParaN3} escalonamentos ({a.taxaEscalonamento}%)</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-componentes ─────────────────────────────────────────────────────

function CardResumo({ label, valor, cor }: { label: string; valor: number; cor: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
      <div className={`text-2xl font-bold ${cor}`}>{valor}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</div>
    </div>
  );
}

function RecomendacaoCard({ rec }: { rec: RecomendacaoAssunto }) {
  return (
    <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 px-2 py-0.5 text-xs font-medium rounded ${prioridadeCor(rec.prioridade)}`}>
          {rec.prioridade.toUpperCase()}
        </span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 dark:text-white text-sm">{rec.titulo}</span>
            <span className="text-xs text-gray-400">({rec.confianca} confiança)</span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{rec.descricao}</p>
          {rec.evidencias.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {rec.evidencias.map((e, i) => (
                <span key={i} className="text-xs bg-white dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-600">
                  {e}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetalheAssunto({ assunto, onFechar }: { assunto: AnaliseAssunto; onFechar: () => void }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{assunto.assuntoNome}</h3>
          {assunto.categoriaNome && (
            <span className="text-sm text-gray-500">Categoria: {assunto.categoriaNome}</span>
          )}
        </div>
        <button onClick={onFechar} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">✕</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
        <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div className="text-xl font-bold text-gray-900 dark:text-white">{assunto.total}</div>
          <div className="text-xs text-gray-500">Chamados</div>
        </div>
        <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div className="text-xl font-bold text-gray-900 dark:text-white">{assunto.percentual}%</div>
          <div className="text-xs text-gray-500">Do total</div>
        </div>
        <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div className="text-xl font-bold text-green-600">{assunto.resolvidos}</div>
          <div className="text-xs text-gray-500">Resolvidos</div>
        </div>
        <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div className="text-xl font-bold text-blue-600">{assunto.abertos}</div>
          <div className="text-xs text-gray-500">Abertos</div>
        </div>
        <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div className="text-xl font-bold text-orange-600">{assunto.reabertos}</div>
          <div className="text-xs text-gray-500">Reabertos</div>
        </div>
        <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div className="text-xl font-bold text-red-600">{assunto.emAtraso}</div>
          <div className="text-xs text-gray-500">Em atraso</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Nível de Suporte</p>
          <div className="flex gap-2">
            <span className="text-sm bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-1 rounded">
              N1: {assunto.porNivel.N1}
            </span>
            <span className="text-sm bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 px-2 py-1 rounded">
              N2: {assunto.porNivel.N2}
            </span>
            <span className="text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-1 rounded">
              N3: {assunto.porNivel.N3}
            </span>
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">SLA</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full rounded-full ${assunto.sla.percentual >= 90 ? 'bg-green-500' : assunto.sla.percentual >= 75 ? 'bg-yellow-500' : 'bg-red-500'}`}
                style={{ width: `${assunto.sla.percentual}%` }}
              />
            </div>
            <span className="text-sm font-medium">{assunto.sla.percentual}%</span>
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Tempo Médio</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{formatTempo(assunto.tempoMedioMin)}</p>
          <p className="text-xs text-gray-400">Mediano: {formatTempo(assunto.tempoMedianoMin)}</p>
        </div>
      </div>

      {/* Tendência */}
      <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg mb-4">
        <p className="text-xs font-medium text-gray-500 mb-1">Tendência</p>
        <div className="flex items-center gap-2">
          <span className={`text-lg font-bold ${
            assunto.tendencia.direcao === 'crescendo' ? 'text-red-600' :
            assunto.tendencia.direcao === 'diminuindo' ? 'text-green-600' : 'text-gray-600'
          }`}>
            {assunto.tendencia.direcao === 'crescendo' ? '↑' : assunto.tendencia.direcao === 'diminuindo' ? '↓' : '→'}
          </span>
          <span className="text-sm">
            {assunto.tendencia.anterior} → {assunto.tendencia.atual} (
            <span className={assunto.tendencia.variacaoPct > 0 ? 'text-red-600' : 'text-green-600'}>
              {assunto.tendencia.variacaoPct > 0 ? '+' : ''}{assunto.tendencia.variacaoPct}%
            </span>
            )
          </span>
        </div>
      </div>

      {/* Recomendações */}
      {assunto.recomendacoes.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">Recomendações</p>
          <div className="space-y-2">
            {assunto.recomendacoes.map((rec, i) => (
              <RecomendacaoCard key={i} rec={rec} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
