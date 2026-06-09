import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import api from '../../services/api';
import { useAuth } from '../../services/auth';
import {
  RefreshCw, MessageSquare, User, Clock, Tag, FileText, Inbox, Bot,
  Headphones, CheckCircle, AlertTriangle, Phone, X, Send, ArrowRight,
  UserPlus, ClipboardList, History, Stethoscope, Building2, ArrowUpDown,
  Search, Plus, MoreVertical, Pencil, ArrowRightLeft,
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

const KanbanCard = memo(function KanbanCard({
  ticket,
  isSelected,
  isDragging,
  colunaSlug,
  board,
  openCardMenuId,
  onSelect,
  onDragStart,
  onDragEnd,
  onOpenMenu,
  onMoveTo,
  onAssignToMe,
  onDescartar,
  onViewDetail,
  onOpenAbrirChamado,
}: {
  ticket: any;
  isSelected: boolean;
  isDragging: boolean;
  colunaSlug: EtapaSlug;
  board: any;
  openCardMenuId: string | null;
  onSelect: (id: string) => void;
  onDragStart: (e: React.DragEvent, ticketId: string, etapa: EtapaSlug) => void;
  onDragEnd: () => void;
  onOpenMenu: (id: string | null) => void;
  onMoveTo: (ticketId: string, etapaSlug: string) => void;
  onAssignToMe: (ticketId: string) => void;
  onDescartar: (ticket: any) => void;
  onViewDetail: (id: string) => void;
  onOpenAbrirChamado: (ticket: any) => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, ticket.id, colunaSlug)}
      onDragEnd={onDragEnd}
      onClick={() => onSelect(ticket.id)}
      className={`bg-white rounded-lg border p-2.5 cursor-grab active:cursor-grabbing hover:shadow-md transition-all ${
        isSelected ? 'border-emerald-400 shadow-md ring-1 ring-emerald-200' : 'border-neutral-200'
      } ${isDragging ? 'opacity-40' : ''}`}
    >
      <div className="flex items-start gap-2 mb-1.5">
        <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
          <User size={12} className="text-emerald-700" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-navy-900 truncate">
            {ticket.contactName || 'Sem nome'}
          </p>
          {ticket.client && (
            <p className="text-[10px] text-neutral-500 truncate flex items-center gap-0.5">
              <Building2 size={8} /> {ticket.client.razaoSocial || ticket.client.nomeFantasia}
            </p>
          )}
          {ticket.protocolo && (
            <p className="text-[10px] text-neutral-400 font-mono">{ticket.protocolo}</p>
          )}
        </div>
        {ticket._count?.orders > 0 && (
          <span title="Possui OS" className="text-[10px] text-pink-600 bg-pink-50 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5">
            <FileText size={9} /> {ticket._count.orders}
          </span>
        )}
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => { e.stopPropagation(); onOpenMenu(openCardMenuId === ticket.id ? null : ticket.id); }}
            className="p-0.5 hover:bg-neutral-100 rounded text-neutral-400 hover:text-neutral-700"
            title="Ações"
          >
            <MoreVertical size={14} />
          </button>
          {openCardMenuId === ticket.id && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => onOpenMenu(null)} />
              <div className="absolute right-0 top-6 z-40 bg-white border border-neutral-200 rounded-lg shadow-lg w-52 py-1 text-xs">
                <div className="px-2.5 py-1.5 text-[10px] font-bold text-neutral-400 uppercase border-b border-neutral-100">
                  Mover para
                </div>
                {Object.values(board)
                  .filter((c: any) => c.slug !== colunaSlug)
                  .map((c: any) => (
                    <button
                      key={c.slug}
                      onClick={() => {
                        onOpenMenu(null);
                        if (c.slug === 'concluido') {
                          onOpenAbrirChamado(ticket);
                        } else {
                          onMoveTo(ticket.id, c.slug);
                        }
                      }}
                      className="w-full text-left px-2.5 py-1.5 hover:bg-neutral-50 flex items-center gap-2"
                    >
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.cor }} />
                      {c.title}
                    </button>
                  ))}
                <div className="border-t border-neutral-100 my-1" />
                {!ticket.assigneeId && (
                  <button
                    onClick={() => { onAssignToMe(ticket.id); onOpenMenu(null); }}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-neutral-50 flex items-center gap-2 text-emerald-700"
                  >
                    <UserPlus size={12} /> Atribuir a mim
                  </button>
                )}
                {!ticket.protocolo && colunaSlug === 'fila' && (
                  <>
                    <button
                      onClick={() => { onViewDetail(ticket.id); onOpenMenu(null); setTimeout(() => onOpenAbrirChamado(ticket), 100); }}
                      className="w-full text-left px-2.5 py-1.5 hover:bg-neutral-50 flex items-center gap-2 text-emerald-700"
                    >
                      <Plus size={12} /> Abrir Chamado
                    </button>
                    <button
                      onClick={() => { onDescartar(ticket); onOpenMenu(null); }}
                      className="w-full text-left px-2.5 py-1.5 hover:bg-neutral-50 flex items-center gap-2 text-zinc-700"
                    >
                      <X size={12} /> Descartar (sem msg)
                    </button>
                  </>
                )}
                <button
                  onClick={() => { onViewDetail(ticket.id); onOpenMenu(null); }}
                  className="w-full text-left px-2.5 py-1.5 hover:bg-neutral-50 flex items-center gap-2"
                >
                  <FileText size={12} /> Ver detalhes
                </button>
              </div>
            </>
          )}
        </div>
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
          {ticket.dataConclusao ? (
            <span title={`Concluído em ${new Date(ticket.dataConclusao).toLocaleString('pt-BR')}`}>
              0min
            </span>
          ) : (
            `${Math.floor((Date.now() - new Date(ticket.updatedAt).getTime()) / 60000)}min`
          )}
        </span>
      </div>
    </div>
  );
});

