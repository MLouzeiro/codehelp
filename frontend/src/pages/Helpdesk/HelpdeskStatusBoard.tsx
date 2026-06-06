import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../services/api';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw, Inbox, Headphones, Clock, ArrowUpCircle, CheckCircle,
  Archive, XCircle, MessageSquare, User, AlertTriangle, Search,
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

export default function HelpdeskStatusBoard() {
  const navigate = useNavigate();
  const [data, setData] = useState<StatusBoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
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
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [autoRefresh, load]);

  const filteredBoard = (slug: StatusSlug) => {
    if (!data) return [];
    const items = data.board[slug]?.items || [];
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter((t) =>
      (t.contactName?.toLowerCase() || '').includes(q)
      || (t.protocolo?.toLowerCase() || '').includes(q)
      || (t.assunto?.toLowerCase() || '').includes(q)
      || (t.client?.razaoSocial?.toLowerCase() || '').includes(q)
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
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
            <ArrowUpCircle className="text-emerald-600" size={24} /> Board por Status
          </h1>
          <p className="text-neutral-500 text-sm">
            {totalGeral} ticket(s) ativos • 7 status (read-only, atualizado a cada 10s)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Filtrar..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs border border-neutral-200 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none w-40" />
          </div>
          <button onClick={() => setAutoRefresh(!autoRefresh)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${
              autoRefresh ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-600'
            }`}>
            {autoRefresh ? 'Auto ON' : 'Pausado'}
          </button>
          <button onClick={load} className="btn-secondary text-sm flex items-center gap-1.5">
            <RefreshCw size={14} /> Atualizar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-3 overflow-x-auto pb-2">
        {data.colunas.map((col) => {
          const Icone = ICONES[col.icone] || Inbox;
          const items = filteredBoard(col.slug);
          return (
            <div key={col.slug} className="flex flex-col bg-neutral-50 rounded-xl border border-neutral-200 min-w-[180px]">
              <div className="px-3 py-2.5 border-b border-neutral-200 flex items-center justify-between sticky top-0 bg-neutral-50 rounded-t-xl z-10">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="w-6 h-6 rounded flex items-center justify-center text-white flex-shrink-0" style={{ backgroundColor: col.cor }}>
                    <Icone size={12} />
                  </div>
                  <span className="text-xs font-bold text-navy-900 truncate">{col.titulo}</span>
                </div>
                <span className="text-xs font-bold text-neutral-500 bg-white px-1.5 py-0.5 rounded flex-shrink-0">
                  {items.length}
                </span>
              </div>
              <div className="flex-1 p-2 space-y-2 max-h-[calc(100vh-22rem)] overflow-y-auto min-h-[200px]">
                {items.length === 0 ? (
                  <p className="text-center text-[10px] text-neutral-400 py-4">vazio</p>
                ) : (
                  items.map((t) => {
                    const minAtualizado = tempoDesdeAtualizacao(t.updatedAt);
                    const critico = minAtualizado > 60;
                    return (
                      <div key={t.id} onClick={() => navigate(`/app/whatsapp/tickets/${t.id}`)}
                        className={`bg-white rounded-lg border-l-4 ${PRIORIDADE_COR[t.prioridade] || 'border-l-neutral-300'} border-r border-t border-b border-neutral-200 p-2 cursor-pointer hover:shadow-md transition-shadow`}>
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <p className="text-xs font-bold text-navy-900 truncate flex-1">
                            {t.contactName || t.client?.razaoSocial || t.contactPhone || 'Sem nome'}
                          </p>
                          {critico && <AlertTriangle size={10} className="text-amber-500 flex-shrink-0" />}
                        </div>
                        {t.protocolo && <p className="text-[9px] text-neutral-400 font-mono">{t.protocolo}</p>}
                        {t.assunto && <p className="text-[11px] text-neutral-600 mt-1 line-clamp-2">{t.assunto}</p>}
                        <div className="flex items-center justify-between gap-1 mt-1.5 pt-1.5 border-t border-neutral-100">
                          <div className="flex items-center gap-1 text-[10px] text-neutral-500 min-w-0">
                            {t.assignee ? (
                              <><User size={9} className="flex-shrink-0" /><span className="truncate">{t.assignee.name.split(' ')[0]}</span></>
                            ) : (
                              <span className="text-amber-600 font-semibold">s/ atendente</span>
                            )}
                          </div>
                          <span className={`text-[10px] font-mono flex-shrink-0 ${critico ? 'text-amber-600 font-bold' : 'text-neutral-400'}`}>
                            {formatarTempo(minAtualizado)}
                          </span>
                        </div>
                        {t.lastMessage && (
                          <p className="text-[10px] text-neutral-500 mt-1 line-clamp-1 italic">
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

      <p className="text-xs text-neutral-400 text-center">
        View read-only derivada do campo <code>status</code> (7 valores). Para mover tickets, use a pagina de detalhe.
      </p>
    </div>
  );
}
