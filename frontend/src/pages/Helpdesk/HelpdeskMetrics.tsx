import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import {
  RefreshCw, BarChart3, Target, Clock, Zap, Star, AlertTriangle,
  Inbox, CheckCircle, TrendingUp, Activity, Users, Tag, Calendar,
} from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts';
import { AcronymText } from '../../components/AcronymText';
import type { DashboardMetrics } from '../../types';

type Periodo = 7 | 30 | 90;

const PRIORIDADE_CORES: Record<string, string> = {
  baixa: '#10b981',
  media: '#3b82f6',
  alta: '#f59e0b',
  urgente: '#ef4444',
};

const ETAPA_CORES: Record<string, string> = {
  fila: '#94a3b8',
  triagem: '#a78bfa',
  em_atendimento: '#10b981',
  aguardando_cliente: '#f59e0b',
  aguardando_os: '#3b82f6',
  concluido: '#22c55e',
  descartado: '#9ca3af',
};

const FILA_CORES = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#84cc16'];

function formatarMinutos(min: number): string {
  if (!min || min <= 0) return '—';
  if (min < 60) return `${min}min`;
  const horas = Math.floor(min / 60);
  const mins = min % 60;
  if (horas < 24) return mins === 0 ? `${horas}h` : `${horas}h${mins}m`;
  return `${Math.floor(horas / 24)}d ${horas % 24}h`;
}

function formatarNumero(n: number): string {
  if (n === null || n === undefined) return '—';
  if (n >= 1000) return n.toLocaleString('pt-BR');
  return n.toString();
}

function corPorPercentual(p: number, invertido = false): string {
  if (invertido) {
    if (p >= 80) return 'text-red-700 bg-red-100';
    if (p >= 60) return 'text-amber-700 bg-amber-100';
    return 'text-emerald-700 bg-emerald-100';
  }
  if (p >= 90) return 'text-emerald-700 bg-emerald-100';
  if (p >= 70) return 'text-amber-700 bg-amber-100';
  return 'text-red-700 bg-red-100';
}

