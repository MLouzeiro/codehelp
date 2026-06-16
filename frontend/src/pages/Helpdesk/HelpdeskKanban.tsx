import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../services/auth';
import { playSound, initAudioContext } from '../../services/soundAlerts';
import { isAlertSoundEnabled } from '../Settings/AlertSettings';
import {
  RefreshCw, MessageSquare, User, Clock, Tag, FileText, Inbox, Bot,
  Headphones, CheckCircle, AlertTriangle, Phone, X, Send, ArrowRight,
  UserPlus, ClipboardList, History, Stethoscope, Building2, ArrowUpDown,
  Search, Plus, MoreVertical, Pencil, ArrowRightLeft, Bluetooth, BluetoothOff,
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
      className={`bg-white rounded-xl border p-3 cursor-grab active:cursor-grabbing hover:shadow-xl hover:-translate-y-1 transition-all duration-200 group ${
        isSelected 
          ? 'border-emerald-400 shadow-lg ring-2 ring-emerald-100 bg-gradient-to-br from-white to-emerald-50/30' 
          : 'border-neutral-200/80 hover:border-neutral-300 shadow-sm'
      } ${isDragging ? 'opacity-40 scale-95 rotate-2' : ''}`}
      style={{
        borderLeftWidth: '4px',
        borderLeftColor: ticket.prioridade === 'urgente' ? '#ef4444'
          : ticket.prioridade === 'alta' ? '#f59e0b'
          : ticket.prioridade === 'media' ? '#3b82f6'
          : '#10b981',
      }}
    >
      <div className="flex items-start gap-2.5 mb-2">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-sm">
          <User size={14} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-navy-900 truncate leading-tight">
            {ticket.contactName || 'Sem nome'}
          </p>
          {ticket.client && (
            <Link to={`/app/crm/${ticket.client.id}`} onClick={(e) => e.stopPropagation()}
              className="text-[11px] text-blue-600 hover:text-blue-800 truncate flex items-center gap-1 hover:underline mt-0.5">
              <Building2 size={10} /> {ticket.client.razaoSocial || ticket.client.nomeFantasia}
            </Link>
          )}
          {ticket.protocolo && (
            <p className="text-[10px] text-neutral-400 font-mono mt-0.5">{ticket.protocolo}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          {ticket._count?.orders > 0 && (
            <span title="Possui OS" className="text-[10px] text-pink-600 bg-pink-50 px-1.5 py-0.5 rounded-md font-medium flex items-center gap-0.5">
              <FileText size={9} /> {ticket._count.orders}
            </span>
          )}
          {colunaSlug === 'fila' && ticket.filaOrder && (
            <span title={`Posição na fila: ${ticket.filaOrder}º`} className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md font-bold">
              #{ticket.filaOrder}º
            </span>
          )}
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={(e) => { e.stopPropagation(); onOpenMenu(openCardMenuId === ticket.id ? null : ticket.id); }}
              className="p-1 hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-neutral-700 opacity-0 group-hover:opacity-100 transition-opacity"
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
                      <UserPlus size={12} /> Assumir
                    </button>
                  )}
                  {colunaSlug === 'triagem' && (
                    <button
                      onClick={() => { onViewDetail(ticket.id); onOpenMenu(null); setTimeout(() => onOpenAbrirChamado(ticket), 100); }}
                      className="w-full text-left px-2.5 py-1.5 hover:bg-neutral-50 flex items-center gap-2 text-violet-700"
                    >
                      <ArrowRight size={12} /> Encaminhar para Fila
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
      </div>

      {ticket.assunto && (
        <p className="text-[13px] text-neutral-700 font-semibold mb-2 line-clamp-2 leading-snug">{ticket.assunto}</p>
      )}

      <div className="flex flex-wrap gap-1.5 mb-2">
        {ticket.departamento && (
          <span className="text-[10px] text-white px-2 py-0.5 rounded-md font-semibold shadow-sm" style={{ backgroundColor: ticket.departamento.cor || '#64748b' }}>
            {ticket.departamento.nome}
          </span>
        )}
        {ticket.categoria && (
          <span className="text-[10px] text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded-md font-medium">
            {ticket.categoria.replace(/_/g, ' ')}
          </span>
        )}
        <span className="text-[10px] text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-md flex items-center gap-1">
          <MessageSquare size={10} /> {ticket._count?.messages || 0}
        </span>
      </div>

      {ticket.lastMessage?.content && (
        <div className={`text-[11px] line-clamp-1 mb-2 px-2 py-1.5 rounded-lg ${
          ticket.lastMessage.source === 'bot' || ticket.lastMessage.tipo === 'system'
            ? 'bg-violet-50 text-violet-600 border border-violet-100'
            : 'bg-neutral-50 text-neutral-600 border border-neutral-100'
        }`}>
          {ticket.lastMessage.source === 'bot' || ticket.lastMessage.tipo === 'system' ? '🤖 ' : ticket.lastMessage.fromMe ? '↪ ' : '↩ '}{ticket.lastMessage.content}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-2 border-t border-neutral-100/80">
        {ticket.assignee ? (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
              <span className="text-[8px] font-bold text-emerald-700">{ticket.assignee.name.charAt(0).toUpperCase()}</span>
            </div>
            <span className="text-[10px] text-emerald-700 font-semibold truncate max-w-[80px]">
              {ticket.assignee.name.split(' ')[0]}
            </span>
          </div>
        ) : colunaSlug === 'fila' ? (
          <button
            onClick={(e) => { e.stopPropagation(); onAssignToMe(ticket.id); }}
            className="text-[10px] text-white bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 px-2.5 py-1 rounded-lg font-semibold transition-all shadow-sm hover:shadow"
            title="Assumir atendimento"
          >
            Assumir
          </button>
        ) : (
          <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md font-semibold">
            Sem analista
          </span>
        )}
        <span className="text-[10px] text-neutral-400 flex items-center gap-1 bg-neutral-50 px-1.5 py-0.5 rounded">
          <Clock size={10} />
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
  const [searchParams] = useSearchParams();
  const [autoMessage, setAutoMessage] = useState<{ sent: boolean; error?: string } | null>(null);
  const [filterDept, setFilterDept] = useState<string>('');
  const [showAbrirChamado, setShowAbrirChamado] = useState(false);
  const [abrirChamado, setAbrirChamado] = useState({
    assunto: '',
    categoria: '',
    prioridade: 'media',
    tipo: '',
    observacoes: '',
    departamentoId: '',
  });
  const [abrirSaving, setAbrirSaving] = useState(false);
  const [departamentos, setDepartamentos] = useState<any[]>([]);
  const [descartarSaving, setDescartarSaving] = useState(false);
  const [waConnected, setWaConnected] = useState<boolean | null>(null);
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
  const firstKanbanLoadRef = useRef(false);
  const prevTicketCountRef = useRef(0);
  const prevMessagesCountRef = useRef(0);

  useEffect(() => { initAudioContext(); }, []);

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

  const loadDepartamentos = useCallback(async () => {
    try {
      const params: any = {};
      if (user?.role === 'tecnico') params.mine = 'true';
      const { data } = await api.get('/helpdesk/departamentos', { params });
      setDepartamentos(data.filter((d: any) => d.ativo));
    } catch { }
  }, [user?.role]);

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
    loadDepartamentos();
  }, [loadKanban, loadAgents, loadDepartamentos]);

  useEffect(() => {
    const ticketParam = searchParams.get('ticket');
    if (ticketParam) {
      setSelectedTicketId(ticketParam);
    }
  }, [searchParams]);

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
    if (!data?.board) return;
    const totalTickets = Object.values(data.board).reduce((acc, col) => acc + col.items.length, 0);
    if (!firstKanbanLoadRef.current) {
      prevTicketCountRef.current = totalTickets;
      if (totalTickets > 0) firstKanbanLoadRef.current = true;
      return;
    }
    if (totalTickets > prevTicketCountRef.current) {
      if (isAlertSoundEnabled('novo_ticket')) {
        playSound('cliente_entrou');
      }
    }
    prevTicketCountRef.current = totalTickets;
  }, [data]);

  useEffect(() => {
    if (!ticketDetail?.ticket?.messages) return;
    const msgs = ticketDetail.ticket.messages;
    if (!firstKanbanLoadRef.current) {
      prevMessagesCountRef.current = msgs.length;
      return;
    }
    if (msgs.length > prevMessagesCountRef.current) {
      const lastMsg = msgs[msgs.length - 1];
      if (lastMsg && !lastMsg.fromMe) {
        if (isAlertSoundEnabled('cliente_resposta')) {
          playSound('nova_mensagem');
        }
      }
    }
    prevMessagesCountRef.current = msgs.length;
  }, [ticketDetail?.ticket?.messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticketDetail?.ticket?.messages?.length]);

  useEffect(() => {
    if (!showAbrirChamado) { setClientResults([]); return; }
    if (!clientSearch.trim()) {
      const t = setTimeout(async () => {
        try {
          const { data } = await api.get('/crm/clients', { params: { limit: 20 } });
          setClientResults(Array.isArray(data) ? data : data?.clients || data?.items || []);
        } catch { setClientResults([]); }
      }, 100);
      return () => clearTimeout(t);
    }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get('/crm/clients', { params: { search: clientSearch, limit: 8 } });
        setClientResults(Array.isArray(data) ? data : data?.clients || data?.items || []);
      } catch { setClientResults([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [clientSearch, showAbrirChamado]);

  useEffect(() => {
    if (!showEditClient) { setEditClientResults([]); return; }
    if (!editClientSearch.trim()) {
      const t = setTimeout(async () => {
        try {
          const { data } = await api.get('/crm/clients', { params: { limit: 20 } });
          setEditClientResults(Array.isArray(data) ? data : data?.clients || data?.items || []);
        } catch { setEditClientResults([]); }
      }, 100);
      return () => clearTimeout(t);
    }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get('/crm/clients', { params: { search: editClientSearch, limit: 8 } });
        setEditClientResults(Array.isArray(data) ? data : data?.clients || data?.items || []);
      } catch { setEditClientResults([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [editClientSearch, showEditClient]);

  useEffect(() => {
    const checkWa = async () => {
      try {
        const { data } = await api.get('/whatsapp/status');
        setWaConnected(data.connected);
      } catch { setWaConnected(null); }
    };
    checkWa();
    const t = setInterval(checkWa, 15000);
    return () => clearInterval(t);
  }, []);

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
        departamentoId: ticketOrigem.departamentoId || '',
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
      departamentoId: t.departamentoId || '',
    });
    setSelectedClientId(t.client?.id || null);
    setClientSearch(t.client?.razaoSocial || t.contactName || '');
    setClientResults([]);
    setShowCreateClient(false);
    setShowAbrirChamado(true);
  }, [ticketDetail]);

  const confirmarEncaminharTriagem = async () => {
    if (!ticketDetail?.ticket || !abrirChamado.departamentoId) return;
    setAbrirSaving(true);
    try {
      await api.post(`/helpdesk/tickets/${ticketDetail.ticket.id}/triage`, {
        departamentoId: abrirChamado.departamentoId,
        prioridade: abrirChamado.prioridade,
      });
      setShowAbrirChamado(false);
      setAbrirChamado({ assunto: '', categoria: '', prioridade: 'media', tipo: '', observacoes: '', departamentoId: '' });
      loadTicketDetail(ticketDetail.ticket.id);
      loadKanban();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao encaminhar ticket');
    } finally {
      setAbrirSaving(false);
    }
  };

  const confirmarAbrirChamado = async () => {
    if (!ticketDetail?.ticket || !abrirChamado.assunto.trim()) return;
    setAbrirSaving(true);
    try {
      if (pendingDrop?.forConcluido) {
        await api.post(`/helpdesk/tickets/${pendingDrop.ticketId}/move`, {
          etapa: 'concluido',
          clientId: selectedClientId || undefined,
        });
      } else if (ticketDetail.ticket.etapa === 'triagem' && abrirChamado.departamentoId) {
        await confirmarEncaminharTriagem();
        return;
      } else {
        await api.post(`/whatsapp/tickets/${ticketDetail.ticket.id}/abrir`, {
          assunto: abrirChamado.assunto.trim(),
          categoria: abrirChamado.categoria || undefined,
          prioridade: abrirChamado.prioridade,
          tipo: abrirChamado.tipo || undefined,
          observacoes: abrirChamado.observacoes.trim() || undefined,
          clientId: selectedClientId || undefined,
          departamentoId: abrirChamado.departamentoId || undefined,
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
      setAbrirChamado({ assunto: '', categoria: '', prioridade: 'media', tipo: '', observacoes: '', departamentoId: '' });
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
    <div className="space-y-4 h-[calc(100vh-7rem)] flex flex-col">
      <div className="bg-gradient-to-r from-white via-white to-emerald-50/30 rounded-2xl border border-neutral-200/60 p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-navy-900 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200">
                <Stethoscope className="text-white" size={22} />
              </div>
              Helpdesk
              {waConnected === false && (
                <Link to="/app/whatsapp" className="ml-2 inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full bg-red-100 text-red-700 hover:bg-red-200 transition-colors shadow-sm" title="WhatsApp desconectado — clique para conectar">
                  <BluetoothOff size={12} /> WA Desconectado
                </Link>
              )}
              {waConnected === true && (
                <span className="ml-2 inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 shadow-sm">
                  <Bluetooth size={12} /> WA Conectado
                </span>
              )}
            </h1>
            <p className="text-neutral-500 text-sm mt-1.5 flex items-center gap-3">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-navy-900 animate-pulse" /> {totalTickets} chamados ativos</span>
              <span className="text-neutral-300">•</span>
              <span className="text-amber-600 font-semibold">{data.contagemEtapas.fila || 0} na fila</span>
              <span className="text-neutral-300">•</span>
              <span className="text-emerald-600 font-semibold">{data.contagemEtapas.em_atendimento || 0} em atendimento</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 sm:flex-none min-w-0">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filtrar tickets..."
                className="w-full sm:w-72 pl-10 pr-4 py-2.5 min-h-[44px] text-sm border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all shadow-sm"
              />
            </div>
            {autoMessage && (
              <div className={`text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-sm ${autoMessage.sent ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                {autoMessage.sent ? <><CheckCircle size={12} /> Enviada</> : <><AlertTriangle size={12} /> {autoMessage.error || 'Sem auto'}</>}
              </div>
            )}
            <div className="relative">
              <ArrowUpDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <select
                value={orderBy}
                onChange={(e) => setOrderBy(e.target.value)}
                className="pl-9 pr-4 py-2.5 min-h-[44px] text-sm border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none appearance-none bg-white cursor-pointer shadow-sm"
                title="Ordenar tickets"
              >
                <option value="updatedAt_desc">Mais recente</option>
                <option value="updatedAt_asc">Mais antigo</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-3 border-b border-neutral-200/60">
        {data.board['triagem'] && data.board['triagem'].total > 0 && (
          <button
            onClick={() => setFilterDept(filterDept === '__triagem__' ? '' : '__triagem__')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${
              filterDept === '__triagem__'
                ? 'bg-gradient-to-r from-violet-500 to-violet-600 text-white shadow-lg shadow-violet-200'
                : 'bg-violet-50 text-violet-600 hover:bg-violet-100 border border-violet-200'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-violet-400" />
            Triagem
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${filterDept === '__triagem__' ? 'bg-white/25' : 'bg-violet-100 text-violet-500'}`}>
              {data.board['triagem'].total}
            </span>
          </button>
        )}
        <button
          onClick={() => setFilterDept('')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
            filterDept === ''
              ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-200'
              : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 border border-neutral-200'
          }`}
        >
          Todos
        </button>
        {departamentos.map((d: any) => {
          const deptCount = Object.values(data.board).reduce(
            (acc: number, col: any) => acc + col.items.filter((t: any) => t.departamentoId === d.id).length,
            0
          );
          return (
            <button
              key={d.id}
              onClick={() => setFilterDept(filterDept === d.id ? '' : d.id)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${
                filterDept === d.id
                  ? 'text-white shadow-lg'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 border border-neutral-200'
              }`}
              style={filterDept === d.id ? { backgroundColor: d.cor, boxShadow: `0 8px 16px ${d.cor}33` } : undefined}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.cor }} />
              {d.nome}
              {deptCount > 0 && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${filterDept === d.id ? 'bg-white/25' : 'bg-neutral-200 text-neutral-500'}`}>
                  {deptCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
        <div className="flex gap-3 overflow-x-auto flex-1 pb-2">
          {Object.values(data.board).map((coluna) => {
            const Icone = ETAPA_ICONES[coluna.icone] || Inbox;
            const isDropTarget = isDragging;

            const isTriageFilter = filterDept === '__triagem__';
            const items = (searchLower || filterDept)
              ? coluna.items.filter((t: any) => {
                  const matchSearch = !searchLower
                    || (t.contactName?.toLowerCase() || '').includes(searchLower)
                    || (t.assunto?.toLowerCase() || '').includes(searchLower)
                    || (t.client?.razaoSocial?.toLowerCase() || '').includes(searchLower)
                    || (t.lastMessage?.content?.toLowerCase() || '').includes(searchLower);
                  const matchDept = isTriageFilter
                    ? t.etapa === 'triagem'
                    : !filterDept || t.departamentoId === filterDept;
                  return matchSearch && matchDept;
                })
              : coluna.items;

            return (
              <div
                key={coluna.slug}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, coluna.slug)}
                className={`w-72 sm:w-80 flex-shrink-0 rounded-2xl border-2 border-dashed bg-gradient-to-b from-neutral-50/80 to-white flex flex-col max-h-full transition-all duration-200 ${
                  isDropTarget ? 'border-emerald-400 bg-gradient-to-b from-emerald-50/50 to-emerald-50/30 shadow-lg shadow-emerald-100' : 'border-transparent hover:border-neutral-200'
                }`}
                style={{ borderTopColor: coluna.cor, borderTopWidth: '4px' }}
              >
                <div className="px-4 py-3 flex items-center gap-3 border-b border-neutral-200/60 bg-white/80 backdrop-blur-sm rounded-t-2xl">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-md" style={{ backgroundColor: coluna.cor }}>
                    <Icone size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-navy-900 truncate">{coluna.title}</h3>
                  </div>
                  <span className="text-sm font-bold text-white bg-navy-900/80 px-2.5 py-1 rounded-lg shadow-sm">{coluna.total}</span>
                  {coluna.enviarAuto && (
                    <span title="Envia mensagem automática" className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md font-semibold border border-emerald-100">AUTO</span>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                  {coluna.items.length === 0 ? (
                    <div className="text-center py-8 text-neutral-400 text-xs">
                      {isDropTarget ? 'Solte aqui' : 'Nenhum ticket'}
                    </div>
                  ) : items.length === 0 ? (
                    <div className="text-center py-8 text-neutral-400 text-xs">
                      Nenhum resultado para "{search}"
                    </div>
                  ) : (
                    items.map((ticket: any) => (
                      <KanbanCard
                        key={ticket.id}
                        ticket={ticket}
                        isSelected={selectedTicketId === ticket.id}
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
                        onViewDetail={(id) => { setSelectedTicketId(id); loadTicketDetail(id); }}
                        onOpenAbrirChamado={abrirModalAbrirChamado}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {selectedTicketId && ticketDetail && (
          <div className="fixed inset-0 md:static md:inset-auto z-40 bg-white md:bg-gradient-to-b md:from-white md:to-neutral-50/50 md:w-[440px] flex-shrink-0 border border-neutral-200/60 md:rounded-2xl flex flex-col md:max-h-full shadow-xl md:shadow-lg">
            <div className="px-5 py-4 border-b border-neutral-200/60 flex items-center justify-between bg-white md:rounded-t-2xl">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-md">
                  <User size={18} className="text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-bold text-navy-900 truncate">
                    {ticketDetail.ticket.contactName || 'Sem nome'}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {ticketDetail.ticket.client ? (
                      <Link to={`/app/crm/${ticketDetail.ticket.client.id}`}
                        className="text-xs text-blue-600 hover:text-blue-800 truncate flex items-center gap-1 hover:underline">
                        <Building2 size={11} /> {ticketDetail.ticket.client.razaoSocial || ticketDetail.ticket.client.nomeFantasia}
                      </Link>
                    ) : (
                      <p className="text-xs text-amber-600 italic">Sem empresa vinculada</p>
                    )}
                    <button
                      onClick={() => {
                        setEditClientId(ticketDetail.ticket.client?.id || null);
                        setEditClientSearch(ticketDetail.ticket.client?.razaoSocial || '');
                        setShowEditClient(true);
                      }}
                      className="text-neutral-400 hover:text-emerald-600 p-1 rounded-lg hover:bg-emerald-50 flex-shrink-0 transition-colors"
                      title="Editar cliente vinculado"
                    >
                      <Pencil size={12} />
                    </button>
                  </div>
                  <p className="text-xs text-neutral-500 font-mono mt-1">
                    {ticketDetail.ticket.protocolo}
                    {ticketDetail.ticket.contactPhone && <span className="ml-2"><Phone size={10} className="inline" /> {ticketDetail.ticket.contactPhone}</span>}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedTicketId(null)} className="p-2 hover:bg-neutral-100 rounded-xl text-neutral-400 min-h-[44px] min-w-[44px] flex items-center justify-center md:min-h-0 md:min-w-0 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="px-5 py-3 border-b border-neutral-200/60 flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-white px-3 py-1 rounded-lg uppercase shadow-sm" style={{ backgroundColor: data.board[ticketDetail.ticket.etapa as EtapaSlug]?.cor || '#64748b' }}>
                {data.board[ticketDetail.ticket.etapa as EtapaSlug]?.title || ticketDetail.ticket.etapa}
              </span>
              {ticketDetail.ticket.categoria && (
                <span className="text-xs text-neutral-700 bg-neutral-100 px-2.5 py-1 rounded-lg font-medium flex items-center gap-1">
                  <Tag size={11} /> {ticketDetail.ticket.categoria.replace(/_/g, ' ')}
                </span>
              )}
              {ticketDetail.ticket.assignee ? (
                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-medium">
                  {ticketDetail.ticket.assignee.name}
                </span>
              ) : (
                <button onClick={() => setShowAssignModal(true)} className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md font-medium hover:bg-amber-100">
                  <UserPlus size={10} className="inline mr-0.5" /> Atribuir
                </button>
              )}
            </div>

            {!ticketDetail.ticket.assigneeId && (
              <div className="px-5 py-2 bg-amber-50 border-b border-amber-100">
                <button onClick={() => setShowAssignModal(true)} className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md font-medium hover:bg-amber-100">
                  <UserPlus size={10} className="inline mr-0.5" /> Atribuir a mim
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {detailLoading && (
                <div className="flex justify-center py-8">
                  <RefreshCw size={14} className="animate-spin inline text-neutral-400" />
                </div>
              )}
              {ticketDetail.ticket.messages?.map((msg: any) => {
                const isAudio = msg.mimeType?.startsWith('audio/');
                const isImage = msg.mimeType?.startsWith('image/');
                const isVideo = msg.mimeType?.startsWith('video/');
                const mediaSrc = msg.mediaUrl && msg.mimeType
                  ? `data:${msg.mimeType};base64,${msg.mediaUrl}`
                  : null;
                const isBot = msg.source === 'bot';
                const isSystem = msg.tipo === 'system' || isBot;
                const isInterno = msg.content?.startsWith('[INTERNO]');

                if (isSystem && !isInterno) {
                  return (
                    <div key={msg.id} className="flex justify-center">
                      <div className="max-w-[85%] bg-violet-50 border border-violet-200 rounded-xl px-3 py-1.5 text-center">
                        <p className="text-[9px] font-bold text-violet-500 mb-0.5 uppercase">🤖 Sistema</p>
                        <p className="text-[11px] text-violet-700 whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                        <p className="text-[9px] text-violet-400 mt-0.5">
                          {new Date(msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={msg.id} className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-xs ${
                      msg.fromMe
                        ? 'bg-emerald-500 text-white rounded-br-sm'
                        : 'bg-white border border-neutral-200 text-neutral-900 rounded-bl-sm'
                    } ${isInterno ? 'opacity-50 italic' : ''}`}>
                      {isInterno ? (
                        <span>🔒 {msg.content.replace('[INTERNO]', '').trim()}</span>
                      ) : (
                        <>
                          {isAudio && mediaSrc && (
                            <div className="mb-1">
                              <audio controls preload="none" className="w-full h-8 max-w-[200px]">
                                <source src={mediaSrc} type={msg.mimeType} />
                              </audio>
                            </div>
                          )}
                          {isImage && mediaSrc && (
                            <div className="mb-1">
                              <img src={mediaSrc} alt="Imagem" className="max-w-[200px] max-h-[150px] rounded-lg cursor-pointer" onClick={() => window.open(mediaSrc, '_blank')} />
                            </div>
                          )}
                          {isVideo && mediaSrc && (
                            <div className="mb-1">
                              <video controls preload="none" className="max-w-[200px] max-h-[150px] rounded-lg">
                                <source src={mediaSrc} type={msg.mimeType} />
                              </video>
                            </div>
                          )}
                          {!isAudio && !isImage && !isVideo && msg.mediaUrl && mediaSrc && (
                            <div className="mb-1">
                              <a href={mediaSrc} target="_blank" rel="noopener noreferrer" className="underline text-blue-300 hover:text-blue-100">📎 Arquivo</a>
                            </div>
                          )}
                          {msg.content && msg.content !== '(mídia)' && (
                            <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                          )}
                          {msg.content === '(mídia)' && !mediaSrc && (
                            <p className="whitespace-pre-wrap leading-relaxed italic opacity-60">{msg.content}</p>
                          )}
                        </>
                      )}
                      <p className={`text-[9px] mt-0.5 ${msg.fromMe ? 'text-white/70' : 'text-neutral-400'}`}>
                        {new Date(msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="px-5 py-3 border-t border-neutral-200/60">
              {ticketDetail.stageEvents && ticketDetail.stageEvents.length > 0 && (
                <div className="mb-2 text-[10px] text-neutral-400 max-h-16 overflow-y-auto">
                  {ticketDetail.stageEvents.map((ev: any) => (
                    <div key={ev.id}>
                      {ev.tipo === 'etapa' && <span>📦 {ev.deEtapa} → {ev.paraEtapa}</span>}
                      {ev.tipo === 'atribuicao' && <span>👤 Atribuído para {ev.usuario?.name}</span>}
                      {ev.tipo === 'mensagem' && <span>💬 Mensagem de {ev.usuario?.name}</span>}
                      {ev.usuario && <span className="text-neutral-500">por {ev.usuario.name}</span>}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Digite uma mensagem..."
                  className="flex-1 text-sm border border-neutral-200 rounded-xl px-4 py-2.5 min-h-[44px] focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none shadow-sm"
                  disabled={sendingMessage}
                />
                <button onClick={sendMessage} disabled={sendingMessage || !messageText.trim()} className="px-4 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium disabled:opacity-50 shadow-sm">
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {showAssignModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={() => setShowAssignModal(false)}>
          <div className="bg-white rounded-xl p-5 w-full max-w-md mx-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-navy-900">Atribuir ticket</h3>
              <button onClick={() => setShowAssignModal(false)} className="text-neutral-400 hover:text-neutral-600 p-1"><X size={20} /></button>
            </div>
            <select value={assignTo} onChange={(e) => setAssignTo(e.target.value)} className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2.5">
              <option value="">Selecione um analista</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name} — {a.role}</option>)}
            </select>
            <button onClick={handleAssign} disabled={!assignTo} className="btn-primary w-full disabled:opacity-50">
              Atribuir
            </button>
          </div>
        </div>
      )}

      {showAbrirChamado && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={() => { setShowAbrirChamado(false); setPendingDrop(null); }}>
          <div className="bg-white rounded-t-2xl sm:rounded-xl sm:max-w-lg w-full max-h-[92vh] sm:max-h-[85vh] overflow-y-auto p-5 space-y-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-navy-900 flex items-center gap-2 text-base">
                <Plus size={18} className="text-emerald-600" />
                {pendingDrop?.forConcluido ? 'Finalizar Chamado' : pendingDrop ? 'Mover para Em Atendimento' : ticketDetail?.ticket.etapa === 'triagem' ? 'Encaminhar para Fila' : 'Abrir Chamado'}
              </h3>
              <button onClick={() => { setShowAbrirChamado(false); setPendingDrop(null); }} disabled={abrirSaving} className="text-neutral-400 hover:text-neutral-600 p-1"><X size={20} /></button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-neutral-700">Cliente</label>
              {selectedClientId ? (
                <div className="flex items-center gap-2 p-2 bg-emerald-50 rounded-lg">
                  <CheckCircle size={14} className="text-emerald-600" />
                  <span className="text-sm text-emerald-800 flex-1 truncate">{clientResults.find((c: any) => c.id === selectedClientId)?.razaoSocial || selectedClientId}</span>
                  <button onClick={() => { setSelectedClientId(null); setClientSearch(''); }} className="text-neutral-400 hover:text-neutral-600 p-1"><X size={14} /></button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={clientSearch}
                    onChange={(e) => { setClientSearch(e.target.value); setSelectedClientId(null); }}
                    placeholder="Buscar empresa..."
                    className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2.5"
                  />
                  {clientResults.length > 0 && !selectedClientId && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-neutral-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto z-10">
                      {clientResults.map((c: any) => (
                        <button
                          key={c.id}
                          onClick={() => { setSelectedClientId(c.id); setClientSearch(c.razaoSocial); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 flex items-center gap-2"
                        >
                          <Building2 size={12} className="text-neutral-400" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{c.razaoSocial}</p>
                            {c.cnpj && <p className="text-[10px] text-neutral-400">{c.cnpj}</p>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {clientSearch && !selectedClientId && clientResults.length === 0 && clientSearch.length >= 2 && (
                    <button
                      onClick={() => { setNewClient({ razaoSocial: clientSearch, telefone: ticketDetail?.ticket.contactPhone || '', cnpj: '', email: '' }); setShowCreateClient(true); }}
                      className="w-full text-left px-3 py-2 text-sm text-emerald-600 hover:bg-emerald-50 flex items-center gap-2"
                    >
                      <Plus size={12} /> Criar "{clientSearch}"
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-neutral-700">Assunto</label>
              <input
                type="text"
                value={abrirChamado.assunto}
                onChange={(e) => setAbrirChamado({ ...abrirChamado, assunto: e.target.value })}
                placeholder="Descreva o problema"
                className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2.5"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-medium text-neutral-700">Departamento</label>
                <select
                  value={abrirChamado.departamentoId}
                  onChange={(e) => setAbrirChamado({ ...abrirChamado, departamentoId: e.target.value })}
                  className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2.5"
                >
                  <option value="">Selecione</option>
                  {departamentos.map((d: any) => (
                    <option key={d.id} value={d.id}>{d.nome}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-neutral-700">Categoria</label>
                <select
                  value={abrirChamado.categoria}
                  onChange={(e) => setAbrirChamado({ ...abrirChamado, categoria: e.target.value })}
                  className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2.5"
                >
                  <option value="">Selecione</option>
                  <option value="duvida">Dúvida</option>
                  <option value="reclamacao">Reclamação</option>
                  <option value="solicitacao">Solicitação</option>
                  <option value="bug">Bug</option>
                  <option value="melhoria">Melhoria</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-medium text-neutral-700">Prioridade</label>
                <select
                  value={abrirChamado.prioridade}
                  onChange={(e) => setAbrirChamado({ ...abrirChamado, prioridade: e.target.value })}
                  className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2.5"
                >
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-neutral-700">Tipo</label>
                <input
                  type="text"
                  value={abrirChamado.tipo}
                  onChange={(e) => setAbrirChamado({ ...abrirChamado, tipo: e.target.value })}
                  placeholder="Tipo do chamado"
                  className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2.5"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-neutral-700">Observações</label>
              <textarea
                value={abrirChamado.observacoes}
                onChange={(e) => setAbrirChamado({ ...abrirChamado, observacoes: e.target.value })}
                rows={3}
                placeholder="Notas internas para o atendente"
                className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2.5 resize-none min-h-[80px]"
              />
            </div>

            <div className="sticky bottom-0 bg-white px-4 sm:px-5 py-3 border-t border-neutral-100 flex gap-2">
              <button onClick={() => { setShowAbrirChamado(false); setPendingDrop(null); }} disabled={abrirSaving} className="flex-1 px-4 py-2.5 min-h-[44px] text-sm border border-neutral-200 rounded-lg hover:bg-neutral-50 disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={confirmarAbrirChamado} disabled={abrirSaving || !abrirChamado.assunto.trim()} className="flex-1 px-4 py-2.5 min-h-[44px] text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-1.5">
                {abrirSaving ? <><RefreshCw size={14} className="animate-spin" /> Salvando...</> : pendingDrop?.forConcluido ? 'Finalizar' : pendingDrop ? 'Mover e Abrir' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateClient && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center" onClick={() => setShowCreateClient(false)}>
          <div className="bg-white rounded-t-2xl sm:rounded-xl sm:max-w-md w-full max-h-[85vh] overflow-y-auto p-5 space-y-3 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-navy-900">Criar cliente</h3>
              <button onClick={() => setShowCreateClient(false)} disabled={creatingClient} className="text-neutral-400 hover:text-neutral-600 p-1"><X size={20} /></button>
            </div>
            <input type="text" value={newClient.razaoSocial} onChange={(e) => setNewClient({ ...newClient, razaoSocial: e.target.value })} placeholder="Razão Social *" className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2.5" />
            <input type="text" value={newClient.telefone} onChange={(e) => setNewClient({ ...newClient, telefone: e.target.value })} placeholder="Telefone" className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2.5" />
            <div className="grid grid-cols-2 gap-3">
              <input type="text" value={newClient.cnpj} onChange={(e) => setNewClient({ ...newClient, cnpj: e.target.value })} placeholder="CNPJ" className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2.5" />
              <input type="email" value={newClient.email} onChange={(e) => setNewClient({ ...newClient, email: e.target.value })} placeholder="Email" className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2.5" />
            </div>
            <button onClick={criarClienteInline} disabled={creatingClient || !newClient.razaoSocial.trim()} className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-1.5">
              {creatingClient ? <><RefreshCw size={14} className="animate-spin" /> Criando...</> : 'Criar e Vincular'}
            </button>
          </div>
        </div>
      )}

      {showEditClient && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center" onClick={() => setShowEditClient(false)}>
          <div className="bg-white rounded-t-2xl sm:rounded-xl sm:max-w-md w-full max-h-[85vh] overflow-y-auto p-5 space-y-3 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-navy-900">Vincular cliente ao ticket</h3>
              <button onClick={() => setShowEditClient(false)} disabled={savingClient} className="text-neutral-400 hover:text-neutral-600 p-1"><X size={20} /></button>
            </div>

            {editClientId ? (
              <div className="flex items-center gap-2 p-2 bg-emerald-50 rounded-lg">
                <CheckCircle size={14} className="text-emerald-600" />
                <span className="text-sm text-emerald-800 flex-1 truncate">{editClientResults.find((c: any) => c.id === editClientId)?.razaoSocial || editClientId}</span>
                <button onClick={() => { setEditClientId(null); setEditClientSearch(''); }} className="text-neutral-400 hover:text-neutral-600 p-1"><X size={14} /></button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  value={editClientSearch}
                  onChange={(e) => { setEditClientSearch(e.target.value); setEditClientId(null); }}
                  placeholder="Buscar empresa..."
                  className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2.5"
                />
                {editClientResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-neutral-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto z-10">
                    {editClientResults.map((c: any) => (
                      <button
                        key={c.id}
                        onClick={() => { setEditClientId(c.id); setEditClientSearch(c.razaoSocial); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 flex items-center gap-2"
                      >
                        <Building2 size={12} className="text-neutral-400" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{c.razaoSocial}</p>
                          {c.cnpj && <p className="text-[10px] text-neutral-400">{c.cnpj}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {editClientSearch && editClientResults.length === 0 && editClientSearch.length >= 2 && (
                  <button
                    onClick={() => { setNewClient({ razaoSocial: editClientSearch, telefone: '', cnpj: '', email: '' }); setShowEditClient(false); setShowCreateClient(true); }}
                    className="w-full text-left px-3 py-2 text-sm text-emerald-600 hover:bg-emerald-50 flex items-center gap-2"
                  >
                    <Plus size={12} /> Criar "{editClientSearch}"
                  </button>
                )}
              </div>
            )}

            <div className="sticky bottom-0 bg-white px-4 sm:px-5 py-3 border-t border-neutral-100 flex gap-2">
              <button onClick={() => setShowEditClient(false)} disabled={savingClient} className="flex-1 px-4 py-2.5 min-h-[44px] text-sm border border-neutral-200 rounded-lg hover:bg-neutral-50 disabled:opacity-50">Cancelar</button>
              <button onClick={salvarClienteTicket} disabled={savingClient} className="flex-1 px-4 py-2.5 min-h-[44px] text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-1.5">
                {savingClient ? <><RefreshCw size={14} className="animate-spin" /> Salvando...</> : editClientId ? 'Vincular' : 'Desvincular'}
              </button>
            </div>
          </div>
        </div>
      )}

      {descartarSaving && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center">
          <div className="bg-white rounded-xl p-5 text-center">
            <RefreshCw size={20} className="animate-spin text-neutral-400 mx-auto mb-2" />
            <p className="text-sm text-neutral-600">Descartando ticket...</p>
          </div>
        </div>
      )}
    </div>
  );
}
