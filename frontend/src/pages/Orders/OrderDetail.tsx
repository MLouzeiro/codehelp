import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../services/auth';
import { ArrowLeft, FileText, Send, Download, User, Calendar, DollarSign, Clock, ExternalLink, ChevronRight, RefreshCw, XCircle, AlertTriangle, Package, Plus, Trash2, MessageCircle } from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  rascunho: 'Rascunho', aguardando_assinatura: 'Aguardando Assinatura', assinada: 'Assinada',
  em_execucao: 'Em Execução', concluida: 'Concluída', cancelada: 'Cancelada',
};

const STATUS_OPTIONS = ['rascunho', 'aguardando_assinatura', 'assinada', 'em_execucao', 'concluida', 'cancelada'];

const STATUS_BADGE: Record<string, string> = {
  rascunho: 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-300',
  aguardando_assinatura: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  assinada: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  assinada_sem_assinatura: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
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
  const [signLink, setSignLink] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [changingStatus, setChangingStatus] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [itemsTotal, setItemsTotal] = useState(0);
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [itemForm, setItemForm] = useState({ descricao: '', tipo: 'servico', quantidade: '1', valorUnitario: '', observacoes: '' });
  const [savingItem, setSavingItem] = useState(false);
  const [phonePreview, setPhonePreview] = useState<{ telefone: string | null; telefoneFormatado: string | null; origem: string | null; contatoNome: string | null; hasTicket: boolean; ticketProtocolo: string | null; ticketContactPhone: string | null; clienteNome: string | null; hasManualPhone: boolean; telefoneManual: string | null; jid: string | null } | null>(null);
  const [manualPhone, setManualPhone] = useState('');
  const [salvarNoCliente, setSalvarNoCliente] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);
  const [sendingOs, setSendingOs] = useState(false);
  const [sendOsMsg, setSendOsMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [layouts, setLayouts] = useState<any[]>([]);
  const [selectedLayoutId, setSelectedLayoutId] = useState<string>('');

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

  useEffect(() => {
    api.get('/orders/layouts').then(({ data }) => {
      setLayouts(data || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (order) {
      setSelectedLayoutId(order.layoutId || '');
    }
  }, [order]);

  const loadPhonePreview = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.get(`/orders/${id}/preview-phone`);
      setPhonePreview(res.data);
    } catch (err) { /* ignora */ }
  }, [id]);

  useEffect(() => { if (order) loadPhonePreview(); }, [order, loadPhonePreview]);

  const saveManualPhone = async () => {
    if (!manualPhone.trim()) return;
    setSavingPhone(true);
    try {
      const res = await api.patch(`/orders/${id}/manual-phone`, { telefone: manualPhone, salvarNoCliente });
      setSignMsg({ type: 'ok', text: res.data.message });
      setManualPhone('');
      setSalvarNoCliente(false);
      await Promise.all([loadOrder(), loadPhonePreview()]);
    } catch (err: any) {
      setSignMsg({ type: 'err', text: err.response?.data?.error || 'Erro ao salvar telefone' });
    } finally { setSavingPhone(false); }
  };

  const loadItems = useCallback(async () => {
    try {
      const res = await api.get(`/orders/${id}/items`);
      setItems(res.data.items || []);
      setItemsTotal(res.data.total || 0);
    } catch (err) { /* OS pode não ter itens */ }
  }, [id]);

  useEffect(() => { if (order) loadItems(); }, [order, loadItems]);

  const openNewItem = () => {
    setEditingItem(null);
    setItemForm({ descricao: '', tipo: 'servico', quantidade: '1', valorUnitario: '', observacoes: '' });
    setShowItemModal(true);
  };

  const openEditItem = (item: any) => {
    setEditingItem(item);
    setItemForm({
      descricao: item.descricao || '',
      tipo: item.tipo || 'servico',
      quantidade: String(item.quantidade || 1),
      valorUnitario: item.valorUnitario ? String(item.valorUnitario) : '',
      observacoes: item.observacoes || '',
    });
    setShowItemModal(true);
  };

  const saveItem = async () => {
    if (!itemForm.descricao.trim()) return alert('Descrição é obrigatória');
    setSavingItem(true);
    try {
      const payload = {
        descricao: itemForm.descricao.trim(),
        tipo: itemForm.tipo,
        quantidade: parseFloat(itemForm.quantidade) || 1,
        valorUnitario: itemForm.valorUnitario ? parseFloat(itemForm.valorUnitario) : null,
        observacoes: itemForm.observacoes || null,
      };
      if (editingItem) {
        await api.put(`/orders/${id}/items/${editingItem.id}`, payload);
      } else {
        await api.post(`/orders/${id}/items`, payload);
      }
      setShowItemModal(false);
      await loadItems();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao salvar item');
    } finally { setSavingItem(false); }
  };

  const deleteItem = async (itemId: string) => {
    if (!window.confirm('Remover este item?')) return;
    try {
      await api.delete(`/orders/${id}/items/${itemId}`);
      await loadItems();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao remover item');
    }
  };

  const doEnvioAssinatura = async (endpoint: string, okMessage: string) => {
    setSending(true);
    setSignMsg(null);
    setSignLink(null);
    try {
      const res = await api.post(`/orders/${id}/${endpoint}`);
      const data = res.data;
      const origemLabel = data.origem === 'manual' ? 'Manual' :
                         data.origem === 'ticket_whatsapp' ? 'WhatsApp do chamado' :
                         data.origem === 'ticket_lid' ? 'WhatsApp do chamado (LID)' : '';
      setSignMsg({
        type: 'ok',
        text: `${data.message || okMessage}${data.provider ? ` · via ${data.provider}` : ''}${data.telefoneFormatado ? ` · ${data.telefoneFormatado}` : ''}${origemLabel ? ` (${origemLabel})` : ''}${data.messageId ? ` · msg ${data.messageId}` : ''}`,
      });
      if (data.signLink) setSignLink(data.signLink);
      await Promise.all([loadOrder(), loadPhonePreview()]);
    } catch (err: any) {
      const data = err.response?.data;
      const errorMsg = data?.error || 'Erro ao enviar para assinatura';
      const telefoneFmt = data?.telefoneFormatado;
      const origemLabel = data?.origem === 'manual' ? 'Manual' :
                         data?.origem === 'ticket_whatsapp' ? 'WhatsApp do chamado' :
                         data?.origem === 'ticket_lid' ? 'WhatsApp do chamado (LID)' : '';
      setSignMsg({
        type: 'err',
        text: `${errorMsg}${telefoneFmt ? ` (telefone: ${telefoneFmt}` : ''}${origemLabel ? `${telefoneFmt ? ' · ' : '('}${origemLabel}` : ''}${telefoneFmt ? ')' : ''}`,
      });
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

  const handleSendOsToClient = async () => {
    setSendingOs(true);
    setSendOsMsg(null);
    try {
      if (selectedLayoutId && selectedLayoutId !== order.layoutId) {
        await api.put(`/orders/${id}`, { layoutId: selectedLayoutId });
      }
      const res = await api.post(`/orders/${id}/send-to-client`);
      setSendOsMsg({ type: 'ok', text: res.data.message });
    } catch (err: any) {
      const data = err.response?.data;
      setSendOsMsg({
        type: 'err',
        text: data?.error || 'Não foi possível enviar a Ordem de Serviço. Verifique a conexão do WhatsApp e tente novamente.',
      });
    } finally { setSendingOs(false); }
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const params: any = {};
      if (selectedLayoutId) params.layoutId = selectedLayoutId;
      const response = await api.get(`/orders/${id}/pdf`, { params, responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${order.numeroOs?.replace(/\//g, '-') || 'OS'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('[OS PDF] Erro ao baixar PDF:', err);
      let msg = 'Não foi possível baixar a Ordem de Serviço. Sua sessão pode ter expirado.';
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const json = JSON.parse(text);
          msg = json.error || msg;
        } catch {}
      } else if (err.response?.data?.error) {
        msg = err.response.data.error;
      }
      alert(msg);
    } finally { setDownloadingPdf(false); }
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
          {order.layout && (
            <div>
              <p className="text-xs text-gray-500 dark:text-slate-400">Layout</p>
              <p className="text-sm font-medium flex items-center gap-1">
                {order.layout.padrao && <span title="Layout padrão">⭐</span>}
                {order.layout.nome}
                <span className="text-xs text-gray-400 dark:text-slate-500">({order.layout.tipo === 'pdf_importado' ? 'PDF' : 'Visual'})</span>
              </p>
            </div>
          )}
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

        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-500 dark:text-slate-400 font-semibold uppercase tracking-wide flex items-center gap-1.5">
              <Package size={13} /> Itens / Materiais / Serviços
            </p>
            {order.status !== 'assinada' && order.status !== 'concluida' && order.status !== 'cancelada' && (
              <button onClick={openNewItem} className="text-xs text-codemed-600 hover:text-codemed-700 flex items-center gap-1 font-medium">
                <Plus size={13} /> Adicionar
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-slate-500 italic">Nenhum item registrado</p>
          ) : (
            <div className="space-y-2">
              {items.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between bg-gray-50 dark:bg-slate-800 rounded-lg px-3 py-2 group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800 dark:text-slate-200 truncate">{item.descricao}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        item.tipo === 'material' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                        item.tipo === 'outros' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                        'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      }`}>{item.tipo === 'material' ? 'Material' : item.tipo === 'outros' ? 'Outros' : 'Serviço'}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                      <span>Qtd: {item.quantidade}</span>
                      {item.valorUnitario && <span>Unit: R$ {item.valorUnitario.toFixed(2)}</span>}
                      {item.valorTotal != null && <span className="font-medium text-green-600 dark:text-green-400">Total: R$ {item.valorTotal.toFixed(2)}</span>}
                      {item.observacoes && <span className="italic truncate max-w-[200px]">{item.observacoes}</span>}
                    </div>
                  </div>
                  {order.status !== 'assinada' && order.status !== 'concluida' && order.status !== 'cancelada' && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEditItem(item)} className="p-1 text-gray-400 hover:text-codemed-600 rounded transition-colors" title="Editar">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                      </button>
                      <button onClick={() => deleteItem(item.id)} className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors" title="Remover">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {itemsTotal > 0 && (
                <div className="text-right text-sm font-semibold text-green-600 dark:text-green-400 pt-1">
                  Total dos Itens: R$ {itemsTotal.toFixed(2)}
                </div>
              )}
            </div>
          )}
        </div>

        {signMsg && (
          <div className={`mt-4 flex items-center gap-2 p-3 rounded-lg text-sm ${
            signMsg.type === 'ok' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900/30' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/30'
          }`}>
            <AlertTriangle size={16} />
            <span>{signMsg.text}</span>
          </div>
        )}

        {signLink && (
          <div className="mt-3 p-3 rounded-lg border border-blue-200 dark:border-blue-900/30 bg-blue-50 dark:bg-blue-900/20">
            <p className="text-xs text-blue-600 dark:text-blue-400 mb-2 font-medium">Link para assinatura:</p>
            <a
              href={signLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-300 hover:underline break-all"
            >
              <ExternalLink size={14} />
              {signLink}
            </a>
          </div>
        )}

        {phonePreview && (order.status === 'rascunho' || order.status === 'aguardando_assinatura') && (
          <div className="mt-4 p-3 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 text-sm">
            <p className="font-medium text-gray-700 dark:text-slate-300 mb-2">WhatsApp para assinatura</p>

            {/* ── OS COM TICKET: contato automatico do chamado ── */}
            {phonePreview.hasTicket && (
              <div>
                {phonePreview.telefone ? (
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-green-600 dark:text-green-400 font-mono font-semibold">{phonePreview.telefoneFormatado || phonePreview.telefone}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                      WhatsApp do chamado
                    </span>
                  </div>
                ) : phonePreview.jid ? (
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-amber-600 dark:text-amber-400 font-mono">{phonePreview.jid}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                      LID JID (identificador WhatsApp)
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-red-600 dark:text-red-400">Contato do ticket nao resolvido</span>
                  </div>
                )}
                {phonePreview.contatoNome && (
                  <p className="text-xs text-gray-500 dark:text-slate-400">Contato: {phonePreview.contatoNome}</p>
                )}
                {phonePreview.ticketProtocolo && (
                  <p className="text-xs text-gray-500 dark:text-slate-400">Chamado: {phonePreview.ticketProtocolo}</p>
                )}
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 italic">O numero e automaticamente o contato que abriu o chamado.</p>
              </div>
            )}

            {/* ── OS SEM TICKET: informar WhatsApp manualmente ── */}
            {!phonePreview.hasTicket && (
              <div>
                {phonePreview.telefone ? (
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-green-600 dark:text-green-400 font-mono">{phonePreview.telefoneFormatado || phonePreview.telefone}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                      Informado manualmente
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">Informe o numero de WhatsApp que recebera a assinatura:</p>
                )}
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={manualPhone}
                      onChange={(e) => setManualPhone(e.target.value)}
                      placeholder="Ex: 11999998888"
                      className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100"
                    />
                  </div>
                  <label className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={salvarNoCliente}
                      onChange={(e) => setSalvarNoCliente(e.target.checked)}
                      className="rounded border-gray-300 dark:border-slate-600"
                    />
                    Salvar no cliente
                  </label>
                  <button
                    onClick={saveManualPhone}
                    disabled={savingPhone || !manualPhone.trim()}
                    className="px-3 py-1.5 text-sm rounded-lg bg-codemed-600 text-white hover:bg-codemed-700 disabled:opacity-50 transition-colors"
                  >
                    {savingPhone ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </div>
            )}
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
          {layouts.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 dark:text-slate-400">Layout:</label>
              <select
                value={selectedLayoutId || order.layoutId || ''}
                onChange={e => setSelectedLayoutId(e.target.value)}
                className="input text-sm py-1 px-2 w-auto"
              >
                <option value="">Padrão</option>
                {layouts.map((l: any) => (
                  <option key={l.id} value={l.id}>{l.nome}{l.padrao ? ' (padrão)' : ''}</option>
                ))}
              </select>
            </div>
          )}
          <button
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="btn-secondary flex items-center gap-2"
          >
            <Download size={16} /> {downloadingPdf ? 'Baixando...' : 'Baixar PDF'}
          </button>
          <button
            onClick={handleSendOsToClient}
            disabled={sendingOs}
            className="btn-secondary flex items-center gap-2"
          >
            <MessageCircle size={16} /> {sendingOs ? 'Enviando...' : 'Enviar para Cliente'}
          </button>
        </div>

        {sendOsMsg && (
          <div className={`mt-4 flex items-center gap-2 p-3 rounded-lg text-sm ${
            sendOsMsg.type === 'ok' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900/30' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/30'
          }`}>
            <AlertTriangle size={16} />
            <span>{sendOsMsg.text}</span>
          </div>
        )}

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

          {order.signature.tokenAssinatura && order.signature.status !== 'assinada' && order.signature.status !== 'cancelada' && order.signature.status !== 'recusada' && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">Link para assinatura</p>
              <a
                href={`${window.location.origin}/assinar/${order.signature.tokenAssinatura}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                <ExternalLink size={14} />
                Abrir página de assinatura
              </a>
            </div>
          )}

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

      {showItemModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-4">{editingItem ? 'Editar Item' : 'Novo Item'}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Descrição *</label>
                <input
                  type="text"
                  value={itemForm.descricao}
                  onChange={(e) => setItemForm({ ...itemForm, descricao: e.target.value })}
                  className="input w-full"
                  placeholder="Ex: Consultoria, Peça X, etc."
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Tipo</label>
                  <select
                    value={itemForm.tipo}
                    onChange={(e) => setItemForm({ ...itemForm, tipo: e.target.value })}
                    className="input w-full"
                  >
                    <option value="servico">Serviço</option>
                    <option value="material">Material</option>
                    <option value="outros">Outros</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Quantidade</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={itemForm.quantidade}
                    onChange={(e) => setItemForm({ ...itemForm, quantidade: e.target.value })}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Valor Unit.</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={itemForm.valorUnitario}
                    onChange={(e) => setItemForm({ ...itemForm, valorUnitario: e.target.value })}
                    className="input w-full"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Observações</label>
                <input
                  type="text"
                  value={itemForm.observacoes}
                  onChange={(e) => setItemForm({ ...itemForm, observacoes: e.target.value })}
                  className="input w-full"
                  placeholder="Opcional"
                />
              </div>
              {itemForm.quantidade && itemForm.valorUnitario && (
                <div className="text-right text-sm font-semibold text-green-600 dark:text-green-400">
                  Subtotal: R$ {(parseFloat(itemForm.quantidade) * parseFloat(itemForm.valorUnitario)).toFixed(2)}
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6 justify-end">
              <button onClick={() => setShowItemModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={saveItem} disabled={savingItem} className="btn-primary">
                {savingItem ? 'Salvando...' : editingItem ? 'Salvar' : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}