import { useState, useEffect, useRef } from 'react';
import { X, Download, FileText, Loader2 } from 'lucide-react';
import api from '../services/api';

interface TicketHistoricoModalProps {
  open: boolean;
  onClose: () => void;
  ticketId: string;
  protocolo?: string;
}

export default function TicketHistoricoModal({ open, onClose, ticketId, protocolo }: TicketHistoricoModalProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [ticket, setTicket] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !ticketId) return;
    setLoading(true);
    setMessages([]);
    setTicket(null);
    api.get(`/helpdesk/tickets/${ticketId}/history`)
      .then(({ data }) => {
        const t = data.ticket || data;
        setTicket(t);
        setMessages(t.messages || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, ticketId]);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [open, messages]);

  const exportTXT = () => {
    const lines = messages.map((m) => {
      const time = new Date(m.createdAt || m.sentAt).toLocaleString('pt-BR');
      const sender = m.fromMe ? (m.source === 'bot' ? 'Bot/IA' : 'Operador') : (ticket?.contactName || 'Cliente');
      return `[${time}] ${sender}: ${m.content || ''}`;
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-${protocolo || ticketId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const messagesHtml = messages.map((m) => {
      const time = new Date(m.createdAt || m.sentAt).toLocaleString('pt-BR');
      const isClient = !m.fromMe;
      const isBot = m.source === 'bot';
      const sender = m.fromMe ? (isBot ? 'Bot/IA' : 'Operador') : (ticket?.contactName || 'Cliente');
      const bg = isClient ? '#f1f5f9' : isBot ? '#eff6ff' : '#ecfdf5';
      const align = isClient ? 'left' : 'right';
      return `<div style="text-align:${align};margin:8px 0"><div style="display:inline-block;max-width:75%;background:${bg};padding:8px 12px;border-radius:12px;text-align:left"><div style="font-size:11px;color:#64748b;margin-bottom:2px"><b>${esc(sender)}</b> ${time}</div><div style="font-size:13px;color:#1e293b">${esc(m.content || '')}</div></div></div>`;
    }).join('');
    win.document.write(`<html><head><title>Chat ${esc(protocolo || '')}</title><style>body{font-family:sans-serif;padding:20px;max-width:700px;margin:0 auto}</style></head><body><h2 style="text-align:center;color:#334155">Chat ${esc(protocolo || '')}</h2>${messagesHtml}</body></html>`);
    win.document.close();
    win.print();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex flex-col w-full max-w-lg h-[80vh] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
            Mensagens do chamado {protocolo ? `#${protocolo}` : ''}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-900">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-slate-400 dark:text-slate-500">
              Nenhuma mensagem encontrada
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {messages.map((msg: any, i: number) => {
                const isIA = msg.source === 'bot';
                const isOp = msg.fromMe && !isIA;
                const isCliente = !msg.fromMe;
                const senderName = isCliente ? (ticket?.contactName || 'Cliente') : isIA ? 'Bot/IA' : 'Operador';
                const time = new Date(msg.createdAt || msg.sentAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                return (
                  <div key={msg.id || i} className={`max-w-[80%] ${isCliente ? 'self-start' : 'self-end'}`}>
                    <div className={`px-3.5 py-2.5 rounded-xl text-sm leading-relaxed ${
                      isCliente
                        ? 'bg-white border border-slate-200 rounded-bl-sm dark:bg-slate-800 dark:border-slate-700'
                        : isIA
                          ? 'bg-blue-50 border border-blue-200 rounded-br-sm dark:bg-blue-900/30 dark:border-blue-700'
                          : 'bg-emerald-50 border border-emerald-200 rounded-br-sm dark:bg-emerald-900/30 dark:border-emerald-700'
                    }`}>
                      <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-0.5">{senderName} <span className="font-normal">{time}</span></div>
                      <div className={isCliente ? 'text-slate-800 dark:text-slate-200' : isIA ? 'text-blue-800 dark:text-blue-200' : 'text-emerald-800 dark:text-emerald-200'}>{msg.content || '(sem conteúdo)'}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-3 px-5 py-3 border-t border-slate-200 dark:border-slate-700 flex-shrink-0 bg-white dark:bg-slate-800">
          <button onClick={onClose} className="px-5 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-medium rounded-xl text-sm transition-colors">
            Fechar
          </button>
          <button onClick={exportPDF} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-sm transition-colors flex items-center gap-1.5">
            <Download className="w-4 h-4" /> Exportar PDF
          </button>
          <button onClick={exportTXT} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-sm transition-colors flex items-center gap-1.5">
            <FileText className="w-4 h-4" /> Exportar TXT
          </button>
        </div>
      </div>
    </div>
  );
}
