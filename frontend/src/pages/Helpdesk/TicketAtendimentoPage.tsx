import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Maximize2, Minimize2, Send, Loader2, ArrowLeft, Calendar, Clock, AlertTriangle, ToggleLeft, ToggleRight, Building2, Timer, MessageSquare, Star, Paperclip, ShieldCheck, ShieldAlert, User, X, Info, BarChart3, ExternalLink, Hash, UserCheck, ClipboardList, Plus, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../../services/api';
import TicketTopo from '../../components/TicketTopo';
import TicketSidebar from '../../components/TicketSidebar';
import TicketRodape from '../../components/TicketRodape';
import TicketChecklist from '../../components/TicketChecklist';
import ClassificationPanel from '../../components/ClassificationPanel';
import { AcronymText } from '../../components/AcronymText';
import type { SlaTicketIndicador } from '../../types';

const STATUS_LABELS: Record<string, string> = {
  aberto: 'Aberto', em_andamento: 'Em andamento', pendente: 'Pendente',
  escalonado: 'Escalonado', resolvido: 'Resolvido', fechado: 'Fechado', cancelado: 'Cancelado',
};

const ETAPA_LABELS: Record<string, string> = {
  fila: 'Fila', triagem: 'Triagem', em_atendimento: 'Em Atendimento',
  aguardando_cliente: 'Aguardando Cliente', aguardando_os: 'Aguardando OS',
  concluido: 'Concluído', descartado: 'Descartado',
};

const PRIORIDADE_LABELS: Record<string, string> = {
  baixa: 'Baixa', media: 'Média', alta: 'Alta', urgente: 'Urgente',
};

