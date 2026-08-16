import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import {
  Loader2, AlertTriangle, CheckCircle, RotateCcw, Search,
  ShieldAlert, Star, FileText, Calendar, User, MessageSquare, Sparkles,
  Gauge,
} from 'lucide-react';
import ReportActions from '../../components/reports/ReportActions';
import ReportKpiCard from '../../components/reports/ReportKpiCard';
import ReportFilters, { FiltrosBase, FILTROS_LIMPOS, FiltroOpcoes } from '../../components/reports/ReportFilters';

interface TicketEncerrado {
  id: string;
  protocolo: string | null;
  contactName: string | null;
  contactPhone: string | null;
  dataFechamento: string;
  dataAbertura: string;
  assignee: { name: string } | null;
  csatResposta: { nota: number | null; respondidoEm: string | null } | null;
  _count: { messages: number };
}

interface Auditoria {
  ticketId: string;
  protocolo: string | null;
  contactName: string | null;
  assigneeName: string | null;
  clienteId: string | null;
  clienteNome: string | null;
  dataFechamento: string | null;
  tipo: 'encerramento_prematuro' | 'resolucao_real' | 'reabertura' | 'sem_dados';
  diagnostico: string;
  detalhes: string[];
  nota: number;
  recomendaReabertura: boolean;
  riscoReabertura: 'BAIXO' | 'MÉDIO' | 'ALTO' | 'CRÍTICO';
  semConfirmacao: boolean;
  motivoStatus: string | null;
  clienteVoltou: boolean;
  mensagensAposEncerramento: number;
  csatNota: number | null;
  csatRespondido: boolean;
  analiseIa: boolean;
  ticketReaberturaId: string | null;
}

interface PorRisco {
  risco: string;
  total: number;
}

interface PorAnalista {
  analista: string;
  auditados: number;
  prematuros: number;
  resolucoesReais: number;
  reaberturas: number;
  notaMedia: number;
}

interface Resumo {
  totalAuditados: number;
  prematuros: number;
  resolucoesReais: number;
  reaberturas: number;
  taxaPrematura: number;
  pctReabertura: number;
  taxaEncerramentoCorreto: number;
  semConfirmacao: number;
  problemaNaoResolvido: number;
  notaMedia: number;
  porRisco: PorRisco[];
  porTipo: { tipo: string; total: number }[];
  porAnalista: PorAnalista[];
  porCliente: { cliente: string; auditados: number; prematuros: number; resolucoesReais: number; reaberturas: number }[];
}

