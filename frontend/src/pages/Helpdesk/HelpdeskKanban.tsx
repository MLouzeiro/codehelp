import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../services/api';
import { useAuth } from '../../services/auth';
import {
  RefreshCw, MessageSquare, User, Clock, Tag, FileText, Inbox, Bot,
  Headphones, CheckCircle, AlertTriangle, Phone, X, Send, ArrowRight,
  UserPlus, ClipboardList, History, Stethoscope, Building2, ArrowUpDown,
  Search, Plus,
} from 'lucide-react';
import type { HelpdeskKanbanData, HelpdeskEtapa, EtapaSlug } from '../../types';

const ETAPA_ICONES: Record<string, any> = {
  inbox: Inbox,
  bot: Bot,
  headphones: Headphones,
  clock: Clock,
  'file-text': FileText,
  'check-circle': CheckCircle,
};

function formatarTempo(minutos: number): string {
  if (minutos < 1) return 'agora';
  if (minutos < 60) return `${minutos}min`;
  const horas = Math.floor(minutos / 60);
  const mins = minutos % 60;
  if (horas < 24) return mins === 0 ? `${horas}h` : `${horas}h${mins}m`;
  const dias = Math.floor(horas / 24);
  return `${dias}d`;
}

export default function HelpdeskKanban() {
  const { user } = useAuth();
  const [data, setData] = useState<HelpdeskKanbanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragFromEtapa, setDragFromEtapa] = useState<EtapaSlug | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketDetail, setTicketDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);
  const [assignTo, setAssignTo] = useState('');
  const [orderBy, setOrderBy] = useState('updatedAt_desc');
  const [search, setSearch] = useState('');
  const [autoMessage, setAutoMessage] = useState<{ sent: boolean; error?: string } | null>(null);
  const [showAbrirChamado, setShowAbrirChamado] = useState(false);
  const [abrirChamado, setAbrirChamado] = useState({
    assunto: '',
    categoria: '',
    prioridade: 'media',
    tipo: '',
    observacoes: '',
  });
  const [abrirSaving, setAbrirSaving] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const detailPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const canManage = user?.role === 'admin' || user?.role === 'gerente';

  const loadKanban = useCallback(async () => {
    try {
      const { data: res } = await api.get('/helpdesk/kanban', { params: { orderBy } });
      setData(res);
    } catch (err) {
      console.error('Erro ao carregar kanban helpdesk:', err);
    } finally {
      setLoading(false);
    }
  }, [orderBy]);

  const loadAgents = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/users');
      setAgents(data.filter((u: any) => u.role !== 'comercial' && u.role !== 'vendedor'));
    } catch { }
  }, []);

  const loadTicketDetail = useCallback(async (id: string) => {
    try {
      const { data } = await api.get(`/helpdesk/tickets/${id}/history`);
      setTicketDetail(data);
    } catch (err) {
      console.error('Erro ao carregar detalhe:', err);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKanban();
    loadAgents();
  }, [loadKanban, loadAgents]);

  useEffect(() => {
    pollRef.current = setInterval(() => { loadKanban(); }, 8000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadKanban]);

  useEffect(() => {
    if (selectedTicketId) {
      setDetailLoading(true);
      loadTicketDetail(selectedTicketId);
      if (detailPollRef.current) clearInterval(detailPollRef.current);
      detailPollRef.current = setInterval(() => loadTicketDetail(selectedTicketId), 4000);
    } else {
      setTicketDetail(null);
      if (detailPollRef.current) { clearInterval(detailPollRef.current); detailPollRef.current = null; }
    }
    return () => { if (detailPollRef.current) clearInterval(detailPollRef.current); };
  }, [selectedTicketId, loadTicketDetail]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticketDetail?.ticket?.messages?.length]);

  const handleDragStart = (e: React.DragEvent, ticketId: string, etapaOrigem: EtapaSlug) => {
    setDragId(ticketId);
    setDragFromEtapa(etapaOrigem);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', ticketId);
  };

  const handleDragEnd = () => {
    setDragId(null);
    setDragFromEtapa(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, etapaDestino: EtapaSlug) => {
    e.preventDefault();
    const ticketId = dragId || e.dataTransfer.getData('text/plain');
    if (!ticketId || !data) return;
    if (dragFromEtapa === etapaDestino) return;

    const board = data.board;
    const ticketOrigem = Object.values(board).flatMap((c) => c.items).find((t: any) => t.id === ticketId);
    if (!ticketOrigem) return;

    const etapaConfig = board[etapaDestino];
    const autoMsgText = etapaConfig?.enviarAuto
      ? `Mover para "${etapaConfig.title}" — uma mensagem automática será enviada ao cliente`
      : null;

    const confirmMsg = autoMsgText
      ? `${autoMsgText}\n\nConfirmar movimentação?`
      : `Mover para "${etapaConfig?.title || etapaDestino}"?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const { data: res } = await api.post(`/helpdesk/tickets/${ticketId}/move`, {
        etapa: etapaDestino,
        atribuirParaMim: etapaDestino === 'em_atendimento',
      });
      setAutoMessage(res.autoMessage);
      setTimeout(() => setAutoMessage(null), 5000);
      loadKanban();
      if (selectedTicketId === ticketId) loadTicketDetail(ticketId);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao mover ticket');
    } finally {
      setDragId(null);
      setDragFromEtapa(null);
    }
  };

  const sendMessage = async () => {
    if (!messageText.trim() || !ticketDetail?.ticket) return;
    setSendingMessage(true);
    try {
      await api.post('/whatsapp/send', {
        to: ticketDetail.ticket.contactPhone,
        message: messageText.trim(),
        ticketId: ticketDetail.ticket.id,
      });
      setMessageText('');
      loadTicketDetail(ticketDetail.ticket.id);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao enviar mensagem');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleAssign = async () => {
    if (!ticketDetail?.ticket || !assignTo) return;
    try {
      await api.patch(`/helpdesk/tickets/${ticketDetail.ticket.id}/atribuir`, { usuarioId: assignTo });
      setShowAssignModal(false);
      setAssignTo('');
      loadKanban();
      loadTicketDetail(ticketDetail.ticket.id);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao atribuir');
    }
  };

  const handleCreateOS = async () => {
    if (!ticketDetail?.ticket) return;
    const clientId = ticketDetail.ticket.client?.id;
    if (!clientId) {
      alert('Ticket sem cliente vinculado — vincule um cliente antes de gerar a OS');
      return;
    }
    try {
      const { data: os } = await api.post('/orders', {
        clientId,
        tipoServico: ticketDetail.ticket.assunto || 'Suporte Técnico',
        descricaoServico: `OS gerada a partir do ticket ${ticketDetail.ticket.protocolo || ''}`,
        ticketId: ticketDetail.ticket.id,
      });
      window.open(`/app/orders/${os.id}`, '_blank');
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao criar OS');
    }
  };

  const abrirModalAbrirChamado = () => {
    if (!ticketDetail?.ticket) return;
    setAbrirChamado({
      assunto: ticketDetail.ticket.assunto || '',
      categoria: ticketDetail.ticket.categoria || '',
      prioridade: ticketDetail.ticket.prioridade || 'media',
      tipo: ticketDetail.ticket.tipo || '',
      observacoes: ticketDetail.ticket.observacoes || '',
    });
    setShowAbrirChamado(true);
  };

  const confirmarAbrirChamado = async () => {
    if (!ticketDetail?.ticket || !abrirChamado.assunto.trim()) return;
    setAbrirSaving(true);
    try {
      await api.post(`/whatsapp/tickets/${ticketDetail.ticket.id}/abrir`, {
        assunto: abrirChamado.assunto.trim(),
        categoria: abrirChamado.categoria || undefined,
        prioridade: abrirChamado.prioridade,
        tipo: abrirChamado.tipo || undefined,
        observacoes: abrirChamado.observacoes.trim() || undefined,
      });
      setShowAbrirChamado(false);
      setAbrirChamado({ assunto: '', categoria: '', prioridade: 'media', tipo: '', observacoes: '' });
      loadTicketDetail(ticketDetail.ticket.id);
      loadKanban();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao abrir chamado');
    } finally {
      setAbrirSaving(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="animate-spin text-emerald-600" size={32} />
      </div>
    );
  }

  const totalTickets = Object.values(data.board).reduce((acc, c) => acc + c.total, 0);

  const filterItems = (items: any[]) => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((t) =>
      (t.contactName?.toLowerCase() || '').includes(q)
      || (t.contactPhone || '').includes(q)
      || (t.assunto?.toLowerCase() || '').includes(q)
      || (t.client?.razaoSocial?.toLowerCase() || '').includes(q)
      || (t.lastMessage?.content?.toLowerCase() || '').includes(q)
    );
  };

  return (
    <div className="space-y-4 h-[calc(100vh-7rem)] flex flex-col">
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
            <Stethoscope className="text-emerald-600" size={24} /> Helpdesk
          </h1>
          <p className="text-neutral-500 text-sm">
            {totalTickets} chamados ativos • {data.contagemEtapas.fila || 0} na fila • {data.contagemEtapas.em_atendimento || 0} em atendimento
          </p>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar cards (nome, msg, cliente...)"
            className="pl-8 pr-3 py-1.5 text-xs border border-neutral-200 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none w-72"
          />
        </div>
        <div className="flex items-center gap-2">
          {autoMessage && (
            <div className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 ${autoMessage.sent ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
              {autoMessage.sent ? <><CheckCircle size={12} /> Mensagem automática enviada</> : <><AlertTriangle size={12} /> {autoMessage.error || 'Sem mensagem automática'}</>}
            </div>
          )}
          <div className="relative">
            <ArrowUpDown size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <select
              value={orderBy}
              onChange={(e) => setOrderBy(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs border border-neutral-200 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none appearance-none bg-white cursor-pointer"
              title="Ordenar tickets dentro das colunas"
            >
              <option value="updatedAt_desc">Mais recente primeiro</option>
              <option value="updatedAt_asc">Mais antigo primeiro</option>
              <option value="dataAbertura_desc">Abertura (recente)</option>
              <option value="dataAbertura_asc">Abertura (antigo)</option>
              <option value="contactName_asc">Nome A-Z</option>
              <option value="contactName_desc">Nome Z-A</option>
              <option value="lastMessage_desc">Ultima msg (recente)</option>
              <option value="lastMessageCliente_desc">Ultima msg do cliente</option>
            </select>
          </div>
          <button onClick={loadKanban} className="btn-secondary text-sm flex items-center gap-1.5">
            <RefreshCw size={14} /> Atualizar
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        <div className="flex-1 overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-max h-full">
            {Object.values(data.board).map((coluna) => {
              const Icone = ETAPA_ICONES[coluna.icone] || Inbox;
              const isDropTarget = dragId !== null;
              return (
                <div
                  key={coluna.slug}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, coluna.slug)}
                  className={`w-72 flex-shrink-0 rounded-xl border-2 border-dashed bg-neutral-50/50 flex flex-col max-h-full transition-colors ${
                    isDropTarget ? 'border-emerald-300 bg-emerald-50/30' : 'border-transparent'
                  }`}
                  style={{ borderTopColor: coluna.cor, borderTopWidth: '3px' }}
                >
                  <div className="px-3 py-2.5 flex items-center gap-2 border-b border-neutral-200 bg-white rounded-t-xl">
                    <div className="w-7 h-7 rounded-md flex items-center justify-center text-white" style={{ backgroundColor: coluna.cor }}>
                      <Icone size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-navy-900 truncate">{coluna.title}</h3>
                    </div>
                    <span className="text-xs font-bold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full">{coluna.total}</span>
                    {coluna.enviarAuto && (
                      <span title="Envia mensagem automática" className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-medium">AUTO</span>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {(() => {
                      const items = filterItems(coluna.items);
                      if (coluna.items.length === 0) {
                        return (
                          <div className="text-center py-6 text-neutral-400 text-xs">
                            {isDropTarget ? 'Solte aqui' : 'Nenhum ticket'}
                          </div>
                        );
                      }
                      if (items.length === 0) {
                        return (
                          <div className="text-center py-6 text-neutral-400 text-xs">
                            Nenhum resultado para "{search}"
                          </div>
                        );
                      }
                      return items.map((ticket: any) => {
                      const isSelected = ticket.id === selectedTicketId;
                      return (
                        <div
                          key={ticket.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, ticket.id, coluna.slug)}
                          onDragEnd={handleDragEnd}
                          onClick={() => setSelectedTicketId(ticket.id)}
                          className={`bg-white rounded-lg border p-2.5 cursor-grab active:cursor-grabbing hover:shadow-md transition-all ${
                            isSelected ? 'border-emerald-400 shadow-md ring-1 ring-emerald-200' : 'border-neutral-200'
                          } ${dragId === ticket.id ? 'opacity-50' : ''}`}
                        >
                          <div className="flex items-start gap-2 mb-1.5">
                            <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                              <User size={12} className="text-emerald-700" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-navy-900 truncate">
                                {ticket.client?.razaoSocial || ticket.client?.nomeFantasia || ticket.contactName || 'Sem nome'}
                              </p>
                              {ticket.protocolo && (
                                <p className="text-[10px] text-neutral-400 font-mono">{ticket.protocolo}</p>
                              )}
                            </div>
                            {ticket._count?.orders > 0 && (
                              <span title="Possui OS" className="text-[10px] text-pink-600 bg-pink-50 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5">
                                <FileText size={9} /> {ticket._count.orders}
                              </span>
                            )}
                          </div>

                          {ticket.assunto && (
                            <p className="text-xs text-neutral-700 font-medium mb-1.5 line-clamp-2">{ticket.assunto}</p>
                          )}

                          <div className="flex flex-wrap gap-1 mb-1.5">
                            {ticket.categoria && (
                              <span className="text-[10px] text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded">
                                {ticket.categoria.replace(/_/g, ' ')}
                              </span>
                            )}
                            <span className="text-[10px] text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                              <MessageSquare size={9} /> {ticket._count?.messages || 0}
                            </span>
                          </div>

                          {ticket.lastMessage?.content && (
                            <p className="text-[11px] text-neutral-500 line-clamp-1 italic mb-1.5">
                              {ticket.lastMessage.fromMe ? '↪ ' : '↩ '}{ticket.lastMessage.content}
                            </p>
                          )}

                          <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-neutral-100">
                            {ticket.assignee ? (
                              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-medium truncate max-w-[100px]">
                                {ticket.assignee.name}
                              </span>
                            ) : (
                              <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-medium">
                                Sem analista
                              </span>
                            )}
                            <span className="text-[10px] text-neutral-400 flex items-center gap-0.5">
                              <Clock size={9} />
                              {Math.floor((Date.now() - new Date(ticket.updatedAt).getTime()) / 60000)}min
                            </span>
                          </div>
                        </div>
                      );
                    });
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {selectedTicketId && ticketDetail && (
          <div className="w-[420px] flex-shrink-0 bg-white rounded-xl border border-neutral-200 flex flex-col">
            <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <User size={14} className="text-emerald-700" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-navy-900 truncate">
                    {ticketDetail.ticket.client?.razaoSocial || ticketDetail.ticket.contactName || 'Sem nome'}
                  </h3>
                  <p className="text-[10px] text-neutral-500 font-mono">
                    {ticketDetail.ticket.protocolo}
                    {ticketDetail.ticket.contactPhone && <span className="ml-2"><Phone size={8} className="inline" /> {ticketDetail.ticket.contactPhone}</span>}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedTicketId(null)} className="p-1 hover:bg-neutral-100 rounded text-neutral-400">
                <X size={16} />
              </button>
            </div>

            <div className="px-4 py-2 border-b border-neutral-200 flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold text-white px-2 py-1 rounded uppercase" style={{ backgroundColor: data.board[ticketDetail.ticket.etapa as EtapaSlug]?.cor || '#64748b' }}>
                {data.board[ticketDetail.ticket.etapa as EtapaSlug]?.title || ticketDetail.ticket.etapa}
              </span>
              {ticketDetail.ticket.categoria && (
                <span className="text-[10px] text-neutral-700 bg-neutral-100 px-2 py-1 rounded font-medium flex items-center gap-0.5">
                  <Tag size={9} /> {ticketDetail.ticket.categoria.replace(/_/g, ' ')}
                </span>
              )}
              {ticketDetail.ticket.assignee ? (
                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-1 rounded font-medium">
                  {ticketDetail.ticket.assignee.name}
                </span>
              ) : (
                <button onClick={() => setShowAssignModal(true)} className="text-[10px] text-amber-700 bg-amber-50 px-2 py-1 rounded font-medium hover:bg-amber-100 flex items-center gap-0.5">
                  <UserPlus size={9} /> Atribuir
                </button>
              )}
              {ticketDetail.ticket.client?.id && (
                <button onClick={handleCreateOS} className="text-[10px] text-pink-700 bg-pink-50 px-2 py-1 rounded font-medium hover:bg-pink-100 flex items-center gap-0.5">
                  <ClipboardList size={9} /> Gerar OS
                </button>
              )}
              {!ticketDetail.ticket.protocolo && (
                <button onClick={abrirModalAbrirChamado} className="text-[10px] text-white bg-emerald-600 hover:bg-emerald-700 px-2 py-1 rounded font-medium flex items-center gap-0.5">
                  <Plus size={9} /> Abrir Chamado
                </button>
              )}
            </div>

            <div className="px-4 py-2 border-b border-neutral-200 bg-neutral-50/30 flex items-center gap-2 text-[11px] text-neutral-500">
              <Clock size={11} />
              {ticketDetail.ticket.dataInicioAtendimento ? (
                <span>Em atendimento há {formatarTempo(Math.floor((Date.now() - new Date(ticketDetail.ticket.dataInicioAtendimento).getTime()) / 60000))}</span>
              ) : (
                <span>Aguardando atendimento</span>
              )}
              {ticketDetail.stageEvents?.length > 0 && (
                <span className="ml-auto flex items-center gap-1 text-neutral-400">
                  <History size={11} /> {ticketDetail.stageEvents.length} eventos
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 bg-neutral-50/30 min-h-0">
              {detailLoading && (
                <div className="text-center py-2">
                  <RefreshCw size={14} className="animate-spin inline text-neutral-400" />
                </div>
              )}
              {ticketDetail.ticket.messages?.map((msg: any) => (
                <div key={msg.id} className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-xs ${
                    msg.fromMe
                      ? 'bg-emerald-500 text-white rounded-br-sm'
                      : 'bg-white border border-neutral-200 text-neutral-900 rounded-bl-sm'
                  } ${msg.content?.startsWith('[INTERNO]') ? 'opacity-50 italic' : ''}`}>
                    {msg.content?.startsWith('[INTERNO]') ? (
                      <span>🔒 {msg.content.replace('[INTERNO]', '').trim()}</span>
                    ) : (
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    )}
                    <p className={`text-[9px] mt-0.5 ${msg.fromMe ? 'text-white/70' : 'text-neutral-400'}`}>
                      {new Date(msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="px-3 py-2 border-t border-neutral-200 flex items-center gap-2">
              <input
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="Digite uma mensagem..."
                className="flex-1 text-xs border border-neutral-200 rounded-full px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
              <button
                onClick={sendMessage}
                disabled={!messageText.trim() || sendingMessage}
                className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center disabled:opacity-40 hover:bg-emerald-600 transition-colors"
              >
                <Send size={14} />
              </button>
            </div>

            {ticketDetail.stageEvents && ticketDetail.stageEvents.length > 0 && (
              <details className="px-3 py-2 border-t border-neutral-200 bg-neutral-50/30">
                <summary className="text-[10px] text-neutral-500 font-medium cursor-pointer flex items-center gap-1">
                  <History size={10} /> Histórico de movimentações ({ticketDetail.stageEvents.length})
                </summary>
                <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
                  {ticketDetail.stageEvents.map((ev: any) => (
                    <div key={ev.id} className="text-[10px] text-neutral-600 flex items-center gap-1.5">
                      <ArrowRight size={9} className="text-neutral-400" />
                      <span className="font-medium">{ev.etapaAnterior || 'novo'}</span>
                      <span>→</span>
                      <span className="font-bold text-navy-900">{ev.etapaNova}</span>
                      {ev.usuario && <span className="text-neutral-500">por {ev.usuario.name}</span>}
                      <span className="ml-auto text-neutral-400">
                        {new Date(ev.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </div>

      {showAssignModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={() => setShowAssignModal(false)}>
          <div className="bg-white rounded-xl p-5 w-full max-w-md mx-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-navy-900 flex items-center gap-2"><UserPlus size={16} /> Atribuir Analista</h3>
              <button onClick={() => setShowAssignModal(false)} className="text-neutral-400 hover:text-neutral-600"><X size={18} /></button>
            </div>
            <select value={assignTo} onChange={(e) => setAssignTo(e.target.value)} className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2.5">
              <option value="">Selecione um analista</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name} — {a.role}</option>)}
            </select>
            <button onClick={handleAssign} disabled={!assignTo} className="btn-primary w-full disabled:opacity-50">Atribuir</button>
          </div>
        </div>
      )}

      {showAbrirChamado && ticketDetail?.ticket && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={() => !abrirSaving && setShowAbrirChamado(false)}>
          <div className="bg-white rounded-xl p-5 w-full max-w-md mx-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-navy-900 flex items-center gap-2"><Plus size={16} className="text-emerald-600" /> Abrir Chamado</h3>
              <button onClick={() => setShowAbrirChamado(false)} disabled={abrirSaving} className="text-neutral-400 hover:text-neutral-600"><X size={18} /></button>
            </div>
            <p className="text-xs text-neutral-500">
              Ticket #{ticketDetail.ticket.id.slice(0, 8)} • {ticketDetail.ticket.contactName} ({ticketDetail.ticket.contactPhone})
            </p>
            <div>
              <label className="text-xs font-medium text-neutral-700 block mb-1">Assunto *</label>
              <input
                type="text"
                value={abrirChamado.assunto}
                onChange={(e) => setAbrirChamado({ ...abrirChamado, assunto: e.target.value })}
                placeholder="Ex: Erro no sistema de notas fiscais"
                className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-neutral-700 block mb-1">Categoria</label>
                <select
                  value={abrirChamado.categoria}
                  onChange={(e) => setAbrirChamado({ ...abrirChamado, categoria: e.target.value })}
                  className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2"
                >
                  <option value="">—</option>
                  <option value="suporte_tecnico">Suporte técnico</option>
                  <option value="financeiro">Financeiro</option>
                  <option value="comercial">Comercial</option>
                  <option value="cancelamento">Cancelamento</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-700 block mb-1">Prioridade</label>
                <select
                  value={abrirChamado.prioridade}
                  onChange={(e) => setAbrirChamado({ ...abrirChamado, prioridade: e.target.value })}
                  className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2"
                >
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-700 block mb-1">Tipo</label>
              <input
                type="text"
                value={abrirChamado.tipo}
                onChange={(e) => setAbrirChamado({ ...abrirChamado, tipo: e.target.value })}
                placeholder="Ex: Suporte N1, Atendimento comercial"
                className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-700 block mb-1">Observações</label>
              <textarea
                value={abrirChamado.observacoes}
                onChange={(e) => setAbrirChamado({ ...abrirChamado, observacoes: e.target.value })}
                rows={3}
                placeholder="Notas internas para o atendente"
                className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 resize-none"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowAbrirChamado(false)} disabled={abrirSaving} className="flex-1 px-4 py-2 text-sm border border-neutral-200 rounded-lg hover:bg-neutral-50 disabled:opacity-50">
                Cancelar
              </button>
              <button
                onClick={confirmarAbrirChamado}
                disabled={abrirSaving || !abrirChamado.assunto.trim()}
                className="flex-1 px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {abrirSaving ? <><RefreshCw size={14} className="animate-spin" /> Abrindo...</> : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
