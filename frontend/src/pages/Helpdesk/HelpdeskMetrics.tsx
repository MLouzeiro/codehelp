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
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-2xl mx-auto mt-10">
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
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
            <BarChart3 className="text-emerald-600" size={24} /> Métricas do Helpdesk
          </h1>
          <p className="text-neutral-500 text-sm flex items-center gap-1.5">
            <Calendar size={12} />
            {new Date(data.periodo.inicio).toLocaleDateString('pt-BR')} até{' '}
            {new Date(data.periodo.fim).toLocaleDateString('pt-BR')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-white border border-neutral-200 rounded-lg p-0.5">
            {([7, 30, 90] as Periodo[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriodo(p)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  periodo === p
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                {p}d
              </button>
            ))}
          </div>
          <button onClick={load} disabled={loading}
            className="btn-secondary text-sm flex items-center gap-1.5 disabled:opacity-50">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Atualizar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
              <Inbox size={18} className="text-amber-600" />
            </div>
            <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Backlog</span>
          </div>
          <p className="text-3xl font-bold text-navy-900">{formatarNumero(data.backlog.total)}</p>
          <p className="text-xs text-neutral-500 mt-1">Tickets abertos agora</p>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
              <CheckCircle size={18} className="text-emerald-600" />
            </div>
            <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">SLA</span>
          </div>
          <p className="text-3xl font-bold text-navy-900">
            {data.sla.total > 0 ? `${data.sla.compliancePercentual}%` : '—'}
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            {data.sla.noPrazo} no prazo • {data.sla.violados} violados
          </p>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
              <Target size={18} className="text-blue-600" />
            </div>
            <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">FCR</span>
          </div>
          <p className="text-3xl font-bold text-navy-900">{data.fcr.percentual}%</p>
          <p className="text-xs text-neutral-500 mt-1">
            {data.fcr.primeiraResolucao} sem escalonamento
          </p>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center">
              <Clock size={18} className="text-purple-600" />
            </div>
            <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">MTTR</span>
          </div>
          <p className="text-3xl font-bold text-navy-900">{formatarMinutos(data.mttr.mediaMinutos)}</p>
          <p className="text-xs text-neutral-500 mt-1">Tempo médio de resolução</p>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-lg bg-cyan-100 flex items-center justify-center">
              <Zap size={18} className="text-cyan-600" />
            </div>
            <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">MTFA</span>
          </div>
          <p className="text-3xl font-bold text-navy-900">{formatarMinutos(data.mtfa.mediaMinutos)}</p>
          <p className="text-xs text-neutral-500 mt-1">Primeira resposta</p>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-lg bg-yellow-100 flex items-center justify-center">
              <Star size={18} className="text-yellow-600" />
            </div>
            <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">CSAT</span>
          </div>
          <p className="text-3xl font-bold text-navy-900">
            {data.csat.totalRespostas > 0 ? data.csat.mediaNotas.toFixed(1) : '—'}
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            {data.csat.totalRespostas} respostas ({data.csat.percentualResposta}%)
          </p>
        </div>
      </div>

      {data.sla.compliancePercentual < 70 && data.sla.total > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <AlertTriangle className="text-amber-600 flex-shrink-0" size={20} />
          <div>
            <p className="text-sm font-bold text-amber-900">SLA abaixo da meta</p>
            <p className="text-xs text-amber-700">
              Compliance de {data.sla.compliancePercentual}% no período — {data.sla.violados} ticket(s) violaram o SLA.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-sm">
          <h3 className="text-sm font-bold text-navy-900 mb-3 flex items-center gap-2">
            <Activity size={16} className="text-emerald-600" /> MTTR detalhado
          </h3>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-50">
              <span className="text-xs font-semibold text-neutral-600">Média</span>
              <span className="text-sm font-bold text-navy-900">{formatarMinutos(data.mttr.mediaMinutos)}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-50">
              <span className="text-xs font-semibold text-neutral-600">Mediana</span>
              <span className="text-sm font-bold text-navy-900">{formatarMinutos(data.mttr.medianaMinutos)}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-50">
              <span className="text-xs font-semibold text-neutral-600">Percentil 95</span>
              <span className="text-sm font-bold text-amber-700">{formatarMinutos(data.mttr.p95Minutos)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-sm">
          <h3 className="text-sm font-bold text-navy-900 mb-3 flex items-center gap-2">
            <TrendingUp size={16} className="text-emerald-600" /> SLA no Período
          </h3>
          {data.sla.total > 0 ? (
            <>
              <div className="flex items-center gap-3 mb-3">
                <div className={`text-3xl font-bold px-3 py-1.5 rounded-lg ${corPorPercentual(data.sla.compliancePercentual)}`}>
                  {data.sla.compliancePercentual}%
                </div>
                <div className="flex-1 text-xs text-neutral-600">
                  <p className="font-bold text-navy-900">{data.sla.noPrazo} tickets</p>
                  <p>entregues no prazo</p>
                </div>
              </div>
              <div className="w-full bg-neutral-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${data.sla.compliancePercentual}%` }}
                />
              </div>
              <p className="text-xs text-red-600 mt-2 font-semibold">{data.sla.violados} violaram o SLA</p>
            </>
          ) : (
            <p className="text-center py-6 text-neutral-400 text-xs">Sem dados de SLA no período</p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-sm">
          <h3 className="text-sm font-bold text-navy-900 mb-3 flex items-center gap-2">
            <Target size={16} className="text-emerald-600" /> First Call Resolution
          </h3>
          <div className="flex items-center gap-3 mb-3">
            <div className={`text-3xl font-bold px-3 py-1.5 rounded-lg ${corPorPercentual(data.fcr.percentual)}`}>
              {data.fcr.percentual}%
            </div>
            <div className="flex-1 text-xs text-neutral-600">
              <p className="font-bold text-navy-900">{data.fcr.primeiraResolucao} tickets</p>
              <p>resolvidos sem escalonar</p>
            </div>
          </div>
          {data.fcr.escalonados > 0 && (
            <p className="text-xs text-amber-600 font-semibold mt-2">
              {data.fcr.escalonados} tickets foram escalonados
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-sm">
          <h3 className="text-sm font-bold text-navy-900 mb-3 flex items-center gap-2">
            <Inbox size={16} className="text-emerald-600" /> Backlog por Etapa
          </h3>
          {dadosEtapa.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={dadosEtapa} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e: any) => `${e.value}`}>
                  {dadosEtapa.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center py-8 text-neutral-400 text-xs">Sem tickets no backlog</p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-sm">
          <h3 className="text-sm font-bold text-navy-900 mb-3 flex items-center gap-2">
            <Activity size={16} className="text-emerald-600" /> Backlog por Prioridade
          </h3>
          {dadosPrioridade.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={dadosPrioridade} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e: any) => `${e.value}`}>
                  {dadosPrioridade.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center py-8 text-neutral-400 text-xs">Sem tickets no backlog</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-sm">
          <h3 className="text-sm font-bold text-navy-900 mb-3 flex items-center gap-2">
            <Users size={16} className="text-emerald-600" /> Backlog por Fila
          </h3>
          {dadosFila.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(180, dadosFila.length * 36)}>
              <BarChart data={dadosFila} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
                <Tooltip />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {dadosFila.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center py-8 text-neutral-400 text-xs">Nenhum ticket em fila</p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-sm">
          <h3 className="text-sm font-bold text-navy-900 mb-3 flex items-center gap-2">
            <CheckCircle size={16} className="text-emerald-600" /> SLA: No Prazo vs Violados
          </h3>
          {dadosSla.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={dadosSla} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} label={(e: any) => `${e.value}`}>
                  {dadosSla.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center py-8 text-neutral-400 text-xs">Sem dados de SLA</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-sm">
        <h3 className="text-sm font-bold text-navy-900 mb-3 flex items-center gap-2">
          <Users size={16} className="text-emerald-600" /> Performance por Agente
        </h3>
        {dadosAgente.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-xs text-neutral-500 uppercase tracking-wider">
                  <th className="text-left py-2 px-3">Agente</th>
                  <th className="text-right py-2 px-3">Tickets</th>
                  <th className="text-right py-2 px-3">MTTR Médio</th>
                  <th className="text-right py-2 px-3">CSAT</th>
                </tr>
              </thead>
              <tbody>
                {data.porAgente.map((a) => (
                  <tr key={a.usuarioId} className="border-b border-neutral-100 hover:bg-neutral-50">
                    <td className="py-2 px-3 font-semibold text-navy-900">{a.nome}</td>
                    <td className="py-2 px-3 text-right font-mono">{a.ticketsAtendidos}</td>
                    <td className="py-2 px-3 text-right font-mono">{formatarMinutos(a.mttrMedioMin)}</td>
                    <td className="py-2 px-3 text-right">
                      {a.csatMedio !== null ? (
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${corPorPercentual(a.csatMedio * 20)}`}>
                          {a.csatMedio.toFixed(1)} ★
                        </span>
                      ) : (
                        <span className="text-neutral-400 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center py-8 text-neutral-400 text-xs">Nenhum agente atendeu tickets no período</p>
        )}
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-sm">
        <h3 className="text-sm font-bold text-navy-900 mb-3 flex items-center gap-2">
          <Tag size={16} className="text-emerald-600" /> Distribuição por Categoria
        </h3>
        {data.porCategoria.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(180, data.porCategoria.length * 32)}>
            <BarChart data={data.porCategoria} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="categoria" type="category" tick={{ fontSize: 11 }} width={120} />
              <Tooltip />
              <Bar dataKey="total" fill="#10b981" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center py-8 text-neutral-400 text-xs">Sem categorias no período</p>
        )}
      </div>
    </div>
  );
}
