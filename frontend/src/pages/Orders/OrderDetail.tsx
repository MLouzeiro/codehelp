import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../services/auth';
import { ArrowLeft, FileText, Send, Download, User, Calendar, DollarSign, Clock, ExternalLink, ChevronRight, RefreshCw, XCircle, AlertTriangle } from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  rascunho: 'Rascunho', aguardando_assinatura: 'Aguardando Assinatura', assinada: 'Assinada',
  em_execucao: 'Em Execução', concluida: 'Concluída', cancelada: 'Cancelada',
};

const STATUS_OPTIONS = ['rascunho', 'aguardando_assinatura', 'assinada', 'em_execucao', 'concluida', 'cancelada'];

const STATUS_BADGE: Record<string, string> = {
  rascunho: 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-300',
  aguardando_assinatura: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  assinada: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  em_execucao: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  concluida: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  cancelada: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export default function OrderDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [signMsg, setSignMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [changingStatus, setChangingStatus] = useState(false);

  const loadOrder = useCallback(async () => {
    try {
      const [orderRes, timelineRes] = await Promise.all([
        api.get(`/orders/${id}`),
        api.get(`/orders/${id}/timeline`).catch(() => ({ data: { timeline: [] } })),
      ]);
      setOrder(orderRes.data);
      setTimeline(timelineRes.data.timeline || []);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { loadOrder(); }, [loadOrder]);

  const doEnvioAssinatura = async (endpoint: string, okMessage: string) => {
    setSending(true);
    setSignMsg(null);
    try {
      const res = await api.post(`/orders/${id}/${endpoint}`);
      const data = res.data;
      setSignMsg({
        type: 'ok',
        text: `${data.message || okMessage}${data.provider ? ` · via ${data.provider}` : ''}${data.telefone ? ` · ${data.telefone}` : ''}${data.messageId ? ` · msg ${data.messageId}` : ''}`,
      });
      await loadOrder();
    } catch (err: any) {
      const data = err.response?.data;
      setSignMsg({ type: 'err', text: data?.error || 'Erro ao enviar para assinatura' });
    } finally { setSending(false); }
  };

  const sendForSignature = () => doEnvioAssinatura('send-signature', 'Link de assinatura enviado');
  const resendSignature = () => doEnvioAssinatura('resend-signature', 'Link de assinatura reenviado');

  const cancelSignature = async () => {
    if (!window.confirm('Cancelar a solicitação de assinatura? A OS voltará para rascunho.')) return;
    setSending(true);
    try {
      await api.post(`/orders/${id}/cancel-signature`);
      setSignMsg({ type: 'ok', text: 'Solicitação de assinatura cancelada' });
      await loadOrder();
    } catch (err: any) {
      setSignMsg({ type: 'err', text: err.response?.data?.error || 'Erro ao cancelar solicitação' });
    } finally { setSending(false); }
  };

  const changeStatus = async (status: string) => {
    if (!status || status === order.status || changingStatus) return;
    setChangingStatus(true);
    try {
      await api.patch(`/orders/${id}/status`, { status });
      await loadOrder();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao atualizar status');
    } finally { setChangingStatus(false); }
  };

  const formatMin = (min: number | null | undefined) => {
    if (min == null) return '—';
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  if (loading) return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" /></div>;
  if (!order) return <div className="text-center py-12 text-gray-500 dark:text-slate-400">OS não encontrada</div>;

  const podeMudarStatus = user?.role === 'admin' || user?.role === 'gerente';

  return (
    <div className="space-y-6 max-w-3xl">
      <button onClick={() => navigate('/app/orders')} className="flex items-center gap-2 text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:text-slate-300">
        <ArrowLeft size={18} /> Voltar
      </button>

      <div className="card">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-codemed-100 rounded-xl flex items-center justify-center">
              <FileText size={24} className="text-codemed-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">{order.numeroOs}</h1>
              <p className="text-gray-500 dark:text-slate-400">{order.client?.razaoSocial}</p>
            </div>
          </div>
          <span className={`badge text-sm px-3 py-1.5 ${STATUS_BADGE[order.status] || 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-300 dark:text-slate-300'}`}>{STATUS_LABELS[order.status]}</span>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-6">
          <div><p className="text-xs text-gray-500 dark:text-slate-400">Cliente</p><p className="text-sm font-medium">{order.client?.razaoSocial}</p></div>
          <div><p className="text-xs text-gray-500 dark:text-slate-400">Tipo de Serviço</p><p className="text-sm font-medium">{order.tipoServico}</p></div>
          <div><p className="text-xs text-gray-500 dark:text-slate-400">Técnico Responsável</p><p className="text-sm font-medium">{order.tecnicoResponsavel?.name}</p></div>
          {order.valorServico && <div><p className="text-xs text-gray-500 dark:text-slate-400">Valor</p><p className="text-sm font-medium text-green-600">R$ {order.valorServico}</p></div>}
          <div><p className="text-xs text-gray-500 dark:text-slate-400">Data de Emissão</p><p className="text-sm font-medium">{new Date(order.dataEmissao).toLocaleDateString('pt-BR')}</p></div>
          {order.dataPrevistaEntrega && <div><p className="text-xs text-gray-500 dark:text-slate-400">Previsão de Entrega</p><p className="text-sm font-medium">{new Date(order.dataPrevistaEntrega).toLocaleDateString('pt-BR')}</p></div>}
          {order.dataConclusao && <div><p className="text-xs text-gray-500 dark:text-slate-400">Data de Conclusão</p><p className="text-sm font-medium text-emerald-600">{new Date(order.dataConclusao).toLocaleString('pt-BR')}</p></div>}
          {order.ticket && (
            <div>
              <p className="text-xs text-gray-500 dark:text-slate-400">Ticket de Origem</p>
              <button onClick={() => navigate(`/app/helpdesk/${order.ticket.id}`)} className="text-sm font-medium text-blue-600 hover:underline inline-flex items-center gap-1">
                #{order.ticket.protocolo} <ExternalLink size={12} />
              </button>
            </div>
          )}
        </div>

        {order.tipoImplantacao && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700">
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-2 font-semibold uppercase tracking-wide">Implantação</p>
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-gray-500 dark:text-slate-400">Tipo</p><p className="text-sm font-medium capitalize">{order.tipoImplantacao}</p></div>
              {order.precoImplantacao > 0 && <div><p className="text-xs text-gray-500 dark:text-slate-400">Preço</p><p className="text-sm font-medium text-green-600">R$ {order.precoImplantacao}</p></div>}
              {order.horasDev > 0 && <div><p className="text-xs text-gray-500 dark:text-slate-400">Horas Dev</p><p className="text-sm font-medium">{order.horasDev}h</p></div>}
              {order.horasSuporte > 0 && <div><p className="text-xs text-gray-500 dark:text-slate-400">Horas Suporte</p><p className="text-sm font-medium">{order.horasSuporte}h</p></div>}
              {order.dataInicioImplantacao && <div><p className="text-xs text-gray-500 dark:text-slate-400">Início</p><p className="text-sm font-medium">{new Date(order.dataInicioImplantacao).toLocaleDateString('pt-BR')}</p></div>}
              {order.dataFimImplantacao && <div><p className="text-xs text-gray-500 dark:text-slate-400">Fim</p><p className="text-sm font-medium">{new Date(order.dataFimImplantacao).toLocaleDateString('pt-BR')}</p></div>}
              <div><p className="text-xs text-gray-500 dark:text-slate-400">Concluída</p><p className="text-sm font-medium">{order.implantacaoConcluida ? '✅ Sim' : '⏳ Não'}</p></div>
            </div>
          </div>
        )}

        {order.descricaoServico && (
          <div className="mt-4">
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Descrição do Serviço</p>
            <p className="text-sm text-gray-700 dark:text-slate-300 bg-gray-50 dark:bg-slate-800 p-3 rounded-lg">{order.descricaoServico}</p>
          </div>
        )}

        {order.sistemasEnvolvidos?.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Sistemas Envolvidos</p>
            <div className="flex gap-2 flex-wrap">
              {order.sistemasEnvolvidos.map((s: string) => (
                <span key={s} className="badge bg-codemed-100 text-codemed-700">{s}</span>
              ))}
            </div>
          </div>
        )}

        {signMsg && (
          <div className={`mt-4 flex items-center gap-2 p-3 rounded-lg text-sm ${
            signMsg.type === 'ok' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900/30' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/30'
          }`}>
            <AlertTriangle size={16} />
            <span>{signMsg.text}</span>
          </div>
        )}

        <div className="flex gap-3 mt-6 pt-4 border-t flex-wrap">
          {order.status === 'rascunho' && !order.signature && (
            <button onClick={sendForSignature} disabled={sending} className="btn-primary flex items-center gap-2">
              <Send size={16} /> {sending ? 'Enviando...' : 'Enviar para Assinatura'}
            </button>
          )}
          {order.signature && order.status === 'rascunho' && (
            <button onClick={sendForSignature} disabled={sending} className="btn-primary flex items-center gap-2">
              <Send size={16} /> {sending ? 'Enviando...' : 'Enviar para Assinatura'}
            </button>
          )}
          {order.status === 'aguardando_assinatura' && order.signature && (
            <>
              <button onClick={resendSignature} disabled={sending} className="btn-secondary flex items-center gap-2">
                <RefreshCw size={16} /> {sending ? 'Enviando...' : 'Reenviar Link'}
              </button>
              <button onClick={cancelSignature} disabled={sending} className="btn-secondary flex items-center gap-2 text-red-600 border-red-200 hover:border-red-400">
                <XCircle size={16} /> Cancelar Solicitação
              </button>
            </>
          )}
          {order.status === 'rascunho' && (
            <button onClick={() => navigate(`/app/orders/${id}/edit`)} className="btn-secondary">Editar</button>
          )}
          {order.signature?.pdfPath && (
            <button onClick={() => window.open(`/api/orders/${id}/pdf`, '_blank')} className="btn-secondary flex items-center gap-2">
              <Download size={16} /> Baixar PDF
            </button>
          )}
        </div>

        {podeMudarStatus && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-2 flex items-center gap-1"><Clock size={13} /> Mudar status</p>
            <div className="flex gap-2 flex-wrap">
              {STATUS_OPTIONS.filter((s) => s !== order.status).map((s) => (
                <button
                  key={s}
                  onClick={() => changeStatus(s)}
                  disabled={changingStatus}
                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 hover:border-codemed-400 hover:text-codemed-600 disabled:opacity-40 transition-colors"
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {order.signature && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-4">📝 Solicitação de Assinatura</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 dark:text-slate-400">Status</p>
              <span className={`badge text-xs px-2 py-1 ${
                order.signature.status === 'assinada' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                order.signature.status === 'recusada' || order.signature.status === 'cancelada' || order.signature.status === 'expirada' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                order.signature.status === 'erro_envio' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
              }`}>
                {order.signature.status}
              </span>
            </div>
            <div><p className="text-xs text-gray-500 dark:text-slate-400">Enviado para</p><p className="text-sm font-medium">{order.signature.telefone || '-'}</p></div>
            <div><p className="text-xs text-gray-500 dark:text-slate-400">Provider</p><p className="text-sm font-medium">{order.signature.provider || '-'}</p></div>
            <div><p className="text-xs text-gray-500 dark:text-slate-400">Message ID</p><p className="text-sm font-medium break-all">{order.signature.messageId || '-'}</p></div>
            <div><p className="text-xs text-gray-500 dark:text-slate-400">Enviado em</p><p className="text-sm font-medium">{order.signature.sentAt ? new Date(order.signature.sentAt).toLocaleString('pt-BR') : '-'}</p></div>
            <div><p className="text-xs text-gray-500 dark:text-slate-400">Tentativas</p><p className="text-sm font-medium">{order.signature.attempts ?? 0}</p></div>
            {order.signature.lastError && (
              <div className="col-span-2">
                <p className="text-xs text-gray-500 dark:text-slate-400">Último erro</p>
                <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded-lg mt-0.5">{order.signature.lastError}</p>
              </div>
            )}
            {order.signature.rejectionReason && (
              <div className="col-span-2">
                <p className="text-xs text-gray-500 dark:text-slate-400">Motivo da recusa</p>
                <p className="text-sm text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 p-2 rounded-lg mt-0.5">{order.signature.rejectionReason}</p>
              </div>
            )}
          </div>

          {(order.signature.signatureAttempts?.length > 0) && (
            <div className="mt-4">
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">Tentativas de envio</p>
              <div className="space-y-1.5">
                {order.signature.signatureAttempts.map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between text-xs bg-gray-50 dark:bg-slate-800 rounded-lg px-3 py-2">
                    <span className={a.resultado === 'enviada' ? 'text-green-600' : 'text-red-600'}>
                      {a.resultado === 'enviada' ? '✓ enviada' : '✕ erro'}
                    </span>
                    <span className="text-gray-500 dark:text-slate-400">{new Date(a.dataHora).toLocaleString('pt-BR')}</span>
                    <span className="text-gray-500 dark:text-slate-400">{a.provider || '-'}</span>
                    <span className="text-gray-400 dark:text-slate-500 truncate max-w-[200px]">{a.erro || a.messageId || '-'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {order.signature.assinanteNome && (
            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
              <div><p className="text-xs text-gray-500 dark:text-slate-400">Assinante</p><p className="text-sm font-medium">{order.signature.assinanteNome}</p></div>
              <div><p className="text-xs text-gray-500 dark:text-slate-400">CPF</p><p className="text-sm font-medium">{order.signature.assinanteCpf}</p></div>
              <div><p className="text-xs text-gray-500 dark:text-slate-400">Cargo</p><p className="text-sm font-medium">{order.signature.assinanteCargo}</p></div>
              <div><p className="text-xs text-gray-500 dark:text-slate-400">Data/Hora</p><p className="text-sm font-medium">{order.signature.assinadoEm ? new Date(order.signature.assinadoEm).toLocaleString('pt-BR') : '-'}</p></div>
            </div>
          )}
          {order.signature.assinaturaBase64 && (
            <div className="mt-4">
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">Assinatura</p>
              <img src={order.signature.assinaturaBase64} alt="Assinatura" className="max-h-24 border border-gray-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800" />
            </div>
          )}
        </div>
      )}

      <div className="card">
        <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <Clock size={16} className="text-codemed-600" /> Timeline de Status
        </h3>
        {timeline.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-slate-500">Nenhuma alteração de status registrada.</p>
        ) : (
          <div className="space-y-0">
            {timeline.map((ev: any, i: number) => (
              <div key={ev.id || i} className="flex gap-3 py-2.5 relative">
                {i < timeline.length - 1 && (
                  <div className="absolute left-[11px] top-[30px] bottom-0 w-0.5 bg-gray-200" />
                )}
                <div className={`w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center flex-shrink-0 z-10 text-[10px] ${
                  ev.statusNovo === 'concluida' ? 'bg-emerald-100 border-emerald-300 dark:bg-emerald-900/40 dark:border-emerald-700' :
                  ev.statusNovo === 'cancelada' ? 'bg-red-100 border-red-300 dark:bg-red-900/40 dark:border-red-700' :
                  'bg-blue-100 border-blue-300 dark:bg-blue-900/40 dark:border-blue-700'
                }`}>
                  {ev.statusNovo === 'concluida' ? '✓' : ev.statusNovo === 'cancelada' ? '✕' : '•'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-medium text-gray-800 dark:text-slate-200">{ev.statusLabel}</span>
                    {ev.statusAnterior && (
                      <span className="text-xs text-gray-400 dark:text-slate-500 flex items-center gap-1">
                        <ChevronRight size={11} /> de {STATUS_LABELS[ev.statusAnterior] || ev.statusAnterior}
                      </span>
                    )}
                    {ev.emAndamento && (
                      <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded-full animate-pulse">em andamento</span>
                    )}
                  </div>
                  {ev.observacao && <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{ev.observacao}</p>}
                  <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">
                    {new Date(ev.createdAt).toLocaleString('pt-BR')}
                    {ev.usuario ? ` · ${ev.usuario.name}` : ''}
                    {ev.origem === 'publico' ? ' · cliente' : ev.origem === 'sistema' ? ' · sistema' : ''}
                    {ev.duracaoMin != null && ` · duração: ${formatMin(ev.duracaoMin)}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}