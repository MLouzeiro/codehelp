import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useAuth } from '../../services/auth';
import {
  RefreshCw, Send, TrendingUp, TrendingDown, Clock, CheckCircle,
  Star, Zap, Users, Building2, FolderOpen, Calendar, Loader2, AlertTriangle, Copy, Check,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';

interface Resumo {
  totalTickets: number;
  ticketsFechados: number;
  ticketsAbertos: number;
  taxaResolucao: number;
  tempoMedioResposta: number;
  tempoMedioResolucao: number;
  slaCumprido: number;
  slaTotal: number;
  taxaSla: number;
  csatMedio: number;
  csatTotalRespostas: number;
  fcr: number;
}

interface Relatorio {
  periodo: { inicio: string; fim: string; label: string };
  resumo: Resumo;
  porCliente: { clienteId: string; clienteNome: string; total: number; fechados: number }[];
  porCategoria: { categoria: string; total: number; fechados: number }[];
  porDepartamento: { departamentoId: string; departamentoNome: string; total: number; fechados: number }[];
  porAgente: { agenteId: string; agenteNome: string; atendidos: number; fechados: number; tempoMedio: number; csatMedio: number }[];
  porCanal: { canal: string; total: number }[];
  porDia: { dia: string; total: number; fechados: number }[];
  comparativoSemanaAnterior: { deltaTickets: number; deltaFechados: number; deltaTempoResposta: number; deltaCsat: number; deltaSla: number };
  sugestoesIa: string[];
  topTicketsProblema: { ticketId: string; protocolo: string; cliente: string; assunto: string; tempoHoras: number; csat: number | null }[];
}

const CANAL_CORES = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4'];

function formatarTempo(minutos: number): string {
  if (minutos < 1) return `${minutos}min`;
  if (minutos < 60) return `${minutos}min`;
  const horas = Math.floor(minutos / 60);
  const mins = minutos % 60;
  if (horas < 24) return mins === 0 ? `${horas}h` : `${horas}h${mins}m`;
  const dias = Math.floor(horas / 24);
  return `${dias}d ${horas % 24}h`;
}

function DeltaPill({ valor, sufixo, invertido }: { valor: number; sufixo?: string; invertido?: boolean }) {
  const ruim = invertido ? valor > 0 : valor < 0;
  const bom = invertido ? valor < 0 : valor > 0;
  const Icon = valor > 0 ? TrendingUp : valor < 0 ? TrendingDown : null;
  const cor = ruim ? 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/30'
    : bom ? 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30'
    : 'text-slate-500 bg-slate-100 dark:text-slate-400 dark:bg-slate-800';
  const sinal = valor > 0 ? '+' : '';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cor}`} style={{ fontFamily: 'Lexend, sans-serif' }}>
      {Icon && <Icon size={12} />}
      {sinal}{valor}{sufixo || ''}
    </span>
  );
}

export default function RelatorioGerencial() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [periodo, setPeriodo] = useState(7);
  const [enviando, setEnviando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [mensagemWhats, setMensagemWhats] = useState('');

  const carregar = useCallback(async (dias: number) => {
    setLoading(true);
    setError('');
    try {
      const fim = new Date();
      const inicio = new Date();
      inicio.setDate(fim.getDate() - (dias - 1));
      const { data } = await api.get('/analytics/relatorio-semanal', {
        params: {
          inicio: inicio.toISOString(),
          fim: fim.toISOString(),
        },
      });
      setRelatorio(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao carregar relatório');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar(periodo);
  }, [periodo, carregar]);

  const enviarWhatsApp = async () => {
    setEnviando(true);
    setSucesso('');
    setError('');
    try {
      const { data } = await api.post('/analytics/relatorio-semanal/enviar');
      if (data.enviado) {
        setSucesso('Relatório enviado aos destinatários do WhatsApp.');
      } else {
        setError(data.erro || 'Nenhum destinatário configurado para alertas.');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao enviar relatório');
    } finally {
      setEnviando(false);
    }
  };

  const copiarMensagem = async () => {
    if (!mensagemWhats) {
      try {
        const { data } = await api.get('/analytics/relatorio-semanal/mensagem');
        setMensagemWhats(data.mensagem);
      } catch { return; }
    }
    try {
      await navigator.clipboard.writeText(mensagemWhats);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {}
  };

  if (loading && !relatorio) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  if (error && !relatorio) {
    return (
      <div className="p-6">
        <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
          {error}
        </div>
      </div>
    );
  }

  const r = relatorio!;
  const cmp = r.comparativoSemanaAnterior;

  const cards = [
    { label: 'Total de Tickets', valor: String(r.resumo.totalTickets), icon: Zap, cor: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/30', delta: <DeltaPill valor={cmp.deltaTickets} /> },
    { label: 'Resolvidos', valor: `${r.resumo.ticketsFechados} (${r.resumo.taxaResolucao}%)`, icon: CheckCircle, cor: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30', delta: <DeltaPill valor={cmp.deltaFechados} /> },
    { label: 'Tempo Médio Resposta', valor: formatarTempo(r.resumo.tempoMedioResposta), icon: Clock, cor: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/30', delta: <DeltaPill valor={cmp.deltaTempoResposta} sufixo="min" invertido /> },
    { label: 'Tempo Médio Resolução', valor: formatarTempo(r.resumo.tempoMedioResolucao), icon: Clock, cor: 'text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-900/30' },
    { label: 'SLA Cumprido', valor: `${r.resumo.taxaSla}%`, icon: TrendingUp, cor: 'text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-900/30', delta: <DeltaPill valor={cmp.deltaSla} sufixo="%" /> },
    { label: 'CSAT Médio', valor: `${r.resumo.csatMedio}/5`, icon: Star, cor: 'text-pink-600 bg-pink-50 dark:text-pink-400 dark:bg-pink-900/30', delta: <DeltaPill valor={cmp.deltaCsat} /> },
    { label: 'FCR', valor: `${r.resumo.fcr}%`, icon: Zap, cor: 'text-cyan-600 bg-cyan-50 dark:text-cyan-400 dark:bg-cyan-900/30' },
    { label: 'Abertos Agora', valor: String(r.resumo.ticketsAbertos), icon: Users, cor: 'text-slate-600 bg-slate-100 dark:text-slate-300 dark:bg-slate-800' },
  ];

  const graficoDia = r.porDia.map(d => ({ ...d, nome: d.dia }));

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>
            Relatório Gerencial
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
            Período: {r.periodo.label}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={periodo}
            onChange={(e) => setPeriodo(Number(e.target.value))}
            className="px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg text-sm text-slate-700 dark:text-slate-200"
            style={{ fontFamily: 'Lexend, sans-serif' }}
          >
            <option value={7}>Últimos 7 dias</option>
            <option value={14}>Últimos 14 dias</option>
            <option value={30}>Últimos 30 dias</option>
          </select>
          <button
            onClick={() => carregar(periodo)}
            className="flex items-center gap-2 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            style={{ fontFamily: 'Lexend, sans-serif' }}
          >
            <RefreshCw size={14} /> Atualizar
          </button>
          <button
            onClick={copiarMensagem}
            className="flex items-center gap-2 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            style={{ fontFamily: 'Lexend, sans-serif' }}
          >
            {copiado ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
            Copiar Mensagem
          </button>
          {isAdmin && (
            <button
              onClick={enviarWhatsApp}
              disabled={enviando}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              style={{ fontFamily: 'Lexend, sans-serif' }}
            >
              {enviando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Enviar WhatsApp
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm" style={{ fontFamily: 'Lexend, sans-serif' }}>
          {error}
        </div>
      )}
      {sucesso && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-400 text-sm" style={{ fontFamily: 'Lexend, sans-serif' }}>
          {sucesso}
        </div>
      )}

      {mensagemWhats && (
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide" style={{ fontFamily: 'Lexend, sans-serif' }}>
              Prévia da mensagem WhatsApp
            </span>
            <button onClick={() => setMensagemWhats('')} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" style={{ fontFamily: 'Lexend, sans-serif' }}>
              Fechar
            </button>
          </div>
          <pre className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap" style={{ fontFamily: 'Lexend, sans-serif' }}>{mensagemWhats}</pre>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map(c => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
              <div className="flex items-start justify-between">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.cor}`}>
                  <Icon size={18} />
                </div>
                {c.delta}
              </div>
              <div className="mt-3">
                <div className="text-xl font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>{c.valor}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>{c.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {r.sugestoesIa.length > 0 && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={18} className="text-blue-600 dark:text-blue-400" />
            <h2 className="font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>
              Sugestões da IA
            </h2>
          </div>
          <ul className="space-y-2">
            {r.sugestoesIa.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300" style={{ fontFamily: 'Lexend, sans-serif' }}>
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-4" style={{ fontFamily: 'Khand, sans-serif' }}>
            Tickets por Dia
          </h2>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={graficoDia}>
              <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
              <XAxis dataKey="nome" tick={{ fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} width={30} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="total" name="Abertos" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="fechados" name="Resolvidos" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-4" style={{ fontFamily: 'Khand, sans-serif' }}>
            Tickets por Canal
          </h2>
          {r.porCanal.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={r.porCanal} dataKey="total" nameKey="canal" innerRadius={55} outerRadius={85} paddingAngle={3}>
                  {r.porCanal.map((_, i) => (
                    <Cell key={i} fill={CANAL_CORES[i % CANAL_CORES.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>Sem dados no período</p>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-4" style={{ fontFamily: 'Khand, sans-serif' }}>
            Top Categorias
          </h2>
          {r.porCategoria.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={r.porCategoria}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                <XAxis dataKey="categoria" tick={{ fontSize: 10 }} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} width={30} />
                <Tooltip />
                <Bar dataKey="total" name="Total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="fechados" name="Resolvidos" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>Sem dados no período</p>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>
              Performance por Agente
            </h2>
          </div>
          <div className="space-y-3 max-h-[240px] overflow-auto">
            {r.porAgente.map(a => (
              <div key={a.agenteId} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-semibold flex-shrink-0" style={{ fontFamily: 'Lexend, sans-serif' }}>
                    {a.agenteNome.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate" style={{ fontFamily: 'Lexend, sans-serif' }}>{a.agenteNome}</div>
                    <div className="text-xs text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
                      {a.atendidos} atendidos · {formatarTempo(a.tempoMedio)} médio
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-200" style={{ fontFamily: 'Lexend, sans-serif' }}>
                    {a.csatMedio ? `${a.csatMedio}/5` : '—'}
                  </div>
                  <div className="text-xs text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>CSAT</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-3">
            <Building2 size={16} className="text-blue-600 dark:text-blue-400" />
            <h2 className="font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>Top Clientes</h2>
          </div>
          <div className="space-y-2">
            {r.porCliente.map(c => (
              <div key={c.clienteId} className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-300 truncate" style={{ fontFamily: 'Lexend, sans-serif' }}>{c.clienteNome}</span>
                <span className="text-slate-400 text-xs" style={{ fontFamily: 'Lexend, sans-serif' }}>{c.total} chamados</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-3">
            <FolderOpen size={16} className="text-indigo-600 dark:text-indigo-400" />
            <h2 className="font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>Por Departamento</h2>
          </div>
          <div className="space-y-2">
            {r.porDepartamento.map(d => (
              <div key={d.departamentoId} className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-300 truncate" style={{ fontFamily: 'Lexend, sans-serif' }}>{d.departamentoNome}</span>
                <span className="text-slate-400 text-xs" style={{ fontFamily: 'Lexend, sans-serif' }}>{d.total} · {d.fechados} resolvidos</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-red-600 dark:text-red-400" />
            <h2 className="font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>Tickets Problema</h2>
          </div>
          <div className="space-y-2">
            {r.topTicketsProblema.map(t => (
              <div key={t.ticketId} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-700/40">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-300 font-medium" style={{ fontFamily: 'Lexend, sans-serif' }}>#{t.protocolo} · {t.cliente}</span>
                  <span className="text-red-500 font-semibold" style={{ fontFamily: 'Lexend, sans-serif' }}>{t.tempoHoras}h</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5" style={{ fontFamily: 'Lexend, sans-serif' }}>{t.assunto}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
