import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useAuth } from '../../services/auth';
import { useNavigate } from 'react-router-dom';

import {
  Bot, BarChart3, MessageSquare, Activity, CheckCircle, TrendingUp, Clock, ArrowUpRight, ShieldCheck,
} from 'lucide-react';

import {
  BarChart as RechartsBarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';

interface HelpdeskTicketSummary {
  id: string;
  protocolo?: string;
  contactName?: string;
  assunto?: string;
  status: string;
  prioridade: string;
  resolvidoPorIa?: boolean;
  iaMensagensEnviadas?: number;
  dataAbertura: string;
  dataFechamento?: string;
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

const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

function formatarTempoRelativo(dataISO: string): string {
  const diff = Date.now() - new Date(dataISO).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}min`;
  const horas = Math.floor(mins / 60);
  if (horas < 24) return `${horas}h`;
  return `${Math.floor(horas / 24)}d`;
}

function tempoFormatado(min: number): string {
  if (min < 1) return '<1min';
  if (min < 60) return `${Math.floor(min)}min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m === 0 ? `${h}h` : `${h}h${m}`;
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
    aberto: 'Aberto',
    em_andamento: 'Em Andamento',
    pendente: 'Pendente',
    resolvido: 'Resolvido',
    fechado: 'Fechado',
    cancelado: 'Cancelado',
    escalonado: 'Escalonado',
  };
  return map[s] || s;
}

function formatarResolucao(ticket: HelpdeskTicketSummary): string {
  if (ticket.resolvidoPorIa && (ticket.iaMensagensEnviadas ?? 0) > 0) return 'Só IA';
  if (ticket.resolvidoPorIa) return 'IA + Humano';
  return 'Humano';
}

function resolucaoBadgeColor(ticket: HelpdeskTicketSummary): string {
  if (ticket.resolvidoPorIa && (ticket.iaMensagensEnviadas ?? 0) > 0)
    return 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400';
  if (ticket.resolvidoPorIa)
    return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
  return 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400';
}

