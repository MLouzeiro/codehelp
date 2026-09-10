import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../services/auth';
import { useThemeSettings } from '../../services/ThemeContext';
import api from '../../services/api';
import {
  DecisionAudit,
  ResumoDecisoes,
  EvidenciaDecisao,
} from '../../types';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Eye,
  FileText,
  Filter,
  RefreshCw,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  XCircle,
  ChevronDown,
  ChevronRight,
  BarChart3,
  Zap,
  Brain,
  Shield,
  Activity,
} from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────────────

const SEVERIDADE_COLORS: Record<string, string> = {
  critica: 'bg-red-100 text-red-800 border-red-200',
  alta: 'bg-orange-100 text-orange-800 border-orange-200',
  media: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  baixa: 'bg-green-100 text-green-800 border-green-200',
  info: 'bg-blue-100 text-blue-800 border-blue-200',
};

const SEVERIDADE_ICONS: Record<string, any> = {
  critica: XCircle,
  alta: AlertTriangle,
  media: Clock,
  baixa: CheckCircle,
  info: FileText,
};

const CONFIANCA_COLORS: Record<string, string> = {
  alta: 'bg-green-100 text-green-800',
  media: 'bg-yellow-100 text-yellow-800',
  baixa: 'bg-red-100 text-red-800',
};

const STATUS_COLORS: Record<string, string> = {
  pendente: 'bg-gray-100 text-gray-800',
  em_acao: 'bg-blue-100 text-blue-800',
  concluido: 'bg-green-100 text-green-800',
  revertido: 'bg-orange-100 text-orange-800',
  ignorado: 'bg-gray-100 text-gray-500',
};

const TIPO_LABELS: Record<string, string> = {
  reabertura: 'Reabertura',
  sla: 'SLA',
  csat: 'CSAT',
  retrabalho: 'Retrabalho',
  ociosidade: 'Ociosidade',
  produtividade: 'Produtividade',
  fila: 'Fila',
  transferencia: 'Transferência',
  qualidade: 'Qualidade',
  resolucao: 'Resolução',
  primeira_resposta: 'Primeira Resposta',
  recorrencia: 'Recorrência',
  performance_analista: 'Performance',
};

function formatarData(data: string | null): string {
  if (!data) return '—';
  return new Date(data).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Sub-components ─────────────────────────────────────────────────────

function EvidenciaCard({ evidencia }: { evidencia: EvidenciaDecisao }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-white/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
        <BarChart3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{evidencia.dado}</p>
        <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{String(evidencia.valor)}</p>
        {evidencia.comparacao && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{evidencia.comparacao}</p>
        )}
        {evidencia.fonte && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Fonte: {evidencia.fonte}</p>
        )}
      </div>
    </div>
  );
}

