import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../services/api';
import { useNavigate } from 'react-router-dom';
import { matchSearchMultiple } from '../../utils/text';
import {
  RefreshCw, Inbox, Headphones, Clock, ArrowUpCircle, CheckCircle,
  Archive, XCircle, MessageSquare, User, AlertTriangle, Search, X, Loader2, ExternalLink,
} from 'lucide-react';
import type { StatusBoardData, StatusSlug } from '../../types';

const ICONES: Record<string, any> = {
  inbox: Inbox,
  headphones: Headphones,
  clock: Clock,
  'arrow-up-circle': ArrowUpCircle,
  'check-circle': CheckCircle,
  archive: Archive,
  'x-circle': XCircle,
};

const PRIORIDADE_COR: Record<string, string> = {
  baixa: 'border-l-blue-400',
  media: 'border-l-yellow-400',
  alta: 'border-l-orange-500',
  urgente: 'border-l-red-500',
};

function formatarTempo(minutos: number): string {
  if (minutos < 1) return 'agora';
  if (minutos < 60) return `${minutos}min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `${horas}h`;
  return `${Math.floor(horas / 24)}d`;
}

function tempoDesdeAtualizacao(d: string | undefined): number {
  if (!d) return 0;
  return Math.floor((Date.now() - new Date(d).getTime()) / 60000);
}

const ETAPAS_LABELS: Record<string, string> = {
  fila: 'Fila',
  triagem: 'Triagem',
  em_atendimento: 'Em atendimento',
  aguardando_cliente: 'Aguard. cliente',
  aguardando_os: 'Aguard. OS',
  concluido: 'Conclu\u00EDdo',
  descartado: 'Descartado',
};

const STATUS_COR: Record<string, string> = {
  aberto: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  em_atendimento: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  pendente: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  escalonado: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  resolvido: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  fechado: 'bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-300',
  cancelado: 'bg-neutral-200 text-neutral-500 dark:bg-slate-600 dark:text-slate-400',
};

interface StatusTicketModalProps {
  tickets: any[];
  title: string;
  onClose: () => void;
  onRefresh: () => void;
}

function StatusTicketModal({ tickets, title, onClose, onRefresh }: StatusTicketModalProps) {
  const navigate = useNavigate();
  const [moving, setMoving] = useState<string | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);
  const [resumoMap, setResumoMap] = useState<Record<string, string>>({});

  const handleMove = async (ticketId: string, novaEtapa: string) => {
    setMoving(ticketId);
    try {
      await api.post(`/helpdesk/tickets/${ticketId}/move`, { etapa: novaEtapa });
      onRefresh();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao mover ticket');
    } finally {
      setMoving(null);
    }
  };

  const handleResolver = async (ticketId: string) => {
    const resumo = (resumoMap[ticketId] || '').trim();
    if (resumo.length < 5) {
      alert('Resumo final obrigat\u00F3rio m\u00EDnimo 5 caracteres');
      return;
    }
    setResolving(ticketId);
    try {
      await api.post(`/helpdesk/tickets/${ticketId}/resolver`, { resumoFinal: resumo });
      setResumoMap(prev => { const n = { ...prev }; delete n[ticketId]; return n; });
      onRefresh();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao resolver ticket');
    } finally {
      setResolving(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col border border-neutral-200 dark:border-slate-700" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-slate-700">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100">{title}</h3>
            <p className="text-xs text-gray-500 dark:text-slate-400">{tickets.length} ticket(s)</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {tickets.length === 0 ? (
            <p className="text-center py-12 text-gray-400 dark:text-slate-500 text-sm">Nenhum ticket nesta categoria</p>
          ) : tickets.map((t: any) => (
            <div key={t.id} className="bg-gray-50 dark:bg-slate-700/50 rounded-xl border border-gray-200 dark:border-slate-600 p-4 hover:shadow-md transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-gray-400 dark:text-slate-500">{t.protocolo}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${STATUS_COR[t.status] || 'bg-gray-100 text-gray-600 dark:bg-slate-600 dark:text-slate-300'}`}>{t.status}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      t.prioridade === 'urgente' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                      t.prioridade === 'alta' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' :
                      t.prioridade === 'media' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                    }`}>{t.prioridade}</span>
                  </div>
                  <p className="text-sm font-bold text-gray-900 dark:text-slate-100 mt-1 truncate">{t.cliente || t.contactName || 'Sem nome'}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 truncate">{t.assunto || t.categoria || 'Sem assunto'}</p>
                </div>
                <div className="flex flex-col gap-1.5 flex-shrink-0 items-end">
                  <button onClick={() => { onClose(); navigate(`/app/whatsapp/tickets/${t.id}`); }}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                    <ExternalLink size={12} /> Abrir
                  </button>
                  <div className="flex items-center gap-1">
                    <select value={t.etapa} disabled={moving === t.id || resolving === t.id} onChange={(e) => handleMove(t.id, e.target.value)}
                      className="text-[11px] px-2 py-1 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 cursor-pointer disabled:opacity-50">
                      {Object.entries(ETAPAS_LABELS).map(([slug, label]) => (<option key={slug} value={slug}>{label}</option>))}
                    </select>
                    {(moving === t.id || resolving === t.id) && <Loader2 className="animate-spin text-blue-500" size={14} />}
                  </div>
                  {t.etapa !== 'concluido' && t.etapa !== 'descartado' && (
                    <div className="w-full">
                      {resolving === t.id ? (
                        <div className="flex flex-col gap-1 mt-1">
                          <input type="text" placeholder="Resumo final (m\u00EDn. 5 chars)" value={resumoMap[t.id] || ''}
                            onChange={(e) => setResumoMap(prev => ({ ...prev, [t.id]: e.target.value }))}
                            className="text-[11px] px-2 py-1 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 w-full" />
                          <div className="flex gap-1">
                            <button onClick={() => handleResolver(t.id)} className="text-[10px] px-2 py-0.5 rounded bg-green-600 text-white hover:bg-green-700 flex-1">Confirmar</button>
                            <button onClick={() => setResolving(null)} className="text-[10px] px-2 py-0.5 rounded bg-gray-200 dark:bg-slate-600 text-gray-600 dark:text-slate-300 hover:bg-gray-300 dark:hover:bg-slate-500">Cancelar</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => { setResolving(t.id); setResumoMap(prev => ({ ...prev, [t.id]: '' })); }}
                          className="text-[11px] w-full px-2 py-1 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-900/40 font-medium mt-1">
                          Finalizar
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HelpdeskStatusBoard() {
  const navigate = useNavigate();
  const [data, setData] = useState<StatusBoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [modalTickets, setModalTickets] = useState<{ tickets: any[]; title: string } | null>(null);
  const initialLoadedRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const { data: res } = await api.get<StatusBoardData>('/helpdesk/status-board');
      setData(res);
    } catch (err) {
      console.error('Erro status board:', err);
    } finally {
      setLoading(false);
      initialLoadedRef.current = true;
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [autoRefresh, load]);

  const filteredBoard = (slug: StatusSlug) => {
    if (!data) return [];
    const items = data.board[slug]?.items || [];
    if (!search) return items;
    return items.filter((t) =>
      matchSearchMultiple(
        [t.contactName, t.protocolo, t.assunto, t.client?.razaoSocial],
        search
      )
    );
  };

  const totalGeral = data ? Object.values(data.board).reduce((acc, c) => acc + c.total, 0) : 0;

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="animate-spin text-emerald-600" size={32} />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-white via-white to-emerald-50/30 rounded-2xl border border-neutral-200/60 p-5 shadow-sm dark:bg-gradient-to-r dark:from-slate-800 dark:via-slate-800 dark:to-emerald-900/20">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-navy-900 dark:text-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200">
                <ArrowUpCircle className="text-white" size={22} />
              </div>
              Board por Status
            </h1>
            <p className="text-neutral-500 dark:text-slate-400 text-sm mt-1.5">
              {totalGeral} ticket(s) ativos • 7 status (read-only, atualizado a cada 10s)
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Filtrar..."
                value={search} onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2.5 text-sm border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none w-48 shadow-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 dark:placeholder:text-slate-400" />
            </div>
            <button onClick={() => setAutoRefresh(!autoRefresh)}
              className={`text-sm font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all ${
                autoRefresh ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700' : 'bg-neutral-100 text-neutral-600 border border-neutral-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'
              }`}>
              {autoRefresh ? 'Auto ON' : 'Pausado'}
            </button>
            <button onClick={load} className="btn-secondary text-sm flex items-center gap-2 px-4 py-2.5 rounded-xl">
              <RefreshCw size={14} /> Atualizar
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 overflow-x-auto pb-2">
        {data.colunas.map((col) => {
          const Icone = ICONES[col.icone] || Inbox;
          const items = filteredBoard(col.slug);
          return (
            <div key={col.slug} className="flex flex-col bg-gradient-to-b from-neutral-50/80 to-white dark:from-slate-900/80 dark:to-slate-800 rounded-2xl border border-neutral-200/60 dark:border-slate-700 min-w-[200px] shadow-sm">
              <div className="px-4 py-3 border-b border-neutral-200/60 dark:border-slate-700 flex items-center justify-between sticky top-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-t-2xl z-10 cursor-pointer hover:bg-neutral-50 dark:hover:bg-slate-700/50 transition-colors" onClick={() => items.length > 0 && setModalTickets({ tickets: items, title: col.titulo })}>
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white shadow-sm flex-shrink-0" style={{ backgroundColor: col.cor }}>
                    <Icone size={14} />
                  </div>
                  <span className="text-sm font-bold text-navy-900 dark:text-slate-100 truncate">{col.titulo}</span>
                </div>
                <span className="text-sm font-bold text-white bg-navy-900/80 dark:bg-slate-600 px-2.5 py-1 rounded-lg flex-shrink-0 shadow-sm">
                  {items.length}
                </span>
              </div>
              <div className="flex-1 p-3 space-y-2.5 max-h-[calc(100vh-22rem)] overflow-y-auto min-h-[200px]">
                {items.length === 0 ? (
                  <p className="text-center text-xs text-neutral-400 dark:text-slate-500 py-6">vazio</p>
                ) : (
                  items.map((t) => {
                    const minAtualizado = tempoDesdeAtualizacao(t.updatedAt);
                    const critico = minAtualizado > 60;
                    return (
                      <div key={t.id} onClick={() => navigate(`/app/whatsapp/tickets/${t.id}`)}
                        className={`bg-white dark:bg-slate-800 rounded-xl border-l-4 ${PRIORIDADE_COR[t.prioridade] || 'border-l-neutral-300'} border-r border-t border-b border-neutral-200/60 p-3 cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200`}>
                        <div className="flex items-start justify-between gap-1 mb-1.5">
                          <p className="text-sm font-bold text-navy-900 dark:text-slate-100 truncate flex-1">
                            {t.contactName || t.client?.razaoSocial || t.contactPhone || 'Sem nome'}
                          </p>
                          {critico && <AlertTriangle size={12} className="text-amber-500 flex-shrink-0" />}
                        </div>
                        {t.protocolo && <p className="text-[10px] text-neutral-400 dark:text-slate-500 font-mono">{t.protocolo}</p>}
                        {t.assunto && <p className="text-xs text-neutral-600 dark:text-slate-300 mt-1.5 line-clamp-2">{t.assunto}</p>}
                        <div className="flex items-center justify-between gap-1 mt-2 pt-2 border-t border-neutral-100 dark:border-slate-700/50">
                          <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-slate-400 min-w-0">
                            {t.assignee ? (
                              <><User size={10} className="flex-shrink-0" /><span className="truncate font-medium">{t.assignee.name.split(' ')[0]}</span></>
                            ) : (
                              <span className="text-amber-600 font-semibold">s/ atendente</span>
                            )}
                          </div>
                          <span className={`text-xs font-mono flex-shrink-0 px-1.5 py-0.5 rounded ${critico ? 'text-amber-600 font-bold bg-amber-50 dark:bg-amber-900/30' : 'text-neutral-400 dark:text-slate-500'}`}>
                            {formatarTempo(minAtualizado)}
                          </span>
                        </div>
                        {t.lastMessage && (
                          <p className="text-[11px] text-neutral-500 dark:text-slate-400 mt-1.5 line-clamp-1 italic bg-neutral-50 dark:bg-slate-900 px-2 py-1 rounded">
                            {t.lastMessage.fromMe ? '↩ ' : ''}
                            {(t.lastMessage.content || '').slice(0, 40)}
                            {(t.lastMessage.content?.length || 0) > 40 ? '...' : ''}
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-neutral-400 dark:text-slate-500 text-center">
        Clique no cabe&#231;alho de uma coluna para ver e mover tickets. Para detalhes, use a p&#225;gina de detalhe.
      </p>

      {modalTickets && (
        <StatusTicketModal
          tickets={modalTickets.tickets}
          title={modalTickets.title}
          onClose={() => setModalTickets(null)}
          onRefresh={() => { load(); setModalTickets(null); }}
        />
      )}
    </div>
  );
}
