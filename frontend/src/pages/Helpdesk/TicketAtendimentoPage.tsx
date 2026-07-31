import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Maximize2, Send, Loader2, ArrowLeft } from 'lucide-react';
import api from '../../services/api';
import TicketTopo from '../../components/TicketTopo';
import TicketSidebar from '../../components/TicketSidebar';
import TicketRodape from '../../components/TicketRodape';

export default function TicketAtendimentoPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<any>(null);
  const [cliente, setCliente] = useState<any>(null);
  const [historicoContato, setHistoricoContato] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState<'chat' | 'timeline'>('chat');
  const [mensagens, setMensagens] = useState<any[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const [novaMsg, setNovaMsg] = useState('');
  const [enviando, setEnviando] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const loadTicket = useCallback(async () => {
    if (!ticketId) return;
    try {
      const [historyRes, timelineRes] = await Promise.all([
        api.get(`/helpdesk/tickets/${ticketId}/history`),
        api.get(`/audit-ticket/tickets/${ticketId}/events`).catch(() => ({ data: [] })),
      ]);
      const t = historyRes.data.ticket || historyRes.data;
      setTicket(t);
      setMensagens(t.messages || []);
      setTimelineEvents(timelineRes.data);
      setHistoricoContato(historyRes.data.historicoContato || []);
      if (t.clientId) {
        try {
          const { data: c } = await api.get(`/crm/clients/${t.clientId}`);
          setCliente(c);
        } catch {}
      }
    } catch (err) {
      console.error('Erro ao carregar ticket:', err);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => { loadTicket(); }, [loadTicket]);

  useEffect(() => {
    const interval = setInterval(loadTicket, 15000);
    return () => clearInterval(interval);
  }, [loadTicket]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  const enviarMensagem = async () => {
    if (!novaMsg.trim() || enviando) return;
    setEnviando(true);
    try {
      const phone = ticket?.contactPhone?.replace(/[^\d]/g, '') || '';
      await api.post('/whatsapp/send', {
        to: phone,
        message: novaMsg.trim(),
        ticketId,
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

  const getTimelineIcon = (ev: any) => {
    if (ev.tipo?.includes('criado') || ev.tipo?.includes('aberto')) return { emoji: '\uD83D\uDCE9', color: 'bg-blue-100 border-blue-300' };
    if (ev.tipo?.includes('ia') || ev.tipo?.includes('bot')) return { emoji: '\uD83E\uDD16', color: 'bg-blue-100 border-blue-300' };
    if (ev.tipo?.includes('humano') || ev.tipo?.includes('atribui')) return { emoji: '\uD83D\uDC64', color: 'bg-emerald-100 border-emerald-300' };
    if (ev.tipo?.includes('aguardando')) return { emoji: '\u23F3', color: 'bg-amber-100 border-amber-300' };
    if (ev.tipo?.includes('conclu') || ev.tipo?.includes('resolv')) return { emoji: '\u2705', color: 'bg-emerald-100 border-emerald-300' };
    return { emoji: '\u25CF', color: 'bg-slate-100 border-slate-300' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
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
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-full">
      {/* === BOTAO VOLTAR === */}
      <div className="flex-shrink-0 mb-3">
        <button
          onClick={() => navigate('/app/helpdesk')}
          className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Chamados
        </button>
      </div>

      {/* === TOPO (fixo) === */}
      <div className="flex-shrink-0">
        <TicketTopo ticket={ticket} />
      </div>

      {/* === CORPO: grid 2 colunas (chat | sidebar) — ocupa espaço restante === */}
      <div className="flex-1 grid grid-cols-[1fr_300px] border border-slate-200 border-t-0 rounded-b-xl bg-white dark:bg-slate-800 dark:border-slate-700 overflow-hidden min-h-0">
        {/* === COLUNA ESQUERDA: CHAT / TIMELINE === */}
        <div className="flex flex-col min-h-0 relative">
          {/* Toggle Chat/Timeline */}
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
          </div>

          {/* Conteudo */}
          {aba === 'chat' ? (
            <div className="flex-1 min-h-0 flex flex-col">
              {/* Messages — scrollavel */}
              <div className="flex-1 min-h-0 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-900 flex flex-col gap-3 relative">
                <button
                  className="absolute top-2 right-2 w-7 h-7 rounded-md border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 z-10"
                  title="Expandir"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
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
                      <div className={`px-3.5 py-2.5 rounded-xl text-sm leading-relaxed ${
                        isCliente
                          ? 'bg-white border border-slate-200 rounded-bl-sm dark:bg-slate-800 dark:border-slate-700'
                          : isIA
                            ? 'bg-blue-50 border border-blue-200 rounded-br-sm dark:bg-blue-900/30 dark:border-blue-700'
                            : 'bg-emerald-50 border border-emerald-200 rounded-br-sm dark:bg-emerald-900/30 dark:border-emerald-700'
                      }`}>
                        <div>{msg.content || '(sem conteúdo)'}</div>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400 dark:text-slate-500">
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
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-900">
              {timelineEvents.length === 0 ? (
                <div className="text-center py-12 text-sm text-slate-400 dark:text-slate-500">
                  Nenhum evento registrado
                </div>
              ) : (
                <div className="space-y-0">
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
          )}
        </div>

        {/* === COLUNA DIREITA: SIDEBAR === */}
        <div className="border-l border-slate-200 dark:border-slate-700 p-4 overflow-y-auto">
          <TicketSidebar ticket={ticket} cliente={cliente} lastEvents={timelineEvents} historicoContato={historicoContato} onTagsChange={() => loadTicket()} />
        </div>
      </div>

      {/* === RODAPE (fixo) === */}
      <div className="flex-shrink-0">
        <TicketRodape ticket={ticket} ticketId={ticketId!} onFinalizar={loadTicket} onMover={loadTicket} />
      </div>

      {/* === TIMELINE CARD (fora do fluxo fixo) === */}
      {timelineEvents.length > 0 && (
        <div className="flex-shrink-0 mt-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-semibold text-sm text-slate-700 dark:text-slate-300">
            {'\uD83D\uDCCB'} Timeline do Atendimento
          </div>
          <div className="p-4 max-h-[200px] overflow-y-auto">
            <div className="space-y-0">
              {timelineEvents.slice(0, 10).map((ev: any, i: number) => {
                const icon = getTimelineIcon(ev);
                return (
                  <div key={ev.id || i} className="flex gap-3 py-1.5 relative">
                    {i < Math.min(timelineEvents.length, 10) - 1 && (
                      <div className="absolute left-[11px] top-[22px] bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700" />
                    )}
                    <div className={`w-[22px] h-[22px] rounded-full border-2 ${icon.color} flex items-center justify-center flex-shrink-0 z-10 text-[10px]`}>
                      {icon.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-700 dark:text-slate-300">{ev.descricao || ev.tipo}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">
                        {ev.createdAt ? new Date(ev.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
                        {ev.dados ? ` \u00B7 ${ev.dados}` : ''}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
