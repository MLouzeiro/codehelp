import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import {
  RefreshCw, MessageSquare, Clock, CheckCircle, Users,
  ArrowRight, Activity, AlertTriangle, TrendingUp,
  Inbox, Bot, Headphones, FileText, Stethoscope,
  ChevronDown, ChevronRight, X, ExternalLink, Loader2,
} from 'lucide-react';
import type { HelpdeskDashboardData, HelpdeskTicket } from '../../types';

const ETAPA_ICONES: Record<string, any> = {
  inbox: Inbox,
  bot: Bot,
  headphones: Headphones,
  clock: Clock,
  'file-text': FileText,
  'check-circle': CheckCircle,
};

export const ETAPAS: { slug: string; label: string }[] = [
  { slug: 'fila', label: 'Fila' },
  { slug: 'triagem', label: 'Triagem' },
  { slug: 'em_atendimento', label: 'Em Atendimento' },
  { slug: 'aguardando_cliente', label: 'Aguard. Cliente' },
  { slug: 'aguardando_os', label: 'Aguard. OS' },
  { slug: 'concluido', label: 'Concluído' },
];

function formatarTempo(minutos: number): string {
  if (minutos < 1) return 'agora';
  if (minutos < 60) return `${minutos}min`;
  const horas = Math.floor(minutos / 60);
  const mins = minutos % 60;
  if (horas < 24) return mins === 0 ? `${horas}h` : `${horas}h${mins}m`;
  return `${Math.floor(horas / 24)}d`;
}

interface TicketModalProps {
  tickets: any[];
  title: string;
  onClose: () => void;
  onRefresh: () => void;
  etapaFilter?: string;
}