export default function HelpdeskKanban() {
  const { user } = useAuth();
  const [data, setData] = useState<HelpdeskKanbanData | null>(null);
  const [loading, setLoading] = useState(true);
  const dragIdRef = useRef<string | null>(null);
  const dragFromEtapaRef = useRef<EtapaSlug | null>(null);
  const [openCardMenuId, setOpenCardMenuId] = useState<string | null>(null);
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
  const [descartarSaving, setDescartarSaving] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState<any[]>([]);
  const [showCreateClient, setShowCreateClient] = useState(false);
  const [newClient, setNewClient] = useState({ razaoSocial: '', telefone: '', cnpj: '', email: '' });
  const [creatingClient, setCreatingClient] = useState(false);
  const [pendingDrop, setPendingDrop] = useState<{ ticketId: string; etapa: EtapaSlug; forConcluido?: boolean } | null>(null);
  const [showEditClient, setShowEditClient] = useState(false);
  const [editClientSearch, setEditClientSearch] = useState('');
  const [editClientResults, setEditClientResults] = useState<any[]>([]);
  const [editClientId, setEditClientId] = useState<string | null>(null);
  const [savingClient, setSavingClient] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
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
    if (isDragging) return;
    pollRef.current = setInterval(() => { loadKanban(); }, 10000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadKanban, isDragging]);

  useEffect(() => {
    if (selectedTicketId && !isDragging) {
      setDetailLoading(true);
      loadTicketDetail(selectedTicketId);
      if (detailPollRef.current) clearInterval(detailPollRef.current);
      detailPollRef.current = setInterval(() => loadTicketDetail(selectedTicketId), 5000);
    } else {
      setTicketDetail(null);
      if (detailPollRef.current) { clearInterval(detailPollRef.current); detailPollRef.current = null; }
    }
    return () => { if (detailPollRef.current) clearInterval(detailPollRef.current); };
  }, [selectedTicketId, loadTicketDetail, isDragging]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticketDetail?.ticket?.messages?.length]);

  useEffect(() => {
    if (!clientSearch.trim()) { setClientResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get('/crm/clients', { params: { search: clientSearch, limit: 8 } });
        setClientResults(Array.isArray(data) ? data : data?.clients || data?.items || []);
      } catch { setClientResults([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [clientSearch]);

  useEffect(() => {
    if (!showEditClient || !editClientSearch.trim()) { setEditClientResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get('/crm/clients', { params: { search: editClientSearch, limit: 8 } });
        setEditClientResults(Array.isArray(data) ? data : data?.clients || data?.items || []);
      } catch { setEditClientResults([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [editClientSearch, showEditClient]);

  const handleDragStart = useCallback((e: React.DragEvent, ticketId: string, etapaOrigem: EtapaSlug) => {
    dragIdRef.current = ticketId;
    dragFromEtapaRef.current = etapaOrigem;
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', ticketId);
  }, []);

  const handleDragEnd = useCallback(() => {
    dragIdRef.current = null;
    dragFromEtapaRef.current = null;
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, etapaDestino: EtapaSlug) => {
    e.preventDefault();
    const ticketId = dragIdRef.current || e.dataTransfer.getData('text/plain');
    const fromEtapa = dragFromEtapaRef.current;
    if (!ticketId || !data) return;
    if (fromEtapa === etapaDestino) return;

    const board = data.board;
    const ticketOrigem = Object.values(board).flatMap((c) => c.items).find((t: any) => t.id === ticketId);
    if (!ticketOrigem) return;

    const abrirModal = (opts?: { forConcluido?: boolean }) => {
      setPendingDrop({ ticketId, etapa: etapaDestino, forConcluido: opts?.forConcluido });
      setSelectedTicketId(ticketId);
      setAbrirChamado({
        assunto: ticketOrigem.assunto || '',
        categoria: ticketOrigem.categoria || '',
        prioridade: ticketOrigem.prioridade || 'media',
        tipo: ticketOrigem.tipo || '',
        observacoes: ticketOrigem.observacoes || '',
      });
      setSelectedClientId(ticketOrigem.client?.id || null);
      setClientSearch(ticketOrigem.client?.razaoSocial || ticketOrigem.contactName || '');
      setClientResults([]);
      setShowCreateClient(false);
      setShowAbrirChamado(true);
      dragIdRef.current = null;
      dragFromEtapaRef.current = null;
    };

    if (etapaDestino === 'em_atendimento' && !ticketOrigem.protocolo) {
      abrirModal();
      return;
    }

    if (etapaDestino === 'concluido') {
      abrirModal({ forConcluido: true });
      return;
    }

    // Atualização otimista: move ticket localmente imediatamente
    setData((prev) => {
      if (!prev) return prev;
      const newBoard = { ...prev.board };
      const origemCol = newBoard[fromEtapa!];
      const destCol = newBoard[etapaDestino];
      if (!origemCol || !destCol) return prev;

      const ticketIndex = origemCol.items.findIndex((t: any) => t.id === ticketId);
      if (ticketIndex === -1) return prev;

      const [ticketMovido] = origemCol.items.splice(ticketIndex, 1);
      ticketMovido.etapa = etapaDestino;
      ticketMovido.updatedAt = new Date().toISOString();
      destCol.items.unshift(ticketMovido);

      return {
        ...prev,
        board: {
          ...newBoard,
          [fromEtapa!]: { ...origemCol, total: origemCol.items.length },
          [etapaDestino]: { ...destCol, total: destCol.items.length },
        },
        contagemEtapas: {
          ...prev.contagemEtapas,
          [fromEtapa!]: Math.max(0, (prev.contagemEtapas[fromEtapa!] || 0) - 1),
          [etapaDestino]: (prev.contagemEtapas[etapaDestino] || 0) + 1,
        },
      };
    });

    try {
      const { data: res } = await api.post(`/helpdesk/tickets/${ticketId}/move`, {
        etapa: etapaDestino,
        atribuirParaMim: etapaDestino === 'em_atendimento',
      });
      setAutoMessage(res.autoMessage);
      setTimeout(() => setAutoMessage(null), 5000);
      // Sincroniza com servidor em background (sem bloquear UI)
      loadKanban();
      if (selectedTicketId === ticketId) loadTicketDetail(ticketId);
    } catch (err: any) {
      // Reverte em caso de erro
      loadKanban();
      alert(err?.response?.data?.error || 'Erro ao mover ticket');
    } finally {
      dragIdRef.current = null;
      dragFromEtapaRef.current = null;
    }
  }, [data, selectedTicketId, loadKanban, loadTicketDetail]);

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

  const abrirModalAbrirChamado = useCallback((ticket?: any) => {
    const t = ticket || ticketDetail?.ticket;
    if (!t) return;
    setAbrirChamado({
      assunto: t.assunto || '',
      categoria: t.categoria || '',
      prioridade: t.prioridade || 'media',
      tipo: t.tipo || '',
      observacoes: t.observacoes || '',
    });
    setSelectedClientId(t.client?.id || null);
    setClientSearch(t.client?.razaoSocial || t.contactName || '');
    setClientResults([]);
    setShowCreateClient(false);
    setShowAbrirChamado(true);
  }, [ticketDetail]);

  const confirmarAbrirChamado = async () => {
    if (!ticketDetail?.ticket || !abrirChamado.assunto.trim()) return;
    setAbrirSaving(true);
    try {
      if (pendingDrop?.forConcluido) {
        await api.post(`/helpdesk/tickets/${pendingDrop.ticketId}/move`, {
          etapa: 'concluido',
          clientId: selectedClientId || undefined,
        });
      } else {
        await api.post(`/whatsapp/tickets/${ticketDetail.ticket.id}/abrir`, {
          assunto: abrirChamado.assunto.trim(),
          categoria: abrirChamado.categoria || undefined,
          prioridade: abrirChamado.prioridade,
          tipo: abrirChamado.tipo || undefined,
          observacoes: abrirChamado.observacoes.trim() || undefined,
          clientId: selectedClientId || undefined,
        });
        if (pendingDrop) {
          await api.post(`/helpdesk/tickets/${pendingDrop.ticketId}/move`, {
            etapa: pendingDrop.etapa,
            atribuirParaMim: true,
            clientId: selectedClientId || undefined,
          });
        }
      }
      setPendingDrop(null);
      setShowAbrirChamado(false);
      setAbrirChamado({ assunto: '', categoria: '', prioridade: 'media', tipo: '', observacoes: '' });
      setSelectedClientId(null);
      setClientSearch('');
      loadTicketDetail(ticketDetail.ticket.id);
      loadKanban();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao abrir chamado');
    } finally {
      setAbrirSaving(false);
    }
  };

  const criarClienteInline = async () => {
    if (!newClient.razaoSocial.trim()) return;
    setCreatingClient(true);
    try {
      const { data } = await api.post('/crm/clients', {
        razaoSocial: newClient.razaoSocial.trim(),
        telefone: newClient.telefone.trim() || undefined,
        cnpj: newClient.cnpj.trim() || undefined,
        email: newClient.email.trim() || undefined,
      });
      setSelectedClientId(data.id);
      setClientSearch(data.razaoSocial);
      setNewClient({ razaoSocial: '', telefone: '', cnpj: '', email: '' });
      setShowCreateClient(false);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao criar cliente');
    } finally {
      setCreatingClient(false);
    }
  };

  const salvarClienteTicket = async () => {
    if (!ticketDetail?.ticket) return;
    setSavingClient(true);
    try {
      const { data } = await api.patch(`/helpdesk/tickets/${ticketDetail.ticket.id}/client`, {
        clientId: editClientId || null,
      });
      setShowEditClient(false);
      setEditClientId(null);
      setEditClientSearch('');
      loadTicketDetail(ticketDetail.ticket.id);
      loadKanban();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao atualizar cliente');
    } finally {
      setSavingClient(false);
    }
  };

  const descartarTicket = async () => {
    if (!ticketDetail?.ticket) return;
    if (!window.confirm(`Descartar ticket de ${ticketDetail.ticket.contactName}?\n\nNenhuma mensagem sera enviada ao cliente. O ticket sera movido para "Descartados".`)) return;
    setDescartarSaving(true);
    try {
      await api.post(`/whatsapp/tickets/${ticketDetail.ticket.id}/descartar`);
      setSelectedTicketId(null);
      loadKanban();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao descartar ticket');
    } finally {
      setDescartarSaving(false);
    }
  };

  const descartarTicketDireto = async (ticket: any) => {
    if (!window.confirm(`Descartar ticket de ${ticket.contactName}?\n\nNenhuma mensagem sera enviada ao cliente. O ticket sera movido para "Descartados".`)) return;
    try {
      await api.post(`/whatsapp/tickets/${ticket.id}/descartar`);
      loadKanban();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao descartar ticket');
    }
  };

  const moverTicketDireto = useCallback(async (ticketId: string, etapaSlug: string) => {
    const destino = etapaSlug as EtapaSlug;
    // Atualização otimista
    setData((prev) => {
      if (!prev) return prev;
      const newBoard = { ...prev.board };
      let ticketMovido: any = null;
      let origemSlug: EtapaSlug | null = null;

      for (const slug of Object.keys(newBoard) as EtapaSlug[]) {
        const idx = newBoard[slug].items.findIndex((t: any) => t.id === ticketId);
        if (idx !== -1) {
          ticketMovido = newBoard[slug].items.splice(idx, 1)[0];
          origemSlug = slug;
          break;
        }
      }
      if (!ticketMovido || !origemSlug || origemSlug === destino) return prev;

      ticketMovido.etapa = destino;
      ticketMovido.updatedAt = new Date().toISOString();
      newBoard[destino].items.unshift(ticketMovido);

      return {
        ...prev,
        board: {
          ...newBoard,
          [origemSlug]: { ...newBoard[origemSlug], total: newBoard[origemSlug].items.length },
          [destino]: { ...newBoard[destino], total: newBoard[destino].items.length },
        },
        contagemEtapas: {
          ...prev.contagemEtapas,
          [origemSlug]: Math.max(0, (prev.contagemEtapas[origemSlug] || 0) - 1),
          [destino]: (prev.contagemEtapas[destino] || 0) + 1,
        },
      };
    });

    try {
      await api.post(`/helpdesk/tickets/${ticketId}/move`, { etapa: etapaSlug });
      loadKanban();
      if (selectedTicketId === ticketId) loadTicketDetail(ticketId);
    } catch (err: any) {
      loadKanban();
      alert(err?.response?.data?.error || 'Erro ao mover ticket');
    }
  }, [selectedTicketId, loadKanban, loadTicketDetail]);

  const handleAssignToMe = async (ticketId: string) => {
    try {
      await api.patch(`/helpdesk/tickets/${ticketId}/atribuir`, { usuarioId: user?.id });
      loadKanban();
      if (selectedTicketId === ticketId) loadTicketDetail(ticketId);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao atribuir ticket');
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

  const searchLower = search.toLowerCase().trim();

  return (
    <div className="space-y-3 sm:space-y-4 h-[calc(100vh-7rem)] flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-navy-900 flex items-center gap-2">
            <Stethoscope className="text-emerald-600" size={24} /> Helpdesk
          </h1>
          <p className="text-neutral-500 text-xs sm:text-sm">
            {totalTickets} chamados ativos • {data.contagemEtapas.fila || 0} na fila • {data.contagemEtapas.em_atendimento || 0} em atendimento
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:flex-none min-w-0">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrar..."
              className="w-full sm:w-72 pl-8 pr-3 py-2 min-h-[40px] text-xs border border-neutral-200 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>
          {autoMessage && (
            <div className={`text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 ${autoMessage.sent ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
              {autoMessage.sent ? <><CheckCircle size={12} /> Enviada</> : <><AlertTriangle size={12} /> {autoMessage.error || 'Sem auto'}</>}
            </div>
          )}
          <div className="relative">
            <ArrowUpDown size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <select
              value={orderBy}
              onChange={(e) => setOrderBy(e.target.value)}
              className="pl-8 pr-3 py-2 min-h-[40px] text-xs border border-neutral-200 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none appearance-none bg-white cursor-pointer"
              title="Ordenar tickets"
            >
              <option value="updatedAt_desc">Mais recente</option>
              <option value="updatedAt_asc">Mais antigo</option>
              <option value="dataAbertura_desc">Abertura (recente)</option>
              <option value="dataAbertura_asc">Abertura (antigo)</option>
              <option value="contactName_asc">Nome A-Z</option>
              <option value="contactName_desc">Nome Z-A</option>
              <option value="lastMessage_desc">Ultima msg</option>
              <option value="lastMessageCliente_desc">Msg cliente</option>
            </select>
          </div>
          <button onClick={loadKanban} className="btn-secondary text-sm min-h-[40px] px-3 flex items-center gap-1.5">
            <RefreshCw size={14} /> <span className="hidden sm:inline">Atualizar</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        <div className="flex-1 overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-max h-full">
            {Object.values(data.board).map((coluna) => {
              const Icone = ETAPA_ICONES[coluna.icone] || Inbox;
              const isDropTarget = isDragging;

              const items = searchLower
                ? coluna.items.filter((t: any) =>
                    (t.contactName?.toLowerCase() || '').includes(searchLower)
                    || (t.contactPhone || '').includes(searchLower)
                    || (t.assunto?.toLowerCase() || '').includes(searchLower)
                    || (t.client?.razaoSocial?.toLowerCase() || '').includes(searchLower)
                    || (t.lastMessage?.content?.toLowerCase() || '').includes(searchLower)
                  )
                : coluna.items;

              return (
                <div
                  key={coluna.slug}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, coluna.slug)}
                  className={`w-64 sm:w-72 flex-shrink-0 rounded-xl border-2 border-dashed bg-neutral-50/50 flex flex-col max-h-full transition-colors ${
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
                    {coluna.items.length === 0 ? (
                      <div className="text-center py-6 text-neutral-400 text-xs">
                        {isDropTarget ? 'Solte aqui' : 'Nenhum ticket'}
                      </div>
                    ) : items.length === 0 ? (
                      <div className="text-center py-6 text-neutral-400 text-xs">
                        Nenhum resultado para "{search}"
                      </div>
                    ) : (
                      items.map((ticket: any) => (
                        <KanbanCard
                          key={ticket.id}
                          ticket={ticket}
                          isSelected={ticket.id === selectedTicketId}
                          isDragging={dragIdRef.current === ticket.id}
                          colunaSlug={coluna.slug}
                          board={data.board}
                          openCardMenuId={openCardMenuId}
                          onSelect={setSelectedTicketId}
                          onDragStart={handleDragStart}
                          onDragEnd={handleDragEnd}
                          onOpenMenu={setOpenCardMenuId}
                          onMoveTo={moverTicketDireto}
                          onAssignToMe={handleAssignToMe}
                          onDescartar={descartarTicketDireto}
                          onViewDetail={setSelectedTicketId}
                          onOpenAbrirChamado={abrirModalAbrirChamado}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {selectedTicketId && ticketDetail && (
          <div className="fixed inset-0 md:static md:inset-auto z-40 bg-white md:bg-transparent md:w-[420px] flex-shrink-0 border border-neutral-200 md:rounded-xl flex flex-col md:max-h-full">
            <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <User size={14} className="text-emerald-700" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-navy-900 truncate">
                    {ticketDetail.ticket.contactName || 'Sem nome'}
                  </h3>
                  <div className="flex items-center gap-1">
                    {ticketDetail.ticket.client ? (
                      <p className="text-[10px] text-neutral-500 truncate flex items-center gap-1">
                        <Building2 size={9} /> {ticketDetail.ticket.client.razaoSocial || ticketDetail.ticket.client.nomeFantasia}
                      </p>
                    ) : (
                      <p className="text-[10px] text-amber-600 italic">Sem empresa vinculada</p>
                    )}
                    <button
                      onClick={() => {
                        setEditClientId(ticketDetail.ticket.client?.id || null);
                        setEditClientSearch(ticketDetail.ticket.client?.razaoSocial || '');
                        setShowEditClient(true);
                      }}
                      className="text-neutral-400 hover:text-emerald-600 p-0.5 rounded flex-shrink-0"
                      title="Editar cliente vinculado"
                    >
                      <Pencil size={10} />
                    </button>
                  </div>
                  <p className="text-[10px] text-neutral-500 font-mono">
                    {ticketDetail.ticket.protocolo}
                    {ticketDetail.ticket.contactPhone && <span className="ml-2"><Phone size={8} className="inline" /> {ticketDetail.ticket.contactPhone}</span>}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedTicketId(null)} className="p-1.5 hover:bg-neutral-100 rounded text-neutral-400 min-h-[44px] min-w-[44px] flex items-center justify-center md:min-h-0 md:min-w-0">
                <X size={18} />
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
                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-1 rounded font-medium flex items-center gap-1">
                  {ticketDetail.ticket.assignee.name}
                  <button onClick={() => setShowAssignModal(true)} className="text-emerald-500 hover:text-emerald-700 ml-0.5" title="Transferir para outro analista">
                    <ArrowRightLeft size={10} />
                  </button>
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
                <>
                  <button onClick={() => abrirModalAbrirChamado()} className="text-[10px] text-white bg-emerald-600 hover:bg-emerald-700 px-2 py-1 rounded font-medium flex items-center gap-0.5">
                    <Plus size={9} /> Abrir Chamado
                  </button>
                  <button
                    onClick={descartarTicket}
                    disabled={descartarSaving}
                    className="text-[10px] text-zinc-700 bg-zinc-100 hover:bg-zinc-200 px-2 py-1 rounded font-medium flex items-center gap-0.5 disabled:opacity-50"
                    title="Descartar ticket sem avisar o cliente"
                  >
                    {descartarSaving ? <RefreshCw size={9} className="animate-spin" /> : <X size={9} />} Descartar
                  </button>
                </>
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
              <h3 className="font-bold text-navy-900 flex items-center gap-2">
                <UserPlus size={16} /> {ticketDetail?.ticket?.assignee ? 'Transferir Chamado' : 'Atribuir Analista'}
              </h3>
              <button onClick={() => setShowAssignModal(false)} className="text-neutral-400 hover:text-neutral-600"><X size={18} /></button>
            </div>
            {ticketDetail?.ticket?.assignee && (
              <p className="text-xs text-neutral-500 bg-neutral-50 px-3 py-2 rounded-lg">
                Atual: <span className="font-medium text-neutral-700">{ticketDetail.ticket.assignee.name}</span>
              </p>
            )}
            <select value={assignTo} onChange={(e) => setAssignTo(e.target.value)} className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2.5">
              <option value="">Selecione um analista</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name} — {a.role}</option>)}
            </select>
            <button onClick={handleAssign} disabled={!assignTo} className="btn-primary w-full disabled:opacity-50">
              {ticketDetail?.ticket?.assignee ? 'Transferir' : 'Atribuir'}
            </button>
          </div>
        </div>
      )}

      {showAbrirChamado && ticketDetail?.ticket && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => { if (!abrirSaving) { setShowAbrirChamado(false); setPendingDrop(null); } }}>
          <div className="bg-white rounded-t-2xl sm:rounded-xl sm:max-w-lg w-full max-h-[92vh] sm:max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white z-10 px-4 sm:px-5 pt-4 sm:pt-5 pb-3 border-b border-neutral-100">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-navy-900 flex items-center gap-2 text-base">
                  <Plus size={18} className="text-emerald-600" />
                  {pendingDrop?.forConcluido ? 'Finalizar Chamado' : pendingDrop ? 'Mover para Em Atendimento' : 'Abrir Chamado'}
                </h3>
                <button onClick={() => { setShowAbrirChamado(false); setPendingDrop(null); }} disabled={abrirSaving} className="text-neutral-400 hover:text-neutral-600 p-1"><X size={20} /></button>
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                {ticketDetail.ticket.contactName} ({ticketDetail.ticket.contactPhone})
              </p>
            </div>

            <div className="px-4 sm:px-5 py-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-neutral-700 block mb-1.5">Cliente vinculado</label>
                {selectedClientId ? (
                  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                    <Building2 size={14} className="text-emerald-600 flex-shrink-0" />
                    <span className="text-sm text-emerald-800 font-medium flex-1 truncate">{clientSearch}</span>
                    <button onClick={() => { setSelectedClientId(null); setClientSearch(''); }} className="text-emerald-600 hover:text-emerald-800 p-0.5" title="Remover"><X size={14} /></button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={clientSearch}
                        onChange={(e) => { setClientSearch(e.target.value); setSelectedClientId(null); }}
                        placeholder="Buscar cliente por nome, CNPJ ou telefone..."
                        className="w-full pl-9 pr-3 py-2.5 min-h-[44px] text-sm border border-neutral-200 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      />
                    </div>
                    {clientResults.length > 0 && !selectedClientId && (
                      <div className="border border-neutral-200 rounded-lg max-h-40 overflow-y-auto divide-y divide-neutral-100">
                        {clientResults.map((c: any) => (
                          <button
                            key={c.id}
                            onClick={() => { setSelectedClientId(c.id); setClientSearch(c.razaoSocial); setClientResults([]); }}
                            className="w-full text-left px-3 py-2.5 hover:bg-emerald-50 transition-colors flex items-center gap-2 min-h-[44px]"
                          >
                            <Building2 size={14} className="text-neutral-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-navy-900 truncate">{c.razaoSocial}</p>
                              {c.telefone && <p className="text-[11px] text-neutral-500">{c.telefone}</p>}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {clientSearch && !selectedClientId && clientResults.length === 0 && clientSearch.length >= 2 && (
                      <button
                        onClick={() => { setNewClient({ razaoSocial: clientSearch, telefone: ticketDetail?.ticket?.contactPhone || '', cnpj: '', email: '' }); setShowCreateClient(true); }}
                        className="w-full text-left px-3 py-2.5 border border-dashed border-emerald-300 rounded-lg text-sm text-emerald-700 hover:bg-emerald-50 transition-colors flex items-center gap-2 min-h-[44px]"
                      >
                        <Plus size={14} /> Criar cliente "{clientSearch}"
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-700 block mb-1.5">Assunto *</label>
                <input
                  type="text"
                  value={abrirChamado.assunto}
                  onChange={(e) => setAbrirChamado({ ...abrirChamado, assunto: e.target.value })}
                  placeholder="Ex: Erro no sistema de notas fiscais"
                  className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2.5 min-h-[44px] focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-neutral-700 block mb-1.5">Categoria</label>
                  <select
                    value={abrirChamado.categoria}
                    onChange={(e) => setAbrirChamado({ ...abrirChamado, categoria: e.target.value })}
                    className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2.5 min-h-[44px]"
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
                  <label className="text-xs font-medium text-neutral-700 block mb-1.5">Prioridade</label>
                  <select
                    value={abrirChamado.prioridade}
                    onChange={(e) => setAbrirChamado({ ...abrirChamado, prioridade: e.target.value })}
                    className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2.5 min-h-[44px]"
                  >
                    <option value="baixa">Baixa</option>
                    <option value="media">Média</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-700 block mb-1.5">Tipo</label>
                <input
                  type="text"
                  value={abrirChamado.tipo}
                  onChange={(e) => setAbrirChamado({ ...abrirChamado, tipo: e.target.value })}
                  placeholder="Ex: Suporte N1, Atendimento comercial"
                  className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2.5 min-h-[44px]"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-700 block mb-1.5">Observações</label>
                <textarea
                  value={abrirChamado.observacoes}
                  onChange={(e) => setAbrirChamado({ ...abrirChamado, observacoes: e.target.value })}
                  rows={3}
                  placeholder="Notas internas para o atendente"
                  className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2.5 resize-none min-h-[80px]"
                />
              </div>
            </div>

            <div className="sticky bottom-0 bg-white px-4 sm:px-5 py-3 border-t border-neutral-100 flex gap-2">
              <button onClick={() => { setShowAbrirChamado(false); setPendingDrop(null); }} disabled={abrirSaving} className="flex-1 px-4 py-2.5 min-h-[44px] text-sm border border-neutral-200 rounded-lg hover:bg-neutral-50 disabled:opacity-50">
                Cancelar
              </button>
              <button
                onClick={confirmarAbrirChamado}
                disabled={abrirSaving || !abrirChamado.assunto.trim()}
                className="flex-1 px-4 py-2.5 min-h-[44px] text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {abrirSaving ? <><RefreshCw size={14} className="animate-spin" /> Salvando...</> : pendingDrop?.forConcluido ? 'Finalizar' : pendingDrop ? 'Mover e Abrir' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateClient && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => !creatingClient && setShowCreateClient(false)}>
          <div className="bg-white rounded-t-2xl sm:rounded-xl sm:max-w-md w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 sm:px-5 pt-4 sm:pt-5 pb-3 border-b border-neutral-100">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-navy-900 flex items-center gap-2 text-base"><Building2 size={18} className="text-emerald-600" /> Novo Cliente</h3>
                <button onClick={() => setShowCreateClient(false)} disabled={creatingClient} className="text-neutral-400 hover:text-neutral-600 p-1"><X size={20} /></button>
              </div>
            </div>
            <div className="px-4 sm:px-5 py-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-neutral-700 block mb-1.5">Razão Social *</label>
                <input type="text" value={newClient.razaoSocial} onChange={(e) => setNewClient({ ...newClient, razaoSocial: e.target.value })} className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2.5 min-h-[44px] focus:ring-1 focus:ring-emerald-500 outline-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-700 block mb-1.5">Telefone</label>
                <input type="text" value={newClient.telefone} onChange={(e) => setNewClient({ ...newClient, telefone: e.target.value })} placeholder="5511999999999" className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2.5 min-h-[44px] focus:ring-1 focus:ring-emerald-500 outline-none" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-neutral-700 block mb-1.5">CNPJ</label>
                  <input type="text" value={newClient.cnpj} onChange={(e) => setNewClient({ ...newClient, cnpj: e.target.value })} className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2.5 min-h-[44px] focus:ring-1 focus:ring-emerald-500 outline-none" />
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-700 block mb-1.5">Email</label>
                  <input type="email" value={newClient.email} onChange={(e) => setNewClient({ ...newClient, email: e.target.value })} className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2.5 min-h-[44px] focus:ring-1 focus:ring-emerald-500 outline-none" />
                </div>
              </div>
            </div>
            <div className="sticky bottom-0 bg-white px-4 sm:px-5 py-3 border-t border-neutral-100 flex gap-2">
              <button onClick={() => setShowCreateClient(false)} disabled={creatingClient} className="flex-1 px-4 py-2.5 min-h-[44px] text-sm border border-neutral-200 rounded-lg hover:bg-neutral-50 disabled:opacity-50">Cancelar</button>
              <button onClick={criarClienteInline} disabled={creatingClient || !newClient.razaoSocial.trim()} className="flex-1 px-4 py-2.5 min-h-[44px] text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-1.5">
                {creatingClient ? <><RefreshCw size={14} className="animate-spin" /> Criando...</> : 'Criar e Vincular'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditClient && ticketDetail?.ticket && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => !savingClient && setShowEditClient(false)}>
          <div className="bg-white rounded-t-2xl sm:rounded-xl sm:max-w-md w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 sm:px-5 pt-4 sm:pt-5 pb-3 border-b border-neutral-100">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-navy-900 flex items-center gap-2 text-base"><Building2 size={18} className="text-emerald-600" /> Editar Cliente do Ticket</h3>
                <button onClick={() => setShowEditClient(false)} disabled={savingClient} className="text-neutral-400 hover:text-neutral-600 p-1"><X size={20} /></button>
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                {ticketDetail.ticket.contactName} ({ticketDetail.ticket.contactPhone})
              </p>
            </div>
            <div className="px-4 sm:px-5 py-4 space-y-3">
              {editClientId && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  <Building2 size={14} className="text-emerald-600 flex-shrink-0" />
                  <span className="text-sm text-emerald-800 font-medium flex-1 truncate">{editClientSearch}</span>
                  <button onClick={() => { setEditClientId(null); setEditClientSearch(''); }} className="text-emerald-600 hover:text-emerald-800 p-0.5" title="Desvincular"><X size={14} /></button>
                </div>
              )}
              {!editClientId && (
                <div className="space-y-2">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={editClientSearch}
                      onChange={(e) => { setEditClientSearch(e.target.value); setEditClientId(null); }}
                      placeholder="Buscar cliente por nome, CNPJ ou telefone..."
                      className="w-full pl-9 pr-3 py-2.5 min-h-[44px] text-sm border border-neutral-200 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      autoFocus
                    />
                  </div>
                  {editClientResults.length > 0 && (
                    <div className="border border-neutral-200 rounded-lg max-h-40 overflow-y-auto divide-y divide-neutral-100">
                      {editClientResults.map((c: any) => (
                        <button
                          key={c.id}
                          onClick={() => { setEditClientId(c.id); setEditClientSearch(c.razaoSocial); setEditClientResults([]); }}
                          className="w-full text-left px-3 py-2.5 hover:bg-emerald-50 transition-colors flex items-center gap-2 min-h-[44px]"
                        >
                          <Building2 size={14} className="text-neutral-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-navy-900 truncate">{c.razaoSocial}</p>
                            {c.telefone && <p className="text-[11px] text-neutral-500">{c.telefone}</p>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {editClientSearch && editClientResults.length === 0 && editClientSearch.length >= 2 && (
                    <p className="text-xs text-neutral-500 text-center py-2">Nenhum cliente encontrado</p>
                  )}
                </div>
              )}
              {editClientId && (
                <p className="text-xs text-neutral-500 text-center">
                  Selecione outro cliente ou clique no X para desvincular
                </p>
              )}
            </div>
            <div className="sticky bottom-0 bg-white px-4 sm:px-5 py-3 border-t border-neutral-100 flex gap-2">
              <button onClick={() => setShowEditClient(false)} disabled={savingClient} className="flex-1 px-4 py-2.5 min-h-[44px] text-sm border border-neutral-200 rounded-lg hover:bg-neutral-50 disabled:opacity-50">Cancelar</button>
              <button onClick={salvarClienteTicket} disabled={savingClient} className="flex-1 px-4 py-2.5 min-h-[44px] text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-1.5">
                {savingClient ? <><RefreshCw size={14} className="animate-spin" /> Salvando...</> : editClientId ? 'Vincular' : 'Desvincular'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
