import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useAuth } from '../../services/auth';
import { useNavigate } from 'react-router-dom';
import {
  Bot, BarChart3, MessageSquare, Activity, CheckCircle, TrendingUp, Clock, ArrowUpRight, ShieldCheck,
  X, Star, Users, AlertTriangle, Eye, Loader2, Search, ThumbsUp, ThumbsDown,
} from 'lucide-react';
import {
  BarChart as RechartsBarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
  PieChart, Pie,
} from 'recharts';

interface KpiCards {
  totalTicketsMonth: number;
  ticketsAbertos: number;
  ticketsFechados: number;
  ticketsResolvidosIa: number;
  ticketsResolvidosSoloIa: number;
  totalResolvidos: number;
  tmrMedia: number;
  tmresMedia: number;
}

interface IaSubMetrics {
  totalChamados: number;
  chamadosIaResolveu: number;
  taxaResolucaoIa: number;
  tempoMedioResolucaoIaMin: number;
  tempoMedioResolucaoHumanoMin: number;
  totalCorrecoes: number;
  confiancaMediaClassificacao: number;
}

interface DetailedTicket {
  id: string;
  protocolo?: string;
  contactName?: string;
  assunto?: string;
  etapa: string;
  status: string;
  prioridade: string;
  cliente?: string;
  assignee?: { id: string; name: string } | null;
  departamento?: { id: string; nome: string; cor: string } | null;
  dataAbertura: string;
  dataInicioAtendimento?: string;
  tempoAberturaMin: number;
  ultimaMensagem?: string;
  totalMensagens: number;
}

interface CsatAgent {
  agenteId: string;
  agenteNome: string;
  totalRespostas: number;
  mediaNotas: number;
  distribuicao: number[];
  ultimasRespostas: { ticketId: string; protocolo: string; contactName: string; nota: number; comentario?: string; respondidoEm: string }[];
}

interface AgentAudit {
  agenteId: string;
  agenteNome: string;
  totalAtendimentos: number;
  mediaNotas: number;
  classificacao: string;
  ultimasAvaliacoes: { ticketId: string; nota: number; classificacao: string; data: string }[];
}

function tempoFormatado(min: number): string {
  if (min < 1) return '<1min';
  if (min < 60) return `${Math.floor(min)}min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m === 0 ? `${h}h` : `${h}h${m}`;
}

function tempoAbsoluto(dataISO: string): string {
  const diff = Date.now() - new Date(dataISO).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}min`;
  const horas = Math.floor(mins / 60);
  if (horas < 24) return `${horas}h`;
  return `${Math.floor(horas / 24)}d`;
}

const STATUS_BADGE: Record<string, string> = {
  aberto: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  em_andamento: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  pendente: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
  resolvido: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  fechado: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  cancelado: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  escalonado: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

const PRIORIDADE_BADGE: Record<string, string> = {
  baixa: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
  media: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  alta: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  urgente: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    aberto: 'Aberto', em_andamento: 'Em Andamento', pendente: 'Pendente',
    resolvido: 'Resolvido', fechado: 'Fechado', cancelado: 'Cancelado', escalonado: 'Escalonado',
  };
  return map[s] || s;
}

function etapaLabel(e: string): string {
  const map: Record<string, string> = {
    fila: 'Fila de Espera', triagem: 'Triagem', em_atendimento: 'Em Atendimento',
    aguardando_cliente: 'Aguardando Cliente', aguardando_os: 'Aguardando OS',
    concluido: 'Concluído', descartado: 'Descartado',
  };
  return map[e] || e;
}

function csatNotaColor(nota: number): string {
  if (nota >= 4) return 'text-emerald-500';
  if (nota >= 3) return 'text-amber-500';
  return 'text-red-500';
}

function classificacaoBadge(c: string): string {
  const map: Record<string, string> = {
    excelente: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    bom: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    regular: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    ruim: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    sem_dados: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400',
  };
  return map[c] || map.regular;
}