export default function TicketAtendimentoPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<any>(null);
  const [cliente, setCliente] = useState<any>(null);
  const [historicoContato, setHistoricoContato] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState<'chat' | 'timeline' | 'checklist' | 'os' | 'indicadores'>('chat');
  const [mensagens, setMensagens] = useState<any[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const [ordens, setOrdens] = useState<any[]>([]);
  const [criandoOs, setCriandoOs] = useState(false);
  const [osError, setOsError] = useState('');
  const [novaMsg, setNovaMsg] = useState('');
  const [enviando, setEnviando] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [prazoEntrega, setPrazoEntrega] = useState('');
  const [semPrazo, setSemPrazo] = useState(false);
  const [salvandoPrazo, setSalvandoPrazo] = useState(false);
  const [horasDesenv, setHorasDesenv] = useState<number | ''>('');
  const [salvandoHoras, setSalvandoHoras] = useState(false);
  const [deptTempos, setDeptTempos] = useState<any[]>([]);
  const [timeBlocks, setTimeBlocks] = useState<any[]>([]);
  const [sidebarAberta, setSidebarAberta] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  const OS_STATUS_LABEL: Record<string, string> = {
    rascunho: 'Rascunho',
    aguardando_assinatura: 'Aguardando Assinatura',
    assinada: 'Assinada',
    em_execucao: 'Em Execução',
    concluida: 'Concluída',
    cancelada: 'Cancelada',
  };

  const OS_STATUS_COLOR: Record<string, string> = {
    rascunho: 'bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300',
    aguardando_assinatura: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    assinada: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
    em_execucao: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    concluida: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    cancelada: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  };

  const formatMin = (min: number | null | undefined) => {
    if (min == null) return '—';
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const formatTimeTotal = (blocks: any[]) =>
    formatMin(blocks.reduce((acc, b) => acc + (b.duracaoMin || 0), 0));

  const tipoLabel = (tipo: string) => {
    const map: Record<string, string> = {
      dev: 'Desenvolvimento', suporte: 'Suporte', implantacao: 'Implantação',
      treinamento: 'Treinamento', reuniao: 'Reunião', outro: 'Outro',
    };
    return map[tipo] || tipo;
  };

  // ── Indicadores do "Resumo do Ticket" (dados reais; '—' quando indisponível) ──
  const tempoTotalMin = useMemo(() => {
    if (!ticket?.dataAbertura) return null;
    const fim = ticket.dataFechamento ? new Date(ticket.dataFechamento).getTime() : Date.now();
    return Math.max(0, Math.round((fim - new Date(ticket.dataAbertura).getTime()) / 60000));
  }, [ticket]);

  const primeiraRespostaMin = useMemo(() => {
    if (!ticket?.dataAbertura || !ticket?.dataPrimeiraResposta) return null;
    return Math.max(0, Math.round((new Date(ticket.dataPrimeiraResposta).getTime() - new Date(ticket.dataAbertura).getTime()) / 60000));
  }, [ticket]);

  const ultimaInteracao = useMemo(() => {
    const comData = (mensagens || []).filter((m: any) => m.createdAt || m.sentAt);
    if (comData.length === 0) return null;
    const ultima = comData.reduce((a: any, b: any) =>
      new Date(b.createdAt || b.sentAt).getTime() > new Date(a.createdAt || a.sentAt).getTime() ? b : a
    );
    return ultima.createdAt || ultima.sentAt;
  }, [mensagens]);

  const csatNota = ticket?.csatResposta?.nota ?? null;

  const [slaIndicador, setSlaIndicador] = useState<SlaTicketIndicador | null>(null);

  const carregarSlaIndicador = useCallback(async () => {
    if (!ticketId) return;
    try {
      const { data } = await api.get(`/helpdesk/indicadores/sla/${ticketId}`);
      setSlaIndicador(data);
    } catch { /* SLA indisponível não quebra a tela */ }
  }, [ticketId]);

  useEffect(() => {
    if (!ticket) return;
    carregarSlaIndicador();
    const id = setInterval(carregarSlaIndicador, 30000);
    return () => clearInterval(id);
  }, [ticket, carregarSlaIndicador]);

  // TME (espera do cliente) calculado localmente a partir das mensagens do ticket
  const tmeTicketMin = useMemo(() => {
    const msgs = (mensagens || [])
      .map((m: any) => ({ fromMe: !!m.fromMe, at: new Date(m.createdAt || m.sentAt).getTime() }))
      .filter((m: any) => !isNaN(m.at))
      .sort((a: any, b: any) => a.at - b.at);
    if (msgs.length === 0) return null;
    let soma = 0;
    let cont = 0;
    let ultimaClienteAt: number | null = null;
    for (const m of msgs) {
      if (!m.fromMe) {
        ultimaClienteAt = m.at;
      } else if (ultimaClienteAt != null) {
        soma += Math.max(0, (m.at - ultimaClienteAt) / 60000);
        cont++;
        ultimaClienteAt = null;
      }
    }
    if (ultimaClienteAt != null) {
      soma += Math.max(0, (Date.now() - ultimaClienteAt) / 60000);
      cont++;
    }
    return cont > 0 ? Math.round(soma / cont) : null;
  }, [mensagens]);

  const slaInfo = useMemo<{ limite: number; consumido: number; status: 'no_prazo' | 'violado' } | null>(() => {
    const limite = ticket?.slaTotalMinutos ?? null;
    if (limite == null) return null;
    const consumido = tempoTotalMin ?? 0;
    return { limite, consumido, status: consumido <= limite ? 'no_prazo' : 'violado' };
  }, [ticket, tempoTotalMin]);

  const totalAnexos = useMemo(() => (mensagens || []).filter((m: any) => !!m.mediaUrl).length, [mensagens]);

  const tempoRelativo = (data?: string) => {
    if (!data) return '—';
    const diff = Math.max(0, Date.now() - new Date(data).getTime());
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'agora';
    if (min < 60) return `${min}min atrás`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h}h atrás`;
    return `${Math.floor(h / 24)}d atrás`;
  };

  const loadOrdens = useCallback(async () => {
    if (!ticketId) return;
    try {
      const { data } = await api.get(`/orders/ticket/${ticketId}`);
      setOrdens(Array.isArray(data.orders) ? data.orders : []);
    } catch (err) {
      console.error('Erro ao carregar OS do ticket:', err);
      setOrdens([]);
    }
  }, [ticketId]);

  const criarOs = async () => {
    if (!ticketId || criandoOs) return;
    setCriandoOs(true);
    setOsError('');
    try {
      await api.post(`/orders/from-ticket/${ticketId}`);
      await Promise.all([loadOrdens(), loadTicket()]);
    } catch (err: any) {
      setOsError(err?.response?.data?.error || 'Erro ao criar OS a partir do ticket');
    } finally {
      setCriandoOs(false);
    }
  };

  const loadTicket = useCallback(async () => {
    if (!ticketId) return;
    try {
      const [historyRes, timelineRes, deptTimeRes, timeBlocksRes] = await Promise.all([
        api.get(`/helpdesk/tickets/${ticketId}/history`),
        api.get(`/audit-ticket/tickets/${ticketId}/events`).catch(() => ({ data: [] })),
        api.get(`/helpdesk/tickets/${ticketId}/department-time`).catch(() => ({ data: [] })),
        api.get(`/timetracking/ticket/${ticketId}/blocks`).catch(() => ({ data: [] })),
      ]);
      const t = historyRes.data.ticket || historyRes.data;
      setTicket(t);
      setMensagens(t.messages || []);
      setTimelineEvents(timelineRes.data);
      setHistoricoContato(historyRes.data.historicoContato || []);
      setDeptTempos(deptTimeRes.data);
      setTimeBlocks(timeBlocksRes.data);
      setPrazoEntrega(t.prazoEntrega ? new Date(t.prazoEntrega).toISOString().slice(0, 16) : '');
      setSemPrazo(t.semPrazo || false);
      setHorasDesenv(t.horasDesenvolvimento ?? '');
      if (t.clientId) {
        try {
          const { data: c } = await api.get(`/crm/clients/${t.clientId}`);
          setCliente(c);
        } catch {}
      }
      loadOrdens();
    } catch (err) {
      console.error('Erro ao carregar ticket:', err);
    } finally {
      setLoading(false);
    }
  }, [ticketId, loadOrdens]);

  useEffect(() => { loadTicket(); }, [loadTicket]);

  useEffect(() => {
    const interval = setInterval(loadTicket, 15000);
    return () => clearInterval(interval);
  }, [loadTicket]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  // Keyboard shortcut: Ctrl+Shift+F to toggle focus mode
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        setFocusMode((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const enviarMensagem = async () => {
    if (!novaMsg.trim() || enviando) return;
    setEnviando(true);
    try {
      const phone = ticket?.contactPhone?.replace(/[^\d]/g, '') || '';
      await api.post('/whatsapp/send', {
        to: phone,
        message: novaMsg.trim(),
        ticketId,
        whatsappConnectionId: ticket?.whatsappConnectionId || undefined,
      });
      setNovaMsg('');
      await loadTicket();
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
    } finally {
      setEnviando(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviarMensagem();
    }
  };

  const salvarPrazo = async () => {
    if (!ticketId) return;
    setSalvandoPrazo(true);
    try {
      await api.patch(`/helpdesk/tickets/${ticketId}/move`, {
        etapa: ticket.etapa,
        prazoEntrega: semPrazo ? null : (prazoEntrega || null),
        semPrazo,
      });
      loadTicket();
    } catch {
    } finally {
      setSalvandoPrazo(false);
    }
  };

  const salvarHorasDesenv = async () => {
    if (!ticketId) return;
    setSalvandoHoras(true);
    try {
      await api.patch(`/helpdesk/tickets/${ticketId}/move`, {
        etapa: ticket.etapa,
        horasDesenvolvimento: horasDesenv === '' ? null : Number(horasDesenv),
      });
      loadTicket();
    } catch {
    } finally {
      setSalvandoHoras(false);
    }
  };

  const getDeadlineStatus = () => {
    if (semPrazo || !ticket?.prazoEntrega) return null;
    const prazo = new Date(ticket.prazoEntrega);
    const agora = new Date();
    const horasRestantes = (prazo.getTime() - agora.getTime()) / (1000 * 60 * 60);
    if (horasRestantes < 0) return { label: 'Atrasado', color: 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/30', icon: AlertTriangle };
    if (horasRestantes < 24) return { label: `Vence em ${Math.floor(horasRestantes)}h`, color: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/30', icon: Clock };
    return { label: `Prazo: ${prazo.toLocaleDateString('pt-BR')}`, color: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/30', icon: Calendar };
  };

  const getTimelineIcon = (ev: any) => {
    if (ev.tipo?.includes('criado') || ev.tipo?.includes('aberto')) return { emoji: '\uD83D\uDCE9', color: 'bg-blue-100 border-blue-300' };
    if (ev.tipo?.includes('ia') || ev.tipo?.includes('bot')) return { emoji: '\uD83E\uDD16', color: 'bg-blue-100 border-blue-300' };
    if (ev.tipo?.includes('humano') || ev.tipo?.includes('atribui')) return { emoji: '\uD83D\uDC64', color: 'bg-emerald-100 border-emerald-300' };
    if (ev.tipo?.includes('aguardando')) return { emoji: '\u23F3', color: 'bg-amber-100 border-amber-300' };
    if (ev.tipo?.includes('conclu') || ev.tipo?.includes('resolv')) return { emoji: '\u2705', color: 'bg-emerald-100 border-emerald-300' };
    return { emoji: '\u25CF', color: 'bg-slate-100 border-slate-300' };
  };

  const renderMetric = (label: string, value: string, icon: React.ReactNode, valueClass = 'text-slate-800 dark:text-slate-100') => (
    <div className="flex items-center gap-2.5 px-4 py-2.5 min-w-0">
      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700/60 flex items-center justify-center text-slate-500 dark:text-slate-300 flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500 font-semibold leading-tight">{label}</div>
        <div className={`text-sm font-semibold truncate ${valueClass}`}>{value}</div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="text-center py-16 text-slate-400 dark:text-slate-500">
        <p className="text-lg">Ticket n{'\u00E3'}o encontrado</p>
        <button onClick={() => navigate(-1)} className="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline">
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 max-w-full overflow-hidden">
      {/* === BOTAO VOLTAR === */}
      <div className="flex-shrink-0 px-4 pt-3">
        <button
          onClick={() => navigate('/app/helpdesk')}
          className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Chamados
        </button>
      </div>

      {/* === CABECALHO DO TICKET (contexto compacto) === */}
      <div className="flex-shrink-0 px-4 pt-2 space-y-2">
        <TicketTopo ticket={ticket} slaLabel={slaInfo ? (slaInfo.status === 'no_prazo' ? 'Dentro do prazo' : 'Prazo violado') : undefined} slaStatus={slaInfo?.status} />
        {ticket && (
          <ClassificationPanel ticketId={ticket.id} ticket={ticket} onClassificada={loadTicket} />
        )}
      </div>

      {/* === WORKSPACE: CONVERSA | CLIENTE === */}
      <div className={`flex-1 min-h-0 grid grid-cols-1 gap-0 p-4 pb-3 ${focusMode ? '' : 'lg:grid-cols-[minmax(0,1fr)_320px]'}`}>
        {/* === COLUNA ESQUERDA: CHAT / TIMELINE / CHECKLIST === */}
        <div className="flex flex-col min-h-0 relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          {/* Toggle Chat/Timeline/Checklist */}
          <div className="flex-shrink-0 flex border-b border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setAba('chat')}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                aba === 'chat'
                  ? 'text-slate-800 border-b-2 border-blue-500 bg-slate-50 dark:text-slate-100 dark:bg-slate-900'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
              }`}
            >
              {'\uD83D\uDCAC'} Chat
            </button>
            <button
              onClick={() => setAba('timeline')}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                aba === 'timeline'
                  ? 'text-slate-800 border-b-2 border-blue-500 bg-slate-50 dark:text-slate-100 dark:bg-slate-900'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
              }`}
            >
              {'\uD83D\uDCCB'} Timeline
            </button>
            <button
              onClick={() => setAba('checklist')}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                aba === 'checklist'
                  ? 'text-slate-800 border-b-2 border-blue-500 bg-slate-50 dark:text-slate-100 dark:bg-slate-900'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
              }`}
            >
              {'\u2611\uFE0F'} Checklist
            </button>
            <button
              onClick={() => setAba('os')}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                aba === 'os'
                  ? 'text-slate-800 border-b-2 border-blue-500 bg-slate-50 dark:text-slate-100 dark:bg-slate-900'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
              }`}
            >
              <FileText size={14} className="inline -mt-0.5 mr-1" />
              OS
            </button>
            <button
              onClick={() => setAba('indicadores')}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                aba === 'indicadores'
                  ? 'text-slate-800 border-b-2 border-blue-500 bg-slate-50 dark:text-slate-100 dark:bg-slate-900'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
              }`}
            >
              <BarChart3 size={14} className="inline -mt-0.5 mr-1" />
              Indicadores
            </button>
            {/* Botao do painel do cliente (mobile) */}
            <button
              onClick={() => setSidebarAberta(true)}
              className="lg:hidden flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-900 border-b-2 border-transparent transition-colors"
              title="Painel do cliente"
            >
              <User size={15} />
              <span className="hidden sm:inline">Cliente</span>
            </button>
          </div>

          {/* Conteudo */}
          {aba === 'chat' ? (
            <div className="flex-1 min-h-0 flex flex-col">
              {/* Messages — scrollavel */}
              <div className="flex-1 min-h-0 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-900 flex flex-col gap-3 relative">
                <button
                  onClick={() => setFocusMode((f) => !f)}
                  className="absolute top-2 right-2 w-7 h-7 rounded-md border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 z-10"
                  title={focusMode ? 'Voltar ao layout normal (Ctrl+Shift+F)' : 'Expandir chat (Ctrl+Shift+F)'}
                >
                  {focusMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>

                {mensagens.length === 0 && (
                  <div className="flex-1 flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">
                    Nenhuma mensagem ainda
                  </div>
                )}

                {mensagens.map((msg: any, i: number) => {
                  const isIA = msg.source === 'bot';
                  const isOp = msg.fromMe && !isIA;
                  const isCliente = !msg.fromMe;
                  return (
                    <div key={msg.id || i} className={`max-w-[78%] ${isCliente ? 'self-start' : 'self-end'}`}>
                      <div className={`px-3.5 py-2.5 rounded-xl text-sm leading-relaxed break-words ${
                        isCliente
                          ? 'bg-white border border-slate-200 rounded-bl-sm dark:bg-slate-800 dark:border-slate-600'
                          : isIA
                            ? 'bg-blue-50 border border-blue-200 rounded-br-sm dark:bg-blue-900/30 dark:border-blue-600'
                            : 'bg-emerald-50 border border-emerald-200 rounded-br-sm dark:bg-emerald-900/30 dark:border-emerald-600'
                      }`}>
                        {msg.mediaUrl && msg.mimeType?.startsWith('image/') && (
                          <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className="block mb-2">
                            <img
                              src={msg.mediaUrl}
                              alt="Imagem"
                              className="max-w-[280px] max-h-[200px] rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity border border-slate-200 dark:border-slate-600"
                              loading="lazy"
                            />
                          </a>
                        )}
                        {msg.mediaUrl && msg.mimeType?.startsWith('video/') && (
                          <video
                            src={msg.mediaUrl}
                            controls
                            className="max-w-[280px] max-h-[200px] rounded-lg mb-2"
                          />
                        )}
                        {msg.mediaUrl && msg.mimeType?.startsWith('audio/') && (
                          <audio src={msg.mediaUrl} controls className="w-full mb-2" />
                        )}
                        {msg.mediaUrl && !msg.mimeType?.startsWith('image/') && !msg.mimeType?.startsWith('video/') && !msg.mimeType?.startsWith('audio/') && (
                          <a
                            href={msg.mediaUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline mb-2 text-xs"
                          >
                            📎 Arquivo anexo
                          </a>
                        )}
                        <div className={isCliente ? 'text-slate-800 dark:text-slate-100' : isIA ? 'text-blue-800 dark:text-blue-100' : 'text-emerald-800 dark:text-emerald-100'}>{msg.content || (msg.mediaUrl ? '' : '(sem conteúdo)')}</div>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400 dark:text-slate-400">
                        <span>{new Date(msg.createdAt || msg.sentAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                        {isIA && <span className="text-blue-600 dark:text-blue-400 font-semibold bg-blue-100 dark:bg-blue-900/50 px-1.5 py-0.5 rounded text-[10px]">{'\uD83E\uDD16'} IA</span>}
                        {isOp && <span className="text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-100 dark:bg-emerald-900/50 px-1.5 py-0.5 rounded text-[10px]">{'\uD83D\uDC64'} Operador</span>}
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>

              {/* Input de mensagem — fixo abaixo do chat */}
              <div className="flex-shrink-0 border-t border-slate-200 dark:border-slate-700 p-2 bg-white dark:bg-slate-800 flex gap-2 items-center">
                <input
                  type="text"
                  value={novaMsg}
                  onChange={(e) => setNovaMsg(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Digite sua mensagem..."
                  className="flex-1 text-sm text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 outline-none bg-transparent px-2"
                  disabled={enviando}
                />
                <button
                  onClick={enviarMensagem}
                  disabled={!novaMsg.trim() || enviando}
                  className="text-blue-600 dark:text-blue-400 font-semibold text-sm px-3 py-1 hover:text-blue-800 dark:hover:text-blue-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Enviar
                </button>
              </div>
            </div>
          ) : aba === 'timeline' ? (
            <div className="flex-1 min-h-0 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-900">
              {timelineEvents.length === 0 ? (
                <div className="text-center py-12 text-sm text-slate-400 dark:text-slate-500">
                  Nenhum evento registrado
                </div>
              ) : (
                <div className="space-y-0">
                  {timeBlocks.length > 0 && (
                    <div className="mb-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock size={14} className="text-indigo-600 dark:text-indigo-400" />
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">Blocos de Tempo</span>
                        <span className="ml-auto text-[11px] text-slate-400 dark:text-slate-500">
                          {formatTimeTotal(timeBlocks)}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {timeBlocks.map((blk: any, bi: number) => (
                          <div key={blk.id || bi} className="flex items-start justify-between gap-2 text-sm">
                            <div className="flex-1 min-w-0">
                              <p className="text-slate-700 dark:text-slate-300">
                                {blk.usuario}
                                {blk.tarefa ? ` — ${blk.tarefa.titulo}` : ''}
                              </p>
                              {blk.descricao && (
                                <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{blk.descricao}</p>
                              )}
                              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                                {blk.dataInicio ? new Date(blk.dataInicio).toLocaleString('pt-BR') : ''}
                                {blk.tipo ? ` · ${tipoLabel(blk.tipo)}` : ''}
                              </p>
                            </div>
                            <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                              {formatMin(blk.duracaoMin)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {timelineEvents.slice(0, 20).map((ev: any, i: number) => {
                    const icon = getTimelineIcon(ev);
                    return (
                      <div key={ev.id || i} className="flex gap-3 py-2 relative">
                        {i < timelineEvents.length - 1 && (
                          <div className="absolute left-[11px] top-[26px] bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700" />
                        )}
                        <div className={`w-[22px] h-[22px] rounded-full border-2 ${icon.color} flex items-center justify-center flex-shrink-0 z-10 text-[10px]`}>
                          {icon.emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-700 dark:text-slate-300">{ev.descricao || ev.tipo}</p>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500">
                            {new Date(ev.createdAt).toLocaleString('pt-BR')}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : aba === 'os' ? (
            <div className="flex-1 min-h-0 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <ClipboardList size={15} className="text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Ordens de Serviço</span>
                  {ordens.length > 0 && (
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded-full">{ordens.length}</span>
                  )}
                </div>
                <button
                  onClick={criarOs}
                  disabled={criandoOs}
                  className="flex items-center gap-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  {criandoOs ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Criar OS
                </button>
              </div>

              {osError && (
                <div className="mb-3 flex items-center gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                  <AlertTriangle size={13} />
                  {osError}
                </div>
              )}

              {ordens.length === 0 ? (
                <div className="text-center py-12 text-sm text-slate-400 dark:text-slate-500">
                  Nenhuma ordem de serviço vinculada a este ticket.
                  <div className="mt-1 text-xs">Clique em "Criar OS" para gerar uma a partir do ticket.</div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {ordens.map((os: any) => (
                    <div key={os.id} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText size={15} className="text-slate-400 dark:text-slate-500 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{os.numeroOs}</p>
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{tipoLabel(os.tipoServico)} · {os.client?.nomeFantasia || os.client?.razaoSocial || '—'}</p>
                          </div>
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-1 rounded-full whitespace-nowrap ${OS_STATUS_COLOR[os.status] || 'bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300'}`}>
                          {OS_STATUS_LABEL[os.status] || os.status}
                        </span>
                      </div>

                      {os.descricaoServico && (
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{os.descricaoServico}</p>
                      )}

                      <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px] text-slate-400 dark:text-slate-500">
                        <span className="flex items-center gap-1.5 min-w-0">
                          <UserCheck size={12} className="flex-shrink-0" />
                          <span className="truncate">{os.tecnicoResponsavel?.name || 'Sem técnico'}</span>
                        </span>
                        <span className="flex items-center gap-1.5 whitespace-nowrap">
                          {os.valorServico != null && os.valorServico > 0 && (
                            <span className="font-medium text-slate-600 dark:text-slate-300">
                              {Number(os.valorServico).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                          )}
                          {os.signature?.assinadoEm && (
                            <span title={`Assinada em ${new Date(os.signature.assinadoEm).toLocaleString('pt-BR')}`}>✍️</span>
                          )}
                        </span>
                      </div>

                      <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                        <span className="text-[11px] text-slate-400 dark:text-slate-500">
                          Criada em {os.createdAt ? new Date(os.createdAt).toLocaleDateString('pt-BR') : '—'}
                        </span>
                        <button
                          onClick={() => navigate(`/app/orders/${os.id}`)}
                          className="flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                        >
                          <ExternalLink size={12} />
                          Abrir OS
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : aba === 'indicadores' ? (
            <div className="flex-1 min-h-0 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-900 space-y-3">
              {/* SLA em tempo real */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <Clock size={15} className="text-blue-600 dark:text-blue-400" /> <AcronymText text="SLA em tempo real" />
                  </h3>
                  {slaIndicador?.pausado && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                      ⏸ Pausado
                    </span>
                  )}
                </div>
                {slaIndicador ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold ${
                          slaIndicador.classificacao.estado === 'fora'
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border border-red-200 dark:border-red-800'
                            : slaIndicador.classificacao.estado === 'atencao'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        }`}>
                          {slaIndicador.classificacao.icone} {slaIndicador.classificacao.texto}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-slate-900 dark:text-white">
                          {slaIndicador.percentualConsumido}% <span className="text-xs font-medium text-slate-400 dark:text-slate-500">consumido</span>
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {slaIndicador.restantesMinutos > 0
                            ? `${formatMin(slaIndicador.restantesMinutos)} restantes de ${formatMin(slaIndicador.totalMinutos)}`
                            : `${formatMin(slaIndicador.totalMinutos)} excedido`}
                          {slaIndicador.finalizado ? ' · Concluído' : ''} · Fonte: {slaIndicador.fonte}
                        </p>
                      </div>
                    </div>
                    <div className="h-2.5 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700">
                      <div
                        className={`h-full transition-all ${slaIndicador.classificacao.estado === 'fora' ? 'bg-red-500' : slaIndicador.classificacao.estado === 'atencao' ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.min(100, slaIndicador.percentualConsumido)}%` }}
                      />
                    </div>
                    {slaIndicador.classificacao.estado === 'atencao' && (
                      <p className="text-[11px] text-amber-700 dark:text-amber-400">
                        ⚠️ <AcronymText text="SLA" /> em risco a partir de {slaIndicador.slaRiscoPct}% consumido — priorize este atendimento.
                      </p>
                    )}
                    {slaIndicador.classificacao.estado === 'fora' && (
                      <p className="text-[11px] text-red-700 dark:text-red-400">
                        ⛔ <AcronymText text="SLA" /> violado. Registre a justificativa do atraso no encerramento.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 dark:text-slate-500">SLA não configurado para este ticket.</p>
                )}
              </div>

              {/* Métricas do atendimento */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
                  <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Tempo total</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{formatMin(tempoTotalMin)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
                  <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Primeira resposta</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{primeiraRespostaMin != null ? formatMin(primeiraRespostaMin) : '—'}</p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
                  <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">TME — espera do cliente</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{tmeTicketMin != null ? formatMin(tmeTicketMin) : '—'}</p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
                  <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Última interação</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white text-sm">{tempoRelativo(ultimaInteracao)}</p>
                </div>
              </div>

              {/* TMR esperado vs meta (config) */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-xs text-slate-500 dark:text-slate-400">
                A avaliação completa de <AcronymText text="TMR/TME/SLA" /> por período e por analista está disponível na página{' '}
                <Link to="/app/helpdesk/indicadores" className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                  Indicadores de Atendimento
                </Link>.
              </div>
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-900">
              <TicketChecklist ticketId={ticketId!} onChange={loadTicket} />
            </div>
          )}
        </div>

        {/* === PANEL CLIENTE (drawer no mobile / coluna fixa no desktop) === */}
        {sidebarAberta && (
          <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarAberta(false)} />
        )}
        <aside
          className={`fixed top-0 right-0 bottom-0 z-50 w-[86%] max-w-sm bg-white dark:bg-slate-800 shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col ${
            sidebarAberta ? 'translate-x-0' : 'translate-x-full'
          } lg:static lg:z-auto lg:translate-x-0 lg:shadow-none lg:w-auto lg:max-w-none lg:h-full lg:min-h-0 lg:border-l lg:border-slate-200 lg:dark:border-slate-700 lg:rounded-none ${
            focusMode ? 'lg:hidden' : ''
          }`}
        >
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 lg:hidden">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Detalhes do Ticket</span>
            <button
              onClick={() => setSidebarAberta(false)}
              className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
            {/* Dados do Atendimento */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
              <div className="flex items-center gap-2 mb-3">
                <Info size={14} className="text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">Dados do Atendimento</span>
              </div>
              <dl className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Hash size={12} /> Status
                  </dt>
                  <dd className="font-semibold text-slate-700 dark:text-slate-200">{STATUS_LABELS[ticket.status] || ticket.status || '—'}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-slate-500 dark:text-slate-400">Prioridade</dt>
                  <dd className="font-semibold text-slate-700 dark:text-slate-200">{PRIORIDADE_LABELS[ticket.prioridade] || '—'}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Building2 size={12} /> Departamento
                  </dt>
                  <dd className="font-semibold text-slate-700 dark:text-slate-200 truncate">{ticket.departamento?.nome || '—'}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-slate-500 dark:text-slate-400">Fila</dt>
                  <dd className="font-semibold text-slate-700 dark:text-slate-200">{ETAPA_LABELS[ticket.etapa] || ticket.etapa || '—'}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <UserCheck size={12} /> Analista
                  </dt>
                  <dd className="font-semibold text-slate-700 dark:text-slate-200 truncate">{ticket.assignee?.name || '—'}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <ShieldCheck size={12} /> <AcronymText text="SLA" />
                  </dt>
                  <dd className={`font-semibold ${slaInfo && slaInfo.status === 'violado' ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'}`}>
                    {slaInfo ? (slaInfo.status === 'no_prazo' ? 'Dentro do prazo' : `Violado (${slaInfo.consumido}/${slaInfo.limite}min)`) : '—'}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Prazo de Entrega */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
              <div className="flex items-center gap-2 mb-3">
                <Calendar size={14} className="text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">Prazo de Entrega</span>
              </div>
              {getDeadlineStatus() && (
                <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg mb-2 ${getDeadlineStatus()!.color}`}>
                  {(() => { const Icon = getDeadlineStatus()!.icon; return <Icon size={12} />; })()}
                  {getDeadlineStatus()!.label}
                </div>
              )}
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => { setSemPrazo(!semPrazo); }}
                  className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400"
                >
                  {semPrazo ? <ToggleRight size={18} className="text-emerald-500" /> : <ToggleLeft size={18} className="text-slate-400" />}
                  Sem prazo
                </button>
              </div>
              {!semPrazo && (
                <input
                  type="datetime-local"
                  value={prazoEntrega}
                  onChange={(e) => setPrazoEntrega(e.target.value)}
                  onBlur={salvarPrazo}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-400 transition-colors text-slate-700 dark:text-slate-300"
                />
              )}
              {prazoEntrega !== (ticket?.prazoEntrega ? new Date(ticket.prazoEntrega).toISOString().slice(0, 16) : '') || semPrazo !== (ticket?.semPrazo || false) ? (
                <button
                  onClick={salvarPrazo}
                  disabled={salvandoPrazo}
                  className="mt-2 w-full text-xs bg-blue-600 hover:bg-blue-700 text-white py-1.5 rounded-lg font-medium disabled:opacity-40 transition-colors"
                >
                  {salvandoPrazo ? 'Salvando...' : 'Salvar Prazo'}
                </button>
              ) : null}
            </div>

            {/* Horas de Desenvolvimento */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
              <div className="flex items-center gap-2 mb-3">
                <Clock size={14} className="text-amber-600 dark:text-amber-400" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">Horas Desenvolvimento</span>
              </div>
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  value={horasDesenv}
                  onChange={(e) => setHorasDesenv(e.target.value === '' ? '' : Number(e.target.value))}
                  onBlur={salvarHorasDesenv}
                  placeholder="0"
                  min={0}
                  step={0.5}
                  className="flex-1 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-400 transition-colors text-slate-700 dark:text-slate-300"
                />
                <span className="text-xs text-slate-500 dark:text-slate-400">horas</span>
              </div>
            </div>

            {/* Tempo por Departamento */}
            {deptTempos.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                <div className="flex items-center gap-2 mb-3">
                  <Building2 size={14} className="text-purple-600 dark:text-purple-400" />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">Tempo por Depto</span>
                </div>
                <div className="space-y-2">
                  {deptTempos.map((dt: any) => {
                    const mins = dt.duracaoMin || 0;
                    const horas = Math.floor(mins / 60);
                    const minsResto = mins % 60;
                    return (
                      <div key={dt.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: dt.departamento?.cor || '#6366f1' }} />
                          <span className="text-xs text-slate-600 dark:text-slate-400">{dt.departamento?.nome}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            {horas > 0 ? `${horas}h ` : ''}{minsResto}min
                          </span>
                          {dt.emAndamento && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">agora</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <TicketSidebar ticket={ticket} cliente={cliente} lastEvents={timelineEvents} historicoContato={historicoContato} onTagsChange={() => loadTicket()} />

            {/* Link para o CRM */}
            {cliente?.id && (
              <div className="pt-1">
                <button
                  onClick={() => navigate(`/app/crm/${cliente.id}`)}
                  className="w-full flex items-center justify-center gap-2 text-xs font-medium text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-700 rounded-lg py-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <ExternalLink size={13} /> Ver no CRM
                </button>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* === ACOES DO TICKET === */}
      <div className={`flex-shrink-0 px-4 pb-3 ${focusMode ? 'hidden' : ''}`}>
        <TicketRodape ticket={ticket} ticketId={ticketId!} onFinalizar={loadTicket} onMover={loadTicket} />
      </div>

      {/* === RESUMO DO TICKET (indicadores rapidos — dados reais) === */}
      <div className={`flex-shrink-0 px-4 pb-4 lg:pb-6 ${focusMode ? 'hidden' : ''}`}>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
          <button
            onClick={() => setSummaryExpanded((s) => !s)}
            className="w-full flex items-center gap-2 px-4 py-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <BarChart3 size={14} className="text-blue-500" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex-1 text-left">
              Resumo do Ticket
            </span>
            {summaryExpanded ? (
              <ChevronDown size={14} className="text-slate-400" />
            ) : (
              <ChevronUp size={14} className="text-slate-400" />
            )}
          </button>
          {summaryExpanded && (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 divide-x divide-y sm:divide-y-0 divide-slate-100 dark:divide-slate-700">
              {renderMetric('Tempo total', tempoTotalMin != null ? formatMin(tempoTotalMin) : '—', <Timer size={15} className="text-blue-500" />)}
              {renderMetric('1ª resposta', primeiraRespostaMin != null ? formatMin(primeiraRespostaMin) : '—', <MessageSquare size={15} className="text-emerald-500" />)}
              {renderMetric('Última interação', tempoRelativo(ultimaInteracao ?? undefined), <Clock size={15} className="text-amber-500" />)}
              {renderMetric('Satisfação', csatNota != null ? `${csatNota}/5` : 'Não avaliado', <Star size={15} className={csatNota != null ? 'text-yellow-500 fill-yellow-400' : 'text-slate-400'} />)}
              {renderMetric(
                'SLA',
                slaInfo ? (slaInfo.status === 'no_prazo' ? 'Dentro do prazo' : `${slaInfo.consumido}/${slaInfo.limite}min`) : '—',
                slaInfo && slaInfo.status === 'violado' ? <ShieldAlert size={15} className="text-red-500" /> : <ShieldCheck size={15} className={slaInfo ? 'text-emerald-500' : 'text-slate-400'} />,
                slaInfo && slaInfo.status === 'violado' ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-100'
              )}
              {renderMetric('Anexos', totalAnexos > 0 ? String(totalAnexos) : '—', <Paperclip size={15} className="text-violet-500" />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