const TIPO_CONFIG: Record<string, { label: string; cor: string; bg: string; icon: any }> = {
  encerramento_prematuro: { label: 'Encerramento Prematuro', cor: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800', icon: AlertTriangle },
  resolucao_real: { label: 'Resolução Real', cor: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800', icon: CheckCircle },
  reabertura: { label: 'Reabertura', cor: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800', icon: RotateCcw },
  sem_dados: { label: 'Sem Dados', cor: 'text-slate-500', bg: 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700', icon: FileText },
};

const RISCO_CONFIG: Record<string, { label: string; cor: string; barra: string; badge: string }> = {
  BAIXO: { label: 'Risco Baixo', cor: 'text-emerald-600 dark:text-emerald-400', barra: 'bg-emerald-500', badge: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' },
  'MÉDIO': { label: 'Risco Médio', cor: 'text-amber-600 dark:text-amber-400', barra: 'bg-amber-500', badge: 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' },
  ALTO: { label: 'Risco Alto', cor: 'text-orange-600 dark:text-orange-400', barra: 'bg-orange-500', badge: 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' },
  'CRÍTICO': { label: 'Risco Crítico', cor: 'text-red-600 dark:text-red-400', barra: 'bg-red-500', badge: 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400' },
};

const TIPO_NOME: Record<string, string> = {
  encerramento_prematuro: 'Encerramento Prematuro',
  resolucao_real: 'Resolução Real',
  reabertura: 'Reabertura',
  sem_dados: 'Sem Dados',
};

export default function AuditoriaEncerramentoPage() {
  const [tickets, setTickets] = useState<TicketEncerrado[]>([]);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [loading, setLoading] = useState(true);
  const [auditando, setAuditando] = useState(false);
  const [error, setError] = useState('');
  const [busca, setBusca] = useState('');
  const [auditorias, setAuditorias] = useState<Record<string, Auditoria>>({});
  const [ticketAberto, setTicketAberto] = useState<Auditoria | null>(null);
  const [opcoes, setOpcoes] = useState<FiltroOpcoes | null>(null);
  const [filtros, setFiltros] = useState<FiltrosBase>(FILTROS_LIMPOS);

  useEffect(() => {
    api.get('/analytics/relatorios/opcoes')
      .then(({ data }) => setOpcoes(data))
      .catch(() => {});
  }, []);

  const montarParams = useCallback((f: FiltrosBase) => {
    const params: Record<string, string> = { limit: '100' };
    const fim = f.fim || new Date().toISOString();
    if (f.inicio) {
      params.dataInicio = new Date(f.inicio).toISOString();
      params.dataFim = new Date(fim).toISOString();
    }
    if (f.filaId) params.filaId = f.filaId;
    if (f.canal) params.canal = f.canal;
    if (f.prioridade) params.prioridade = f.prioridade;
    if (f.status) params.status = f.status;
    if (f.departamentoId) params.departamentoId = f.departamentoId;
    if (f.analistaId) params.assigneeId = f.analistaId;
    if (f.clienteId) params.clienteId = f.clienteId;
    if (f.categoria) params.categoria = f.categoria;
    return params;
  }, []);

  const carregar = useCallback(async (f: FiltrosBase) => {
    setLoading(true);
    setError('');
    try {
      const [ticketsRes, resumoRes] = await Promise.all([
        api.get('/helpdesk/closure-audit/encerrados', { params: montarParams(f) }),
        api.get('/helpdesk/closure-audit/resumo', { params: montarParams(f) }),
      ]);
      setTickets(ticketsRes.data || []);
      setResumo(resumoRes.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao carregar auditoria');
    } finally {
      setLoading(false);
    }
  }, [montarParams]);

  useEffect(() => { carregar(filtros); }, [carregar, filtros]);

  const auditarTicket = async (ticketId: string) => {
    setError('');
    try {
      const { data } = await api.get(`/helpdesk/closure-audit/${ticketId}`);
      setAuditorias(prev => ({ ...prev, [ticketId]: data }));
      setTicketAberto(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao auditar ticket');
    }
  };

  const auditarLote = async () => {
    setAuditando(true);
    setError('');
    try {
      const { data } = await api.get('/helpdesk/closure-audit/lote', { params: montarParams(filtros) });
      const map: Record<string, Auditoria> = {};
      data.auditados.forEach((a: Auditoria) => { map[a.ticketId] = a; });
      setAuditorias(map);
      const resumoRes = await api.get('/helpdesk/closure-audit/resumo', { params: montarParams(filtros) });
      setResumo(resumoRes.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao auditar lote');
    } finally {
      setAuditando(false);
    }
  };

  const urlExportar = (tipo: 'csv' | 'excel') => {
    const params = new URLSearchParams(montarParams({ ...filtros, dias: 0 }));
    params.set('limit', '500');
    return `${window.location.origin}/api/helpdesk/closure-audit/${tipo === 'csv' ? 'exportar' : 'exportar-excel'}?${params.toString()}`;
  };

  const ticketsFiltrados = tickets.filter(t =>
    !busca ||
    (t.contactName || '').toLowerCase().includes(busca.toLowerCase()) ||
    (t.protocolo || '').toLowerCase().includes(busca.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-red-600" size={32} />
      </div>
    );
  }

  const resumoCards = resumo ? [
    { label: 'Tickets Auditados', valor: resumo.totalAuditados, icon: FileText, cor: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/30' },
    { label: 'Encerramentos Prematuros', valor: resumo.prematuros, icon: AlertTriangle, cor: 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/30', extra: `${resumo.taxaPrematura}%` },
    { label: 'Encerramento Correto', valor: resumo.resolucoesReais, icon: CheckCircle, cor: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30', extra: `${resumo.taxaEncerramentoCorreto}%` },
    { label: 'Reaberturas', valor: resumo.reaberturas, icon: RotateCcw, cor: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/30', extra: `${resumo.pctReabertura}%` },
    { label: 'Sem Confirmação', valor: resumo.semConfirmacao, icon: MessageSquare, cor: 'text-slate-600 bg-slate-50 dark:text-slate-400 dark:bg-slate-800' },
    { label: 'Sem Resolução', valor: resumo.problemaNaoResolvido, icon: AlertTriangle, cor: 'text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-900/30' },
    { label: 'Nota Média', valor: resumo.notaMedia, icon: Star, cor: 'text-violet-600 bg-violet-50 dark:text-violet-400 dark:bg-violet-900/30', extra: '/10' },
    { label: 'Risco Crítico', valor: (resumo.porRisco.find(r => r.risco === 'CRÍTICO')?.total ?? 0), icon: ShieldAlert, cor: 'text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/40' },
  ] : [];

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
            <ShieldAlert size={24} className="text-red-600 dark:text-red-400" />
            Auditoria de Encerramento
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
            Detecta encerramento prematuro, resolução real e reabertura por IA
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ReportActions
            onRefresh={() => carregar(filtros)}
            onCsv={() => window.open(urlExportar('csv'), '_blank')}
            onExcel={() => window.open(urlExportar('excel'), '_blank')}
            onPrint={() => window.print()}
          />
          <button onClick={auditarLote} disabled={auditando}
            className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors print:hidden"
            style={{ fontFamily: 'Lexend, sans-serif' }}>
            {auditando ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Auditar Lote (IA)
          </button>
        </div>
      </div>

      <ReportFilters opcoes={opcoes} filtros={filtros} onChange={setFiltros} />

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm" style={{ fontFamily: 'Lexend, sans-serif' }}>{error}</div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {resumoCards.map(c => (
          <ReportKpiCard key={c.label} label={c.label} valor={c.extra ? `${c.valor} · ${c.extra}` : c.valor} icon={c.icon} cor={c.cor} />
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>
            Tickets Encerrados
          </h2>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar protocolo ou cliente..."
              className="pl-9 pr-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg text-sm text-slate-700 dark:text-slate-200 w-64"
              style={{ fontFamily: 'Lexend, sans-serif' }}
            />
          </div>
        </div>

        <div className="space-y-3">
          {ticketsFiltrados.map(t => {
            const auditoria = auditorias[t.id];
            const config = auditoria ? TIPO_CONFIG[auditoria.tipo] : null;
            const Icon = config?.icon || FileText;
            return (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-sm transition-shadow">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${config ? config.bg : 'bg-slate-100 dark:bg-slate-700'} ${config ? config.cor : 'text-slate-400'}`}>
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Lexend, sans-serif' }}>
                        #{t.protocolo || t.id.slice(0, 8)}
                      </span>
                      {config && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.bg} ${config.cor}`} style={{ fontFamily: 'Lexend, sans-serif' }}>
                          {config.label}
                        </span>
                      )}
                      {auditoria?.analiseIa && (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
                          <Sparkles size={10} /> IA
                        </span>
                      )}
                      {auditoria && auditoria.riscoReabertura && auditoria.riscoReabertura !== 'BAIXO' && (
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${RISCO_CONFIG[auditoria.riscoReabertura].badge}`} style={{ fontFamily: 'Lexend, sans-serif' }}>
                          <Gauge size={10} /> Risco {auditoria.riscoReabertura}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-300 truncate" style={{ fontFamily: 'Lexend, sans-serif' }}>
                      {t.contactName || t.contactPhone || 'Cliente'}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5" style={{ fontFamily: 'Lexend, sans-serif' }}>
                      <span className="flex items-center gap-1"><Calendar size={11} /> {t.dataFechamento ? new Date(t.dataFechamento).toLocaleDateString('pt-BR') : '—'}</span>
                      <span className="flex items-center gap-1"><User size={11} /> {t.assignee?.name || 'Não atribuído'}</span>
                      <span className="flex items-center gap-1"><MessageSquare size={11} /> {t._count?.messages} msgs</span>
                      {t.csatResposta?.nota != null && (
                        <span className="flex items-center gap-1"><Star size={11} /> {t.csatResposta.nota}/5</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {auditoria && (
                    <span className="text-lg font-bold" style={{ fontFamily: 'Khand, sans-serif' }}>
                      <span className={auditoria.nota >= 8 ? 'text-emerald-600 dark:text-emerald-400' : auditoria.nota >= 5 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}>
                        {auditoria.nota}/10
                      </span>
                    </span>
                  )}
                  <button
                    onClick={() => auditarTicket(t.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg transition-colors"
                    style={{ fontFamily: 'Lexend, sans-serif' }}>
                    <Sparkles size={14} />
                    {auditoria ? 'Reauditar' : 'Auditar'}
                  </button>
                </div>
              </div>
            );
          })}
          {ticketsFiltrados.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8" style={{ fontFamily: 'Lexend, sans-serif' }}>Nenhum ticket encerrado encontrado</p>
          )}
        </div>
      </div>

      {resumo && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
            <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-4" style={{ fontFamily: 'Khand, sans-serif' }}>
              Distribuição por Risco de Reabertura
            </h2>
            <div className="space-y-3">
              {resumo.porRisco.map(r => {
                const cfg = RISCO_CONFIG[r.risco];
                const pct = resumo.totalAuditados > 0 ? Math.round((r.total / resumo.totalAuditados) * 100) : 0;
                return (
                  <div key={r.risco}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium text-slate-700 dark:text-slate-300" style={{ fontFamily: 'Lexend, sans-serif' }}>{cfg.label}</span>
                      <span className={`text-sm font-semibold ${cfg.cor}`} style={{ fontFamily: 'Khand, sans-serif' }}>{r.total} · {pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                      <div className={`h-full rounded-full ${cfg.barra} transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
            <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-4" style={{ fontFamily: 'Khand, sans-serif' }}>
              Distribuição por Tipo
            </h2>
            <div className="space-y-3">
              {resumo.porTipo.map(t => {
                const cfg = TIPO_CONFIG[t.tipo];
                const pct = resumo.totalAuditados > 0 ? Math.round((t.total / resumo.totalAuditados) * 100) : 0;
                return (
                  <div key={t.tipo}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium text-slate-700 dark:text-slate-300" style={{ fontFamily: 'Lexend, sans-serif' }}>{TIPO_NOME[t.tipo] || t.tipo}</span>
                      <span className={`text-sm font-semibold ${cfg?.cor || 'text-slate-500'}`} style={{ fontFamily: 'Khand, sans-serif' }}>{t.total} · {pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                      <div className={`h-full rounded-full ${cfg ? cfg.bg.split(' ')[0] : 'bg-slate-400'} transition-all`} style={{ width: `${pct}%`, backgroundColor: cfg ? undefined : undefined }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700 lg:col-span-2">
            <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-4" style={{ fontFamily: 'Khand, sans-serif' }}>
              Auditoria por Analista
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-400 border-b border-slate-100 dark:border-slate-700" style={{ fontFamily: 'Lexend, sans-serif' }}>
                    <th className="pb-2 font-medium">Analista</th>
                    <th className="pb-2 font-medium">Auditados</th>
                    <th className="pb-2 font-medium">Prematuros</th>
                    <th className="pb-2 font-medium">Resoluções</th>
                    <th className="pb-2 font-medium">Reaberturas</th>
                    <th className="pb-2 font-medium">Nota Média</th>
                  </tr>
                </thead>
                <tbody>
                  {resumo.porAnalista.map(a => (
                    <tr key={a.analista} className="border-b border-slate-50 dark:border-slate-700/50" style={{ fontFamily: 'Lexend, sans-serif' }}>
                      <td className="py-2 text-slate-700 dark:text-slate-300 font-medium">{a.analista}</td>
                      <td className="py-2 text-slate-600 dark:text-slate-400">{a.auditados}</td>
                      <td className={`py-2 font-medium ${a.prematuros > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`}>{a.prematuros}</td>
                      <td className="py-2 text-emerald-600 dark:text-emerald-400">{a.resolucoesReais}</td>
                      <td className={`py-2 font-medium ${a.reaberturas > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>{a.reaberturas}</td>
                      <td className={`py-2 font-semibold ${a.notaMedia >= 8 ? 'text-emerald-600' : a.notaMedia >= 5 ? 'text-amber-600' : 'text-red-600'}`}>{a.notaMedia}</td>
                    </tr>
                  ))}
                  {resumo.porAnalista.length === 0 && (
                    <tr><td colSpan={6} className="py-4 text-center text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>Sem dados</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {resumo.porCliente.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700 lg:col-span-2">
              <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-4" style={{ fontFamily: 'Khand, sans-serif' }}>
                Auditoria por Cliente
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-400 border-b border-slate-100 dark:border-slate-700" style={{ fontFamily: 'Lexend, sans-serif' }}>
                      <th className="pb-2 font-medium">Cliente</th>
                      <th className="pb-2 font-medium">Auditados</th>
                      <th className="pb-2 font-medium">Prematuros</th>
                      <th className="pb-2 font-medium">Resoluções</th>
                      <th className="pb-2 font-medium">Reaberturas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumo.porCliente.map(c => (
                      <tr key={c.cliente} className="border-b border-slate-50 dark:border-slate-700/50" style={{ fontFamily: 'Lexend, sans-serif' }}>
                        <td className="py-2 text-slate-700 dark:text-slate-300 font-medium">{c.cliente}</td>
                        <td className="py-2 text-slate-600 dark:text-slate-400">{c.auditados}</td>
                        <td className={`py-2 font-medium ${c.prematuros > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`}>{c.prematuros}</td>
                        <td className="py-2 text-emerald-600 dark:text-emerald-400">{c.resolucoesReais}</td>
                        <td className={`py-2 font-medium ${c.reaberturas > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>{c.reaberturas}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {ticketAberto && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setTicketAberto(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>
                  Auditoria #{ticketAberto.protocolo || ticketAberto.ticketId.slice(0, 8)}
                </h2>
                <button onClick={() => setTicketAberto(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl leading-none">×</button>
              </div>

              <div className="flex items-center gap-3 mb-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${TIPO_CONFIG[ticketAberto.tipo]?.bg} ${TIPO_CONFIG[ticketAberto.tipo]?.cor}`}>
                  {(() => { const I = TIPO_CONFIG[ticketAberto.tipo]?.icon || FileText; return <I size={22} />; })()}
                </div>
                <div>
                  <div className="font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>
                    {TIPO_CONFIG[ticketAberto.tipo]?.label}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-2xl font-bold" style={{ fontFamily: 'Khand, sans-serif' }}>
                      <span className={ticketAberto.nota >= 8 ? 'text-emerald-600 dark:text-emerald-400' : ticketAberto.nota >= 5 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}>
                        {ticketAberto.nota}/10
                      </span>
                    </span>
                    {ticketAberto.analiseIa && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
                        <Sparkles size={10} /> Análise IA
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <p className="text-sm text-slate-600 dark:text-slate-300 mb-4" style={{ fontFamily: 'Lexend, sans-serif' }}>
                {ticketAberto.diagnostico}
              </p>

              {ticketAberto.detalhes.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2" style={{ fontFamily: 'Lexend, sans-serif' }}>Evidências</h3>
                  <ul className="space-y-1.5">
                    {ticketAberto.detalhes.map((d, i) => (
                      <li key={i} className="text-sm text-slate-600 dark:text-slate-300 flex items-start gap-2" style={{ fontFamily: 'Lexend, sans-serif' }}>
                        <span className="text-blue-500 mt-0.5">•</span> {d}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-700/40">
                  <div className="text-xs text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>Atendente</div>
                  <div className="text-slate-700 dark:text-slate-200 font-medium" style={{ fontFamily: 'Lexend, sans-serif' }}>{ticketAberto.assigneeName || '—'}</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-700/40">
                  <div className="text-xs text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>CSAT</div>
                  <div className="text-slate-700 dark:text-slate-200 font-medium" style={{ fontFamily: 'Lexend, sans-serif' }}>
                    {ticketAberto.csatRespondido ? `${ticketAberto.csatNota}/5` : 'Não respondido'}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-700/40">
                  <div className="text-xs text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>Cliente voltou</div>
                  <div className="text-slate-700 dark:text-slate-200 font-medium" style={{ fontFamily: 'Lexend, sans-serif' }}>
                    {ticketAberto.clienteVoltou ? `Sim (${ticketAberto.mensagensAposEncerramento} msgs)` : 'Não'}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-700/40">
                  <div className="text-xs text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>Recomendação</div>
                  <div className={`font-medium ${ticketAberto.recomendaReabertura ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`} style={{ fontFamily: 'Lexend, sans-serif' }}>
                    {ticketAberto.recomendaReabertura ? 'Reabrir atenção' : 'OK — sem ação'}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-700/40">
                  <div className="text-xs text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>Risco de Reabertura</div>
                  <div className={`font-medium ${RISCO_CONFIG[ticketAberto.riscoReabertura]?.cor || 'text-slate-500'}`} style={{ fontFamily: 'Lexend, sans-serif' }}>
                    {RISCO_CONFIG[ticketAberto.riscoReabertura]?.label || ticketAberto.riscoReabertura || '—'}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-700/40">
                  <div className="text-xs text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>Confirmação de Resolução</div>
                  <div className={`font-medium ${ticketAberto.semConfirmacao ? 'text-orange-600 dark:text-orange-400' : 'text-emerald-600 dark:text-emerald-400'}`} style={{ fontFamily: 'Lexend, sans-serif' }}>
                    {ticketAberto.semConfirmacao ? 'Sem confirmação' : 'Confirmado'}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-700/40">
                  <div className="text-xs text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>Motivo Status</div>
                  <div className="text-slate-700 dark:text-slate-200 font-medium" style={{ fontFamily: 'Lexend, sans-serif' }}>
                    {ticketAberto.motivoStatus ? ticketAberto.motivoStatus.replace(/_/g, ' ') : '—'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
