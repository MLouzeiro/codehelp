import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../services/auth';
import { ArrowLeft, Send, User, Phone, Plus } from 'lucide-react';

export default function TicketDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadTicket(); }, [id]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [ticket?.messages]);

  const loadTicket = async () => {
    try {
      const { data } = await api.get(`/whatsapp/tickets/${id}`);
      setTicket(data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const sendMessage = async () => {
    if (!message.trim() || !ticket?.contactPhone) return;
    try {
      await api.post('/whatsapp/send', {
        to: ticket.contactPhone,
        message: message.trim(),
        ticketId: ticket.id,
      });
      setMessage('');
      loadTicket();
    } catch (err) { console.error(err); }
  };

  const createOS = () => {
    navigate(`/app/orders/new?clientId=${ticket.client?.id || ''}&ticketId=${ticket.id}`);
  };

  if (loading) return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" /></div>;
  if (!ticket) return <div className="text-center py-12 text-gray-500">Ticket não encontrado</div>;

  return (
    <div className="max-w-3xl mx-auto h-[calc(100vh-6rem)] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => navigate('/app/whatsapp')} className="flex items-center gap-2 text-gray-500 hover:text-gray-700">
          <ArrowLeft size={18} /> Voltar
        </button>
        <button onClick={createOS} className="btn-primary text-sm flex items-center gap-1">
          <Plus size={14} /> Criar OS
        </button>
      </div>

      <div className="card flex-shrink-0 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
            <User size={18} className="text-green-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">{ticket.contactName || ticket.client?.razaoSocial || 'Desconhecido'}</h2>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1"><Phone size={12} />{ticket.contactPhone}</span>
              {ticket.client?.razaoSocial && <span>• {ticket.client.razaoSocial}</span>}
            </div>
          </div>
        </div>
        {ticket.serviceOrders?.length > 0 && (
          <div className="mt-2 flex gap-2 flex-wrap">
            {ticket.serviceOrders.map((os: any) => (
              <span key={os.id} onClick={() => navigate(`/app/orders/${os.id}`)} className="badge bg-codemed-100 text-codemed-700 cursor-pointer hover:bg-codemed-200">{os.numeroOs}</span>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 mb-4 bg-gray-50 rounded-xl p-4">
        {ticket.messages?.map((msg: any) => {
          const isSystem = msg.tipo === 'system' || msg.source === 'bot';
          if (isSystem) {
            return (
              <div key={msg.id} className="flex justify-center">
                <div className="max-w-[85%] bg-violet-50 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-700 rounded-xl px-4 py-2 text-center">
                  <p className="text-[10px] font-bold text-violet-500 dark:text-violet-400 mb-0.5 uppercase">🤖 Sistema</p>
                  <p className="text-xs text-violet-700 dark:text-violet-300">{msg.content}</p>
                  <p className="text-[10px] text-violet-400 dark:text-violet-500 mt-1">
                    {msg.sentAt ? new Date(msg.sentAt).toLocaleTimeString('pt-BR') : ''}
                  </p>
                </div>
              </div>
            );
          }
          return (
            <div key={msg.id} className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-lg px-4 py-2 ${msg.fromMe ? 'bg-codemed-600 text-white' : 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-slate-200'}`}>
                <p className={`text-sm ${msg.fromMe ? 'text-white' : 'text-gray-900 dark:text-slate-200'}`}>{msg.content}</p>
                <p className={`text-xs mt-1 ${msg.fromMe ? 'text-codemed-200' : 'text-gray-400 dark:text-slate-500'}`}>
                  {msg.sentAt ? new Date(msg.sentAt).toLocaleTimeString('pt-BR') : ''}
                  {msg.usuario?.name && ` - ${msg.usuario.name}`}
                </p>
              </div>
            </div>
          );
        })}
        {(!ticket.messages || ticket.messages.length === 0) && (
          <div className="text-center py-8 text-gray-400 dark:text-slate-500 text-sm">Nenhuma mensagem ainda</div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex gap-2">
        <input type="text" value={message} onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Digite sua mensagem..."
          className="input flex-1" />
        <button onClick={sendMessage} disabled={!message.trim()} className="btn-primary px-4">
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