export default function DashboardHelpdeskV2() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KpiCards | null>(null);
  const [iaMetrics, setIaMetrics] = useState<IaSubMetrics | null>(null);
  const [periodo, setPeriodo] = useState<7 | 30 | 90>(30);
  const [fcrMetrics, setFcrMetrics] = useState<any>(null);

  const [modalTickets, setModalTickets] = useState<DetailedTicket[] | null>(null);
  const [modalTitle, setModalTitle] = useState('');
  const [modalLoading, setModalLoading] = useState(false);

  const [csatData, setCsatData] = useState<CsatAgent[]>([]);
  const [auditData, setAuditData] = useState<AgentAudit[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const fim = new Date();
      const inicio = new Date(fim.getTime() - periodo * 24 * 60 * 60 * 1000);
      const params = { dataInicio: inicio.toISOString(), dataFim: fim.toISOString() };

      const [kpisRes, metricsRes, fcrRes, csatRes, auditRes] = await Promise.all([
        api.get('/analytics/kpis'),
        api.get('/helpdesk/metrics', { params }),
        api.get('/helpdesk/fcr/metricas', { params }).catch(() => ({ data: null })),
        api.get('/csat/por-agente', { params }).catch(() => ({ data: [] })),
        api.get('/helpdesk/audit/agent-performance', { params }).catch(() => ({ data: [] })),
      ]);

      setKpis(kpisRes.data.cards);
      setIaMetrics(metricsRes.data.ia);
      setFcrMetrics(fcrRes.data);
      setCsatData(csatRes.data || []);
      setAuditData(auditRes.data || []);
    } catch (err) {
      console.error('Erro DashboardHelpdeskV2:', err);
    } finally {
      setLoading(false);
    }
  }, [periodo]);

  useEffect(() => { load(); }, [load]);

  const openTicketModal = useCallback(async (titulo: string, params: Record<string, string>) => {
    setModalTitle(titulo);
    setModalLoading(true);
    setModalTickets(null);
    try {
      const { data } = await api.get('/helpdesk/dashboard/detalhado', { params });
      setModalTickets(data.tickets || []);
    } catch {
      setModalTickets([]);
    } finally {
      setModalLoading(false);
    }
  }, []);

  if (loading || !kpis) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-violet-600" size={32} />
      </div>
    );
  }

  const iaTicketCount = kpis.ticketsResolvidosIa;
  const iaSoloCount = kpis.ticketsResolvidosSoloIa;
  const totalResolvidos = kpis.totalResolvidos || 1;
  const iaPercentual = Math.round((iaTicketCount / totalResolvidos) * 100);

  const tempoMedioData = [
    { name: 'IA', tempo: iaMetrics?.tempoMedioResolucaoIaMin || 4.5, fill: '#7C3AED' },
    { name: 'IA+Humano', tempo: iaMetrics && iaMetrics.tempoMedioResolucaoIaMin ? Math.round(((iaMetrics.tempoMedioResolucaoIaMin + (iaMetrics.tempoMedioResolucaoHumanoMin || 32)) / 2) * 100) / 100 : 18.2, fill: '#3B82F6' },
    { name: 'Humano', tempo: iaMetrics?.tempoMedioResolucaoHumanoMin || 32.75, fill: '#94A3B8' },
  ];

  const csatGeral = csatData.length > 0
    ? { media: Math.round(csatData.reduce((s, a) => s + a.mediaNotas * a.totalRespostas, 0) / Math.max(csatData.reduce((s, a) => s + a.totalRespostas, 0), 1) * 10) / 10, total: csatData.reduce((s, a) => s + a.totalRespostas, 0) }
    : { media: 0, total: 0 };

  const periodos = [7, 30, 90] as const;

  return (
    <div className="space-y-6 font-['Lexend']">
      {/* Header */}
      <div className="bg-gradient-to-r from-white via-white to-violet-50/30 dark:from-slate-800 dark:via-slate-800 dark:to-violet-900/30 rounded-2xl border border-neutral-200/60 dark:border-slate-700/60 p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-navy-900 dark:text-slate-100 flex items-center gap-3" style={{ fontFamily: 'Khand, sans-serif' }}>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-lg shadow-violet-200">
                <Bot className="text-white" size={22} />
              </div>
              Dashboard Helpdesk
            </h1>
            <p className="text-neutral-500 dark:text-slate-400 text-sm mt-1.5 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
              Métricas em tempo real • {periodo} dias
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl p-1 shadow-sm">
              {periodos.map((p) => (
                <button key={p} onClick={() => setPeriodo(p)}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${periodo === p ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 shadow-sm' : 'text-neutral-600 dark:text-slate-400 hover:bg-neutral-50 dark:hover:bg-slate-700'}`}>
                  {p}d
                </button>
              ))}
            </div>
            <button onClick={load} className="btn-secondary text-sm flex items-center gap-2 px-4 py-2.5 rounded-xl">
              <Activity size={14} /> Atualizar
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards - Clicaveis */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <button onClick={() => openTicketModal('Tickets Abertos', { etapa: 'fila', etapa2: 'triagem' })}
          className="text-left bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all cursor-pointer group">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-400 to-blue-500 flex items-center justify-center shadow-md shadow-blue-200 dark:shadow-blue-800/50 group-hover:scale-105 transition-transform">
              <MessageSquare size={20} className="text-white" />
            </div>
            <span className="text-xs font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wider">Abertos</span>
          </div>
          <p className="text-4xl font-bold text-navy-900 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>{kpis.ticketsAbertos}</p>
          <p className="text-xs text-violet-600 dark:text-violet-400 mt-2 font-medium flex items-center gap-1">Clique para ver <Eye size={10} /></p>
        </button>

        <button onClick={() => openTicketModal('Em Andamento', { etapa: 'em_atendimento' })}
          className="text-left bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm hover:shadow-md hover:border-amber-300 dark:hover:border-amber-600 transition-all cursor-pointer group">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center shadow-md shadow-amber-200 dark:shadow-amber-800/50 group-hover:scale-105 transition-transform">
              <Activity size={20} className="text-white" />
            </div>
            <span className="text-xs font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wider">Em Atendimento</span>
          </div>
          <p className="text-4xl font-bold text-navy-900 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>{kpis.totalTicketsMonth - kpis.ticketsFechados}</p>
          <p className="text-xs text-violet-600 dark:text-violet-400 mt-2 font-medium flex items-center gap-1">Clique para ver <Eye size={10} /></p>
        </button>

        <button onClick={() => openTicketModal('Resolvidos / Fechados', { status: 'resolvido' })}
          className="text-left bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-600 transition-all cursor-pointer group">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center shadow-md shadow-emerald-200 dark:shadow-emerald-800/50 group-hover:scale-105 transition-transform">
              <CheckCircle size={20} className="text-white" />
            </div>
            <span className="text-xs font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wider">Resolvidos</span>
          </div>
          <p className="text-4xl font-bold text-navy-900 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>{kpis.ticketsFechados}</p>
          <p className="text-xs text-violet-600 dark:text-violet-400 mt-2 font-medium flex items-center gap-1">Clique para ver <Eye size={10} /></p>
        </button>

        <button onClick={() => openTicketModal('Aguardando Cliente', { etapa: 'aguardando_cliente' })}
          className="text-left bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm hover:shadow-md hover:border-cyan-300 dark:hover:border-cyan-600 transition-all cursor-pointer group">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-500 flex items-center justify-center shadow-md shadow-cyan-200 dark:shadow-cyan-800/50 group-hover:scale-105 transition-transform">
              <Clock size={20} className="text-white" />
            </div>
            <span className="text-xs font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wider">Aguard. Cliente</span>
          </div>
          <p className="text-4xl font-bold text-navy-900 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>{fcrMetrics?.taxaFCR ?? 0}%</p>
          <p className="text-xs text-violet-600 dark:text-violet-400 mt-2 font-medium flex items-center gap-1">Clique para ver <Eye size={10} /></p>
        </button>

        <div className="rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-violet-600 to-violet-800 border border-violet-500">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shadow-md backdrop-blur-sm">
              <Bot size={20} className="text-white" />
            </div>
            <span className="text-xs font-semibold text-violet-100 uppercase tracking-wider">Resolvidos IA</span>
          </div>
          <p className="text-4xl font-bold text-white" style={{ fontFamily: 'Khand, sans-serif' }}>{iaTicketCount}</p>
          <p className="text-xs text-violet-200 mt-2">{iaPercentual}% dos resolvidos</p>
        </div>
      </div>

      {/* IA Highlight */}
      <div className="rounded-2xl p-6 shadow-sm bg-gradient-to-br from-violet-900 to-[#2D1B69] border border-violet-700/50 text-white">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-2">
              <Bot size={24} className="text-violet-300" />
              <span className="text-xs font-semibold text-violet-300 uppercase tracking-wider">IA Destacado</span>
            </div>
            <p className="text-5xl font-bold mt-2" style={{ fontFamily: 'Khand, sans-serif' }}>
              {iaMetrics?.taxaResolucaoIa ?? iaPercentual}%
            </p>
            <p className="text-violet-200 text-sm mt-1">resolução por IA</p>
          </div>
          <div className="flex flex-col justify-center">
            <p className="text-4xl font-bold" style={{ fontFamily: 'Khand, sans-serif' }}>{iaSoloCount}</p>
            <p className="text-violet-200 text-sm mt-1">
              <TrendingUp size={14} className="inline mr-1 text-emerald-400" />
              Resolvidos só pela IA
            </p>
          </div>
          <div className="flex flex-col justify-center">
            <p className="text-4xl font-bold text-emerald-400" style={{ fontFamily: 'Khand, sans-serif' }}>
              {csatGeral.media > 0 ? `${csatGeral.media}/5` : '—'}
            </p>
            <p className="text-violet-200 text-sm mt-1">Nota média CSAT ({csatGeral.total} respostas)</p>
          </div>
          <div className="flex flex-col justify-center">
            <p className="text-sm text-violet-200 leading-relaxed">
              A IA resolveu {iaMetrics?.chamadosIaResolveu ?? iaTicketCount} chamados autônomos,
              com {iaMetrics?.confiancaMediaClassificacao ?? 0}% de confiança
              {iaMetrics && iaMetrics.totalCorrecoes > 0 ? ` e ${iaMetrics.totalCorrecoes} correções.` : '.'}
            </p>
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
          <h3 className="text-base font-bold text-navy-900 dark:text-slate-100 mb-4 flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
            <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <BarChart3 size={16} className="text-violet-600 dark:text-violet-400" />
            </div>
            Tempo Médio de Resolução
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <RechartsBarChart data={tempoMedioData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false}
                tickFormatter={(v: number) => tempoFormatado(v)} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 13, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} width={90} />
              <Tooltip formatter={(value: number) => tempoFormatado(value)}
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, fontSize: 13 }} />
              <Bar dataKey="tempo" radius={[0, 8, 8, 0]} maxBarSize={40}>
                {tempoMedioData.map((entry, idx) => (<Cell key={idx} fill={entry.fill} />))}
              </Bar>
            </RechartsBarChart>
          </ResponsiveContainer>
        </div>

        {/* CSAT Distribution */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
          <h3 className="text-base font-bold text-navy-900 dark:text-slate-100 mb-4 flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Star size={16} className="text-amber-600 dark:text-amber-400" />
            </div>
            Avaliações CSAT por Atendente
          </h3>
          {csatData.length === 0 ? (
            <p className="text-center py-16 text-neutral-400 dark:text-slate-500 text-sm">Nenhuma avaliação CSAT ainda</p>
          ) : (
            <div className="space-y-3 max-h-[280px] overflow-y-auto">
              {csatData.map(a => (
                <div key={a.agenteId} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-slate-900/50 hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {a.agenteNome.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 dark:text-slate-200 truncate">{a.agenteNome}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">{a.totalRespostas} respostas</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-xl font-bold ${csatNotaColor(a.mediaNotas)}`} style={{ fontFamily: 'Khand, sans-serif' }}>{a.mediaNotas}</p>
                    <div className="flex gap-0.5 justify-end">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star key={s} size={10} className={s <= Math.round(a.mediaNotas) ? 'text-amber-400 fill-amber-400' : 'text-gray-300 dark:text-slate-600'} />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Auditoria AI */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
        <h3 className="text-base font-bold text-navy-900 dark:text-slate-100 mb-4 flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
          <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
            <ShieldCheck size={16} className="text-violet-600 dark:text-violet-400" />
          </div>
          Auditoria de Atendimento (IA)
          <span className="text-xs font-normal text-neutral-400 dark:text-slate-500 ml-2">Análise de qualidade das respostas</span>
        </h3>
        {auditData.length === 0 ? (
          <p className="text-center py-10 text-neutral-400 dark:text-slate-500 text-sm">Nenhum dado de auditoria disponível</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-xs text-neutral-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="text-left py-3 px-3 font-semibold">Atendente</th>
                  <th className="text-center py-3 px-3 font-semibold">Atendimentos</th>
                  <th className="text-center py-3 px-3 font-semibold">Nota Média</th>
                  <th className="text-center py-3 px-3 font-semibold">Classificação</th>
                  <th className="text-left py-3 px-3 font-semibold">Últimas Avaliações</th>
                </tr>
              </thead>
              <tbody>
                {auditData.map(a => (
                  <tr key={a.agenteId} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                          {a.agenteNome.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-gray-800 dark:text-slate-200">{a.agenteNome}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center text-gray-600 dark:text-slate-400">{a.totalAtendimentos}</td>
                    <td className="py-3 px-3 text-center">
                      <span className={`text-lg font-bold ${csatNotaColor(a.mediaNotas)}`} style={{ fontFamily: 'Khand, sans-serif' }}>
                        {a.mediaNotas}/10
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${classificacaoBadge(a.classificacao)}`}>
                        {a.classificacao === 'excelente' ? 'Excelente' : a.classificacao === 'bom' ? 'Bom' : a.classificacao === 'regular' ? 'Regular' : a.classificacao === 'ruim' ? 'Ruim' : 'Sem dados'}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex gap-1 flex-wrap">
                        {a.ultimasAvaliacoes.slice(0, 5).map((av, i) => (
                          <span key={i} className={`inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded ${av.nota >= 7 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : av.nota >= 5 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                            {av.nota}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Tickets Filtrados */}
      {modalTickets !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setModalTickets(null)} />
          <div className="relative w-full max-w-5xl max-h-[85vh] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-5 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>{modalTitle}</h2>
                <span className="text-xs text-gray-400 dark:text-slate-500 bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">{modalTickets.length} tickets</span>
              </div>
              <button onClick={() => setModalTickets(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {modalLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="animate-spin text-violet-600" size={28} />
                </div>
              ) : modalTickets.length === 0 ? (
                <p className="text-center py-16 text-neutral-400 dark:text-slate-500 text-sm">Nenhum ticket encontrado</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 text-xs text-neutral-500 dark:text-slate-400 uppercase tracking-wider">
                        <th className="text-left py-3 px-2 font-semibold">#</th>
                        <th className="text-left py-3 px-2 font-semibold">Cliente</th>
                        <th className="text-left py-3 px-2 font-semibold">Assunto</th>
                        <th className="text-center py-3 px-2 font-semibold">Etapa</th>
                        <th className="text-center py-3 px-2 font-semibold">Status</th>
                        <th className="text-center py-3 px-2 font-semibold">Prioridade</th>
                        <th className="text-left py-3 px-2 font-semibold">Responsável</th>
                        <th className="text-center py-3 px-2 font-semibold">Departamento</th>
                        <th className="text-center py-3 px-2 font-semibold">Tempo</th>
                        <th className="text-center py-3 px-2 font-semibold">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modalTickets.map(t => (
                        <tr key={t.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                          <td className="py-2.5 px-2 font-mono text-xs text-neutral-500 dark:text-slate-400">{t.protocolo || t.id.slice(0, 8)}</td>
                          <td className="py-2.5 px-2 font-semibold text-gray-800 dark:text-slate-200 truncate max-w-[120px]">{t.contactName || t.cliente || '—'}</td>
                          <td className="py-2.5 px-2 text-neutral-600 dark:text-slate-400 truncate max-w-[180px]">{t.assunto || '—'}</td>
                          <td className="py-2.5 px-2 text-center">
                            <span className="text-xs font-medium text-gray-600 dark:text-slate-400 bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">{etapaLabel(t.etapa)}</span>
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[t.status] || ''}`}>{statusLabel(t.status)}</span>
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${PRIORIDADE_BADGE[t.prioridade] || ''}`}>
                              {t.prioridade?.charAt(0).toUpperCase() + t.prioridade?.slice(1) || '—'}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-center text-xs text-gray-600 dark:text-slate-400">{t.assignee?.name || <span className="text-neutral-300 dark:text-slate-600">Não atribuído</span>}</td>
                          <td className="py-2.5 px-2 text-center">
                            {t.departamento ? (
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: `${t.departamento.cor}20`, color: t.departamento.cor }}>{t.departamento.nome}</span>
                            ) : <span className="text-neutral-300 dark:text-slate-600 text-xs">—</span>}
                          </td>
                          <td className="py-2.5 px-2 text-center text-xs font-mono text-neutral-500 dark:text-slate-400">{tempoAbsoluto(t.dataAbertura)}</td>
                          <td className="py-2.5 px-2 text-center">
                            <button onClick={() => { setModalTickets(null); navigate(`/app/helpdesk/ticket/${t.id}`); }}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-300 transition-colors">
                              Abrir <ArrowUpRight size={11} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
