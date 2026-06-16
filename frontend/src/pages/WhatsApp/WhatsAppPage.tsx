import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../services/auth';
import { playSound, initAudioContext } from '../../services/soundAlerts';
import { isAlertSoundEnabled, getAlertColor } from '../Settings/AlertSettings';
import { Bluetooth, BluetoothOff, RefreshCw, Send, Plus, Search, MessageSquare, User, Phone, AlertCircle, X, FileText, Building2, Calendar, DollarSign, Tag, ArrowRightLeft, Bot, ClipboardList, ArrowUpDown, XCircle } from 'lucide-react';
import QRCode from 'qrcode';

export default function WhatsAppPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [connected, setConnected] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [waState, setWaState] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [messageText, setMessageText] = useState('');
  const [search, setSearch] = useState('');
  const [orderBy, setOrderBy] = useState('updatedAt_desc');
  const [loading, setLoading] = useState(true);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [newTicket, setNewTicket] = useState({ contactName: '', contactPhone: '', assunto: '' });
  const [showAbrirChamado, setShowAbrirChamado] = useState(false);
  const [showTransferir, setShowTransferir] = useState(false);
  const [usuarios, setUsuarios] = useState<any[]>([]);
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
  const [transferirPara, setTransferirPara] = useState('');
  const [transferirMotivo, setTransferirMotivo] = useState('');
  const [transferirSaving, setTransferirSaving] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState<any[]>([]);
  const [showCreateClient, setShowCreateClient] = useState(false);
  const [newClient, setNewClient] = useState({ razaoSocial: '', telefone: '', cnpj: '', email: '' });
  const [creatingClient, setCreatingClient] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const msgPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialLoadedRef = useRef(false);
  const prevTicketsCountRef = useRef(0);
  const prevMessagesCountRef = useRef(0);
  const firstLoadDoneRef = useRef(false);

  useEffect(() => { initAudioContext(); }, []);

  const CATEGORIAS = [
    { value: 'suporte_tecnico', label: 'Suporte Tecnico' },
    { value: 'duvida_faturamento', label: 'Duvida de Faturamento' },
    { value: 'solicitacao_mudanca', label: 'Solicitacao de Mudanca' },
    { value: 'treinamento', label: 'Treinamento' },
    { value: 'reclamacao', label: 'Reclamacao' },
    { value: 'orcamento', label: 'Orcamento / Comercial' },
    { value: 'agendamento', label: 'Agendamento' },
    { value: 'outro', label: 'Outro' },
  ];

  const TIPOS = [
    { value: 'bug', label: 'Bug' },
    { value: 'duvida', label: 'Duvida' },
    { value: 'solicitacao', label: 'Solicitacao' },
    { value: 'reclamacao', label: 'Reclamacao' },
  ];

  const PRIORIDADES = [
    { value: 'baixa', label: 'Baixa' },
    { value: 'media', label: 'Media' },
    { value: 'alta', label: 'Alta' },
    { value: 'urgente', label: 'Urgente' },
  ];

  const statusStyles: Record<string, string> = {
    aberto: 'bg-blue-100 text-blue-700',
    em_andamento: 'bg-amber-100 text-amber-700',
    fechado: 'bg-green-100 text-green-700',
    pendente: 'bg-gray-100 text-gray-700',
  };

  const clientStatusStyles: Record<string, string> = {
    ativo: 'bg-green-100 text-green-700',
    suspenso: 'bg-amber-100 text-amber-700',
    cancelado: 'bg-red-100 text-red-700',
    prospecto: 'bg-blue-100 text-blue-700',
    inativo: 'bg-gray-100 text-gray-700',
  };

  const formatCurrency = (v?: number) => {
    if (v == null) return '—';
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatDate = (d?: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('pt-BR');
  };

  const loadStatus = useCallback(async () => {
    try {
      const { data } = await api.get('/whatsapp/status');
      setConnected(data.connected);
      setConnectionError(data.error || null);
      setWaState(data.state || null);
      if (data.qrCode) {
        setQrCode(data.qrCode);
        const url = await QRCode.toDataURL(data.qrCode, { width: 256, margin: 1 });
        setQrDataUrl(url);
      } else if (data.connected) {
        setQrCode(null);
        setQrDataUrl(null);
      }
      if (data.connected) {
        setConnecting(false);
      }
    } catch (err) { console.error(err); }
  }, []);

  const loadTickets = useCallback(async () => {
    try {
      const { data } = await api.get('/whatsapp/tickets', { params: { limit: 100, orderBy } });
      setTickets(data.tickets || []);
    } catch (err) { console.error(err); }
    finally {
      if (!initialLoadedRef.current) {
        initialLoadedRef.current = true;
        setLoading(false);
      }
    }
  }, [orderBy]);

  const loadMessages = useCallback(async (ticketId: string) => {
    try {
      const { data } = await api.get(`/whatsapp/tickets/${ticketId}`);
      setSelectedTicket(data);
      setMessages(data.messages || []);
    } catch (err) { console.error(err); }
  }, []);

  const loadDepartamentos = useCallback(async () => {
    try {
      const params: any = {};
      if (user?.role === 'tecnico') params.mine = 'true';
      const { data } = await api.get('/helpdesk/departamentos', { params });
      setDepartamentos(data.filter((d: any) => d.ativo));
    } catch { }
  }, [user?.role]);

  useEffect(() => {
    loadStatus();
    loadTickets();
    loadDepartamentos();
  }, [loadStatus, loadTickets, loadDepartamentos]);

  useEffect(() => {
    if (!firstLoadDoneRef.current) {
      prevTicketsCountRef.current = tickets.length;
      prevMessagesCountRef.current = messages.length;
      if (tickets.length > 0 || messages.length > 0) {
        firstLoadDoneRef.current = true;
      }
      return;
    }
    if (tickets.length > prevTicketsCountRef.current) {
      if (isAlertSoundEnabled('novo_ticket')) {
        playSound('cliente_entrou');
      }
    }
    prevTicketsCountRef.current = tickets.length;
  }, [tickets, messages]);

  useEffect(() => {
    if (!firstLoadDoneRef.current) return;
    if (messages.length > prevMessagesCountRef.current) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && !lastMsg.fromMe) {
        if (isAlertSoundEnabled('cliente_resposta')) {
          playSound('nova_mensagem');
        }
      }
    }
    prevMessagesCountRef.current = messages.length;
  }, [messages]);

  useEffect(() => {
    const interval = (!connected || connecting) ? 2000 : 5000;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => { loadStatus(); loadTickets(); }, interval);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [connected, connecting, loadStatus, loadTickets]);

  useEffect(() => {
    if (selectedTicketId) {
      loadMessages(selectedTicketId);
      if (msgPollRef.current) clearInterval(msgPollRef.current);
      msgPollRef.current = setInterval(() => loadMessages(selectedTicketId), 3000);
    } else {
      if (msgPollRef.current) { clearInterval(msgPollRef.current); msgPollRef.current = null; }
      setSelectedTicket(null);
      setMessages([]);
    }
    return () => { if (msgPollRef.current) clearInterval(msgPollRef.current); };
  }, [selectedTicketId, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  const handleSelectTicket = (ticket: any) => {
    setSelectedTicketId(ticket.id);
  };

  const connectWhatsApp = async () => {
    try {
      setConnecting(true);
      setConnectionError(null);
      await api.post('/whatsapp/connect');
      loadStatus();
      setTimeout(loadStatus, 1500);
      setTimeout(loadStatus, 3000);
      setTimeout(loadStatus, 5000);
    } catch (err) { console.error(err); setConnecting(false); }
  };

  const disconnectWhatsApp = async () => {
    try {
      await api.post('/whatsapp/disconnect');
      setConnected(false);
      setQrCode(null);
      setQrDataUrl(null);
      setConnecting(false);
    } catch (err) { console.error(err); }
  };

  const reconnectWhatsApp = async () => {
    try {
      setConnecting(true);
      setConnectionError(null);
      await api.post('/whatsapp/reconnect');
      loadStatus();
      setTimeout(loadStatus, 1500);
      setTimeout(loadStatus, 3000);
      setTimeout(loadStatus, 5000);
    } catch (err) { console.error(err); setConnecting(false); }
  };

  const sendMessage = async () => {
    if (!messageText.trim()) return;
    if (!selectedTicket?.contactPhone) {
      setSendError('Número de telefone não disponível para este ticket');
      return;
    }
    setSendError(null);
    try {
      await api.post('/whatsapp/send', {
        to: selectedTicket.contactPhone,
        message: messageText.trim(),
        ticketId: selectedTicket.id,
      });
      setMessageText('');
      if (selectedTicketId) loadMessages(selectedTicketId);
    } catch (err: any) {
      setSendError(err.response?.data?.error || 'Erro ao enviar mensagem');
    }
  };

  const createTicket = async () => {
    try {
      const { data } = await api.post('/whatsapp/tickets', newTicket);
      setShowNewTicket(false);
      setNewTicket({ contactName: '', contactPhone: '', assunto: '' });
      loadTickets();
      setSelectedTicketId(data.id);
    } catch (err) { console.error(err); }
  };

  const createOS = () => {
    if (!selectedTicket) return;
    navigate(`/app/orders/new?clientId=${selectedTicket.client?.id || ''}&ticketId=${selectedTicket.id}`);
  };

  const carregarUsuarios = useCallback(async () => {
    try {
      const { data } = await api.get('/users');
      setUsuarios(Array.isArray(data) ? data : data?.items || data?.users || []);
    } catch {}
  }, []);

  const abrirModalAbrirChamado = () => {
    if (!selectedTicket) return;
    setAbrirChamado({
      assunto: selectedTicket.assunto || '',
      categoria: selectedTicket.categoria || '',
      prioridade: selectedTicket.prioridade || 'media',
      tipo: selectedTicket.tipo || '',
      observacoes: selectedTicket.observacoes || '',
      departamentoId: selectedTicket.departamentoId || '',
    });
    setSelectedClientId(selectedTicket.client?.id || null);
    setClientSearch(selectedTicket.client?.razaoSocial || selectedTicket.contactName || '');
    setClientResults([]);
    setShowCreateClient(false);
    setShowAbrirChamado(true);
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
      setSendError(err?.response?.data?.error || 'Erro ao criar cliente');
    } finally {
      setCreatingClient(false);
    }
  };

  const confirmarAbrirChamado = async () => {
    if (!selectedTicket || !abrirChamado.assunto.trim()) return;
    setAbrirSaving(true);
    try {
      const { data } = await api.post(`/whatsapp/tickets/${selectedTicket.id}/abrir`, {
        assunto: abrirChamado.assunto.trim(),
        categoria: abrirChamado.categoria || undefined,
        prioridade: abrirChamado.prioridade,
        tipo: abrirChamado.tipo || undefined,
        observacoes: abrirChamado.observacoes.trim() || undefined,
        clientId: selectedClientId || undefined,
        departamentoId: abrirChamado.departamentoId || undefined,
      });
      setSelectedTicket((prev: any) => ({ ...prev, ...data }));
      setShowAbrirChamado(false);
      setSelectedClientId(null);
      setClientSearch('');
      loadTickets();
      if (selectedTicketId) loadMessages(selectedTicketId);
    } catch (err: any) {
      setSendError(err.response?.data?.error || 'Erro ao abrir chamado');
    } finally {
      setAbrirSaving(false);
    }
  };

  const handleDescartar = async () => {
    if (!selectedTicket) return;
    if (!window.confirm(`Descartar ticket de ${selectedTicket.contactName}?\n\nNenhuma mensagem sera enviada ao cliente. O ticket sera movido para "Descartados".`)) return;
    try {
      await api.post(`/whatsapp/tickets/${selectedTicket.id}/descartar`);
      setSelectedTicket(null);
      setMessages([]);
      loadTickets();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao descartar ticket');
    }
  };

  const abrirModalTransferir = () => {
    setTransferirPara('');
    setTransferirMotivo('');
    carregarUsuarios();
    setShowTransferir(true);
  };

  const confirmarTransferir = async () => {
    if (!selectedTicket || !transferirPara) return;
    setTransferirSaving(true);
    try {
      const { data } = await api.post(`/whatsapp/tickets/${selectedTicket.id}/transferir`, {
        paraUsuarioId: transferirPara,
        motivo: transferirMotivo.trim() || undefined,
      });
      setSelectedTicket((prev: any) => ({ ...prev, ...data }));
      setShowTransferir(false);
      loadTickets();
    } catch (err: any) {
      setSendError(err.response?.data?.error || 'Erro ao transferir');
    } finally {
      setTransferirSaving(false);
    }
  };

  const filteredTickets = tickets.filter((t: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (t.contactName?.toLowerCase() || '').includes(q)
      || (t.contactPhone || '').includes(q)
      || (t.assunto?.toLowerCase() || '').includes(q)
      || (t.client?.razaoSocial || '').toLowerCase().includes(q)
      || (t.messages?.[0]?.content?.toLowerCase() || '').includes(q);
  });

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86400000) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 flex-shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <MessageSquare className="text-green-500" size={22} />
            <h1 className="text-xl font-bold text-codemed-700">WhatsApp</h1>
          </div>
          <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${connected ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
            {connected ? <><Bluetooth size={12} /> Conectado</> : <><BluetoothOff size={12} /> Desconectado</>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowNewTicket(true)} className="btn-primary text-sm flex items-center gap-1 min-h-[40px] px-3"><Plus size={14} /> Novo</button>
          {!connected && (
            <button onClick={reconnectWhatsApp} disabled={connecting} className="bg-amber-500 text-white text-sm px-3 py-2 rounded-lg hover:bg-amber-600 transition-colors font-medium flex items-center gap-1 disabled:opacity-50 min-h-[40px]">
              <RefreshCw size={14} /> Reconectar
            </button>
          )}
          {connected ? (
            <button onClick={disconnectWhatsApp} className="bg-red-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center gap-1 min-h-[40px]"><BluetoothOff size={14} /> Desconectar</button>
          ) : (
            <button onClick={connectWhatsApp} disabled={connecting} className="btn-primary text-sm flex items-center gap-1 disabled:opacity-50 min-h-[40px] px-3">
              {connecting ? <><RefreshCw size={14} className="animate-spin" /> Conectando</> : <><Bluetooth size={14} /> Conectar</>}
            </button>
          )}
        </div>
      </div>

      {connectionError && !connected && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle size={16} className="flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium">{connectionError}</p>
            {waState && <p className="text-xs mt-0.5 opacity-80">Estado interno: {waState}</p>}
          </div>
          <button onClick={reconnectWhatsApp} disabled={connecting} className="ml-auto text-xs bg-red-100 hover:bg-red-200 px-2 py-1 rounded font-medium disabled:opacity-50">
            {connecting ? 'Reconectando...' : 'Tentar reconectar'}
          </button>
        </div>
      )}

      {(connecting || (qrDataUrl && !connected)) && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={() => { if (!connecting) { setQrCode(null); setQrDataUrl(null); } }}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-xl text-center max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-lg text-gray-900 mb-1">Conectar WhatsApp</h3>
            {qrDataUrl ? (
              <>
                <p className="text-sm text-gray-500 mb-4">Abra o WhatsApp no celular<br />Menu &rarr; Dispositivos conectados &rarr; Conectar dispositivo</p>
                <img src={qrDataUrl} alt="QR Code" className="mx-auto w-56 h-56" />
                <p className="text-xs text-gray-400 mt-3">Escaneie o QR Code acima com o WhatsApp</p>
              </>
            ) : (
              <div className="py-8">
                <div className="flex justify-center mb-3">
                  <RefreshCw size={32} className="animate-spin text-green-500" />
                </div>
                <p className="text-sm text-gray-500">Gerando QR Code...</p>
                <p className="text-xs text-gray-400 mt-1">Aguarde alguns segundos</p>
              </div>
            )}
            {connectionError && (
              <div className="mt-3 bg-red-50 dark:bg-red-900/30 border border-red-200 rounded-lg px-3 py-2">
                <p className="text-xs text-red-600">{connectionError}</p>
              </div>
            )}
            <button onClick={() => { if (!connecting) { setQrCode(null); setQrDataUrl(null); } }} className="mt-4 text-sm text-gray-500 hover:text-gray-700">Fechar</button>
          </div>
        </div>
      )}

      <div className="flex-1 flex min-h-0 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 overflow-hidden">
        <div className={`${selectedTicket ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 flex-shrink-0 border-r border-gray-200 flex flex-col bg-gray-50/50`}>
          <div className="p-3 border-b border-gray-200 bg-white dark:bg-slate-800 space-y-2">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Pesquisar conversa..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm border border-neutral-200 rounded-lg focus:ring-1 focus:ring-green-500 focus:border-green-500 outline-none" />
            </div>
            <div className="relative">
              <ArrowUpDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                value={orderBy}
                onChange={(e) => setOrderBy(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-neutral-200 rounded-lg focus:ring-1 focus:ring-green-500 focus:border-green-500 outline-none appearance-none bg-white dark:bg-slate-800 cursor-pointer"
              >
                <option value="updatedAt_desc">Mais recente primeiro</option>
                <option value="updatedAt_asc">Mais antigo primeiro</option>
                <option value="dataAbertura_desc">Abertura (recente)</option>
                <option value="dataAbertura_asc">Abertura (antigo)</option>
                <option value="contactName_asc">Nome A-Z</option>
                <option value="contactName_desc">Nome Z-A</option>
                <option value="lastMessageCliente_desc">Ultima msg do cliente</option>
                <option value="lastMessage_desc">Ultima msg (qualquer)</option>
              </select>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-8"><RefreshCw size={20} className="animate-spin text-gray-400" /></div>
            ) : filteredTickets.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                {search ? 'Nenhuma conversa encontrada' : 'Nenhuma conversa ainda'}
              </div>
            ) : (
              filteredTickets.map((ticket: any) => {
                const lastMsg = ticket.messages?.[0];
                const isSelected = ticket.id === selectedTicketId;
                return (
                  <div key={ticket.id} onClick={() => handleSelectTicket(ticket)}
                    className={`flex items-start gap-3 px-4 py-3 cursor-pointer border-b border-neutral-100 transition-colors ${isSelected ? 'bg-green-50 border-l-2 border-l-green-500' : 'hover:bg-neutral-100'}`}>
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <User size={18} className="text-green-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm text-gray-900 truncate">
                          {ticket.contactName || ticket.contactPhone || 'Desconhecido'}
                        </span>
                        <span className="text-xs text-gray-400 flex-shrink-0">{lastMsg ? formatTime(lastMsg.sentAt || ticket.updatedAt) : formatTime(ticket.updatedAt)}</span>
                      </div>
                      {ticket.client && (
                        <p className="text-[11px] text-gray-500 truncate flex items-center gap-1 mt-0.5">
                          <Building2 size={9} /> {ticket.client.razaoSocial || ticket.client.nomeFantasia}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${statusStyles[ticket.status] || ''}`}>{ticket.status?.replace('_', ' ')}</span>
                        {ticket.protocolo && <span className="text-[10px] text-neutral-400 font-mono">{ticket.protocolo}</span>}
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {lastMsg ? `${lastMsg.fromMe ? 'Você: ' : ''}${lastMsg.content || '(mídia)'}` : ticket.assunto || 'Sem mensagens'}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className={`${selectedTicket ? 'flex' : 'hidden md:flex'} flex-1 flex-col`}>
          {selectedTicket ? (
            <>
              <div className="flex items-center gap-2 px-3 sm:px-5 py-3 border-b border-gray-200 bg-white dark:bg-slate-800 flex-shrink-0">
                <button onClick={() => setSelectedTicketId(null)} className="md:hidden p-1 hover:bg-neutral-100 rounded text-neutral-500 mr-1">
                  <ArrowRightLeft size={16} className="rotate-180" />
                </button>
                <div className="flex items-center justify-between flex-1 min-w-0">
                   <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                     <User size={16} className="text-green-500" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-sm text-gray-900 truncate">{selectedTicket.contactName || selectedTicket.client?.razaoSocial || 'Desconhecido'}</h3>
                        {selectedTicket.protocolo && <span className="text-[10px] font-mono text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded flex-shrink-0">{selectedTicket.protocolo}</span>}
                      </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><Phone size={10} />{selectedTicket.contactPhone}</span>
                      {selectedTicket.client?.razaoSocial && <span className="hidden sm:inline">• {selectedTicket.client.razaoSocial}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 flex-wrap">
                  <span className={`badge text-[10px] sm:text-xs ${statusStyles[selectedTicket.status] || ''}`}>{selectedTicket.status?.replace('_', ' ')}</span>
                  {!selectedTicket.protocolo && (
                    <span className="hidden sm:flex badge text-xs bg-amber-100 text-amber-700 items-center gap-1"><ClipboardList size={10} /> Aguardando decisao</span>
                  )}
                  {!selectedTicket.protocolo && (
                    <button onClick={abrirModalAbrirChamado} className="bg-blue-600 text-white text-xs px-2.5 py-1.5 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-1 min-h-[36px]" title="Abrir chamado (gerar protocolo + atribuir a voce)">
                      <ClipboardList size={12} /> <span className="hidden sm:inline">Abrir Chamado</span>
                    </button>
                  )}
                  {!selectedTicket.protocolo && (
                    <button onClick={handleDescartar} className="bg-neutral-100 text-neutral-700 text-xs px-2.5 py-1.5 rounded-lg hover:bg-neutral-200 transition-colors font-medium flex items-center gap-1 min-h-[36px]" title="Descartar (tira da fila sem mandar msg ao cliente)">
                      <XCircle size={12} /> <span className="hidden sm:inline">Descartar</span>
                    </button>
                  )}
                  {selectedTicket.protocolo && selectedTicket.assigneeId && (
                    <button onClick={abrirModalTransferir} className="bg-neutral-100 text-neutral-700 text-xs px-2.5 py-1.5 rounded-lg hover:bg-neutral-200 transition-colors font-medium flex items-center gap-1 min-h-[36px]" title="Transferir atendimento para outro usuario">
                      <ArrowRightLeft size={12} /> <span className="hidden sm:inline">Transferir</span>
                    </button>
                  )}
                   <button onClick={createOS} className="btn-primary text-xs flex items-center gap-1 min-h-[36px] px-2.5"><Plus size={12} /> OS</button>
                </div>
                </div>
              </div>

              {selectedTicket.client && (
                <div className="px-3 sm:px-5 py-3 border-b border-gray-200 bg-gradient-to-r from-blue-50/40 to-green-50/40 dark:from-blue-900/30 dark:to-emerald-900/30 flex-shrink-0">
                  <div className="flex items-start gap-2 mb-2">
                    <Building2 size={14} className="text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900">{selectedTicket.client.razaoSocial}</span>
                        {selectedTicket.client.nomeFantasia && selectedTicket.client.nomeFantasia !== selectedTicket.client.razaoSocial && (
                          <span className="text-xs text-gray-500">({selectedTicket.client.nomeFantasia})</span>
                        )}
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${clientStatusStyles[selectedTicket.client.status] || 'bg-gray-100 text-gray-700'}`}>
                          {selectedTicket.client.status || 'sem status'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-600 flex-wrap">
                        {selectedTicket.client.cnpjCpf && <span>CNPJ/CPF: {selectedTicket.client.cnpjCpf}</span>}
                        {selectedTicket.client.segmento && (
                          <span className="flex items-center gap-1"><Tag size={10} /> {selectedTicket.client.segmento}</span>
                        )}
                        {(selectedTicket.client as any).tipoContrato && (
                          <span className="flex items-center gap-1"><FileText size={10} /> {(selectedTicket.client as any).tipoContrato}</span>
                        )}
                        {(selectedTicket.client as any).valorMensalidade != null && (
                          <span className="flex items-center gap-1"><DollarSign size={10} /> {formatCurrency((selectedTicket.client as any).valorMensalidade)}/mês</span>
                        )}
                        {(selectedTicket.client as any).dataFimContrato && (
                          <span className="flex items-center gap-1"><Calendar size={10} /> até {formatDate((selectedTicket.client as any).dataFimContrato)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 space-y-2 bg-gray-50/30">
                {messages.map((msg: any) => {
                  const isAudio = msg.mimeType?.startsWith('audio/');
                  const isImage = msg.mimeType?.startsWith('image/');
                  const isVideo = msg.mimeType?.startsWith('video/');
                  const mediaSrc = msg.mediaUrl && msg.mimeType
                    ? `data:${msg.mimeType};base64,${msg.mediaUrl}`
                    : null;
                  const isBot = msg.source === 'bot';
                  const isSystem = msg.tipo === 'system' || isBot;

                  if (isSystem) {
                    return (
                      <div key={msg.id} className="flex justify-center">
                        <div className="max-w-[85%] bg-violet-50 border border-violet-200 rounded-xl px-4 py-2 text-center">
                          <p className="text-[10px] font-bold text-violet-500 mb-0.5 uppercase">🤖 Sistema</p>
                          <p className="text-xs text-violet-700 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                          <p className="text-[10px] text-violet-400 mt-1">
                            {msg.sentAt ? new Date(msg.sentAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
                          </p>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={msg.id} className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                        msg.fromMe
                          ? 'bg-green-500 text-white rounded-br-sm'
                          : 'bg-white dark:bg-slate-800 border border-neutral-200 text-neutral-900 rounded-bl-sm'
                      }`}>
                        {isAudio && mediaSrc && (
                          <div className="mb-1">
                            <audio controls preload="none" className="w-full h-9 max-w-[220px]">
                              <source src={mediaSrc} type={msg.mimeType} />
                            </audio>
                          </div>
                        )}
                        {isImage && mediaSrc && (
                          <div className="mb-1">
                            <img src={mediaSrc} alt="Imagem" className="max-w-[220px] max-h-[160px] rounded-lg cursor-pointer" onClick={() => window.open(mediaSrc, '_blank')} />
                          </div>
                        )}
                        {isVideo && mediaSrc && (
                          <div className="mb-1">
                            <video controls preload="none" className="max-w-[220px] max-h-[160px] rounded-lg">
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
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                        )}
                        {msg.content === '(mídia)' && !mediaSrc && (
                          <p className="text-sm leading-relaxed whitespace-pre-wrap italic opacity-60">{msg.content}</p>
                        )}
                        <div className={`flex items-center gap-2 mt-1 ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
                          <span className={`text-[10px] ${msg.fromMe ? 'text-white/70' : 'text-gray-400'}`}>
                            {msg.sentAt ? new Date(msg.sentAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                          {msg.usuario?.name && <span className={`text-[10px] ${msg.fromMe ? 'text-white/70' : 'text-gray-400'}`}>{msg.usuario.name}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {messages.length === 0 && (
                  <div className="text-center py-12 text-gray-400 text-sm">Nenhuma mensagem ainda</div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="px-3 sm:px-5 py-2 bg-white dark:bg-slate-800 flex-shrink-0">
                {sendError && <p className="text-xs text-red-600 mb-1 flex items-center gap-1"><AlertCircle size={12} /> {sendError}</p>}
                {!connected && <p className="text-xs text-amber-600 mb-1 flex items-center gap-1"><AlertCircle size={12} /> WhatsApp desconectado — conecte-se para enviar mensagens</p>}
              </div>
              <div className="flex items-center gap-2 px-3 sm:px-5 py-3 border-t border-gray-200 bg-white dark:bg-slate-800 flex-shrink-0">
                <input type="text" value={messageText} onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Digite sua mensagem..."
                  className="flex-1 px-4 py-2.5 text-sm border border-neutral-200 rounded-full focus:ring-1 focus:ring-green-500 focus:border-green-500 outline-none bg-neutral-50" />
                <button onClick={sendMessage} disabled={!messageText.trim() || !connected}
                  className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center disabled:opacity-40 hover:bg-green-600 transition-colors">
                  <Send size={16} />
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-3">
              <MessageSquare size={48} className="text-gray-300" />
              <p className="text-sm">Selecione uma conversa para começar</p>
            </div>
          )}
        </div>
      </div>

      {showNewTicket && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={() => setShowNewTicket(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-xl w-full max-w-md mx-4 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-gray-900">Nova Conversa</h3>
              <button onClick={() => setShowNewTicket(false)} className="text-neutral-400 hover:text-neutral-600 p-1"><X size={20} /></button>
            </div>
            <input type="text" placeholder="Nome do contato" value={newTicket.contactName} onChange={(e) => setNewTicket({ ...newTicket, contactName: e.target.value })} className="input w-full" />
            <input type="text" placeholder="WhatsApp (5511999999999)" value={newTicket.contactPhone} onChange={(e) => setNewTicket({ ...newTicket, contactPhone: e.target.value })} className="input w-full" />
            <input type="text" placeholder="Assunto (obrigatório)" value={newTicket.assunto} onChange={(e) => setNewTicket({ ...newTicket, assunto: e.target.value })} className="input w-full" />
            <button onClick={createTicket} disabled={!newTicket.contactName || !newTicket.contactPhone || !newTicket.assunto} className="btn-primary w-full disabled:opacity-50">Criar Conversa</button>
          </div>
        </div>
      )}

      {showAbrirChamado && selectedTicket && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => !abrirSaving && setShowAbrirChamado(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-xl sm:max-w-lg w-full max-h-[92vh] sm:max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white dark:bg-slate-800 z-10 px-4 sm:px-5 pt-4 sm:pt-5 pb-3 border-b border-neutral-100">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-gray-900 text-base">Abrir Chamado</h3>
                <button onClick={() => setShowAbrirChamado(false)} disabled={abrirSaving} className="text-neutral-400 hover:text-neutral-600 p-1 disabled:opacity-50"><X size={20} /></button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {selectedTicket.protocolo
                  ? 'Editando informacoes do chamado.'
                  : 'Defina os dados do chamado. Sera gerado protocolo e o ticket ira para "Em Atendimento" atribuido a voce.'}
              </p>
            </div>

            <div className="px-4 sm:px-5 py-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1.5 block">Cliente vinculado</label>
                {selectedClientId ? (
                  <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 rounded-lg px-3 py-2">
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
                        className="w-full pl-9 pr-3 py-2.5 min-h-[44px] text-sm border border-neutral-200 rounded-lg focus:ring-1 focus:ring-green-500 focus:border-green-500 outline-none"
                      />
                    </div>
                    {clientResults.length > 0 && !selectedClientId && (
                      <div className="border border-neutral-200 rounded-lg max-h-40 overflow-y-auto divide-y divide-neutral-100">
                        {clientResults.map((c: any) => (
                          <button
                            key={c.id}
                            onClick={() => { setSelectedClientId(c.id); setClientSearch(c.razaoSocial); setClientResults([]); }}
                            className="w-full text-left px-3 py-2.5 hover:bg-green-50 transition-colors flex items-center gap-2 min-h-[44px]"
                          >
                            <Building2 size={14} className="text-neutral-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{c.razaoSocial}</p>
                              {c.telefone && <p className="text-[11px] text-neutral-500">{c.telefone}</p>}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {clientSearch && !selectedClientId && clientResults.length === 0 && clientSearch.length >= 2 && (
                      <button
                        onClick={() => { setNewClient({ razaoSocial: clientSearch, telefone: selectedTicket?.contactPhone || '', cnpj: '', email: '' }); setShowCreateClient(true); }}
                        className="w-full text-left px-3 py-2.5 border border-dashed border-green-300 rounded-lg text-sm text-green-700 hover:bg-green-50 transition-colors flex items-center gap-2 min-h-[44px]"
                      >
                        <Building2 size={14} /> Criar cliente "{clientSearch}"
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 mb-1.5 block">Assunto *</label>
                <input
                  type="text"
                  placeholder="Ex: Erro no modulo LIS, Duvida sobre boleto..."
                  value={abrirChamado.assunto}
                  onChange={(e) => setAbrirChamado({ ...abrirChamado, assunto: e.target.value })}
                  autoFocus
                  className="w-full px-3 py-2.5 min-h-[44px] text-sm border border-neutral-200 rounded-lg focus:ring-1 focus:ring-green-500 focus:border-green-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1.5 block">Departamento *</label>
                  <select value={abrirChamado.departamentoId} onChange={(e) => setAbrirChamado({ ...abrirChamado, departamentoId: e.target.value })} className="w-full px-3 py-2.5 min-h-[44px] text-sm border border-neutral-200 rounded-lg" required>
                    <option value="">Selecione o setor</option>
                    {departamentos.map((d: any) => (<option key={d.id} value={d.id}>{d.nome}</option>))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1.5 block">Categoria</label>
                  <select value={abrirChamado.categoria} onChange={(e) => setAbrirChamado({ ...abrirChamado, categoria: e.target.value })} className="w-full px-3 py-2.5 min-h-[44px] text-sm border border-neutral-200 rounded-lg">
                    <option value="">Selecione...</option>
                    {CATEGORIAS.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1.5 block">Prioridade</label>
                  <select value={abrirChamado.prioridade} onChange={(e) => setAbrirChamado({ ...abrirChamado, prioridade: e.target.value })} className="w-full px-3 py-2.5 min-h-[44px] text-sm border border-neutral-200 rounded-lg">
                    {PRIORIDADES.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 mb-1.5 block">Tipo de solicitacao</label>
                <select value={abrirChamado.tipo} onChange={(e) => setAbrirChamado({ ...abrirChamado, tipo: e.target.value })} className="w-full px-3 py-2.5 min-h-[44px] text-sm border border-neutral-200 rounded-lg">
                  <option value="">Selecione...</option>
                  {TIPOS.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 mb-1.5 block">Observacoes internas (auditoria)</label>
                <textarea
                  rows={3}
                  placeholder="Anotacoes visiveis apenas para a equipe (nao enviadas ao cliente)..."
                  value={abrirChamado.observacoes}
                  onChange={(e) => setAbrirChamado({ ...abrirChamado, observacoes: e.target.value })}
                  className="w-full px-3 py-2.5 min-h-[80px] text-sm border border-neutral-200 rounded-lg resize-none focus:ring-1 focus:ring-green-500 outline-none"
                />
              </div>
            </div>

            <div className="sticky bottom-0 bg-white dark:bg-slate-800 px-4 sm:px-5 py-3 border-t border-neutral-100 flex gap-2">
              <button onClick={() => setShowAbrirChamado(false)} disabled={abrirSaving} className="flex-1 px-4 py-2.5 min-h-[44px] text-sm border border-neutral-200 rounded-lg hover:bg-neutral-50 disabled:opacity-50">Cancelar</button>
              <button onClick={confirmarAbrirChamado} disabled={!abrirChamado.assunto.trim() || !abrirChamado.departamentoId || abrirSaving} className="flex-1 px-4 py-2.5 min-h-[44px] text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-1.5">
                {abrirSaving ? <><RefreshCw size={14} className="animate-spin" /> Abrindo...</> : selectedTicket.protocolo ? 'Salvar alteracoes' : 'Abrir Chamado'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateClient && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => !creatingClient && setShowCreateClient(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-xl sm:max-w-md w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 sm:px-5 pt-4 sm:pt-5 pb-3 border-b border-neutral-100">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-900 flex items-center gap-2 text-base"><Building2 size={18} className="text-green-600" /> Novo Cliente</h3>
                <button onClick={() => setShowCreateClient(false)} disabled={creatingClient} className="text-neutral-400 hover:text-neutral-600 p-1"><X size={20} /></button>
              </div>
            </div>
            <div className="px-4 sm:px-5 py-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1.5">Razao Social *</label>
                <input type="text" value={newClient.razaoSocial} onChange={(e) => setNewClient({ ...newClient, razaoSocial: e.target.value })} className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2.5 min-h-[44px] focus:ring-1 focus:ring-green-500 outline-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1.5">Telefone</label>
                <input type="text" value={newClient.telefone} onChange={(e) => setNewClient({ ...newClient, telefone: e.target.value })} placeholder="5511999999999" className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2.5 min-h-[44px] focus:ring-1 focus:ring-green-500 outline-none" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1.5">CNPJ</label>
                  <input type="text" value={newClient.cnpj} onChange={(e) => setNewClient({ ...newClient, cnpj: e.target.value })} className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2.5 min-h-[44px] focus:ring-1 focus:ring-green-500 outline-none" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1.5">Email</label>
                  <input type="email" value={newClient.email} onChange={(e) => setNewClient({ ...newClient, email: e.target.value })} className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2.5 min-h-[44px] focus:ring-1 focus:ring-green-500 outline-none" />
                </div>
              </div>
            </div>
            <div className="sticky bottom-0 bg-white dark:bg-slate-800 px-4 sm:px-5 py-3 border-t border-neutral-100 flex gap-2">
              <button onClick={() => setShowCreateClient(false)} disabled={creatingClient} className="flex-1 px-4 py-2.5 min-h-[44px] text-sm border border-neutral-200 rounded-lg hover:bg-neutral-50 disabled:opacity-50">Cancelar</button>
              <button onClick={criarClienteInline} disabled={creatingClient || !newClient.razaoSocial.trim()} className="flex-1 px-4 py-2.5 min-h-[44px] text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-1.5">
                {creatingClient ? <><RefreshCw size={14} className="animate-spin" /> Criando...</> : 'Criar e Vincular'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTransferir && selectedTicket && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={() => !transferirSaving && setShowTransferir(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-xl w-full max-w-md mx-4 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-gray-900">Transferir Atendimento</h3>
              <button onClick={() => setShowTransferir(false)} disabled={transferirSaving} className="text-neutral-400 hover:text-neutral-600 p-1 disabled:opacity-50"><X size={20} /></button>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Transferir para</label>
              <select
                value={transferirPara}
                onChange={(e) => setTransferirPara(e.target.value)}
                className="input w-full"
              >
                <option value="">Selecione o usuario...</option>
                {usuarios.filter((u) => u.id !== selectedTicket.assigneeId).map((u) => (
                  <option key={u.id} value={u.id}>{u.nome || u.name} ({u.role || 'user'})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Motivo (opcional)</label>
              <textarea
                rows={2}
                placeholder="Ex: Especialista em modulo financeiro..."
                value={transferirMotivo}
                onChange={(e) => setTransferirMotivo(e.target.value)}
                className="input w-full resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowTransferir(false)} disabled={transferirSaving} className="flex-1 px-4 py-2 border border-neutral-200 rounded-lg text-sm hover:bg-neutral-50 disabled:opacity-50">Cancelar</button>
              <button onClick={confirmarTransferir} disabled={!transferirPara || transferirSaving} className="flex-1 btn-primary disabled:opacity-50">
                {transferirSaving ? 'Transferindo...' : 'Transferir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
