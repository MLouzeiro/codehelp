import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Maximize2, Send, Loader2, ArrowLeft, Calendar, Clock, AlertTriangle, ToggleLeft, ToggleRight, Building2 } from 'lucide-react';
import api from '../../services/api';
import TicketTopo from '../../components/TicketTopo';
import TicketSidebar from '../../components/TicketSidebar';
import TicketRodape from '../../components/TicketRodape';
import TicketChecklist from '../../components/TicketChecklist';

export default function TicketAtendimentoPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<any>(null);
  const [cliente, setCliente] = useState<any>(null);
  const [historicoContato, setHistoricoContato] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState<'chat' | 'timeline' | 'checklist'>('chat');
  const [mensagens, setMensagens] = useState<any[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const [novaMsg, setNovaMsg] = useState('');
  const [enviando, setEnviando] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [prazoEntrega, setPrazoEntrega] = useState('');
  const [semPrazo, setSemPrazo] = useState(false);
  const [salvandoPrazo, setSalvandoPrazo] = useState(false);
  const [horasDesenv, setHorasDesenv] = useState<number | ''>('');
  const [salvandoHoras, setSalvandoHoras] = useState(false);
  const [deptTempos, setDeptTempos] = useState<any[]>([]);

  const loadTicket = useCallback(async () => {
    if (!ticketId) return;
    try {
      const [historyRes, timelineRes, deptTimeRes] = await Promise.all([
        api.get(`/helpdesk/tickets/${ticketId}/history`),
        api.get(`/audit-ticket/tickets/${ticketId}/events`).catch(() => ({ data: [] })),
        api.get(`/helpdesk/tickets/${ticketId}/department-time`).catch(() => ({ data: [] })),
      ]);
      const t = historyRes.data.ticket || historyRes.data;
      setTicket(t);
      setMensagens(t.messages || []);
      setTimelineEvents(timelineRes.data);
      setHistoricoContato(historyRes.data.historicoContato || []);
      setDeptTempos(deptTimeRes.data);
      setPrazoEntrega(t.prazoEntrega ? new Date(t.prazoEntrega).toISOString().slice(0, 16) : '');
      setSemPrazo(t.semPrazo || false);
      setHorasDesenv(t.horasDesenvolvimento ?? '');
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
                        <div className={isCliente ? 'text-slate-800 dark:text-slate-200' : isIA ? 'text-blue-800 dark:text-blue-200' : 'text-emerald-800 dark:text-emerald-200'}>{msg.content || (msg.mediaUrl ? '' : '(sem conteúdo)')}</div>
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
          ) : aba === 'checklist' ? (
            <div className="flex-1 min-h-0 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-900">
              <TicketChecklist ticketId={ticketId!} onChange={loadTicket} />
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
        <div className="border-l border-slate-200 dark:border-slate-700 p-4 overflow-y-auto space-y-4">
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