export default function HelpdeskMetrics() {
  const [data, setData] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<Periodo>(30);

  const load = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const fim = new Date();
      const inicio = new Date(fim.getTime() - periodo * 24 * 60 * 60 * 1000);
      const { data: res } = await api.get<DashboardMetrics>('/helpdesk/metrics', {
        params: {
          dataInicio: inicio.toISOString(),
          dataFim: fim.toISOString(),
        },
      });
      setData(res);
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Erro ao carregar métricas';
      setErro(msg);
      console.error('Erro métricas helpdesk:', err);
    } finally {
      setLoading(false);
    }
  }, [periodo]);

  useEffect(() => { load(); }, [load]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="animate-spin text-emerald-600" size={32} />
      </div>
    );
  }

  if (erro && !data) {
    return (
      <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 rounded-xl p-6 max-w-2xl mx-auto mt-10">
        <div className="flex items-start gap-3">
          <AlertTriangle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <p className="font-bold text-red-900">Não foi possível carregar as métricas</p>
            <p className="text-sm text-red-700 mt-1">{erro}</p>
            <p className="text-xs text-red-600 mt-2">
              Verifique se você tem permissão de supervisor ou administrador.
            </p>
          </div>
        </div>
        <button onClick={load} className="mt-4 btn-primary text-sm flex items-center gap-1.5">
          <RefreshCw size={14} /> Tentar novamente
        </button>
      </div>
    );
  }

  if (!data) return null;

  const dadosEtapa = Object.entries(data.backlog.porEtapa).map(([key, value]) => ({
    name: key.replace(/_/g, ' '),
    value,
    fill: ETAPA_CORES[key] || '#94a3b8',
  }));

  const dadosPrioridade = Object.entries(data.backlog.porPrioridade).map(([key, value]) => ({
    name: key,
    value,
    fill: PRIORIDADE_CORES[key] || '#94a3b8',
  }));

  const dadosFila = Object.entries(data.backlog.porFila)
    .map(([key, value], idx) => ({
      name: key.replace(/_/g, ' '),
      value,
      fill: FILA_CORES[idx % FILA_CORES.length],
    }))
    .sort((a, b) => b.value - a.value);

  const dadosSla = [
    { name: 'No prazo', value: data.sla.noPrazo, fill: '#10b981' },
    { name: 'Violados', value: data.sla.violados, fill: '#ef4444' },
  ].filter((d) => d.value > 0);

  const dadosAgente = data.porAgente.slice(0, 8).map((a) => ({
    nome: a.nome,
    tickets: a.ticketsAtendidos,
    mttr: a.mttrMedioMin,
    csat: a.csatMedio ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-white via-white to-emerald-50/30 rounded-2xl border border-neutral-200/60 p-5 shadow-sm dark:bg-gradient-to-r dark:from-slate-800 dark:via-slate-800 dark:to-emerald-900/20">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-navy-900 dark:text-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200">
                <BarChart3 className="text-white" size={22} />
              </div>
              Métricas do Helpdesk
            </h1>
            <p className="text-neutral-500 dark:text-slate-400 text-sm mt-1.5 flex items-center gap-1.5">
              <Calendar size={14} />
              {new Date(data.periodo.inicio).toLocaleDateString('pt-BR')} até{' '}
              {new Date(data.periodo.fim).toLocaleDateString('pt-BR')}
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="flex bg-white dark:bg-slate-800 border border-neutral-200 rounded-xl p-1 shadow-sm">
              {([7, 30, 90] as Periodo[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriodo(p)}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                    periodo === p
                      ? 'bg-emerald-100 text-emerald-700 shadow-sm'
                      : 'text-neutral-600 hover:bg-neutral-50'
                  }`}
                >
                  {p}d
                </button>
              ))}
            </div>
            <button onClick={load} disabled={loading}
              className="btn-secondary text-sm flex items-center gap-2 px-4 py-2.5 rounded-xl disabled:opacity-50">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Atualizar
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200/60 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center shadow-md shadow-amber-200">
              <Inbox size={20} className="text-white" />
            </div>
            <span className="text-[10px] font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wider">Backlog</span>
          </div>
          <p className="text-4xl font-bold text-navy-900 dark:text-slate-100">{formatarNumero(data.backlog.total)}</p>
          <p className="text-xs text-neutral-500 dark:text-slate-400 mt-2">Tickets abertos agora</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200/60 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center shadow-md shadow-emerald-200">
              <CheckCircle size={20} className="text-white" />
            </div>
            <span className="text-[10px] font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wider"><AcronymText text="SLA" /></span>
          </div>
          <p className="text-4xl font-bold text-navy-900 dark:text-slate-100">
            {data.sla.total > 0 ? `${data.sla.compliancePercentual}%` : '—'}
          </p>
          <p className="text-xs text-neutral-500 dark:text-slate-400 mt-2">
            {data.sla.noPrazo} no prazo • {data.sla.violados} violados
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200/60 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-400 to-blue-500 flex items-center justify-center shadow-md shadow-blue-200">
              <Target size={20} className="text-white" />
            </div>
            <span className="text-[10px] font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wider"><AcronymText text="FCR" /></span>
          </div>
          <p className="text-4xl font-bold text-navy-900 dark:text-slate-100">{data.fcr.percentual}%</p>
          <p className="text-xs text-neutral-500 dark:text-slate-400 mt-2">
            {data.fcr.primeiraResolucao} sem escalonamento
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200/60 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-400 to-purple-500 flex items-center justify-center shadow-md shadow-purple-200">
              <Clock size={20} className="text-white" />
            </div>
            <span className="text-[10px] font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wider">MTTR</span>
          </div>
          <p className="text-4xl font-bold text-navy-900 dark:text-slate-100">{formatarMinutos(data.mttr.mediaMinutos)}</p>
          <p className="text-xs text-neutral-500 dark:text-slate-400 mt-2">Tempo médio de resolução</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200/60 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-500 flex items-center justify-center shadow-md shadow-cyan-200">
              <Zap size={20} className="text-white" />
            </div>
            <span className="text-[10px] font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wider">MTFA</span>
          </div>
          <p className="text-4xl font-bold text-navy-900 dark:text-slate-100">{formatarMinutos(data.mtfa.mediaMinutos)}</p>
          <p className="text-xs text-neutral-500 dark:text-slate-400 mt-2">Primeira resposta</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200/60 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center shadow-md shadow-yellow-200">
              <Star size={20} className="text-white" />
            </div>
            <span className="text-[10px] font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wider"><AcronymText text="CSAT" /></span>
          </div>
          <p className="text-4xl font-bold text-navy-900 dark:text-slate-100">
            {data.csat.totalRespostas > 0 ? data.csat.mediaNotas.toFixed(1) : '—'}
          </p>
          <p className="text-xs text-neutral-500 dark:text-slate-400 mt-2">
            {data.csat.totalRespostas} respostas ({data.csat.percentualResposta}%)
          </p>
        </div>
      </div>

      {data.sla.compliancePercentual < 70 && data.sla.total > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl px-5 py-4 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="text-amber-600" size={24} />
          </div>
          <div>
            <p className="text-base font-bold text-amber-900"><AcronymText text="SLA" /> abaixo da meta</p>
            <p className="text-sm text-amber-700">
              Compliance de {data.sla.compliancePercentual}% no período — {data.sla.violados} ticket(s) violaram o <AcronymText text="SLA" />.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200/60 p-5 shadow-sm">
          <h3 className="text-base font-bold text-navy-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Activity size={16} className="text-emerald-600" />
            </div>
            MTTR detalhado
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-50">
              <span className="text-sm font-semibold text-neutral-600">Média</span>
              <span className="text-lg font-bold text-navy-900 dark:text-slate-100">{formatarMinutos(data.mttr.mediaMinutos)}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-50">
              <span className="text-sm font-semibold text-neutral-600">Mediana</span>
              <span className="text-lg font-bold text-navy-900 dark:text-slate-100">{formatarMinutos(data.mttr.medianaMinutos)}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 dark:bg-amber-900/30 border border-amber-100">
              <span className="text-sm font-semibold text-amber-700">Percentil 95</span>
              <span className="text-lg font-bold text-amber-700">{formatarMinutos(data.mttr.p95Minutos)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200/60 p-5 shadow-sm">
          <h3 className="text-base font-bold text-navy-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <TrendingUp size={16} className="text-emerald-600" />
            </div>
            <AcronymText text="SLA" /> no Período
          </h3>
          {data.sla.total > 0 ? (
            <>
              <div className="flex items-center gap-4 mb-4">
                <div className={`text-4xl font-bold px-4 py-2 rounded-xl ${corPorPercentual(data.sla.compliancePercentual)}`}>
                  {data.sla.compliancePercentual}%
                </div>
                <div className="flex-1 text-sm text-neutral-600">
                  <p className="font-bold text-navy-900 dark:text-slate-100">{data.sla.noPrazo} tickets</p>
                  <p>entregues no prazo</p>
                </div>
              </div>
              <div className="w-full bg-neutral-100 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all"
                  style={{ width: `${data.sla.compliancePercentual}%` }}
                />
              </div>
              <p className="text-sm text-red-600 mt-3 font-semibold">{data.sla.violados} violaram o <AcronymText text="SLA" /></p>
            </>
          ) : (
            <p className="text-center py-8 text-neutral-400 dark:text-slate-500 text-sm">Sem dados de <AcronymText text="SLA" /> no período</p>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200/60 p-5 shadow-sm">
          <h3 className="text-base font-bold text-navy-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Target size={16} className="text-emerald-600" />
            </div>
            First Call Resolution
          </h3>
          <div className="flex items-center gap-4 mb-4">
            <div className={`text-4xl font-bold px-4 py-2 rounded-xl ${corPorPercentual(data.fcr.percentual)}`}>
              {data.fcr.percentual}%
            </div>
            <div className="flex-1 text-sm text-neutral-600">
              <p className="font-bold text-navy-900 dark:text-slate-100">{data.fcr.primeiraResolucao} tickets</p>
              <p>resolvidos sem escalonar</p>
            </div>
          </div>
          {data.fcr.escalonados > 0 && (
            <p className="text-sm text-amber-600 font-semibold mt-3">
              {data.fcr.escalonados} tickets foram escalonados
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200/60 p-5 shadow-sm">
          <h3 className="text-base font-bold text-navy-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Inbox size={16} className="text-emerald-600" />
            </div>
            Backlog por Etapa
          </h3>
          {dadosEtapa.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={dadosEtapa} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e: any) => `${e.value}`}>
                  {dadosEtapa.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center py-10 text-neutral-400 dark:text-slate-500 text-sm">Sem tickets no backlog</p>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200/60 p-5 shadow-sm">
          <h3 className="text-base font-bold text-navy-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Activity size={16} className="text-emerald-600" />
            </div>
            Backlog por Prioridade
          </h3>
          {dadosPrioridade.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={dadosPrioridade} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e: any) => `${e.value}`}>
                  {dadosPrioridade.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center py-10 text-neutral-400 dark:text-slate-500 text-sm">Sem tickets no backlog</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200/60 p-5 shadow-sm">
          <h3 className="text-base font-bold text-navy-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Users size={16} className="text-emerald-600" />
            </div>
            Backlog por Fila
          </h3>
          {dadosFila.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(200, dadosFila.length * 40)}>
              <BarChart data={dadosFila} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={100} />
                <Tooltip />
                <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                  {dadosFila.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center py-10 text-neutral-400 dark:text-slate-500 text-sm">Nenhum ticket em fila</p>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200/60 p-5 shadow-sm">
          <h3 className="text-base font-bold text-navy-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <CheckCircle size={16} className="text-emerald-600" />
            </div>
            <AcronymText text="SLA" />: No Prazo vs Violados
          </h3>
          {dadosSla.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={dadosSla} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} label={(e: any) => `${e.value}`}>
                  {dadosSla.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center py-10 text-neutral-400 dark:text-slate-500 text-sm">Sem dados de <AcronymText text="SLA" /></p>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200/60 p-5 shadow-sm">
        <h3 className="text-base font-bold text-navy-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
            <Users size={16} className="text-emerald-600" />
          </div>
          Performance por Agente
        </h3>
        {dadosAgente.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-xs text-neutral-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="text-left py-3 px-4">Agente</th>
                  <th className="text-right py-3 px-4">Tickets</th>
                  <th className="text-right py-3 px-4">MTTR Médio</th>
                  <th className="text-right py-3 px-4"><AcronymText text="CSAT" /></th>
                </tr>
              </thead>
              <tbody>
                {data.porAgente.map((a) => (
                  <tr key={a.usuarioId} className="border-b border-neutral-100 hover:bg-neutral-50 transition-colors">
                    <td className="py-3 px-4 font-semibold text-navy-900 dark:text-slate-100">{a.nome}</td>
                    <td className="py-3 px-4 text-right font-mono">{a.ticketsAtendidos}</td>
                    <td className="py-3 px-4 text-right font-mono">{formatarMinutos(a.mttrMedioMin)}</td>
                    <td className="py-3 px-4 text-right">
                      {a.csatMedio !== null ? (
                        <span className={`px-3 py-1 rounded-lg text-sm font-bold ${corPorPercentual(a.csatMedio * 20)}`}>
                          {a.csatMedio.toFixed(1)} ★
                        </span>
                      ) : (
                        <span className="text-neutral-400 dark:text-slate-500 text-sm">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center py-10 text-neutral-400 dark:text-slate-500 text-sm">Nenhum agente atendeu tickets no período</p>
        )}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200/60 p-5 shadow-sm">
        <h3 className="text-base font-bold text-navy-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
            <Tag size={16} className="text-emerald-600" />
          </div>
          Distribuição por Categoria
        </h3>
        {data.porCategoria.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(200, data.porCategoria.length * 36)}>
            <BarChart data={data.porCategoria} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis dataKey="categoria" type="category" tick={{ fontSize: 12 }} width={140} />
              <Tooltip />
              <Bar dataKey="total" fill="#10b981" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center py-10 text-neutral-400 dark:text-slate-500 text-sm">Sem categorias no período</p>
        )}
      </div>
    </div>
  );
}
