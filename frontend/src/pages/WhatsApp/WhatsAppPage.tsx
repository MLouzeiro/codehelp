import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { Bluetooth, BluetoothOff, RefreshCw, Send, Plus, Search, MessageSquare, User, Phone, AlertCircle, X } from 'lucide-react';
import QRCode from 'qrcode';

export default function WhatsAppPage() {
  const navigate = useNavigate();
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
  const [loading, setLoading] = useState(true);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [newTicket, setNewTicket] = useState({ contactName: '', contactPhone: '', assunto: '' });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const msgPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const statusStyles: Record<string, string> = {
    aberto: 'bg-blue-100 text-blue-700',
    em_andamento: 'bg-amber-100 text-amber-700',
    fechado: 'bg-green-100 text-green-700',
    pendente: 'bg-gray-100 text-gray-700',
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
      } else {
        setQrCode(null);
        setQrDataUrl(null);
      }
      if (data.connected && connecting) {
        setConnecting(false);
      }
    } catch (err) { console.error(err); }
  }, [connecting]);

  const loadTickets = useCallback(async () => {
    try {
      const { data } = await api.get('/whatsapp/tickets', { params: { limit: 100 } });
      setTickets(data.tickets || []);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, []);

  const loadMessages = useCallback(async (ticketId: string) => {
    try {
      const { data } = await api.get(`/whatsapp/tickets/${ticketId}`);
      setSelectedTicket(data);
      setMessages(data.messages || []);
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => {
    loadStatus();
    loadTickets();
  }, [loadStatus, loadTickets]);

  useEffect(() => {
    if (!connected) {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(() => { loadStatus(); loadTickets(); }, 5000);
    } else if (connected && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (connected && !pollRef.current) {
      pollRef.current = setInterval(() => { loadStatus(); loadTickets(); }, 5000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [connected, loadStatus, loadTickets]);

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

  const handleSelectTicket = (ticket: any) => {
    setSelectedTicketId(ticket.id);
  };

  const connectWhatsApp = async () => {
    try {
      setConnecting(true);
      await api.post('/whatsapp/connect');
      setTimeout(() => loadStatus(), 2500);
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
      setTimeout(() => loadStatus(), 3000);
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
    navigate(`/orders/new?clientId=${selectedTicket.client?.id || ''}&ticketId=${selectedTicket.id}`);
  };

  const filteredTickets = tickets.filter((t: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (t.contactName?.toLowerCase() || '').includes(q)
      || (t.contactPhone || '').includes(q)
      || (t.assunto?.toLowerCase() || '').includes(q)
      || (t.client?.razaoSocial || '').toLowerCase().includes(q);
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
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="text-green-500" size={22} />
            <h1 className="text-xl font-bold text-codemed-700">WhatsApp</h1>
          </div>
          <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${connected ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
            {connected ? <><Bluetooth size={12} /> Conectado</> : <><BluetoothOff size={12} /> Desconectado</>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowNewTicket(true)} className="btn-primary text-sm flex items-center gap-1"><Plus size={14} /> Novo</button>
          {!connected && (
            <button onClick={reconnectWhatsApp} disabled={connecting} className="bg-amber-500 text-white text-sm px-3 py-2 rounded-lg hover:bg-amber-600 transition-colors font-medium flex items-center gap-1 disabled:opacity-50">
              <RefreshCw size={14} /> Reconectar
            </button>
          )}
          {connected ? (
            <button onClick={disconnectWhatsApp} className="bg-red-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center gap-1"><BluetoothOff size={14} /> Desconectar</button>
          ) : (
            <button onClick={connectWhatsApp} disabled={connecting} className="btn-primary text-sm flex items-center gap-1 disabled:opacity-50">
              {connecting ? <><RefreshCw size={14} className="animate-spin" /> Conectando</> : <><Bluetooth size={14} /> Conectar</>}
            </button>
          )}
        </div>
      </div>

      {connectionError && !connected && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
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

      {qrDataUrl && !connected && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={() => { setQrCode(null); setQrDataUrl(null); if (!connecting) setConnecting(false); }}>
          <div className="bg-white rounded-2xl p-6 shadow-xl text-center max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-lg text-gray-900 mb-1">Conectar WhatsApp</h3>
            <p className="text-sm text-gray-500 mb-4">Abra o WhatsApp no celular<br />Menu → WhatsApp Web → Escanear</p>
            <img src={qrDataUrl} alt="QR Code" className="mx-auto w-56 h-56" />
            <p className="text-xs text-gray-400 mt-3">O QR Code expira em alguns segundos</p>
            <button onClick={() => { setQrCode(null); setQrDataUrl(null); if (!connecting) setConnecting(false); }} className="mt-4 text-sm text-gray-500 hover:text-gray-700">Fechar</button>
          </div>
        </div>
      )}

      <div className="flex-1 flex min-h-0 bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="w-80 lg:w-96 flex-shrink-0 border-r border-gray-200 flex flex-col bg-gray-50/50">
          <div className="p-3 border-b border-gray-200 bg-white">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Pesquisar conversa..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm border border-neutral-200 rounded-lg focus:ring-1 focus:ring-green-500 focus:border-green-500 outline-none" />
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
                          {ticket.contactName || ticket.client?.razaoSocial || ticket.contactPhone || 'Desconhecido'}
                        </span>
                        <span className="text-xs text-gray-400 flex-shrink-0">{lastMsg ? formatTime(lastMsg.sentAt || ticket.updatedAt) : formatTime(ticket.updatedAt)}</span>
                      </div>
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

        <div className="flex-1 flex flex-col">
          {selectedTicket ? (
            <>
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-white flex-shrink-0">
                   <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center">
                     <User size={16} className="text-green-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-sm text-gray-900">{selectedTicket.contactName || selectedTicket.client?.razaoSocial || 'Desconhecido'}</h3>
                        {selectedTicket.protocolo && <span className="text-[10px] font-mono text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded">{selectedTicket.protocolo}</span>}
                      </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><Phone size={10} />{selectedTicket.contactPhone}</span>
                      {selectedTicket.client?.razaoSocial && <span>• {selectedTicket.client.razaoSocial}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`badge text-xs ${statusStyles[selectedTicket.status] || ''}`}>{selectedTicket.status?.replace('_', ' ')}</span>
                  <button onClick={createOS} className="btn-primary text-xs flex items-center gap-1"><Plus size={12} /> OS</button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2 bg-gray-50/30">
                {messages.map((msg: any) => (
                  <div key={msg.id} className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${msg.fromMe ? 'bg-green-500 text-white rounded-br-sm' : 'bg-white border border-neutral-200 text-neutral-900 rounded-bl-sm'}`}>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      <div className={`flex items-center gap-2 mt-1 ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
                        <span className={`text-[10px] ${msg.fromMe ? 'text-white/70' : 'text-gray-400'}`}>
                          {msg.sentAt ? new Date(msg.sentAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                        {msg.usuario?.name && <span className={`text-[10px] ${msg.fromMe ? 'text-white/70' : 'text-gray-400'}`}>{msg.usuario.name}</span>}
                      </div>
                    </div>
                  </div>
                ))}
                {messages.length === 0 && (
                  <div className="text-center py-12 text-gray-400 text-sm">Nenhuma mensagem ainda</div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="px-5 py-2 bg-white flex-shrink-0">
                {sendError && <p className="text-xs text-red-600 mb-1 flex items-center gap-1"><AlertCircle size={12} /> {sendError}</p>}
                {!connected && <p className="text-xs text-amber-600 mb-1 flex items-center gap-1"><AlertCircle size={12} /> WhatsApp desconectado — conecte-se para enviar mensagens</p>}
              </div>
              <div className="flex items-center gap-2 px-5 py-3 border-t border-gray-200 bg-white flex-shrink-0">
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
          <div className="bg-white rounded-2xl p-6 shadow-xl w-full max-w-md mx-4 space-y-4" onClick={(e) => e.stopPropagation()}>
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
    </div>
  );
}
