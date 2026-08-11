import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../services/auth';
import { playSound, initAudioContext } from '../../services/soundAlerts';
import { isAlertSoundEnabled } from '../Settings/AlertSettings';
import { useModal } from '../../hooks/useModal';
import { AlertModal, ConfirmModal } from '../../components/Modal';
import { matchSearchMultiple } from '../../utils/text';
import {
  RefreshCw, MessageSquare, User, Clock, FileText, Inbox, Bot,
  Headphones, CheckCircle, AlertTriangle, Phone, X, ArrowRight,
  UserPlus, ClipboardList, Stethoscope, Building2, ArrowUpDown,
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
  if (horas < 24) return mins === 0 ? `${horas}h` : `${horas}h ${mins}min`;
  const dias = Math.floor(horas / 24);
  const remainHours = horas % 24;
  if (remainHours === 0 && mins === 0) return `${dias}d`;
  if (remainHours === 0) return `${dias}d ${mins}min`;
  return mins > 0 ? `${dias}d ${remainHours}h ${mins}min` : `${dias}d ${remainHours}h`;
}

function getTimeColor(minutos: number): string {
  if (minutos < 30) return 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30';
  if (minutos < 120) return 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/30';
  if (minutos < 480) return 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/30';
  if (minutos < 1440) return 'text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-900/30';
  return 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/30';
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
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(ticket.id);
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`Ticket ${ticket.protocolo || ticket.id} - ${ticket.contactName || 'Sem nome'}`}
      className={`bg-white dark:bg-slate-800 rounded-xl border p-3 cursor-grab active:cursor-grabbing hover:shadow-xl hover:-translate-y-1 transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 ${
        isSelected 
          ? 'border-emerald-400 shadow-lg ring-2 ring-emerald-100 dark:ring-emerald-900/50 bg-gradient-to-br from-white to-emerald-50/30 dark:from-slate-800 dark:to-emerald-900/20' 
          : 'border-neutral-200/80 dark:border-slate-700 hover:border-neutral-300 dark:hover:border-slate-600 shadow-sm'
      } ${isDragging ? 'opacity-40 scale-95 rotate-2' : ''}`}
      style={{
        borderLeftWidth: '4px',
        borderLeftColor: ticket.prioridade === 'urgente' ? '#ef4444'
          : ticket.prioridade === 'alta' ? '#f59e0b'
          : ticket.prioridade === 'media' ? '#3b82f6'
          : '#10b981',
      }}
    >
      <div className="flex items-start gap-3 mb-2.5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-md">
          <User size={16} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-navy-900 dark:text-slate-100 truncate leading-tight">
            {ticket.contactName || 'Sem nome'}
          </p>
          {ticket.contactPhone && (
            <p className="text-[11px] text-neutral-500 dark:text-slate-400 font-medium mt-0.5 flex items-center gap-1">
              <Phone size={10} className="text-neutral-400 dark:text-slate-500" /> {ticket.contactPhone}
            </p>
          )}
          {ticket.client && (
            <Link to={`/app/crm/${ticket.client.id}`} onClick={(e) => e.stopPropagation()}
              className="text-[11px] text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 truncate flex items-center gap-1 hover:underline mt-1">
              <Building2 size={10} /> {ticket.client.razaoSocial || ticket.client.nomeFantasia}
            </Link>
          )}
          {ticket.protocolo && (
            <p className="text-[10px] text-neutral-400 dark:text-slate-500 font-mono mt-1 bg-neutral-50 dark:bg-slate-700 px-1.5 py-0.5 rounded inline-block">{ticket.protocolo}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {ticket._count?.orders > 0 && (
            <span title="Possui OS" className="text-[10px] text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-900/30 px-1.5 py-0.5 rounded-md font-medium flex items-center gap-0.5">
              <FileText size={9} /> {ticket._count.orders}
            </span>
          )}
          {colunaSlug === 'fila' && ticket.filaOrder && (
            <span title={`Posição na fila: ${ticket.filaOrder}º`} className="text-[10px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-md font-bold">
              #{ticket.filaOrder}º
            </span>
          )}
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={(e) => { e.stopPropagation(); onOpenMenu(openCardMenuId === ticket.id ? null : ticket.id); }}
              className="p-1 hover:bg-neutral-100 dark:hover:bg-slate-700 rounded-lg text-neutral-400 dark:text-slate-500 hover:text-neutral-700 dark:hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Ações"
            >
              <MoreVertical size={14} />
            </button>
            {openCardMenuId === ticket.id && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => onOpenMenu(null)} />
                <div className="absolute right-0 top-6 z-40 bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-lg shadow-lg w-52 py-1 text-xs">
                  <div className="px-2.5 py-1.5 text-[10px] font-bold text-neutral-400 dark:text-slate-500 uppercase border-b border-neutral-100 dark:border-slate-700/50">
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
                        className="w-full text-left px-2.5 py-1.5 hover:bg-neutral-50 dark:hover:bg-slate-700 flex items-center gap-2"
                      >
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.cor }} />
                        {c.title}
                      </button>
                    ))}
                  <div className="border-t border-neutral-100 dark:border-slate-700/50 my-1" />
                  {!ticket.assigneeId && (
                    <button
                      onClick={() => { onAssignToMe(ticket.id); onOpenMenu(null); }}
                      className="w-full text-left px-2.5 py-1.5 hover:bg-neutral-50 dark:hover:bg-slate-700 flex items-center gap-2 text-emerald-700 dark:text-emerald-400"
                    >
                      <UserPlus size={12} /> Assumir
                    </button>
                  )}
                  {colunaSlug === 'triagem' && (
                    <button
                      onClick={() => { onViewDetail(ticket.id); onOpenMenu(null); setTimeout(() => onOpenAbrirChamado(ticket), 100); }}
                      className="w-full text-left px-2.5 py-1.5 hover:bg-neutral-50 dark:hover:bg-slate-700 flex items-center gap-2 text-violet-700 dark:text-violet-400"
                    >
                      <ArrowRight size={12} /> Encaminhar para Fila
                    </button>
                  )}
                  {!ticket.protocolo && colunaSlug === 'fila' && (
                    <>
                      <button
                        onClick={() => { onViewDetail(ticket.id); onOpenMenu(null); setTimeout(() => onOpenAbrirChamado(ticket), 100); }}
                        className="w-full text-left px-2.5 py-1.5 hover:bg-neutral-50 dark:hover:bg-slate-700 flex items-center gap-2 text-emerald-700 dark:text-emerald-400"
                      >
                        <Plus size={12} /> Abrir Chamado
                      </button>
                      <button
                        onClick={() => { onDescartar(ticket); onOpenMenu(null); }}
                        className="w-full text-left px-2.5 py-1.5 hover:bg-neutral-50 dark:hover:bg-slate-700 flex items-center gap-2 text-zinc-700 dark:text-zinc-400"
                      >
                        <X size={12} /> Descartar (sem msg)
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => { onViewDetail(ticket.id); onOpenMenu(null); }}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-neutral-50 dark:hover:bg-slate-700 flex items-center gap-2"
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
        <p className="text-[13px] text-neutral-700 dark:text-slate-300 font-semibold mb-2 line-clamp-2 leading-snug">{ticket.assunto}</p>
      )}

      {ticket.prazoEntrega && !ticket.semPrazo && (() => {
        const prazo = new Date(ticket.prazoEntrega);
        const agora = new Date();
        const horasRestantes = (prazo.getTime() - agora.getTime()) / (1000 * 60 * 60);
        const isAtrasado = horasRestantes < 0;
        const isProximo = horasRestantes >= 0 && horasRestantes < 24;
        return (
          <div className={`flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-lg mb-2 ${
            isAtrasado ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50' :
            isProximo ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50' :
            'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50'
          }`}>
            {isAtrasado ? <AlertTriangle size={11} /> : <Clock size={11} />}
            {isAtrasado ? `Atrasado ${formatarTempo(Math.abs(Math.floor(horasRestantes * 60)))}` :
             isProximo ? `Vence em ${formatarTempo(Math.floor(horasRestantes * 60))}` :
             `Prazo: ${prazo.toLocaleDateString('pt-BR')}`}
          </div>
        );
      })()}

      <div className="flex flex-wrap gap-1.5 mb-2">
        {ticket.channel && (
          <span className="text-[10px] text-white px-2 py-0.5 rounded-md font-semibold shadow-sm flex items-center gap-1" style={{ backgroundColor: ticket.channel.cor || '#64748b' }}>
            {ticket.channel.tipo === 'whatsapp' && '💬'}
            {ticket.channel.tipo === 'email' && '📧'}
            {ticket.channel.tipo === 'instagram' && '📷'}
            {ticket.channel.tipo === 'facebook' && '👤'}
            {ticket.channel.tipo === 'telegram' && '✈️'}
            {ticket.channel.tipo === 'web' && '🌐'}
            {ticket.channel.tipo === 'telefone' && '📞'}
            {ticket.channel.nome}
          </span>
        )}
        {ticket.departamento && (
          <span className="text-[10px] text-white px-2 py-0.5 rounded-md font-semibold shadow-sm" style={{ backgroundColor: ticket.departamento.cor || '#64748b' }}>
            {ticket.departamento.nome}
          </span>
        )}
        {ticket.categoria && (
          <span className="text-[10px] text-neutral-600 dark:text-slate-400 bg-neutral-100 dark:bg-slate-700 px-2 py-0.5 rounded-md font-medium">
            {ticket.categoria.replace(/_/g, ' ')}
          </span>
        )}
        {ticket.tags && ticket.tags.split(',').map((tag: string) => tag.trim()).filter(Boolean).slice(0, 3).map((tag: string) => (
          <span key={tag} className="text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-md font-medium border border-blue-100 dark:border-blue-900/50">
            {tag}
          </span>
        ))}
        <span className="text-[10px] text-neutral-500 dark:text-slate-400 bg-neutral-100 dark:bg-slate-700 px-2 py-0.5 rounded-md flex items-center gap-1">
          <MessageSquare size={10} /> {ticket._count?.messages || 0}
        </span>
        {ticket._count?.checklists > 0 && (
          <span className="text-[10px] text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30 px-2 py-0.5 rounded-md font-medium flex items-center gap-1">
            ☑ {ticket._count.checklists}
          </span>
        )}
        {ticket.horasDesenvolvimento != null && ticket.horasDesenvolvimento > 0 && (
          <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-md font-medium flex items-center gap-1">
            <Clock size={10} /> {ticket.horasDesenvolvimento}h
          </span>
        )}
      </div>

      {ticket.lastMessage?.content && (
        <div className={`text-[11px] line-clamp-1 mb-2 px-2 py-1.5 rounded-lg ${
          ticket.lastMessage.source === 'bot' || ticket.lastMessage.tipo === 'system'
            ? 'bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-violet-900/50'
            : 'bg-neutral-50 dark:bg-slate-700 text-neutral-600 dark:text-slate-400 border border-neutral-100 dark:border-slate-700/50'
        }`}>
          {ticket.lastMessage.source === 'bot' || ticket.lastMessage.tipo === 'system' ? '🤖 ' : ticket.lastMessage.fromMe ? '↪ ' : '↩ '}{ticket.lastMessage.content}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-2 border-t border-neutral-100/80 dark:border-slate-700/50">
        {ticket.assignee ? (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <span className="text-[8px] font-bold text-emerald-700 dark:text-emerald-400">{ticket.assignee.name.charAt(0).toUpperCase()}</span>
            </div>
            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold truncate max-w-[80px]">
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
          <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-md font-semibold">
            Sem analista
          </span>
        )}
        <span className={`text-[10px] flex items-center gap-1 px-1.5 py-0.5 rounded font-medium ${getTimeColor(ticket.dataConclusao ? 0 : Math.floor((Date.now() - new Date(ticket.dataAbertura || ticket.createdAt).getTime()) / 60000))}`} title={ticket.dataConclusao ? `Concluído em ${new Date(ticket.dataConclusao).toLocaleString('pt-BR')}` : `Aberto em ${new Date(ticket.dataAbertura || ticket.createdAt).toLocaleString('pt-BR')}`}>
          <Clock size={10} />
          {ticket.dataConclusao ? (
            <span>Concluído</span>
          ) : (
            formatarTempo(Math.floor((Date.now() - new Date(ticket.dataAbertura || ticket.createdAt).getTime()) / 60000))
          )}
        </span>
      </div>
    </div>
  );
});

