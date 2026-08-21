import { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../services/auth';
import {
  Check, X, Clock, AlertCircle, FileText, User, Search,
  ChevronDown, Eye, MessageSquare, Filter,
} from 'lucide-react';

interface Aprovacao {
  id: string;
  ticketId: string;
  tipo: string;
  motivo: string;
  observacao?: string;
  status: string;
  valorAprovado?: number;
  dataSolicitacao: string;
  dataDecisao?: string;
  solicitadoPor: { id: string; name: string; email: string };
  aprovadoPor?: { id: string; name: string; email: string };
  ticket: { id: string; protocolo?: string; assunto?: string; status: string };
}

export default function Aprovacoes() {
  const { user } = useAuth();
  const [aprovacoes, setAprovacoes] = useState<Aprovacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [selected, setSelected] = useState<Aprovacao | null>(null);
  const [showDecidir, setShowDecidir] = useState(false);
  const [decisaoObservacao, setDecisaoObservacao] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pendentes, setPendentes] = useState(0);

  const canDecide = user?.role === 'admin' || user?.role === 'gerente';

  useEffect(() => {
    carregarAprovacoes();
    carregarPendentes();
  }, [filtroStatus, filtroTipo, page]);

  const carregarAprovacoes = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 15 };
      if (filtroStatus) params.status = filtroStatus;
      if (filtroTipo) params.tipo = filtroTipo;
      const { data } = await api.get('/aprovacoes', { params });
      setAprovacoes(data.items);
      setTotal(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const carregarPendentes = async () => {
    try {
      const { data } = await api.get('/aprovacoes/pendentes');
      setPendentes(data.pendentes);
    } catch {}
  };

  const decidir = async (aprovacaoId: string, decidido: boolean) => {
    setError('');
    setSuccess('');
    try {
      await api.post(`/aprovacoes/${aprovacaoId}/decidir`, {
        decidido,
        observacao: decisaoObservacao || undefined,
      });
      setSuccess(decidido ? 'Aprovação confirmada' : 'Aprovação rejeitada');
      setShowDecidir(false);
      setSelected(null);
      setDecisaoObservacao('');
      carregarAprovacoes();
      carregarPendentes();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao processar decisão');
    }
  };

  const enviarWhatsApp = async (aprovacaoId: string) => {
    setError('');
    setSuccess('');
    try {
      const { data } = await api.post(`/aprovacoes/${aprovacaoId}/enviar-whatsapp`);
      if (data?.link) {
        const copy = `${window.location.origin}${data.link.replace(/\/$/, '')}`;
        await navigator.clipboard?.writeText(data.link).catch(() => {});
        setSuccess(`WhatsApp enviado. Link de validação: ${copy}`);
      } else {
        setSuccess('Solicitação enviada via WhatsApp.');
      }
      carregarAprovacoes();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao enviar via WhatsApp');
    }
  };

  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    pendente: { label: 'Pendente', color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
    aprovada: { label: 'Aprovada', color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
    rejeitada: { label: 'Rejeitada', color: 'text-red-700 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' },
  };

  const tipoConfig: Record<string, string> = {
    geral: 'Geral',
    desconto: 'Desconto',
    prazo: 'Prazo',
    servico: 'Serviço',
    cancelamento: 'Cancelamento',
  };

  const itensFiltrados = aprovacoes;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>
            Aprovações
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1" style={{ fontFamily: 'Lexend, sans-serif' }}>
            Fluxo de autorização formal para ações que exigem aprovação
          </p>
        </div>
        {pendentes > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
            <Clock size={16} className="text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-medium text-amber-700 dark:text-amber-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
              {pendentes} pendente{pendentes > 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400">
          <AlertCircle size={18} />
          <span className="text-sm" style={{ fontFamily: 'Lexend, sans-serif' }}>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-green-700 dark:text-green-400">
          <Check size={18} />
          <span className="text-sm" style={{ fontFamily: 'Lexend, sans-serif' }}>{success}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-slate-400" />
          <select
            value={filtroStatus}
            onChange={(e) => { setFiltroStatus(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{ fontFamily: 'Lexend, sans-serif' }}
          >
            <option value="">Todos os status</option>
            <option value="pendente">Pendente</option>
            <option value="aprovada">Aprovada</option>
            <option value="rejeitada">Rejeitada</option>
          </select>
        </div>
        <select
          value={filtroTipo}
          onChange={(e) => { setFiltroTipo(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{ fontFamily: 'Lexend, sans-serif' }}
        >
          <option value="">Todos os tipos</option>
          <option value="geral">Geral</option>
          <option value="desconto">Desconto</option>
          <option value="prazo">Prazo</option>
          <option value="servico">Serviço</option>
          <option value="cancelamento">Cancelamento</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            <span className="text-sm text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>Carregando...</span>
          </div>
        </div>
      ) : itensFiltrados.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-12 text-center">
          <Check size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
          <h3 className="text-lg font-medium text-slate-500 dark:text-slate-400 mb-2" style={{ fontFamily: 'Lexend, sans-serif' }}>
            Nenhuma aprovação encontrada
          </h3>
          <p className="text-sm text-slate-400 dark:text-slate-500" style={{ fontFamily: 'Lexend, sans-serif' }}>
            {filtroStatus || filtroTipo ? 'Tente alterar os filtros.' : 'Não há solicitações de aprovação no momento.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {itensFiltrados.map((a) => {
            const st = statusConfig[a.status] || statusConfig.pendente;
            return (
              <div key={a.id} className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-5 hover:shadow-xl transition-shadow">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-full ${st.bg} ${st.color}`} style={{ fontFamily: 'Lexend, sans-serif' }}>
                        {a.status === 'pendente' && <Clock size={12} className="mr-1" />}
                        {a.status === 'aprovada' && <Check size={12} className="mr-1" />}
                        {a.status === 'rejeitada' && <X size={12} className="mr-1" />}
                        {st.label}
                      </span>
                      <span className="text-xs text-slate-400 dark:text-slate-500 px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded-full" style={{ fontFamily: 'Lexend, sans-serif' }}>
                        {tipoConfig[a.tipo] || a.tipo}
                      </span>
                    </div>
                    <h3 className="text-sm font-medium text-slate-800 dark:text-slate-100 mb-1" style={{ fontFamily: 'Lexend, sans-serif' }}>
                      {a.motivo}
                    </h3>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
                      <span className="flex items-center gap-1">
                        <FileText size={12} />
                        #{a.ticket.protocolo || a.ticket.id.slice(0, 8)}
                      </span>
                      <span className="flex items-center gap-1">
                        <User size={12} />
                        {a.solicitadoPor.name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(a.dataSolicitacao).toLocaleString('pt-BR')}
                      </span>
                      {a.valorAprovado != null && (
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          R$ {a.valorAprovado.toFixed(2)}
                        </span>
                      )}
                    </div>
                    {a.observacao && (
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 italic" style={{ fontFamily: 'Lexend, sans-serif' }}>
                        {a.observacao}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 sm:flex-shrink-0">
                    <button
                      onClick={() => setSelected(a)}
                      className="p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg"
                      title="Detalhes"
                    >
                      <Eye size={16} />
                    </button>
                    {canDecide && a.status === 'pendente' && (
                      <button
                        onClick={() => enviarWhatsApp(a.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-blue-600 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 text-xs font-medium rounded-lg transition-colors min-h-[36px]"
                        style={{ fontFamily: 'Lexend, sans-serif' }}
                        title="Enviar aprovação via WhatsApp"
                      >
                        <MessageSquare size={14} />
                        WhatsApp
                      </button>
                    )}
                    {canDecide && a.status === 'pendente' && (
                      <button
                        onClick={() => { setSelected(a); setShowDecidir(true); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors min-h-[36px]"
                        style={{ fontFamily: 'Lexend, sans-serif' }}
                      >
                        <MessageSquare size={14} />
                        Decidir
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {total > 15 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg disabled:opacity-50 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            style={{ fontFamily: 'Lexend, sans-serif' }}
          >
            Anterior
          </button>
          <span className="text-sm text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
            Página {page} de {Math.ceil(total / 15)}
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page >= Math.ceil(total / 15)}
            className="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg disabled:opacity-50 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            style={{ fontFamily: 'Lexend, sans-serif' }}
          >
            Próxima
          </button>
        </div>
      )}

      {selected && !showDecidir && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>
                  Detalhes da Aprovação
                </h2>
                <button onClick={() => setSelected(null)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>Status</span>
                  <p className={`text-sm font-medium ${statusConfig[selected.status]?.color || ''}`} style={{ fontFamily: 'Lexend, sans-serif' }}>
                    {statusConfig[selected.status]?.label || selected.status}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>Tipo</span>
                  <p className="text-sm text-slate-700 dark:text-slate-300" style={{ fontFamily: 'Lexend, sans-serif' }}>
                    {tipoConfig[selected.tipo] || selected.tipo}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>Motivo</span>
                  <p className="text-sm text-slate-700 dark:text-slate-300" style={{ fontFamily: 'Lexend, sans-serif' }}>
                    {selected.motivo}
                  </p>
                </div>
                {selected.observacao && (
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>Observação</span>
                    <p className="text-sm text-slate-700 dark:text-slate-300" style={{ fontFamily: 'Lexend, sans-serif' }}>
                      {selected.observacao}
                    </p>
                  </div>
                )}
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>Ticket</span>
                  <p className="text-sm text-slate-700 dark:text-slate-300" style={{ fontFamily: 'Lexend, sans-serif' }}>
                    #{selected.ticket.protocolo || selected.ticket.id.slice(0, 8)} — {selected.ticket.assunto || 'Sem assunto'}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>Solicitado por</span>
                  <p className="text-sm text-slate-700 dark:text-slate-300" style={{ fontFamily: 'Lexend, sans-serif' }}>
                    {selected.solicitadoPor.name} ({selected.solicitadoPor.email})
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>Data da solicitação</span>
                  <p className="text-sm text-slate-700 dark:text-slate-300" style={{ fontFamily: 'Lexend, sans-serif' }}>
                    {new Date(selected.dataSolicitacao).toLocaleString('pt-BR')}
                  </p>
                </div>
                {selected.aprovadoPor && (
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>Decidido por</span>
                    <p className="text-sm text-slate-700 dark:text-slate-300" style={{ fontFamily: 'Lexend, sans-serif' }}>
                      {selected.aprovadoPor.name} em {selected.dataDecisao ? new Date(selected.dataDecisao).toLocaleString('pt-BR') : '-'}
                    </p>
                  </div>
                )}
                {selected.valorAprovado != null && (
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>Valor</span>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300" style={{ fontFamily: 'Lexend, sans-serif' }}>
                      R$ {selected.valorAprovado.toFixed(2)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {selected && showDecidir && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { setShowDecidir(false); setSelected(null); }}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4" style={{ fontFamily: 'Khand, sans-serif' }}>
                Decidir Aprovação
              </h2>
              <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-750 rounded-xl">
                <p className="text-sm text-slate-700 dark:text-slate-300" style={{ fontFamily: 'Lexend, sans-serif' }}>
                  {selected.motivo}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1" style={{ fontFamily: 'Lexend, sans-serif' }}>
                  Solicitado por {selected.solicitadoPor.name}
                </p>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2" style={{ fontFamily: 'Lexend, sans-serif' }}>
                  Observação (opcional)
                </label>
                <textarea
                  value={decisaoObservacao}
                  onChange={(e) => setDecisaoObservacao(e.target.value)}
                  rows={3}
                  placeholder="Adicione uma observação..."
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ fontFamily: 'Lexend, sans-serif' }}
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => decidir(selected.id, true)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors text-sm font-medium min-h-[44px]"
                  style={{ fontFamily: 'Lexend, sans-serif' }}
                >
                  <Check size={16} />
                  Aprovar
                </button>
                <button
                  onClick={() => decidir(selected.id, false)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors text-sm font-medium min-h-[44px]"
                  style={{ fontFamily: 'Lexend, sans-serif' }}
                >
                  <X size={16} />
                  Rejeitar
                </button>
                <button
                  onClick={() => { setShowDecidir(false); setSelected(null); setDecisaoObservacao(''); }}
                  className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl transition-colors text-sm min-h-[44px]"
                  style={{ fontFamily: 'Lexend, sans-serif' }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