function DecisaoExpandida({ decisao }: { decisao: DecisionAudit }) {
  return (
    <div className="mt-4 space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
      {/* Evidências */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          📊 Evidências
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {decisao.evidencias.map((ev, i) => (
            <EvidenciaCard key={i} evidencia={ev} />
          ))}
        </div>
      </div>

      {/* Como chegamos */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
          <Target className="w-4 h-4" />
          🧮 Como chegamos a essa conclusão
        </h4>
        <pre className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg whitespace-pre-wrap font-mono">
          {decisao.comoChegamos}
        </pre>
      </div>

      {/* O que os dados mostram */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
          <Eye className="w-4 h-4" />
          🔎 O que os dados mostram
        </h4>
        <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
          {decisao.oQueDadosMostram}
        </p>
      </div>

      {/* Hipótese */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
          <Brain className="w-4 h-4" />
          🧠 Hipótese
        </h4>
        <p className="text-sm text-gray-600 dark:text-gray-400 bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800">
          {decisao.hipotese}
        </p>
      </div>

      {/* Impacto */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
          <Zap className="w-4 h-4" />
          🎯 Impacto
        </h4>
        <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
          {decisao.impacto}
        </p>
      </div>

      {/* Confiança */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
          <Shield className="w-4 h-4" />
          🟢 Confiança
        </h4>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${CONFIANCA_COLORS[decisao.confianca] || 'bg-gray-100'}`}>
            {decisao.confianca === 'alta' ? '🟢 Alta' : decisao.confianca === 'media' ? '🟡 Média' : '🔴 Baixa'}
          </span>
          {decisao.confiancaMotivo && (
            <span className="text-xs text-gray-500 dark:text-gray-400">{decisao.confiancaMotivo}</span>
          )}
        </div>
      </div>

      {/* Recomendação */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
          <Activity className="w-4 h-4" />
          🛠️ Recomendação
        </h4>
        <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
          <p className="text-sm text-gray-700 dark:text-gray-300">{decisao.recomendacao}</p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
            {decisao.responsavelAcao && (
              <span>👤 {decisao.responsavelAcao}</span>
            )}
            {decisao.prazoAcao && (
              <span>⏱️ {decisao.prazoAcao}</span>
            )}
            {decisao.comoVerificar && (
              <span>📈 {decisao.comoVerificar}</span>
            )}
          </div>
        </div>
      </div>

      {/* Resultado */}
      {decisao.resultado && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">🔄 Resultado</h4>
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-gray-700 dark:text-gray-300">{decisao.resultado}</p>
            {decisao.resultadoData && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Verificado em: {formatarData(decisao.resultadoData)}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Ranking de Analistas */}
      {decisao.rankingAnalistas.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Ranking de Analistas
          </h4>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-3 text-gray-500 dark:text-gray-400">Analista</th>
                  <th className="text-right py-2 px-3 text-gray-500 dark:text-gray-400">Valor</th>
                  <th className="text-left py-2 px-3 text-gray-500 dark:text-gray-400">Classificação</th>
                </tr>
              </thead>
              <tbody>
                {decisao.rankingAnalistas.map((a, i) => (
                  <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 px-3 text-gray-900 dark:text-gray-100">{a.nome}</td>
                    <td className="py-2 px-3 text-right font-medium text-gray-900 dark:text-gray-100">{a.valor}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        a.classificacao === 'alerta' ? 'bg-red-100 text-red-700' :
                        a.classificacao === 'ocioso' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {a.classificacao}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tickets Envolvidos */}
      {decisao.ticketsEnvolvidos.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            🎫 Tickets Envolvidos ({decisao.ticketsEnvolvidos.length})
          </h4>
          <div className="flex flex-wrap gap-1">
            {decisao.ticketsEnvolvidos.slice(0, 20).map((id, i) => (
              <span key={i} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs text-gray-600 dark:text-gray-400 font-mono">
                {id.slice(0, 8)}...
              </span>
            ))}
            {decisao.ticketsEnvolvidos.length > 20 && (
              <span className="px-2 py-0.5 text-xs text-gray-500">
                +{decisao.ticketsEnvolvidos.length - 20} mais
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DecisaoCard({ decisao, onAtualizarStatus }: {
  decisao: DecisionAudit;
  onAtualizarStatus: (id: string, status: string) => void;
}) {
  const [expandido, setExpandido] = useState(false);
  const SeveridadeIcon = SEVERIDADE_ICONS[decisao.severidade] || Clock;

  return (
    <div className={`border rounded-xl p-4 transition-all ${
      decisao.severidade === 'critica' ? 'border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-900/10' :
      decisao.severidade === 'alta' ? 'border-orange-300 dark:border-orange-700 bg-orange-50/50 dark:bg-orange-900/10' :
      'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${SEVERIDADE_COLORS[decisao.severidade]}`}>
            <SeveridadeIcon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                {TIPO_LABELS[decisao.tipo] || decisao.tipo}
              </span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${SEVERIDADE_COLORS[decisao.severidade]}`}>
                {decisao.severidade}
              </span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[decisao.status]}`}>
                {decisao.status}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-1">
              {decisao.titulo}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
              {decisao.problema}
            </p>
          </div>
        </div>

        <button
          onClick={() => setExpandido(!expandido)}
          className="flex-shrink-0 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          {expandido ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
        </button>
      </div>

      {/* Meta info */}
      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
        <span className={`px-2 py-0.5 rounded ${CONFIANCA_COLORS[decisao.confianca]}`}>
          {decisao.confianca === 'alta' ? '🟢 Alta confiança' : decisao.confianca === 'media' ? '🟡 Média confiança' : '🔴 Baixa confiança'}
        </span>
        {decisao.responsavelAcao && (
          <span>👤 {decisao.responsavelAcao}</span>
        )}
        {decisao.prazoAcao && (
          <span>⏱️ {decisao.prazoAcao}</span>
        )}
        <span>{formatarData(decisao.criadoEm)}</span>
      </div>

      {/* Recomendação preview */}
      <div className="mt-3 p-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
        <p className="text-xs text-green-700 dark:text-green-300 line-clamp-2">
          🛠️ {decisao.recomendacao}
        </p>
      </div>

      {/* Ações de status */}
      {decisao.status === 'pendente' && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => onAtualizarStatus(decisao.id, 'em_acao')}
            className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Iniciar Ação
          </button>
          <button
            onClick={() => onAtualizarStatus(decisao.id, 'ignorado')}
            className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Ignorar
          </button>
        </div>
      )}

      {decisao.status === 'em_acao' && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => onAtualizarStatus(decisao.id, 'concluido')}
            className="px-3 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Concluir
          </button>
          <button
            onClick={() => onAtualizarStatus(decisao.id, 'revertido')}
            className="px-3 py-1 text-xs bg-orange-200 dark:bg-orange-900 text-orange-700 dark:text-orange-300 rounded-lg hover:bg-orange-300 dark:hover:bg-orange-800 transition-colors"
          >
            Reverter
          </button>
        </div>
      )}

      {/* Conteúdo expandido */}
      {expandido && <DecisaoExpandida decisao={decisao} />}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────

export default function DecisaoAuditPage() {
  const { theme } = useThemeSettings();
  const isDark = theme === 'dark';
  const [decisoes, setDecisoes] = useState<DecisionAudit[]>([]);
  const [resumo, setResumo] = useState<ResumoDecisoes | null>(null);
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [dias, setDias] = useState(30);
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroSeveridade, setFiltroSeveridade] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');

  const carregarDados = useCallback(async () => {
    try {
      setLoading(true);
      const [decisoesRes, resumoRes] = await Promise.all([
        api.get('/helpdesk/decisao', { params: { limit: 100, tipo: filtroTipo || undefined, severidade: filtroSeveridade || undefined, status: filtroStatus || undefined } }),
        api.get('/helpdesk/decisao/resumo', { params: { dias } }),
      ]);
      setDecisoes(decisoesRes.data.decisoes || []);
      setResumo(resumoRes.data);
    } catch (err) {
      console.error('Erro ao carregar decisões:', err);
    } finally {
      setLoading(false);
    }
  }, [dias, filtroTipo, filtroSeveridade, filtroStatus]);

  useEffect(() => { carregarDados(); }, [carregarDados]);

  const handleGerar = async () => {
    try {
      setGerando(true);
      const dataFim = new Date();
      const dataInicio = new Date();
      dataInicio.setDate(dataInicio.getDate() - dias);
      await api.post('/helpdesk/decisao/gerar', {
        dataInicio: dataInicio.toISOString(),
        dataFim: dataFim.toISOString(),
      });
      await carregarDados();
    } catch (err) {
      console.error('Erro ao gerar decisões:', err);
    } finally {
      setGerando(false);
    }
  };

  const handleAtualizarStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/helpdesk/decisao/${id}/status`, { status });
      await carregarDados();
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
    }
  };

  const decisoesFiltradas = decisoes;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
          <Brain className="w-7 h-7 text-purple-600" />
          Auditoria de Tomada de Decisão
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Cada conclusão possui evidências, cálculos, hipóteses e recomendações rastreáveis.
        </p>
      </div>

      {/* Resumo Cards */}
      {resumo && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{resumo.total}</p>
          </div>
          {resumo.porSeveridade.map((s) => (
            <div key={s.severidade} className={`rounded-xl p-4 border ${SEVERIDADE_COLORS[s.severidade]}`}>
              <p className="text-xs opacity-75 capitalize">{s.severidade}</p>
              <p className="text-2xl font-bold">{s.count}</p>
            </div>
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select
          value={dias}
          onChange={(e) => setDias(parseInt(e.target.value))}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        >
          <option value={7}>Últimos 7 dias</option>
          <option value={15}>Últimos 15 dias</option>
          <option value={30}>Últimos 30 dias</option>
          <option value={90}>Últimos 90 dias</option>
        </select>

        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        >
          <option value="">Todos os tipos</option>
          {Object.entries(TIPO_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>

        <select
          value={filtroSeveridade}
          onChange={(e) => setFiltroSeveridade(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        >
          <option value="">Todas severidades</option>
          <option value="critica">Crítica</option>
          <option value="alta">Alta</option>
          <option value="media">Média</option>
          <option value="baixa">Baixa</option>
        </select>

        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        >
          <option value="">Todos status</option>
          <option value="pendente">Pendente</option>
          <option value="em_acao">Em Ação</option>
          <option value="concluido">Concluído</option>
          <option value="revertido">Revertido</option>
          <option value="ignorado">Ignorado</option>
        </select>

        <button
          onClick={handleGerar}
          disabled={gerando}
          className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center gap-2"
        >
          {gerando ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Brain className="w-4 h-4" />
          )}
          Gerar Decisões
        </button>

        <button
          onClick={carregarDados}
          className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </button>
      </div>

      {/* Lista de Decisões */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-purple-600" />
          <span className="ml-2 text-gray-500 dark:text-gray-400">Carregando...</span>
        </div>
      ) : decisoesFiltradas.length === 0 ? (
        <div className="text-center py-12">
          <Brain className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">Nenhuma decisão encontrada.</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            Clique em "Gerar Decisões" para analisar o período selecionado.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {decisoesFiltradas.map((decisao) => (
            <DecisaoCard
              key={decisao.id}
              decisao={decisao}
              onAtualizarStatus={handleAtualizarStatus}
            />
          ))}
        </div>
      )}
    </div>
  );
}
