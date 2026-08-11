import { useState, useEffect, useCallback } from 'react';
import { Bot, CheckCircle, XCircle, Clock, Settings, BarChart3, Send, Brain, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../../services/api';

interface AutoAtendimentoConfig {
  autoAtendimentoAtivo: boolean;
  thresholdValidacoes: number;
  maxInteracoesIa: number;
}

interface PropostaResposta {
  id: string;
  ticketId: string;
  mensagemCliente: string;
  respostaProposta: string;
  assunto?: string;
  prioridade?: string;
  confianca?: number;
  status: string;
  validacoesCount: number;
  validacaoIds: string[];
  respostaFinal?: string;
  enviadaEm?: string;
  ticket?: {
    id: string;
    protocolo?: string;
    assunto?: string;
    prioridade?: string;
    contactName?: string;
    etapa?: string;
  };
}

interface MetricasValidacao {
  totalPropostas: number;
  pendentes: number;
  validadas: number;
  rejeitadas: number;
  autoEnviadas: number;
  taxaDeUso: number;
}

export default function AIAutoAtendimentoPage() {
  const [config, setConfig] = useState<AutoAtendimentoConfig>({
    autoAtendimentoAtivo: false,
    thresholdValidacoes: 3,
    maxInteracoesIa: 5,
  });
  const [propostas, setPropostas] = useState<PropostaResposta[]>([]);
  const [metricas, setMetricas] = useState<MetricasValidacao | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [respostaEditada, setRespostaEditada] = useState('');

  const carregarDados = useCallback(async () => {
    try {
      setLoading(true);
      const [configRes, propostasRes, metricasRes] = await Promise.all([
        api.get('/ai/validacoes/config'),
        api.get('/ai/validacoes/pendentes'),
        api.get('/ai/validacoes/metricas'),
      ]);
      setConfig(configRes.data);
      setPropostas(propostasRes.data);
      setMetricas(metricasRes.data);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      setError('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregarDados(); }, [carregarDados]);

  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => { setSuccess(''); setError(''); }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  const salvarConfig = async () => {
    try {
      setSaving(true);
      await api.patch('/ai/validacoes/config', config);
      setSuccess('Configurações salvas com sucesso!');
    } catch (err) {
      setError('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const validarResposta = async (id: string) => {
    try {
      const data: any = {};
      if (editandoId === id && respostaEditada.trim()) {
        data.respostaFinal = respostaEditada.trim();
      }
      await api.patch(`/ai/validacoes/${id}/validar`, data);
      setEditandoId(null);
      setRespostaEditada('');
      setSuccess('Resposta validada com sucesso!');
      carregarDados();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao validar resposta');
    }
  };

  const rejeitarResposta = async (id: string) => {
    try {
      await api.patch(`/ai/validacoes/${id}/rejeitar`);
      setSuccess('Resposta rejeitada');
      carregarDados();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao rejeitar resposta');
    }
  };

  const getConfiancaCor = (confianca?: number) => {
    if (!confianca) return 'text-gray-400';
    if (confianca >= 80) return 'text-green-500';
    if (confianca >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      pendente: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300', label: 'Pendente' },
      validada: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', label: 'Validada' },
      rejeitada: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', label: 'Rejeitada' },
      auto_enviada: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', label: 'Auto-enviada' },
    };
    const badge = badges[status] || badges.pendente;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-codemed-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
          <Bot size={28} className="text-codemed-600" />
          Auto-Atendimento IA
        </h1>
        <p className="text-gray-500 dark:text-slate-400">Configure o atendimento automatizado por inteligência artificial</p>
      </div>

      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Configurações */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2 mb-4">
          <Settings size={20} />
          Configurações
        </h2>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900 dark:text-slate-100">Auto-atendimento ativo</p>
              <p className="text-sm text-gray-500 dark:text-slate-400">Quando ativo, a IA tenta resolver problemas automaticamente</p>
            </div>
            <button
              onClick={() => setConfig({ ...config, autoAtendimentoAtivo: !config.autoAtendimentoAtivo })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                config.autoAtendimentoAtivo ? 'bg-codemed-600' : 'bg-gray-300 dark:bg-slate-600'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                config.autoAtendimentoAtivo ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Threshold de validações
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={config.thresholdValidacoes}
                onChange={(e) => setConfig({ ...config, thresholdValidacoes: parseInt(e.target.value) || 3 })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
              />
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                Número de validações necessárias para envio automático
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Máximo de interações IA
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={config.maxInteracoesIa}
                onChange={(e) => setConfig({ ...config, maxInteracoesIa: parseInt(e.target.value) || 5 })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
              />
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                Após N respostas da IA sem resolução, escala para humano
              </p>
            </div>
          </div>

          <button
            onClick={salvarConfig}
            disabled={saving}
            className="bg-codemed-600 hover:bg-codemed-700 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </button>
        </div>
      </div>

      {/* Métricas */}
      {metricas && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2 mb-4">
            <BarChart3 size={20} />
            Métricas
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{metricas.totalPropostas}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">Total Propostas</p>
            </div>
            <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{metricas.pendentes}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">Pendentes</p>
            </div>
            <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{metricas.validadas}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">Validadas</p>
            </div>
            <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{metricas.autoEnviadas}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">Auto-enviadas</p>
            </div>
            <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{metricas.taxaDeUso}%</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">Taxa de Uso</p>
            </div>
          </div>
        </div>
      )}

      {/* Respostas Pendentes */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2 mb-4">
          <Clock size={20} />
          Respostas Pendentes de Validação
          {propostas.length > 0 && (
            <span className="ml-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 text-xs font-medium px-2 py-1 rounded-full">
              {propostas.length}
            </span>
          )}
        </h2>

        {propostas.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-slate-400">
            <Brain size={48} className="mx-auto mb-4 opacity-50" />
            <p>Nenhuma resposta pendente de validação</p>
            <p className="text-sm">Respostas da IA aparecerão aqui para sua validação</p>
          </div>
        ) : (
          <div className="space-y-3">
            {propostas.map((proposta) => (
              <div key={proposta.id} className="border border-gray-200 dark:border-slate-600 rounded-lg overflow-hidden">
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50"
                  onClick={() => setExpandedId(expandedId === proposta.id ? null : proposta.id)}
                >
                  <div className="flex items-center gap-3">
                    {getStatusBadge(proposta.status)}
                    <div>
                      <p className="font-medium text-gray-900 dark:text-slate-100">
                        {proposta.ticket?.protocolo || `Ticket ${proposta.ticketId.slice(0, 8)}`}
                        {proposta.ticket?.assunto && ` — ${proposta.ticket.assunto}`}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-slate-400 truncate max-w-md">
                        {proposta.mensagemCliente.slice(0, 100)}...
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {proposta.confianca !== undefined && (
                      <span className={`text-sm font-medium ${getConfiancaCor(proposta.confianca)}`}>
                        {proposta.confianca}%
                      </span>
                    )}
                    <span className="text-xs text-gray-400">
                      {proposta.validacoesCount}/{config.thresholdValidacoes}
                    </span>
                    {expandedId === proposta.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>

                {expandedId === proposta.id && (
                  <div className="border-t border-gray-200 dark:border-slate-600 p-4 space-y-4">
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Mensagem do cliente:</p>
                      <p className="text-sm text-gray-600 dark:text-slate-400 bg-gray-50 dark:bg-slate-700/50 p-3 rounded-lg">
                        {proposta.mensagemCliente}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Resposta proposta pela IA:</p>
                      {editandoId === proposta.id ? (
                        <textarea
                          value={respostaEditada}
                          onChange={(e) => setRespostaEditada(e.target.value)}
                          rows={6}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 font-mono text-sm"
                        />
                      ) : (
                        <p className="text-sm text-gray-600 dark:text-slate-400 bg-gray-50 dark:bg-slate-700/50 p-3 rounded-lg whitespace-pre-wrap">
                          {proposta.respostaFinal || proposta.respostaProposta}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      {proposta.status === 'pendente' && (
                        <>
                          {editandoId === proposta.id ? (
                            <>
                              <button
                                onClick={() => validarResposta(proposta.id)}
                                className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium"
                              >
                                <Send size={14} />
                                Enviar Resposta Editada
                              </button>
                              <button
                                onClick={() => { setEditandoId(null); setRespostaEditada(''); }}
                                className="text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 px-3 py-1.5 text-sm"
                              >
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => validarResposta(proposta.id)}
                                className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium"
                              >
                                <CheckCircle size={14} />
                                Aprovar
                              </button>
                              <button
                                onClick={() => { setEditandoId(proposta.id); setRespostaEditada(proposta.respostaFinal || proposta.respostaProposta); }}
                                className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium"
                              >
                                Editar e Aprovar
                              </button>
                              <button
                                onClick={() => rejeitarResposta(proposta.id)}
                                className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium"
                              >
                                <XCircle size={14} />
                                Rejeitar
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