export default function HelpdeskKanban() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { modal, alert: showAlert, confirm: showConfirm, close: closeModal } = useModal();
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
  const [filterChannel, setFilterChannel] = useState<string>('');
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
    pollRef.current = setInterval(() => { loadKanban(); }, 15000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadKanban, isDragging]);

  useEffect(() => {
    if (selectedTicketId && !isDragging) {
      setDetailLoading(true);
      loadTicketDetail(selectedTicketId);
      if (detailPollRef.current) clearInterval(detailPollRef.current);
      detailPollRef.current = setInterval(() => loadTicketDetail(selectedTicketId), 15000);
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
      showAlert(err?.response?.data?.error || 'Erro ao mover ticket');
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
      showAlert(err?.response?.data?.error || 'Erro ao enviar mensagem');
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
      showAlert(err?.response?.data?.error || 'Erro ao atribuir');
    }
  };

  const handleCreateOS = async () => {
    if (!ticketDetail?.ticket) return;
    const clientId = ticketDetail.ticket.client?.id;
    if (!clientId) {
      showAlert('Ticket sem cliente vinculado — vincule um cliente antes de gerar a OS');
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
      showAlert(err?.response?.data?.error || 'Erro ao criar OS');
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
      showAlert(err?.response?.data?.error || 'Erro ao encaminhar ticket');
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
      showAlert(err?.response?.data?.error || 'Erro ao abrir chamado');
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
      showAlert(err?.response?.data?.error || 'Erro ao criar cliente');
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
      showAlert(err?.response?.data?.error || 'Erro ao atualizar cliente');
    } finally {
      setSavingClient(false);
    }
  };

  const descartarTicket = async () => {
    if (!ticketDetail?.ticket) return;
    const confirmed = await showConfirm(`Descartar ticket de ${ticketDetail.ticket.contactName}?\n\nNenhuma mensagem sera enviada ao cliente. O ticket sera movido para "Descartados".`);
    if (!confirmed) return;
    setDescartarSaving(true);
    try {
      await api.post(`/whatsapp/tickets/${ticketDetail.ticket.id}/descartar`);
      setSelectedTicketId(null);
      loadKanban();
    } catch (err: any) {
      showAlert(err?.response?.data?.error || 'Erro ao descartar ticket');
    } finally {
      setDescartarSaving(false);
    }
  };

  const descartarTicketDireto = async (ticket: any) => {
    const confirmed = await showConfirm(`Descartar ticket de ${ticket.contactName}?\n\nNenhuma mensagem sera enviada ao cliente. O ticket sera movido para "Descartados".`);
    if (!confirmed) return;
    try {
      await api.post(`/whatsapp/tickets/${ticket.id}/descartar`);
      loadKanban();
    } catch (err: any) {
      showAlert(err?.response?.data?.error || 'Erro ao descartar ticket');
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
      showAlert(err?.response?.data?.error || 'Erro ao mover ticket');
    }
  }, [selectedTicketId, loadKanban, loadTicketDetail]);

  const handleAssignToMe = async (ticketId: string) => {
    try {
      await api.patch(`/helpdesk/tickets/${ticketId}/atribuir`, { usuarioId: user?.id });
      loadKanban();
      if (selectedTicketId === ticketId) loadTicketDetail(ticketId);
    } catch (err: any) {
      showAlert(err?.response?.data?.error || 'Erro ao atribuir ticket');
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
      <div className="bg-gradient-to-r from-white via-white to-emerald-50/30 dark:from-slate-800 dark:via-slate-800 dark:to-emerald-900/20 rounded-2xl border border-neutral-200/60 dark:border-slate-700 p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-navy-900 dark:text-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200">
                <Stethoscope className="text-white" size={22} />
              </div>
              Helpdesk
              {waConnected === false && (
                <Link to="/app/whatsapp" className="ml-2 inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors shadow-sm" title="WhatsApp desconectado — clique para conectar">
                  <BluetoothOff size={12} /> WA Desconectado
                </Link>
              )}
              {waConnected === true && (
                <span className="ml-2 inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 shadow-sm">
                  <Bluetooth size={12} /> WA Conectado
                </span>
              )}
            </h1>
            <p className="text-neutral-500 dark:text-slate-400 text-sm mt-1.5 flex items-center gap-3">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-navy-900 animate-pulse" /> {totalTickets} chamados ativos</span>
              <span className="text-neutral-300">•</span>
              <span className="text-amber-600 dark:text-amber-400 font-semibold">{data.contagemEtapas.fila || 0} na fila</span>
              <span className="text-neutral-300 dark:text-slate-600">•</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{data.contagemEtapas.em_atendimento || 0} em atendimento</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 sm:flex-none min-w-0">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filtrar tickets..."
                className="w-full sm:w-72 pl-10 pr-4 py-2.5 min-h-[44px] text-sm border border-neutral-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all shadow-sm"
              />
            </div>
            {autoMessage && (
              <div className={`text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-sm ${autoMessage.sent ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50' : 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50'}`}>
                {autoMessage.sent ? <><CheckCircle size={12} /> Enviada</> : <><AlertTriangle size={12} /> {autoMessage.error || 'Sem auto'}</>}
              </div>
            )}
            <div className="relative">
              <ArrowUpDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 pointer-events-none" />
              <select
                value={orderBy}
                onChange={(e) => setOrderBy(e.target.value)}
                className="pl-9 pr-4 py-2.5 min-h-[44px] text-sm border border-neutral-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none appearance-none bg-white dark:bg-slate-800 cursor-pointer shadow-sm"
                title="Ordenar tickets"
              >
                <option value="updatedAt_desc">Mais recente</option>
                <option value="updatedAt_asc">Mais antigo</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-3 border-b border-neutral-200/60 dark:border-slate-700">
        {data.board['triagem'] && data.board['triagem'].total > 0 && (
          <button
            onClick={() => setFilterDept(filterDept === '__triagem__' ? '' : '__triagem__')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${
              filterDept === '__triagem__'
                ? 'bg-gradient-to-r from-violet-500 to-violet-600 text-white shadow-lg shadow-violet-200'
                : 'bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900/50 border border-violet-200 dark:border-violet-900/50'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-violet-400" />
            Triagem
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${filterDept === '__triagem__' ? 'bg-white/25' : 'bg-violet-100 dark:bg-violet-900/30 text-violet-500 dark:text-violet-400'}`}>
              {data.board['triagem'].total}
            </span>
          </button>
        )}
        <button
          onClick={() => setFilterDept('')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
            filterDept === ''
              ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-200'
                  : 'bg-neutral-100 dark:bg-slate-700 text-neutral-600 dark:text-slate-400 hover:bg-neutral-200 dark:hover:bg-slate-600 border border-neutral-200 dark:border-slate-700'
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
              : 'bg-neutral-100 dark:bg-slate-700 text-neutral-600 dark:text-slate-400 hover:bg-neutral-200 dark:hover:bg-slate-600 border border-neutral-200 dark:border-slate-700'
              }`}
              style={filterDept === d.id ? { backgroundColor: d.cor, boxShadow: `0 8px 16px ${d.cor}33` } : undefined}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.cor }} />
              {d.nome}
              {deptCount > 0 && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${filterDept === d.id ? 'bg-white/25' : 'bg-neutral-200 dark:bg-slate-600 text-neutral-500 dark:text-slate-400'}`}>
                  {deptCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Channel Filter */}
      {(() => {
        const channelsWithTickets = departamentos.length > 0 ? [] : [];
        const allChannels = Object.values(data.board).flatMap((col: any) => 
          col.items.filter((t: any) => t.channel).map((t: any) => t.channel)
        );
        const uniqueChannels = allChannels.filter((ch: any, i: number, arr: any[]) => 
          arr.findIndex((c: any) => c?.id === ch?.id) === i
        );
        
        if (uniqueChannels.length === 0) return null;
        
        return (
          <div className="flex gap-2 overflow-x-auto pb-3 border-b border-neutral-200/60 dark:border-slate-700">
            <button
              onClick={() => setFilterChannel('')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                filterChannel === ''
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-200'
                  : 'bg-neutral-100 dark:bg-slate-700 text-neutral-600 dark:text-slate-400 hover:bg-neutral-200 dark:hover:bg-slate-600 border border-neutral-200 dark:border-slate-700'
              }`}
            >
              Todos Canais
            </button>
            {uniqueChannels.map((ch: any) => {
              const channelCount = Object.values(data.board).reduce(
                (acc: number, col: any) => acc + col.items.filter((t: any) => t.channelId === ch.id).length,
                0
              );
              return (
                <button
                  key={ch.id}
                  onClick={() => setFilterChannel(filterChannel === ch.id ? '' : ch.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${
                    filterChannel === ch.id
                      ? 'text-white shadow-lg'
                      : 'bg-neutral-100 dark:bg-slate-700 text-neutral-600 dark:text-slate-400 hover:bg-neutral-200 dark:hover:bg-slate-600 border border-neutral-200 dark:border-slate-700'
                  }`}
                  style={filterChannel === ch.id ? { backgroundColor: ch.cor, boxShadow: `0 8px 16px ${ch.cor}33` } : undefined}
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ch.cor }} />
                  {ch.nome}
                  {channelCount > 0 && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${filterChannel === ch.id ? 'bg-white/25' : 'bg-neutral-200 dark:bg-slate-600 text-neutral-500 dark:text-slate-400'}`}>
                      {channelCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        );
      })()}

      <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
        <div className="flex gap-3 overflow-x-auto flex-1 pb-2">
          {Object.values(data.board).map((coluna) => {
            const Icone = ETAPA_ICONES[coluna.icone] || Inbox;
            const isDropTarget = isDragging;

            const isTriageFilter = filterDept === '__triagem__';
            const items = (searchLower || filterDept || filterChannel)
              ? coluna.items.filter((t: any) => {
                  const matchSearch = !searchLower
                    || matchSearchMultiple(
                        [t.contactName, t.assunto, t.client?.razaoSocial, t.lastMessage?.content, t.channel?.nome],
                        searchLower
                      );
                  const matchDept = isTriageFilter
                    ? t.etapa === 'triagem'
                    : !filterDept || t.departamentoId === filterDept;
                  const matchChannel = !filterChannel || t.channelId === filterChannel;
                  return matchSearch && matchDept && matchChannel;
                })
              : coluna.items;

            return (
              <div
                key={coluna.slug}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, coluna.slug)}
                className={`w-[280px] min-w-[260px] sm:w-80 flex-shrink-0 rounded-2xl border-2 border-dashed bg-gradient-to-b from-neutral-50/80 to-white dark:from-slate-900/80 dark:to-slate-800 flex flex-col max-h-full transition-all duration-200 ${
                  isDropTarget ? 'border-emerald-400 bg-gradient-to-b from-emerald-50/50 to-emerald-50/30 shadow-lg shadow-emerald-100' : 'border-transparent hover:border-neutral-200 dark:hover:border-slate-700'
                }`}
                style={{ borderTopColor: coluna.cor, borderTopWidth: '4px' }}
              >
                <div className="px-4 py-3 flex items-center gap-3 border-b border-neutral-200/60 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-t-2xl">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-md" style={{ backgroundColor: coluna.cor }}>
                    <Icone size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-navy-900 dark:text-slate-100 truncate">{coluna.title}</h3>
                  </div>
                  <span className="text-sm font-bold text-white bg-navy-900/80 px-2.5 py-1 rounded-lg shadow-sm">{coluna.total}</span>
                  {coluna.enviarAuto && (
                    <span title="Envia mensagem automática" className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-md font-semibold border border-emerald-100 dark:border-emerald-900/50">AUTO</span>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                  {coluna.items.length === 0 ? (
                    <div className="text-center py-8 text-neutral-400 dark:text-slate-500 text-xs">
                      {isDropTarget ? 'Solte aqui' : 'Nenhum ticket'}
                    </div>
                  ) : items.length === 0 ? (
                    <div className="text-center py-8 text-neutral-400 dark:text-slate-500 text-xs">
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
                        onSelect={(id) => navigate(`/app/helpdesk/ticket/${id}`)}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onOpenMenu={setOpenCardMenuId}
                        onMoveTo={moverTicketDireto}
                        onAssignToMe={handleAssignToMe}
                        onDescartar={descartarTicketDireto}
                        onViewDetail={(id) => navigate(`/app/helpdesk/ticket/${id}`)}
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

      {showAssignModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowAssignModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 space-y-4 shadow-2xl border border-neutral-200 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-navy-900 dark:text-slate-100 flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
                <UserPlus size={20} className="text-emerald-600" />
                Atribuir ticket
              </h3>
              <button onClick={() => setShowAssignModal(false)} className="text-neutral-400 dark:text-slate-500 hover:text-neutral-600 dark:hover:text-slate-300 p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-slate-700 transition-colors"><X size={20} /></button>
            </div>
            <select value={assignTo} onChange={(e) => setAssignTo(e.target.value)} className="w-full text-sm border border-neutral-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all">
              <option value="">Selecione um analista</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name} — {a.role}</option>)}
            </select>
            <div className="flex gap-3">
              <button onClick={() => setShowAssignModal(false)} className="flex-1 px-4 py-3 text-sm font-medium text-neutral-700 dark:text-slate-300 bg-neutral-100 dark:bg-slate-700 hover:bg-neutral-200 dark:hover:bg-slate-600 rounded-xl transition-colors">
                Cancelar
              </button>
              <button onClick={handleAssign} disabled={!assignTo} className="flex-1 px-4 py-3 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-emerald-600/25">
                Atribuir
              </button>
            </div>
          </div>
        </div>
      )}

      {showAbrirChamado && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={() => { setShowAbrirChamado(false); setPendingDrop(null); }}>
          <div className="bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-xl sm:max-w-lg w-full max-h-[92vh] sm:max-h-[85vh] overflow-y-auto p-5 space-y-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-navy-900 dark:text-slate-100 flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
                <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <Plus size={16} className="text-emerald-600" />
                </div>
                {pendingDrop?.forConcluido ? 'Finalizar Chamado' : pendingDrop ? 'Mover para Em Atendimento' : ticketDetail?.ticket.etapa === 'triagem' ? 'Encaminhar para Fila' : 'Abrir Chamado'}
              </h3>
              <button onClick={() => { setShowAbrirChamado(false); setPendingDrop(null); }} disabled={abrirSaving} className="text-neutral-400 dark:text-slate-500 hover:text-neutral-600 dark:hover:text-slate-300 p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-slate-700 transition-colors"><X size={20} /></button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-neutral-700 dark:text-slate-300">Cliente</label>
              {selectedClientId ? (
                <div className="flex items-center gap-2 p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg">
                  <CheckCircle size={14} className="text-emerald-600 dark:text-emerald-400" />
                  <span className="text-sm text-emerald-800 dark:text-emerald-300 flex-1 truncate">{clientResults.find((c: any) => c.id === selectedClientId)?.razaoSocial || selectedClientId}</span>
                  <button onClick={() => { setSelectedClientId(null); setClientSearch(''); }} className="text-neutral-400 dark:text-slate-500 hover:text-neutral-600 dark:hover:text-slate-300 p-1"><X size={14} /></button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={clientSearch}
                    onChange={(e) => { setClientSearch(e.target.value); setSelectedClientId(null); }}
                    placeholder="Buscar empresa..."
                    className="w-full text-sm border border-neutral-200 dark:border-slate-700 rounded-lg px-3 py-2.5"
                  />
                  {clientResults.length > 0 && !selectedClientId && (
                    <div className="absolute top-full left-0 right-0 bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto z-10">
                      {clientResults.map((c: any) => (
                        <button
                          key={c.id}
                          onClick={() => { setSelectedClientId(c.id); setClientSearch(c.razaoSocial); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-slate-700 flex items-center gap-2"
                        >
                          <Building2 size={12} className="text-neutral-400 dark:text-slate-500" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{c.razaoSocial}</p>
                            {c.cnpj && <p className="text-[10px] text-neutral-400 dark:text-slate-500">{c.cnpj}</p>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {clientSearch && !selectedClientId && clientResults.length === 0 && clientSearch.length >= 2 && (
                    <button
                      onClick={() => { setNewClient({ razaoSocial: clientSearch, telefone: ticketDetail?.ticket.contactPhone || '', cnpj: '', email: '' }); setShowCreateClient(true); }}
                      className="w-full text-left px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 flex items-center gap-2"
                    >
                      <Plus size={12} /> Criar "{clientSearch}"
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-neutral-700 dark:text-slate-300">Assunto</label>
              <input
                type="text"
                value={abrirChamado.assunto}
                onChange={(e) => setAbrirChamado({ ...abrirChamado, assunto: e.target.value })}
                placeholder="Descreva o problema"
                className="w-full text-sm border border-neutral-200 dark:border-slate-700 rounded-lg px-3 py-2.5"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-medium text-neutral-700 dark:text-slate-300">Departamento</label>
                <select
                  value={abrirChamado.departamentoId}
                  onChange={(e) => setAbrirChamado({ ...abrirChamado, departamentoId: e.target.value })}
                  className="w-full text-sm border border-neutral-200 dark:border-slate-700 rounded-lg px-3 py-2.5"
                >
                  <option value="">Selecione</option>
                  {departamentos.map((d: any) => (
                    <option key={d.id} value={d.id}>{d.nome}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-neutral-700 dark:text-slate-300">Categoria</label>
                <select
                  value={abrirChamado.categoria}
                  onChange={(e) => setAbrirChamado({ ...abrirChamado, categoria: e.target.value })}
                  className="w-full text-sm border border-neutral-200 dark:border-slate-700 rounded-lg px-3 py-2.5"
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
                <label className="text-xs font-medium text-neutral-700 dark:text-slate-300">Prioridade</label>
                <select
                  value={abrirChamado.prioridade}
                  onChange={(e) => setAbrirChamado({ ...abrirChamado, prioridade: e.target.value })}
                  className="w-full text-sm border border-neutral-200 dark:border-slate-700 rounded-lg px-3 py-2.5"
                >
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-neutral-700 dark:text-slate-300">Tipo</label>
                <input
                  type="text"
                  value={abrirChamado.tipo}
                  onChange={(e) => setAbrirChamado({ ...abrirChamado, tipo: e.target.value })}
                  placeholder="Tipo do chamado"
                  className="w-full text-sm border border-neutral-200 dark:border-slate-700 rounded-lg px-3 py-2.5"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-neutral-700 dark:text-slate-300">Observações</label>
              <textarea
                value={abrirChamado.observacoes}
                onChange={(e) => setAbrirChamado({ ...abrirChamado, observacoes: e.target.value })}
                rows={3}
                placeholder="Notas internas para o atendente"
                className="w-full text-sm border border-neutral-200 dark:border-slate-700 rounded-lg px-3 py-2.5 resize-none min-h-[80px]"
              />
            </div>

            <div className="sticky bottom-0 bg-white dark:bg-slate-800 px-4 sm:px-5 py-3 border-t border-neutral-100 dark:border-slate-700/50 flex gap-2">
              <button onClick={() => { setShowAbrirChamado(false); setPendingDrop(null); }} disabled={abrirSaving} className="flex-1 px-4 py-2.5 min-h-[44px] text-sm border border-neutral-200 dark:border-slate-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-slate-700 disabled:opacity-50">
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
          <div className="bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-xl sm:max-w-md w-full max-h-[85vh] overflow-y-auto p-5 space-y-3 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-navy-900 dark:text-slate-100 flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
                <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Plus size={16} className="text-blue-600" />
                </div>
                Criar cliente
              </h3>
              <button onClick={() => setShowCreateClient(false)} disabled={creatingClient} className="text-neutral-400 dark:text-slate-500 hover:text-neutral-600 dark:hover:text-slate-300 p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-slate-700 transition-colors"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <input type="text" value={newClient.razaoSocial} onChange={(e) => setNewClient({ ...newClient, razaoSocial: e.target.value })} placeholder="Razao Social *" className="w-full text-sm border border-neutral-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" />
              <input type="text" value={newClient.telefone} onChange={(e) => setNewClient({ ...newClient, telefone: e.target.value })} placeholder="Telefone" className="w-full text-sm border border-neutral-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" />
              <div className="grid grid-cols-2 gap-3">
                <input type="text" value={newClient.cnpj} onChange={(e) => setNewClient({ ...newClient, cnpj: e.target.value })} placeholder="CNPJ" className="w-full text-sm border border-neutral-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" />
                <input type="email" value={newClient.email} onChange={(e) => setNewClient({ ...newClient, email: e.target.value })} placeholder="Email" className="w-full text-sm border border-neutral-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowCreateClient(false)} disabled={creatingClient} className="flex-1 px-4 py-3 text-sm font-medium text-neutral-700 dark:text-slate-300 bg-neutral-100 dark:bg-slate-700 hover:bg-neutral-200 dark:hover:bg-slate-600 rounded-xl transition-colors">
                Cancelar
              </button>
              <button onClick={criarClienteInline} disabled={creatingClient || !newClient.razaoSocial.trim()} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-lg shadow-blue-600/25 transition-colors">
                {creatingClient ? <><RefreshCw size={14} className="animate-spin" /> Criando...</> : 'Criar e Vincular'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditClient && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={() => setShowEditClient(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl sm:max-w-md w-full max-h-[85vh] overflow-y-auto p-6 space-y-4 shadow-2xl border border-neutral-200 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-navy-900 dark:text-slate-100 flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
                <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <Building2 size={16} className="text-purple-600" />
                </div>
                Vincular cliente ao ticket
              </h3>
              <button onClick={() => setShowEditClient(false)} disabled={savingClient} className="text-neutral-400 dark:text-slate-500 hover:text-neutral-600 dark:hover:text-slate-300 p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-slate-700 transition-colors"><X size={20} /></button>
            </div>

            {editClientId ? (
              <div className="flex items-center gap-2 p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg">
                <CheckCircle size={14} className="text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm text-emerald-800 dark:text-emerald-300 flex-1 truncate">{editClientResults.find((c: any) => c.id === editClientId)?.razaoSocial || editClientId}</span>
                <button onClick={() => { setEditClientId(null); setEditClientSearch(''); }} className="text-neutral-400 dark:text-slate-500 hover:text-neutral-600 dark:hover:text-slate-300 p-1"><X size={14} /></button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  value={editClientSearch}
                  onChange={(e) => { setEditClientSearch(e.target.value); setEditClientId(null); }}
                  placeholder="Buscar empresa..."
                  className="w-full text-sm border border-neutral-200 dark:border-slate-700 rounded-lg px-3 py-2.5"
                />
                {editClientResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto z-10">
                    {editClientResults.map((c: any) => (
                      <button
                        key={c.id}
                        onClick={() => { setEditClientId(c.id); setEditClientSearch(c.razaoSocial); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-slate-700 flex items-center gap-2"
                      >
                        <Building2 size={12} className="text-neutral-400 dark:text-slate-500" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{c.razaoSocial}</p>
                          {c.cnpj && <p className="text-[10px] text-neutral-400 dark:text-slate-500">{c.cnpj}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {editClientSearch && editClientResults.length === 0 && editClientSearch.length >= 2 && (
                  <button
                    onClick={() => { setNewClient({ razaoSocial: editClientSearch, telefone: '', cnpj: '', email: '' }); setShowEditClient(false); setShowCreateClient(true); }}
                    className="w-full text-left px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 flex items-center gap-2"
                  >
                    <Plus size={12} /> Criar "{editClientSearch}"
                  </button>
                )}
              </div>
            )}

            <div className="sticky bottom-0 bg-white dark:bg-slate-800 px-4 sm:px-5 py-3 border-t border-neutral-100 dark:border-slate-700/50 flex gap-2">
              <button onClick={() => setShowEditClient(false)} disabled={savingClient} className="flex-1 px-4 py-2.5 min-h-[44px] text-sm border border-neutral-200 dark:border-slate-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-slate-700 disabled:opacity-50">Cancelar</button>
              <button onClick={salvarClienteTicket} disabled={savingClient} className="flex-1 px-4 py-2.5 min-h-[44px] text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-1.5">
                {savingClient ? <><RefreshCw size={14} className="animate-spin" /> Salvando...</> : editClientId ? 'Vincular' : 'Desvincular'}
              </button>
            </div>
          </div>
        </div>
      )}

      {descartarSaving && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-5 text-center">
            <RefreshCw size={20} className="animate-spin text-neutral-400 dark:text-slate-500 mx-auto mb-2" />
            <p className="text-sm text-neutral-600 dark:text-slate-400">Descartando ticket...</p>
          </div>
        </div>
      )}

      <AlertModal
        open={modal.type === 'alert' && modal.open}
        onClose={closeModal}
        title={modal.title}
        message={modal.message}
      />
      <ConfirmModal
        open={modal.type === 'confirm' && modal.open}
        onClose={closeModal}
        onConfirm={() => modal.onConfirm?.()}
        title={modal.title}
        message={modal.message}
        danger
      />
    </div>
  );
}
