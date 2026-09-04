import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../services/api';
import {
  Loader2, User, FileText, Calendar, Star, Clock, MessageSquare,
  CheckCircle, AlertTriangle, Sparkles, Play, Users, ArrowUpDown, ArrowUp, ArrowDown,
} from 'lucide-react';
import ReportActions from '../../components/reports/ReportActions';
import ReportKpiCard from '../../components/reports/ReportKpiCard';
import AuditoriaFiltros, {
  AnalistaOpcao, FiltrosAuditoria, PeriodoFiltro, periodoLabel, periodoParaDatas,
} from '../../components/reports/AuditoriaFiltros';
import { AcronymText } from '../../components/AcronymText';

interface TicketResumo {
  ticketId: string;
  protocolo: string | null;
  contactName: string | null;
  dataAbertura: string;
  dataFechamento: string | null;
  status: string;
  etapa: string;
  totalMensagens: number;
  mensagensAgente: number;
  primeiraRespostaMin: number | null;
  csatNota: number | null;
  csatRespondido: boolean;
  notaAuditoriaMedia: number | null;
  classificacaoAuditoria: string | null;
  totalAlertas: number;
}

interface Relatorio {
  agenteId: string;
  agenteNome: string;
  periodo: { inicio: string | null; fim: string | null };
  resumo: {
    totalTickets: number;
    ticketsResolvidos: number;
    taxaResolucao: number;
    tempoMedioRespostaMin: number;
    notaAuditoriaMedia: number;
    classificacaoAuditoria: string;
    csatMedia: number;
    csatRespondidos: number;
    totalMensagensAgente: number;
    fcr: number;
  };
  tickets: TicketResumo[];
}

interface AnalistaRanking {
  agenteId: string;
  agenteNome: string;
  totalTickets: number;
  ticketsResolvidos: number;
  taxaResolucao: number;
  tempoMedioRespostaMin: number;
  notaAuditoriaMedia: number;
  classificacaoAuditoria: string;
  csatMedia: number;
  csatRespondidos: number;
  totalMensagensAgente: number;
  fcr: number;
}

interface ResumoTodos {
  totalAnalistas: number;
  resumo: {
    totalTickets: number;
    ticketsResolvidos: number;
    taxaResolucaoMedia: number;
    csatMedia: number;
    fcrMedia: number;
    notaAuditoriaMedia: number;
    totalMensagensAgente: number;
  };
  analistas: AnalistaRanking[];
}

interface MensagemReplay {
  id: string;
  fromMe: boolean;
  content: string | null;
  createdAt: string;
  source: string | null;
  tipo: string | null;
  auditoria: {
    notaGeral: number;
    classificacao: string;
    alertas: string[];
    pontosFortes: string[];
    pontosMelhoria: string[];
    sugestaoResposta: string | null;
  } | null;
}

interface Replay {
  ticketId: string;
  protocolo: string | null;
  contactName: string | null;
  contactPhone: string | null;
  assunto: string | null;
  status: string;
  etapa: string;
  assigneeName: string | null;
  dataAbertura: string;
  dataFechamento: string | null;
  mensagens: MensagemReplay[];
  resumoAuditoria: {
    totalMensagens: number;
    mensagensAuditadas: number;
    notaMedia: number;
    classificacao: string;
  };
}