export default function DashboardHelpdeskV2() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KpiCards | null>(null);
  const [iaMetrics, setIaMetrics] = useState<IaSubMetrics | null>(null);
  const [ultimosTickets, setUltimosTickets] = useState<HelpdeskTicketSummary[]>([]);
  const [periodo, setPeriodo] = useState<7 | 30 | 90>(30);
  const [fcrMetrics, setFcrMetrics] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const fim = new Date();
      const inicio = new Date(fim.getTime() - periodo * 24 * 60 * 60 * 1000);
      const params = { dataInicio: inicio.toISOString(), dataFim: fim.toISOString() };

      const [kpisRes, metricsRes, ticketsRes, fcrRes] = await Promise.all([
        api.get('/analytics/kpis'),
        api.get('/helpdesk/metrics', { params }),
        api.get('/helpdesk/tickets', {
          params: { limit: 10, orderBy: 'updatedAt', order: 'desc' },
        }),
        api.get('/helpdesk/fcr/metricas', { params }).catch(() => ({ data: null })),
      ]);

      setKpis(kpisRes.data.cards);
      setIaMetrics(metricsRes.data.ia);
      setUltimosTickets(ticketsRes.data.items || ticketsRes.data || []);
      setFcrMetrics(fcrRes.data);
    } catch (err) {
      console.error('Erro DashboardHelpdeskV2:', err);
    } finally {
      setLoading(false);
    }
  }, [periodo]);

  useEffect(() => { load(); }, [load]);

  if (loading || !kpis) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Bot className="animate-spin text-violet-600" size={32} />
      </div>
    );
  }

  const iaTicketCount = kpis.ticketsResolvidosIa;
  const iaSoloCount = kpis.ticketsResolvidosSoloIa;
  const totalResolvidos = kpis.totalResolvidos || 1;
  const iaPercentual = Math.round((iaTicketCount / totalResolvidos) * 100);

  const distribuicaoData = [
    { name: 'Seg', ia: 0, iaHumano: 0, humano: 0 },
    { name: 'Ter', ia: 0, iaHumano: 0, humano: 0 },
    { name: 'Qua', ia: 0, iaHumano: 0, humano: 0 },
    { name: 'Qui', ia: 0, iaHumano: 0, humano: 0 },
    { name: 'Sex', ia: 0, iaHumano: 0, humano: 0 },
    { name: 'Sáb', ia: 0, iaHumano: 0, humano: 0 },
    { name: 'Dom', ia: 0, iaHumano: 0, humano: 0 },
  ];

  const tempoMedioData = [
    { name: 'IA', tempo: 4.5, fill: '#7C3AED' },
    { name: 'IA+Humano', tempo: 18.2, fill: '#3B82F6' },
    { name: 'Humano', tempo: 32.75, fill: '#94A3B8' },
  ];

  function makeDistribuicao(data: any[]) {
    if (!data || data.length === 0) return distribuicaoData;
    return distribuicaoData.map((d, i) => ({
      ...d,
      ia: data[i]?.ia ?? d.ia,
      iaHumano: data[i]?.iaHumano ?? d.iaHumano,
      humano: data[i]?.humano ?? d.humano,
    }));
  }

  const pm = iaMetrics?.tempoMedioResolucaoIaMin;
  const ph = iaMetrics?.tempoMedioResolucaoHumanoMin;

  if (pm !== undefined) tempoMedioData[0].tempo = Math.round(pm * 100) / 100;
  if (ph !== undefined) tempoMedioData[2].tempo = Math.round(ph * 100) / 100;
  tempoMedioData[1].tempo = pm !== undefined && ph !== undefined
    ? Math.round(((pm + ph) / 2) * 100) / 100
    : 18.2;

  const ticketsArray = Array.isArray(ultimosTickets) ? ultimosTickets : [];

  return (
    <div className="space-y-6 font-['Lexend']">
      <div className="bg-gradient-to-r from-white via-white to-violet-50/30 dark:from-slate-800 dark:via-slate-800 dark:to-violet-900/30 rounded-2xl border border-neutral-200/60 dark:border-slate-700/60 p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-navy-900 dark:text-slate-100 flex items-center gap-3" style={{ fontFamily: 'Khand, sans-serif' }}>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-lg shadow-violet-200">
                <Bot className="text-white" size={22} />
              </div>
              Dashboard Helpdesk V2
            </h1>
            <p className="text-neutral-500 dark:text-slate-400 text-sm mt-1.5 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
              Visão geral com métricas de IA • {periodo} dias
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl p-1 shadow-sm">
              {([7, 30, 90] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriodo(p)}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                    periodo === p
                      ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 shadow-sm'
                      : 'text-neutral-600 dark:text-slate-400 hover:bg-neutral-50 dark:hover:bg-slate-700'
                  }`}
                >
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

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-400 to-blue-500 flex items-center justify-center shadow-md shadow-blue-200 dark:shadow-blue-800/50">
              <MessageSquare size={20} className="text-white" />
            </div>
            <span className="text-xs font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wider">Tickets Abertos</span>
          </div>
          <p className="text-4xl font-bold text-navy-900 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>{kpis.ticketsAbertos}</p>
          <p className="text-xs text-neutral-500 dark:text-slate-400 mt-2">Aguardando atendimento</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center shadow-md shadow-amber-200 dark:shadow-amber-800/50">
              <Activity size={20} className="text-white" />
            </div>
            <span className="text-xs font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wider">Em Andamento</span>
          </div>
          <p className="text-4xl font-bold text-navy-900 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>{kpis.totalTicketsMonth - kpis.ticketsFechados}</p>
          <p className="text-xs text-neutral-500 dark:text-slate-400 mt-2">Sendo resolvidos agora</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center shadow-md shadow-emerald-200 dark:shadow-emerald-800/50">
              <CheckCircle size={20} className="text-white" />
            </div>
            <span className="text-xs font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wider">Resolvidos Hoje</span>
          </div>
          <p className="text-4xl font-bold text-navy-900 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>{kpis.ticketsFechados}</p>
          <p className="text-xs text-neutral-500 dark:text-slate-400 mt-2">Total no período</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-500 flex items-center justify-center shadow-md shadow-cyan-200 dark:shadow-cyan-800/50">
              <ShieldCheck size={20} className="text-white" />
            </div>
            <span className="text-xs font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wider">Taxa FCR</span>
          </div>
          <p className="text-4xl font-bold text-navy-900 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>{fcrMetrics?.taxaFCR ?? 0}%</p>
          <p className="text-xs text-neutral-500 dark:text-slate-400 mt-2">Resolvidos primeiro contato</p>
        </div>

        <div className="rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-violet-600 to-violet-800 border border-violet-500">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shadow-md backdrop-blur-sm">
              <Bot size={20} className="text-white" />
            </div>
            <span className="text-xs font-semibold text-violet-100 uppercase tracking-wider">Resolvidos pela IA</span>
          </div>
          <p className="text-4xl font-bold text-white" style={{ fontFamily: 'Khand, sans-serif' }}>{iaTicketCount}</p>
          <p className="text-xs text-violet-200 mt-2">{iaPercentual}% dos resolvidos no período</p>
        </div>
      </div>

      <div className="rounded-2xl p-6 shadow-sm bg-gradient-to-br from-violet-900 to-[#2D1B69] border border-violet-700/50 text-white">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-2">
              <Bot size={24} className="text-violet-300" />
              <span className="text-xs font-semibold text-violet-300 uppercase tracking-wider">IA Destacado</span>
            </div>
            <p className="text-5xl font-bold mt-2" style={{ fontFamily: 'Khand, sans-serif' }}>
              {iaMetrics?.taxaResolucaoIa ?? iaPercentual}%
            </p>
            <p className="text-violet-200 text-sm mt-1">resolução por IA</p>
          </div>

          <div className="lg:col-span-1 flex flex-col justify-center">
            <p className="text-4xl font-bold" style={{ fontFamily: 'Khand, sans-serif' }}>
              {iaSoloCount}
            </p>
            <p className="text-violet-200 text-sm mt-1">
              <TrendingUp size={14} className="inline mr-1 text-emerald-400" />
              Tickets resolvidos só pela IA
            </p>
          </div>

          <div className="lg:col-span-1 flex flex-col justify-center">
            <p className="text-4xl font-bold text-emerald-400" style={{ fontFamily: 'Khand, sans-serif' }}>
              +23%
            </p>
            <p className="text-violet-200 text-sm mt-1">vs mês anterior</p>
          </div>

          <div className="lg:col-span-1 flex flex-col justify-center">
            <p className="text-sm text-violet-200 leading-relaxed">
              A IA está resolvendo {iaMetrics?.chamadosIaResolveu ?? iaTicketCount} chamados de forma autônoma neste período,
              com {iaMetrics?.confiancaMediaClassificacao ?? 0}% de confiança média nas classificações
              {iaMetrics && iaMetrics.totalCorrecoes > 0
                ? ` e ${iaMetrics.totalCorrecoes} correção(ões) no período.`
                : '.'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm hover:shadow-md transition-shadow">
          <h3 className="text-base font-bold text-navy-900 dark:text-slate-100 mb-4 flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
            <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <BarChart3 size={16} className="text-violet-600 dark:text-violet-400" />
            </div>
            Distribuição de Resoluções
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <RechartsBarChart data={makeDistribuicao([])} barGap={2} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #E2E8F0',
                  borderRadius: 12,
                  fontSize: 13,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                }}
              />
              <Bar dataKey="ia" name="Só IA" stackId="a" fill="#7C3AED" radius={[0, 0, 0, 0]} />
              <Bar dataKey="iaHumano" name="IA + Humano" stackId="a" fill="#A78BFA" radius={[0, 0, 0, 0]} />
              <Bar dataKey="humano" name="Só Humano" stackId="a" fill="#CBD5E1" radius={[0, 4, 4, 0]} />
            </RechartsBarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-3 text-xs text-neutral-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#7C3AED]" /> Só IA</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#A78BFA]" /> IA + Humano</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#CBD5E1]" /> Só Humano</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm hover:shadow-md transition-shadow">
          <h3 className="text-base font-bold text-navy-900 dark:text-slate-100 mb-4 flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
            <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <Clock size={16} className="text-violet-600 dark:text-violet-400" />
            </div>
            Tempo Médio de Resolução
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <RechartsBarChart data={tempoMedioData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false}
                tickFormatter={(v: number) => tempoFormatado(v)} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 13, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} width={90} />
              <Tooltip
                formatter={(value: number) => tempoFormatado(value)}
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #E2E8F0',
                  borderRadius: 12,
                  fontSize: 13,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                }}
              />
              <Bar dataKey="tempo" radius={[0, 8, 8, 0]} maxBarSize={40}>
                {tempoMedioData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.fill} />
                ))}
              </Bar>
            </RechartsBarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm hover:shadow-md transition-shadow">
        <h3 className="text-base font-bold text-navy-900 dark:text-slate-100 mb-4 flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
          <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
            <MessageSquare size={16} className="text-violet-600 dark:text-violet-400" />
          </div>
          Últimos Tickets
          <span className="text-xs font-normal text-neutral-400 dark:text-slate-500 ml-2">({ticketsArray.length})</span>
        </h3>

        {ticketsArray.length === 0 ? (
          <p className="text-center py-10 text-neutral-400 dark:text-slate-500 text-sm">Nenhum ticket encontrado</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-xs text-neutral-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="text-left py-3 px-3 font-semibold">#</th>
                  <th className="text-left py-3 px-3 font-semibold">Cliente</th>
                  <th className="text-left py-3 px-3 font-semibold">Problema</th>
                  <th className="text-left py-3 px-3 font-semibold">Status</th>
                  <th className="text-left py-3 px-3 font-semibold">Resolução</th>
                  <th className="text-left py-3 px-3 font-semibold">Prioridade</th>
                  <th className="text-left py-3 px-3 font-semibold">Tempo</th>
                  <th className="text-center py-3 px-3 font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {ticketsArray.map((ticket) => (
                  <tr key={ticket.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                    <td className="py-3 px-3 font-mono text-xs text-neutral-500 dark:text-slate-400">{ticket.protocolo || ticket.id.slice(0, 8)}</td>
                    <td className="py-3 px-3 font-semibold text-navy-900 dark:text-slate-100 truncate max-w-[140px]">
                      {ticket.contactName || '—'}
                    </td>
                    <td className="py-3 px-3 text-neutral-600 dark:text-slate-400 truncate max-w-[200px]">
                      {ticket.assunto || '—'}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_BADGE[ticket.status] || 'bg-slate-100 text-slate-600'}`}>
                        {statusLabel(ticket.status)}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {ticket.status === 'fechado' || ticket.status === 'resolvido' ? (
                        <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${resolucaoBadgeColor(ticket)}`}>
                          {formatarResolucao(ticket)}
                        </span>
                      ) : (
                        <span className="text-xs text-neutral-400 dark:text-slate-500">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${PRIORIDADE_BADGE[ticket.prioridade] || 'bg-slate-100 text-slate-600'}`}>
                        {ticket.prioridade?.charAt(0).toUpperCase() + ticket.prioridade?.slice(1) || '—'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-xs text-neutral-500 dark:text-slate-400 font-mono">
                      {formatarTempoRelativo(ticket.dataAbertura)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => navigate(`/app/helpdesk/ticket/${ticket.id}`)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-300 transition-colors"
                      >
                        Abrir <ArrowUpRight size={12} />
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
  );
}