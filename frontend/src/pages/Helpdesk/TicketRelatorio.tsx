import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileText, AlertTriangle, CheckCircle, Clock, Bot, User, MessageSquare, Download, X, ArrowLeft, Zap, ThumbsUp, ThumbsDown, AlertCircle, Mail, ChevronLeft } from 'lucide-react';
import api from '../../services/api';

interface SinalInsatisfacao {
  tipo: string;
  descricao: string;
  severidade: 'baixa' | 'media' | 'alta';
}

interface RelatorioCompleto {
  problema: string;
  acoes: string;
  resolucao: string;
  observacoes: string;
  notaCompleta: string;
  sinaisInsatisfacao: SinalInsatisfacao[];
  metrics?: {
    tempoTotal?: string;
    tempoIA?: string;
    tempoHumano?: string;
    msgsIA?: number;
    msgsOperador?: number;
    msgsCliente?: number;
    totalMensagens?: number;
  };
}

export default function TicketRelatorio() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const [relatorio, setRelatorio] = useState<RelatorioCompleto | null>(null);
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRelatorio = useCallback(async () => {
    if (!ticketId) return;
    setLoading(true);
    setError(null);
    try {
      const [relRes, ticketRes] = await Promise.all([
        api.post(`/ai/ticket/${ticketId}/relatorio-completo`),
        api.get(`/helpdesk/tickets/${ticketId}/history`).catch(() => null),
      ]);
      setRelatorio(relRes.data);
      if (ticketRes?.data) {
        setTicket(ticketRes.data.ticket || ticketRes.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao carregar relatório');
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    loadRelatorio();
  }, [loadRelatorio]);

  const getSeveridadeCor = (sev: string) => {
    switch (sev) {
      case 'alta': return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700';
      case 'media': return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700';
      case 'baixa': return 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700';
      default: return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700';
    }
  };

  const getSeveridadeIcone = (sev: string) => {
    switch (sev) {
      case 'alta': return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'media': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'baixa': return <ThumbsDown className="w-4 h-4 text-yellow-500" />;
      default: return <AlertTriangle className="w-4 h-4 text-slate-400" />;
    }
  };

  const getTipoSinalLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      reclamacao_demora: 'Reclamação de Demora',
      tom_alterado: 'Tom Alterado',
      problema_nao_resolvido: 'Problema Não Resolvido',
      escalada: 'Ameaça de Escalada',
      frustracao: 'Frustração',
    };
    return labels[tipo] || tipo.replace(/_/g, ' ');
  };

  const isResolvido = ticket?.status === 'resolvido' || ticket?.status === 'fechado';
  const temIA = ticket?.resolvidoPorIa;

  const ticketProtocolo = ticket?.protocolo
    ? `#${ticket.protocolo}`
    : `#${ticketId?.slice(0, 8)}`;

  const metadataDate = ticket?.createdAt
    ? new Date(ticket.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '09/07/2026';

  const metadataTime = ticket?.createdAt
    ? `${new Date(ticket.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
    : '14:32';

  const clienteNome = ticket?.cliente?.nome || ticket?.clientName || 'Cliente';
  const categoria = ticket?.categoria || ticket?.category || 'Suporte Técnico';

  const parseAcoes = (acoes: string): { prefix: string; text: string }[] => {
    if (!acoes) return [];
    return acoes.split(';').filter(Boolean).map((acao) => {
      const trimmed = acao.trim();
      const isIA = trimmed.toLowerCase().startsWith('ia') || trimmed.toLowerCase().includes('🤖');
      return {
        prefix: isIA ? '🤖' : '👤',
        text: trimmed.replace(/^(IA\s*[-:]?\s*|🤖\s*)/, ''),
      };
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <span className="text-sm text-slate-500 dark:text-slate-400">Gerando relatório...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto mt-8">
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-2xl p-6 text-center">
          <AlertTriangle className="w-10 h-10 text-red-400 dark:text-red-500 mx-auto mb-3" />
          <h3 className="font-semibold text-red-700 dark:text-red-400 mb-1">Erro ao carregar relatório</h3>
          <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>
          <div className="flex gap-3 justify-center">
            <button onClick={loadRelatorio} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 dark:hover:bg-red-500">
              Tentar novamente
            </button>
            <button onClick={() => navigate(-1)} className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-slate-300">
              Voltar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!relatorio) {
    return (
      <div className="max-w-2xl mx-auto mt-8 text-center py-12 text-slate-400 dark:text-slate-500">
        <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="text-base">Nenhum relatório disponível para este ticket.</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
          Voltar
        </button>
      </div>
    );
  }

  const acoes = parseAcoes(relatorio.acoes);
  const metrics = relatorio.metrics;

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* Header - relatorio-header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-xl p-7">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              📄 Ticket {ticketProtocolo}
            </h2>
            <p className="text-slate-300 text-sm mt-1">
              Relatório gerado automaticamente pelo sistema
            </p>
          </div>
          <div>
            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold bg-emerald-500/20 text-emerald-300 rounded-full border border-emerald-500/30">
              ✅ Finalizado
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-5 mt-4 text-sm text-slate-300/80">
          <span className="flex items-center gap-1.5">
            📅 {metadataDate} {metadataTime}
          </span>
          <span className="flex items-center gap-1.5">
            👤 Cliente: {clienteNome}
          </span>
          <span className="flex items-center gap-1.5">
            🔧 Categoria: {categoria}
          </span>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left column */}
        <div className="space-y-5">
          {/* Problema Relatado */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
              📌 Problema Relatado
            </h4>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
              "{relatorio.problema}"
            </p>
            <div className="mt-3">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full border border-blue-200 dark:border-blue-700">
                🤖 Resumo gerado por IA
              </span>
            </div>
          </div>

          {/* Ações Tomadas */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
              🔧 Ações Tomadas
            </h4>
            {acoes.length > 0 ? (
              <ul className="space-y-2">
                {acoes.map((acao, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    <span className="mt-0.5 shrink-0">{acao.prefix}</span>
                    <span>{acao.text}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400 dark:text-slate-500 italic">Nenhuma ação registrada</p>
            )}
          </div>

          {/* Sinais de Insatisfação */}
          {relatorio.sinaisInsatisfacao.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                ⚠️ Sinais de Insatisfação Detectados
                <span className="px-2 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-full">
                  {relatorio.sinaisInsatisfacao.length}
                </span>
              </h4>
              <div className="flex flex-wrap gap-2">
                {relatorio.sinaisInsatisfacao.map((sinal, i) => (
                  <span
                    key={i}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border ${getSeveridadeCor(sinal.severidade)}`}
                  >
                    {getSeveridadeIcone(sinal.severidade)}
                    {getTipoSinalLabel(sinal.tipo)}
                    {sinal.descricao && (
                      <span className="opacity-70">— {sinal.descricao}</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Resolução */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
              ✅ Resolução
            </h4>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
              {relatorio.resolucao || 'Não informada'}
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full border border-emerald-200 dark:border-emerald-700">
                🎯 Resolvido
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full border border-blue-200 dark:border-blue-700">
                🤖 IA + Humano
              </span>
            </div>
          </div>

          {/* Métricas do Atendimento */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
              📊 Métricas do Atendimento
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="text-lg font-bold text-slate-800 dark:text-slate-100">{metrics?.tempoTotal || '—'}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">⏱ Tempo Total</div>
              </div>
              <div className="text-center p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="text-lg font-bold text-slate-800 dark:text-slate-100">{metrics?.tempoIA || '—'}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">🤖 Tempo IA</div>
              </div>
              <div className="text-center p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="text-lg font-bold text-slate-800 dark:text-slate-100">{metrics?.tempoHumano || '—'}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">👤 Tempo Humano</div>
              </div>
              <div className="text-center p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="text-lg font-bold text-slate-800 dark:text-slate-100">{metrics?.msgsIA ?? ticket?.iaMensagensEnviadas ?? '—'}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">🤖 Msgs IA</div>
              </div>
              <div className="text-center p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="text-lg font-bold text-slate-800 dark:text-slate-100">{metrics?.msgsOperador ?? '—'}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">👤 Msgs Operador</div>
              </div>
              <div className="text-center p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="text-lg font-bold text-slate-800 dark:text-slate-100">{metrics?.msgsCliente ?? '—'}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">💬 Msgs Cliente</div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3">
            <button className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 dark:hover:bg-blue-500 transition-colors">
              <Download className="w-4 h-4" />
              📥 Exportar (PDF)
            </button>
            <button className="inline-flex items-center gap-2 px-4 py-2.5 bg-transparent text-slate-600 dark:text-slate-400 rounded-lg text-sm font-semibold border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
              <Mail className="w-4 h-4" />
              📧 Enviar por Email
            </button>
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-transparent text-slate-600 dark:text-slate-400 rounded-lg text-sm font-semibold border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              ✖ Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