const CLASS_CONFIG: Record<string, { label: string; cor: string; bg: string }> = {
  excelente: { label: 'Excelente', cor: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800' },
  bom: { label: 'Bom', cor: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800' },
  neutro: { label: 'Neutro', cor: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600' },
  atencao: { label: 'Atenção', cor: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800' },
  critico: { label: 'Crítico', cor: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800' },
  sem_dados: { label: 'Sem dados', cor: 'text-slate-400', bg: 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700' },
};

function formataData(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
}

function iniciais(nome: string): string {
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

type ColunaRanking = 'agenteNome' | 'totalTickets' | 'taxaResolucao' | 'notaAuditoriaMedia' | 'tempoMedioRespostaMin' | 'csatMedia' | 'fcr' | 'totalMensagensAgente';

const COLUNAS_RANKING: { chave: ColunaRanking; label: string; alinhar?: 'text-right' }[] = [
  { chave: 'agenteNome', label: 'Analista' },
  { chave: 'totalTickets', label: 'Tickets', alinhar: 'text-right' },
  { chave: 'taxaResolucao', label: 'Resolvidos %', alinhar: 'text-right' },
  { chave: 'notaAuditoriaMedia', label: 'Nota Auditoria', alinhar: 'text-right' },
  { chave: 'tempoMedioRespostaMin', label: 'Tempo Médio Resp.', alinhar: 'text-right' },
  { chave: 'csatMedia', label: 'CSAT', alinhar: 'text-right' },
  { chave: 'fcr', label: 'FCR', alinhar: 'text-right' },
  { chave: 'totalMensagensAgente', label: 'Mensagens', alinhar: 'text-right' },
];

export default function AuditoriaAnalistaPage() {
  const [analistas, setAnalistas] = useState<AnalistaOpcao[]>([]);
  const [analistasCarregando, setAnalistasCarregando] = useState(true);
  const [filtros, setFiltros] = useState<FiltrosAuditoria>({
    analistaId: '',
    periodo: { tipo: 'preset', valor: '30dias' },
  });
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null);
  const [resumoTodos, setResumoTodos] = useState<ResumoTodos | null>(null);
  const [replay, setReplay] = useState<Replay | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingReplay, setLoadingReplay] = useState(false);
  const [error, setError] = useState('');
  const [colunaOrdenacao, setColunaOrdenacao] = useState<ColunaRanking>('totalTickets');
  const [ordemAsc, setOrdemAsc] = useState(false);

  const carregarAnalistas = useCallback(async () => {
    setAnalistasCarregando(true);
    try {
      const { data } = await api.get('/auth/users', { params: { active: 'true' } });
      const lista = Array.isArray(data) ? data : data?.users || data?.data || [];
      const filtrados = lista.filter((u: any) =>
        ['tecnico', 'gerente', 'admin', 'comercial'].includes(u.role)
      );
      const opcoes = filtrados.map((u: any) => ({ id: u.id, name: u.name, active: u.active !== false }));
      setAnalistas(opcoes);
      if (!filtros.analistaId && opcoes.length > 0) {
        setFiltros(prev => prev.analistaId ? prev : { ...prev, analistaId: opcoes[0].id });
      }
    } catch (err) {
      setError('Erro ao carregar analistas');
    } finally {
      setAnalistasCarregando(false);
    }
  }, [filtros.analistaId]);

  useEffect(() => { carregarAnalistas(); }, [carregarAnalistas]);

  const montarParams = useCallback((f: FiltrosAuditoria) => {
    const datas = periodoParaDatas(f.periodo);
    if (!datas) return null;
    return {
      dataInicio: datas.inicio.toISOString(),
      dataFim: datas.fim.toISOString(),
    };
  }, []);

  const auditar = useCallback(async (f: FiltrosAuditoria) => {
    const params = montarParams(f);
    if (!params) {
      setError('Defina o período da auditoria antes de auditar.');
      return;
    }
    setLoading(true);
    setError('');
    setResumoTodos(null);
    setRelatorio(null);
    try {
      if (f.analistaId === 'todos' || !f.analistaId) {
        const { data } = await api.get('/helpdesk/audit/analistas/resumo', { params });
        setResumoTodos(data);
      } else {
        const { data } = await api.get(`/helpdesk/audit/agent/${f.analistaId}`, { params });
        setRelatorio(data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao carregar relatório');
    } finally {
      setLoading(false);
    }
  }, [montarParams]);

  useEffect(() => {
    if (!filtros.analistaId) return;
    auditar(filtros);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros.analistaId]);

  const aplicarAuditoria = () => auditar(filtros);

  const abrirReplay = async (ticketId: string) => {
    if (!relatorio) return;
    setLoadingReplay(true);
    setError('');
    try {
      const { data } = await api.get(`/helpdesk/audit/agent/${relatorio.agenteId}/ticket/${ticketId}`);
      setReplay(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao carregar replay');
    } finally {
      setLoadingReplay(false);
    }
  };

  const mudarParaAnalista = (agenteId: string) => {
    setFiltros(prev => ({ ...prev, analistaId: agenteId }));
  };

  const rankingOrdenado = useMemo(() => {
    if (!resumoTodos) return [];
    const lista = [...resumoTodos.analistas];
    lista.sort((a, b) => {
      if (colunaOrdenacao === 'agenteNome') {
        const na = String(a.agenteNome || '').toLowerCase();
        const nb = String(b.agenteNome || '').toLowerCase();
        return ordemAsc ? na.localeCompare(nb) : nb.localeCompare(na);
      }
      const na = Number(a[colunaOrdenacao]) || 0;
      const nb = Number(b[colunaOrdenacao]) || 0;
      return ordemAsc ? na - nb : nb - na;
    });
    return lista;
  }, [resumoTodos, colunaOrdenacao, ordemAsc]);

  const ordenarPor = (chave: ColunaRanking) => {
    if (colunaOrdenacao === chave) {
      setOrdemAsc(!ordemAsc);
    } else {
      setColunaOrdenacao(chave);
      setOrdemAsc(false);
    }
  };

  const modoTodos = filtros.analistaId === 'todos' || !filtros.analistaId;
  const resumo = relatorio?.resumo;
  const resumoTime = resumoTodos?.resumo;

  const cardsIndividuais = resumo ? [
    { label: 'Tickets', valor: resumo.totalTickets, icon: FileText, cor: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/30' },
    { label: 'Resolvidos', valor: resumo.ticketsResolvidos, icon: CheckCircle, cor: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30', extra: `${resumo.taxaResolucao}%` },
    { label: 'Nota Auditoria', valor: resumo.notaAuditoriaMedia ? `${resumo.notaAuditoriaMedia}/10` : '—', icon: Sparkles, cor: 'text-violet-600 bg-violet-50 dark:text-violet-400 dark:bg-violet-900/30' },
    { label: 'Tempo Médio Resp.', valor: `${resumo.tempoMedioRespostaMin} min`, icon: Clock, cor: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/30' },
    { label: 'CSAT', valor: resumo.csatRespondidos ? resumo.csatMedia : '—', icon: Star, cor: 'text-pink-600 bg-pink-50 dark:text-pink-400 dark:bg-pink-900/30', extra: resumo.csatRespondidos ? `${resumo.csatRespondidos} respostas` : '' },
    { label: 'FCR', valor: resumo.fcr ? `${resumo.fcr}%` : '—', icon: CheckCircle, cor: 'text-cyan-600 bg-cyan-50 dark:text-cyan-400 dark:bg-cyan-900/30' },
    { label: 'Mensagens Agente', valor: resumo.totalMensagensAgente, icon: MessageSquare, cor: 'text-slate-600 bg-slate-100 dark:text-slate-300 dark:bg-slate-700' },
  ] : [];

  const cardsTime = resumoTime ? [
    { label: 'Tickets do Time', valor: resumoTime.totalTickets, icon: FileText, cor: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/30' },
    { label: 'Resolução Média', valor: resumoTime.taxaResolucaoMedia ? `${resumoTime.taxaResolucaoMedia}%` : '—', icon: CheckCircle, cor: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30' },
    { label: 'CSAT Médio', valor: resumoTime.csatMedia ? resumoTime.csatMedia : '—', icon: Star, cor: 'text-pink-600 bg-pink-50 dark:text-pink-400 dark:bg-pink-900/30' },
    { label: 'FCR Médio', valor: resumoTime.fcrMedia ? `${resumoTime.fcrMedia}%` : '—', icon: CheckCircle, cor: 'text-cyan-600 bg-cyan-50 dark:text-cyan-400 dark:bg-cyan-900/30' },
  ] : [];

  const periodoTexto = relatorio?.periodo?.inicio && relatorio?.periodo?.fim
    ? `${formataData(relatorio.periodo.inicio)} — ${formataData(relatorio.periodo.fim)}`
    : periodoLabel(filtros.periodo);

  if (loading && !relatorio && !resumoTodos) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-red-600" size={32} />
      </div>
    );
  }

  const analistaSelecionado = relatorio || resumoTodos;

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
            {modoTodos ? <Users size={24} className="text-red-600 dark:text-red-400" /> : <User size={24} className="text-red-600 dark:text-red-400" />}
            Auditoria por Analista
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
            Relatório individual com replay de conversa e visão consolidada do time
          </p>
        </div>
        <ReportActions onRefresh={aplicarAuditoria} onPrint={() => window.print()} />
      </div>

      <AuditoriaFiltros
        analistas={analistas}
        filtros={filtros}
        onChange={setFiltros}
        onApply={aplicarAuditoria}
        loading={loading}
        analistasCarregando={analistasCarregando}
      />

      {/* Chip do filtro ativo */}
      {analistaSelecionado && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-semibold border border-red-200 dark:border-red-800" style={{ fontFamily: 'Lexend, sans-serif' }}>
            {modoTodos ? <Users size={12} /> : <User size={12} />}
            {modoTodos ? `Todos os Analistas (${resumoTodos?.totalAnalistas ?? 0} ativos)` : relatorio?.agenteNome}
            <span className="opacity-60">•</span>
            {periodoTexto}
          </span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm" style={{ fontFamily: 'Lexend, sans-serif' }}>{error}</div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="animate-spin text-red-600" size={24} />
        </div>
      )}

      {/* Card de identificação do analista (modo individual) */}
      {!modoTodos && relatorio && (
        <div className="flex items-center gap-3 print:break-inside-avoid">
          <div className="w-11 h-11 rounded-xl bg-red-600/10 text-red-600 dark:text-red-400 flex items-center justify-center">
            <User size={20} />
          </div>
          <div>
            <div className="text-lg font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>
              {relatorio.agenteNome}
            </div>
            <div className="text-xs text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
              Período: {relatorio.periodo.inicio ? formataData(relatorio.periodo.inicio) : 'Todo'} — {relatorio.periodo.fim ? formataData(relatorio.periodo.fim) : 'hoje'}
            </div>
          </div>
          {resumo && resumo.classificacaoAuditoria !== 'sem_dados' && (
            <span className={`text-xs font-medium px-3 py-1 rounded-full ${CLASS_CONFIG[resumo.classificacaoAuditoria]?.bg} ${CLASS_CONFIG[resumo.classificacaoAuditoria]?.cor}`} style={{ fontFamily: 'Lexend, sans-serif' }}>
              {CLASS_CONFIG[resumo.classificacaoAuditoria]?.label}
            </span>
          )}
        </div>
      )}

      {/* Card de identificação (modo todos) */}
      {modoTodos && resumoTodos && (
        <div className="flex items-center gap-3 print:break-inside-avoid">
          <div className="w-11 h-11 rounded-xl bg-red-600/10 text-red-600 dark:text-red-400 flex items-center justify-center">
            <Users size={20} />
          </div>
          <div>
            <div className="text-lg font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>
              Todos os Analistas ({resumoTodos.totalAnalistas} ativos)
            </div>
            <div className="text-xs text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
              Período: {periodoTexto}
            </div>
          </div>
        </div>
      )}

      {/* Cards de métricas */}
      {!modoTodos && cardsIndividuais.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4 print:break-inside-avoid">
          {cardsIndividuais.map(c => (
            <ReportKpiCard key={c.label} label={c.label} valor={c.extra ? `${c.valor} · ${c.extra}` : c.valor} icon={c.icon} cor={c.cor} />
          ))}
        </div>
      )}

      {modoTodos && cardsTime.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:break-inside-avoid">
          {cardsTime.map(c => (
            <ReportKpiCard key={c.label} label={c.label} valor={c.valor} icon={c.icon} cor={c.cor} />
          ))}
        </div>
      )}

      {/* Ranking de analistas (modo todos) */}
      {modoTodos && resumoTodos && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-4" style={{ fontFamily: 'Khand, sans-serif' }}>
            Ranking de Analistas ({resumoTodos.analistas.length})
          </h2>
          {resumoTodos.analistas.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8" style={{ fontFamily: 'Lexend, sans-serif' }}>
              Nenhum analista encontrado no período.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700">
                    {COLUNAS_RANKING.map(col => (
                      <th key={col.chave} className={`px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide cursor-pointer select-none hover:text-red-600 dark:hover:text-red-400 ${col.alinhar || 'text-left'}`} style={{ fontFamily: 'Lexend, sans-serif' }} onClick={() => ordenarPor(col.chave)}>
                        <span className="inline-flex items-center gap-1">
                          <AcronymText text={col.label} />
                          {colunaOrdenacao === col.chave ? (
                            ordemAsc ? <ArrowUp size={11} /> : <ArrowDown size={11} />
                          ) : <ArrowUpDown size={11} className="opacity-40" />}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rankingOrdenado.map((a) => (
                    <tr
                      key={a.agenteId}
                      onClick={() => mudarParaAnalista(a.agenteId)}
                      className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
                    >
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-8 h-8 rounded-full bg-red-600/10 text-red-600 dark:text-red-400 flex items-center justify-center flex-shrink-0 text-[11px] font-bold">
                            {iniciais(a.agenteNome)}
                          </span>
                          <span className="font-medium text-slate-700 dark:text-slate-200" style={{ fontFamily: 'Lexend, sans-serif' }}>{a.agenteNome}</span>
                          {a.classificacaoAuditoria && a.classificacaoAuditoria !== 'sem_dados' && (
                            <span className={`hidden lg:inline-block text-[10px] px-2 py-0.5 rounded-full ${CLASS_CONFIG[a.classificacaoAuditoria]?.bg} ${CLASS_CONFIG[a.classificacaoAuditoria]?.cor}`}>
                              {CLASS_CONFIG[a.classificacaoAuditoria]?.label}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right text-slate-600 dark:text-slate-300">{a.totalTickets || '—'}</td>
                      <td className="px-3 py-2.5 text-right text-slate-600 dark:text-slate-300">{a.totalTickets ? `${a.taxaResolucao}%` : '—'}</td>
                      <td className="px-3 py-2.5 text-right text-slate-600 dark:text-slate-300">{a.notaAuditoriaMedia ? `${a.notaAuditoriaMedia}/10` : '—'}</td>
                      <td className="px-3 py-2.5 text-right text-slate-600 dark:text-slate-300">{a.totalTickets ? `${a.tempoMedioRespostaMin} min` : '—'}</td>
                      <td className="px-3 py-2.5 text-right text-slate-600 dark:text-slate-300">{a.csatRespondidos ? a.csatMedia : '—'}</td>
                      <td className="px-3 py-2.5 text-right text-slate-600 dark:text-slate-300">{a.totalTickets ? `${a.fcr}%` : '—'}</td>
                      <td className="px-3 py-2.5 text-right text-slate-600 dark:text-slate-300">{a.totalMensagensAgente || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Lista de tickets (modo individual) */}
      {!modoTodos && relatorio && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-4" style={{ fontFamily: 'Khand, sans-serif' }}>
            Tickets Atendidos ({relatorio.tickets.length})
          </h2>
          <div className="space-y-3">
            {relatorio.tickets.map(t => {
              const config = t.classificacaoAuditoria ? CLASS_CONFIG[t.classificacaoAuditoria] : null;
              return (
                <div key={t.ticketId} className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:shadow-sm transition-shadow">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${config ? config.bg : 'bg-slate-100 dark:bg-slate-700'} ${config ? config.cor : 'text-slate-400'}`}>
                      <FileText size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Lexend, sans-serif' }}>
                          #{t.protocolo || t.ticketId.slice(0, 8)}
                        </span>
                        {config && (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.bg} ${config.cor}`} style={{ fontFamily: 'Lexend, sans-serif' }}>
                            {config.label}
                          </span>
                        )}
                        {t.csatNota != null && (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-pink-50 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
                            <Star size={10} /> {t.csatNota}/5
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-300 truncate" style={{ fontFamily: 'Lexend, sans-serif' }}>
                        {t.contactName || 'Cliente'}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5" style={{ fontFamily: 'Lexend, sans-serif' }}>
                        <span className="flex items-center gap-1"><Calendar size={11} /> {formataData(t.dataAbertura)}</span>
                        <span className="flex items-center gap-1"><MessageSquare size={11} /> {t.totalMensagens} msgs</span>
                        {t.primeiraRespostaMin != null && (
                          <span className="flex items-center gap-1"><Clock size={11} /> 1ª resp. {t.primeiraRespostaMin} min</span>
                        )}
                        {t.totalAlertas > 0 && (
                          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400"><AlertTriangle size={11} /> {t.totalAlertas} alertas</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {t.notaAuditoriaMedia != null && (
                      <span className="text-lg font-bold" style={{ fontFamily: 'Khand, sans-serif' }}>
                        <span className={t.notaAuditoriaMedia >= 8 ? 'text-emerald-600 dark:text-emerald-400' : t.notaAuditoriaMedia >= 5 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}>
                          {t.notaAuditoriaMedia}/10
                        </span>
                      </span>
                    )}
                    <button
                      onClick={() => abrirReplay(t.ticketId)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg transition-colors"
                      style={{ fontFamily: 'Lexend, sans-serif' }}>
                      <Play size={14} /> Replay
                    </button>
                  </div>
                </div>
              );
            })}
            {relatorio.tickets.length === 0 && (
              <div className="text-center py-10">
                <p className="text-sm text-slate-400 mb-1" style={{ fontFamily: 'Lexend, sans-serif' }}>Nenhum ticket no período selecionado</p>
                <p className="text-xs text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>Tente ampliar o período ou verifique se o analista teve atendimentos nesta janela.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {replay && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setReplay(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 pb-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>
                  Replay — #{replay.protocolo || replay.ticketId.slice(0, 8)}
                </h2>
                <div className="text-sm text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
                  {replay.contactName || replay.contactPhone || 'Cliente'} · {replay.assigneeName || 'Sem analista'} · {new Date(replay.dataAbertura).toLocaleString('pt-BR')}
                </div>
              </div>
              <button onClick={() => setReplay(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl leading-none">×</button>
            </div>

            <div className="px-6 py-3 flex flex-wrap items-center gap-4 text-sm border-b border-slate-100 dark:border-slate-700">
              <span className="text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
                <MessageSquare size={14} className="inline mr-1" />
                {replay.resumoAuditoria.totalMensagens} msgs · {replay.resumoAuditoria.mensagensAuditadas} auditadas
              </span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CLASS_CONFIG[replay.resumoAuditoria.classificacao]?.bg} ${CLASS_CONFIG[replay.resumoAuditoria.classificacao]?.cor}`} style={{ fontFamily: 'Lexend, sans-serif' }}>
                Nota média: {replay.resumoAuditoria.notaMedia} — {CLASS_CONFIG[replay.resumoAuditoria.classificacao]?.label}
              </span>
            </div>

            <div className="flex-1 overflow-auto p-6 space-y-3">
              {replay.mensagens.map(m => (
                <div key={m.id} className={`flex ${m.fromMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${m.fromMe ? 'bg-red-600 text-white rounded-br-md' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-bl-md'}`}>
                    <div className="text-xs opacity-60 mb-0.5" style={{ fontFamily: 'Lexend, sans-serif' }}>
                      {m.fromMe ? 'Analista' : 'Cliente'} · {new Date(m.createdAt).toLocaleTimeString('pt-BR')}
                    </div>
                    <div className="text-sm whitespace-pre-wrap" style={{ fontFamily: 'Lexend, sans-serif' }}>{m.content || '(sem conteúdo)'}</div>
                    {m.auditoria && (
                      <div className={`mt-2 pt-2 border-t ${m.fromMe ? 'border-white/20' : 'border-slate-200 dark:border-slate-600'} text-xs`}>
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${m.fromMe ? 'text-white' : ''}`} style={{ fontFamily: 'Lexend, sans-serif' }}>
                            {m.auditoria.notaGeral}/10 · {CLASS_CONFIG[m.auditoria.classificacao]?.label}
                          </span>
                        </div>
                        {m.auditoria.alertas.length > 0 && (
                          <div className="mt-1 flex items-center gap-1 text-red-500">
                            <AlertTriangle size={11} />
                            {m.auditoria.alertas.join('; ')}
                          </div>
                        )}
                        {m.auditoria.sugestaoResposta && (
                          <div className="mt-1 opacity-90" style={{ fontFamily: 'Lexend, sans-serif' }}>💡 {m.auditoria.sugestaoResposta}</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {replay.mensagens.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-8" style={{ fontFamily: 'Lexend, sans-serif' }}>Sem mensagens neste ticket</p>
              )}
            </div>
          </div>
        </div>
      )}

      {loadingReplay && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <Loader2 className="animate-spin text-red-600" size={32} />
        </div>
      )}
    </div>
  );
}