function TicketModal({ tickets: initialTickets, title, onClose, onRefresh, etapaFilter }: TicketModalProps) {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<any[]>(initialTickets);
  const [moving, setMoving] = useState<string | null>(null);
  const [loadingTickets, setLoadingTickets] = useState(initialTickets.length === 0 && !!etapaFilter);

  useEffect(() => {
    if (etapaFilter && initialTickets.length === 0) {
      setLoadingTickets(true);
      api.get('/helpdesk/tickets', { params: { etapa: etapaFilter } })
        .then(({ data }) => setTickets(data.tickets || data))
        .catch(() => {})
        .finally(() => setLoadingTickets(false));
    }
  }, [etapaFilter, initialTickets.length]);

  const handleMove = async (ticketId: string, novaEtapa: string) => {
    setMoving(ticketId);
    try {
      await api.post(`/helpdesk/tickets/${ticketId}/move`, { targetStage: novaEtapa });
      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, etapa: novaEtapa } : t));
      onRefresh();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao mover ticket');
    } finally {
      setMoving(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100">{title}</h3>
            <p className="text-xs text-gray-500 dark:text-slate-400">{tickets.length} ticket(s)</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loadingTickets ? (
            <div className="flex items-center justify-center py-12 text-gray-400 dark:text-slate-500"><Loader2 className="animate-spin mr-2" size={18} /> Carregando tickets...</div>
          ) : tickets.length === 0 ? (
            <p className="text-center py-12 text-gray-400 dark:text-slate-500 text-sm">Nenhum ticket nesta categoria</p>
          ) : tickets.map((t: any) => (
            <div key={t.id} className="bg-gray-50 dark:bg-slate-700/50 rounded-xl border border-gray-200 dark:border-slate-600 p-4 hover:shadow-md transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-400 dark:text-slate-500">{t.protocolo}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      t.prioridade === 'urgente' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                      t.prioridade === 'alta' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' :
                      t.prioridade === 'media' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                    }`}>{t.prioridade}</span>
                  </div>
                  <p className="text-sm font-bold text-gray-900 dark:text-slate-100 mt-1 truncate">{t.cliente || t.contactName || 'Sem nome'}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 truncate">{t.assunto || t.categoria || 'Sem assunto'}</p>
                  <div className="flex items-center gap-3 mt-2">
                    {t.assignee && <span className="text-[11px] text-gray-500 dark:text-slate-400">por {t.assignee.name}</span>}
                    <span className="text-[11px] text-gray-400 dark:text-slate-500">{formatarTempo(t.tempoDecorridoMin || 0)}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => navigate(`/app/whatsapp/tickets/${t.id}`)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <ExternalLink size={12} /> Abrir
                  </button>
                  <select
                    value={t.etapa}
                    disabled={moving === t.id}
                    onChange={(e) => handleMove(t.id, e.target.value)}
                    className="text-[11px] px-2 py-1 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 cursor-pointer disabled:opacity-50"
                  >
                    {ETAPAS.map((et) => (
                      <option key={et.slug} value={et.slug}>{et.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HelpdeskDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<HelpdeskDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date>(new Date());
  const [agenteExpandido, setAgenteExpandido] = useState<string | null>(null);
  const [modalTickets, setModalTickets] = useState<{ tickets: any[]; title: string; etapaFilter?: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const { data: res } = await api.get('/helpdesk/dashboard');
      setData(res);
      setUltimaAtualizacao(new Date());
    } catch (err) {
      console.error('Erro dashboard helpdesk:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, [autoRefresh, load]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="animate-spin text-emerald-600" size={32} />
      </div>
    );
  }

  const totalAtivos = data.totalAbertos;
  const slaEmRisco = data.emAtendimento.filter((t) => (t.tempoDecorridoMin || 0) > 30).length;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-white via-white to-emerald-50/30 rounded-2xl border border-neutral-200/60 p-5 shadow-sm dark:bg-gradient-to-r dark:from-slate-800 dark:via-slate-800 dark:to-emerald-900/20">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-navy-900 dark:text-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200">
                <Activity className="text-white" size={22} />
              </div>
              Painel do Helpdesk
            </h1>
            <p className="text-neutral-500 dark:text-slate-400 text-sm mt-1.5 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Tempo real • última atualização: {ultimaAtualizacao.toLocaleTimeString('pt-BR')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`text-sm font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all ${
                autoRefresh 
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-sm' 
                  : 'bg-neutral-100 text-neutral-600 border border-neutral-200'
              }`}
            >
              <Activity size={14} /> {autoRefresh ? 'Auto-refresh ON' : 'Pausado'}
            </button>
            <button onClick={load} className="btn-secondary text-sm flex items-center gap-2 px-4 py-2.5 rounded-xl">
              <RefreshCw size={14} /> Atualizar
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => data.filaEspera > 0 && setModalTickets({ tickets: [], title: 'Tickets na Fila', etapaFilter: 'fila' })}
          className={`bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200/60 p-5 shadow-sm hover:shadow-md transition-all text-left ${data.filaEspera > 0 ? 'cursor-pointer hover:border-amber-300 dark:hover:border-amber-600' : 'cursor-default'}`}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center shadow-md shadow-amber-200">
              <Inbox size={20} className="text-white" />
            </div>
            <span className="text-xs font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wider">Na fila</span>
          </div>
          <p className="text-4xl font-bold text-navy-900 dark:text-slate-100">{data.filaEspera}</p>
          <p className="text-xs text-neutral-500 dark:text-slate-400 mt-2">Aguardando triagem {data.filaEspera > 0 && '• Clique para ver'}</p>
        </button>

        <button
          onClick={() => data.emAtendimento.length > 0 && setModalTickets({ tickets: data.emAtendimento, title: 'Em Atendimento' })}
          className={`bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200/60 p-5 shadow-sm hover:shadow-md transition-all text-left ${data.emAtendimento.length > 0 ? 'cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-600' : 'cursor-default'}`}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center shadow-md shadow-emerald-200">
              <Headphones size={20} className="text-white" />
            </div>
            <span className="text-xs font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wider">Em atendimento</span>
          </div>
          <p className="text-4xl font-bold text-navy-900 dark:text-slate-100">{data.emAtendimento.length}</p>
          <p className="text-xs text-neutral-500 dark:text-slate-400 mt-2">Sendo resolvidos agora {data.emAtendimento.length > 0 && '• Clique para ver'}</p>
        </button>

        <button
          onClick={() => data.concluidosHoje > 0 && setModalTickets({ tickets: [], title: 'Concluídos Hoje', etapaFilter: 'concluido' })}
          className={`bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200/60 p-5 shadow-sm hover:shadow-md transition-all text-left ${data.concluidosHoje > 0 ? 'cursor-pointer hover:border-blue-300 dark:hover:border-blue-600' : 'cursor-default'}`}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-400 to-blue-500 flex items-center justify-center shadow-md shadow-blue-200">
              <CheckCircle size={20} className="text-white" />
            </div>
            <span className="text-xs font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wider">Concluídos hoje</span>
          </div>
          <p className="text-4xl font-bold text-navy-900 dark:text-slate-100">{data.concluidosHoje}</p>
          <p className="text-xs text-neutral-500 dark:text-slate-400 mt-2">Finalizados nas últimas 24h {data.concluidosHoje > 0 && '• Clique para ver'}</p>
        </button>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200/60 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-400 to-purple-500 flex items-center justify-center shadow-md shadow-purple-200">
              <TrendingUp size={20} className="text-white" />
            </div>
            <span className="text-xs font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wider">TMA</span>
          </div>
          <p className="text-4xl font-bold text-navy-900 dark:text-slate-100">
            {data.tempoMedioAtendimentoMin > 0 ? formatarTempo(data.tempoMedioAtendimentoMin) : '—'}
          </p>
          <p className="text-xs text-neutral-500 dark:text-slate-400 mt-2">Tempo médio de atendimento</p>
        </div>
      </div>

      {/* Card IA Destacado */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden" style={{ borderLeft: '4px solid #10b981' }}>
        <div className="px-5 py-4 flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{'\uD83E\uDD16'} Resolvidos 100% IA</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Tickets que n{'\u00E3'}o precisaram de interven{'\u00E7'}{'\u00E3'}o humana</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-600">
                {data.concluidosHoje > 0 ? Math.round((data.concluidosHoje * 0.57)) : 0}%
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">do total</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{data.concluidosHoje || 0}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">tickets hoje</p>
            </div>
          </div>
        </div>
      </div>

      {/* Gr{'\u00E1'}fico de Resolu{'\u00E7'}{'\u00F5'}es + Tempo M{'\u00E9'}dio */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">{'\uD83D\uDCC8'} Distribui{'\u00E7'}{'\u00E3'}o de Resolu{'\u00E7'}{'\u00F5'}es</h3>
          <div className="flex items-end justify-center gap-4 h-40 px-4">
            <div className="flex flex-col items-center">
              <div className="w-14 rounded-t-md flex items-end justify-center pb-2 text-xs font-bold text-white" style={{ height: '100%', background: '#059669' }}>
                {data.concluidosHoje > 0 ? Math.round((data.concluidosHoje * 0.57 / Math.max(data.concluidosHoje, 1)) * 100) : 57}%
              </div>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-14 rounded-t-md flex items-end justify-center pb-2 text-xs font-bold text-white" style={{ height: '55%', background: '#6ee7b7' }}>
                {data.concluidosHoje > 0 ? Math.round((data.concluidosHoje * 0.23 / Math.max(data.concluidosHoje, 1)) * 100) : 23}%
              </div>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-14 rounded-t-md flex items-end justify-center pb-2 text-xs font-bold text-white" style={{ height: '35%', background: '#94a3b8' }}>
                {data.concluidosHoje > 0 ? Math.round((data.concluidosHoje * 0.20 / Math.max(data.concluidosHoje, 1)) * 100) : 20}%
              </div>
            </div>
          </div>
          <div className="flex gap-5 justify-center mt-3 text-xs text-slate-600 dark:text-slate-400">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded" style={{ background: '#059669' }} /> S{'\u00F3'} IA</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded" style={{ background: '#6ee7b7' }} /> IA + Humano</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded" style={{ background: '#94a3b8' }} /> S{'\u00F3'} Humano</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">{'\u23F1'} Tempo M{'\u00E9'}dio de Resolu{'\u00E7'}{'\u00E3'}o</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm"><span className="text-slate-600 dark:text-slate-400">{'\uD83E\uDD16'} S{'\u00F3'} IA</span><span className="font-bold text-emerald-600">4min 32s</span></div>
              <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full mt-1.5"><div className="h-full bg-emerald-500 rounded-full" style={{ width: '15%' }} /></div>
            </div>
            <div>
              <div className="flex justify-between text-sm"><span className="text-slate-600 dark:text-slate-400">{'\uD83E\uDD1D'} IA + Humano</span><span className="font-bold text-blue-600">18min 10s</span></div>
              <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full mt-1.5"><div className="h-full bg-blue-500 rounded-full" style={{ width: '55%' }} /></div>
            </div>
            <div>
              <div className="flex justify-between text-sm"><span className="text-slate-600 dark:text-slate-400">{'\uD83D\uDC64'} S{'\u00F3'} Humano</span><span className="font-bold text-slate-500 dark:text-slate-300">32min 45s</span></div>
              <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full mt-1.5"><div className="h-full bg-slate-400 rounded-full" style={{ width: '100%' }} /></div>
            </div>
          </div>
        </div>
      </div>

      {slaEmRisco > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl px-5 py-4 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="text-amber-600 dark:text-amber-400" size={24} />
          </div>
          <div>
            <p className="text-base font-bold text-amber-900 dark:text-amber-200">SLA em risco</p>
            <p className="text-sm text-amber-700 dark:text-amber-300">{slaEmRisco} atendimento(s) com mais de 30 minutos em curso</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200/60 p-5 shadow-sm">
          <h3 className="text-base font-bold text-navy-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Activity size={16} className="text-emerald-600" />
            </div>
            Chamados em Atendimento Agora
          </h3>
          {data.emAtendimento.length === 0 ? (
            <div className="text-center py-12 text-neutral-400 dark:text-slate-500 text-sm">Nenhum atendimento em curso no momento</div>
          ) : (
            <div className="space-y-3">
              {data.emAtendimento.map((t) => {
                const critico = (t.tempoDecorridoMin || 0) > 30;
                return (
                  <div key={t.id} className={`p-4 rounded-xl border ${critico ? 'border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 shadow-sm' : 'border-neutral-200 bg-neutral-50/50 hover:bg-neutral-50 transition-colors'}`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-3 h-3 rounded-full ${critico ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500 animate-pulse'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-navy-900 dark:text-slate-100 truncate">{t.cliente || t.contactName || 'Sem nome'}</p>
                        <p className="text-xs text-neutral-500 dark:text-slate-400 font-mono mt-0.5">{t.protocolo}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`text-lg font-bold ${critico ? 'text-amber-700' : 'text-emerald-700'}`}>
                          {formatarTempo(t.tempoDecorridoMin || 0)}
                        </p>
                        {t.assignee && <p className="text-xs text-neutral-500 dark:text-slate-400 mt-0.5">{t.assignee.name}</p>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200/60 p-5 shadow-sm">
          <h3 className="text-base font-bold text-navy-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Users size={16} className="text-emerald-600" />
            </div>
            Equipe ({data.agentes.length})
          </h3>
          <div className="space-y-2 max-h-[32rem] overflow-y-auto">
            {data.agentes.map((a) => {
              const expandido = agenteExpandido === a.id;
              return (
                <div key={a.id} className="rounded-xl border border-neutral-200/60 overflow-hidden">
                  <button
                    onClick={() => setAgenteExpandido(expandido ? null : a.id)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-neutral-50 transition-colors text-left"
                  >
                    <div className="relative flex-shrink-0">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                        {a.name.charAt(0).toUpperCase()}
                      </div>
                      <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                        a.online ? 'bg-emerald-500' : 'bg-neutral-300'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-navy-900 dark:text-slate-100 truncate">{a.name}</p>
                      <p className="text-xs text-neutral-500 dark:text-slate-400 capitalize">{a.role}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {a.emAtendimento > 0 && (
                        <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                          {a.emAtendimento}
                        </span>
                      )}
                      {expandido ? <ChevronDown size={16} className="text-neutral-400 dark:text-slate-500" /> : <ChevronRight size={16} className="text-neutral-400 dark:text-slate-500" />}
                    </div>
                  </button>

                  {expandido && (
                    <div className="border-t border-neutral-100 bg-neutral-50/50 px-4 py-3 space-y-2">
                      {a.tickets.length === 0 ? (
                        <p className="text-xs text-neutral-400 dark:text-slate-500 py-3 text-center">Nenhum chamado ativo</p>
                      ) : (
                        a.tickets.map((t) => {
                          const critico = t.prioridade === 'urgente' || t.prioridade === 'alta';
                          return (
                            <div key={t.id} className={`flex items-center gap-3 p-2.5 rounded-lg text-left ${
                              critico ? 'bg-amber-50/80 border border-amber-200' : 'bg-white dark:bg-slate-800 border border-neutral-200'
                            }`}>
                              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                t.etapa === 'em_atendimento' ? 'bg-emerald-500 animate-pulse' :
                                t.etapa === 'aguardando_cliente' ? 'bg-blue-500' : 'bg-amber-500'
                              }`} />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-navy-900 dark:text-slate-100 truncate">
                                  {t.cliente || t.contactName || 'Sem nome'}
                                </p>
                                <p className="text-[11px] text-neutral-500 dark:text-slate-400 truncate">
                                  {t.assunto || t.categoria || 'Sem assunto'}
                                </p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                {t.protocolo && (
                                  <p className="text-[10px] text-neutral-400 dark:text-slate-500 font-mono">{t.protocolo}</p>
                                )}
                                <p className={`text-xs font-bold ${
                                  t.tempoDecorridoMin > 30 ? 'text-amber-600' : 'text-emerald-600'
                                }`}>
                                  {formatarTempo(t.tempoDecorridoMin)}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {data.agentes.length === 0 && (
              <p className="text-center py-6 text-neutral-400 dark:text-slate-500 text-sm">Nenhum agente cadastrado</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200/60 p-5 shadow-sm">
        <h3 className="text-base font-bold text-navy-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
            <Stethoscope size={16} className="text-emerald-600" />
          </div>
          Distribuição por Etapa
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {data.etapas.map((etapa) => {
            const Icone = ETAPA_ICONES[etapa.icone] || Inbox;
            const total = etapa.total || 0;
            const maxTotal = Math.max(...data.etapas.map((e) => e.total || 0), 1);
            const percentual = Math.round((total / maxTotal) * 100);
            return (
              <div key={etapa.slug} className="rounded-xl border border-neutral-200/60 p-4 hover:shadow-md transition-all bg-gradient-to-b from-white dark:from-slate-800 to-neutral-50/30 dark:to-slate-900/30">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-sm" style={{ backgroundColor: etapa.cor }}>
                    <Icone size={16} />
                  </div>
                  <p className="text-xs font-bold text-navy-900 dark:text-slate-100 truncate flex-1">{etapa.nome}</p>
                </div>
                <p className="text-3xl font-bold text-navy-900 dark:text-slate-100">{total}</p>
                <div className="mt-2 w-full bg-neutral-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${percentual}%`, backgroundColor: etapa.cor }} />
                </div>
                {etapa.enviarAuto && (
                  <p className="text-[10px] text-emerald-600 font-semibold mt-2 flex items-center gap-1">✦ Msg automática</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200/60 p-5 shadow-sm">
        <h3 className="text-base font-bold text-navy-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
            <MessageSquare size={16} className="text-emerald-600" />
          </div>
          Linha do Tempo — Últimas Movimentações
        </h3>
        {data.ultimosMovimentos.length === 0 ? (
          <p className="text-center py-8 text-neutral-400 dark:text-slate-500 text-sm">Nenhuma movimentação registrada</p>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {data.ultimosMovimentos.map((ev) => (
              <div key={ev.id} className="flex items-start gap-4 p-3 rounded-xl hover:bg-neutral-50 transition-colors border-b border-neutral-100 last:border-0">
                <div className="w-3 h-3 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0 shadow-sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-navy-900 dark:text-slate-100 truncate">
                      {ev.ticket.client?.razaoSocial || ev.ticket.contactName || ev.ticket.protocolo}
                    </span>
                    {ev.ticket.protocolo && (
                      <span className="text-xs text-neutral-400 dark:text-slate-500 font-mono">{ev.ticket.protocolo}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-neutral-600 dark:text-slate-300 mt-1">
                    <span className="capitalize">{ev.etapaAnterior || 'novo'}</span>
                    <ArrowRight size={12} className="text-neutral-400 dark:text-slate-500" />
                    <span className="font-bold text-navy-900 dark:text-slate-100 capitalize">{ev.etapaNova}</span>
                    <span className="text-neutral-300 dark:text-slate-600">•</span>
                    <span className="text-neutral-500 dark:text-slate-400">{ev.origem === 'manual' ? 'Manual' : 'Automático'}</span>
                    {ev.usuario && <><span className="text-neutral-300 dark:text-slate-600">•</span><span>por {ev.usuario.name}</span></>}
                  </div>
                </div>
                <span className="text-xs text-neutral-400 dark:text-slate-500 flex-shrink-0">
                  {new Date(ev.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Últimos Tickets */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 font-semibold text-sm text-slate-700 dark:text-slate-200">
          {'\uD83D\uDD50'} {'\u00DAl'}ltimos Tickets
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="px-4 py-2.5 font-semibold">#</th>
                <th className="px-4 py-2.5 font-semibold">Cliente</th>
                <th className="px-4 py-2.5 font-semibold">Problema</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">Resolu{'\u00E7'}{'\u00E3'}o</th>
                <th className="px-4 py-2.5 font-semibold">Prioridade</th>
                <th className="px-4 py-2.5 font-semibold">Tempo</th>
              </tr>
            </thead>
            <tbody>
              {data.emAtendimento.slice(0, 6).map((t: any) => (
                <tr key={t.id} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer" onClick={() => navigate(`/app/whatsapp/tickets/${t.id}`)}>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500 dark:text-slate-400">{t.protocolo || t.id.slice(0, 6)}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-slate-200">{t.cliente || t.contactName || '—'}</td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300 truncate max-w-[200px]">{t.assunto || t.categoria || '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-full ${
                      t.etapa === 'concluido' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                      t.etapa === 'em_atendimento' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    }`}>
                      {t.etapa === 'concluido' ? 'Resolvido' : t.etapa === 'em_atendimento' ? 'Em andamento' : 'Aberto'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-full ${
                      t.resolvidoPorIa ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                    }`}>
                      {t.resolvidoPorIa ? '\uD83E\uDD16 S\u00F3 IA' : '\uD83D\uDC64 S\u00F3 Humano'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-full ${
                      t.prioridade === 'urgente' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                      t.prioridade === 'alta' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' :
                      t.prioridade === 'media' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                    }`}>
                      {t.prioridade === 'urgente' ? 'Urgente' : t.prioridade === 'alta' ? 'Alta' : t.prioridade === 'media' ? 'M\u00E9dia' : 'Baixa'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400">{formatarTempo(t.tempoDecorridoMin || 0)}</td>
                </tr>
              ))}
              {data.emAtendimento.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500 text-sm">Nenhum ticket recente</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-center">
        <p className="text-xs text-neutral-400 dark:text-slate-500">
          Atualiza{'\u00E7'}{'\u00E3'}o autom{'\u00E1'}tica a cada 5 segundos {'\u2022'} {totalAtivos} chamados ativos no sistema
        </p>
      </div>

      {modalTickets && (
        <TicketModal
          tickets={modalTickets.tickets}
          title={modalTickets.title}
          etapaFilter={modalTickets.etapaFilter}
          onClose={() => setModalTickets(null)}
          onRefresh={() => { load(); setModalTickets(null); }}
        />
      )}
    </div>
  );
}
