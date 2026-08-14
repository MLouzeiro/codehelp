import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import {
  Loader2, AlertTriangle, CheckCircle, RotateCcw, Search, RefreshCw,
  ShieldAlert, Star, FileText, Calendar, User, MessageSquare, Sparkles,
} from 'lucide-react';

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
  dataFechamento: string | null;
  tipo: 'encerramento_prematuro' | 'resolucao_real' | 'reabertura' | 'sem_dados';
  diagnostico: string;
  detalhes: string[];
  nota: number;
  recomendaReabertura: boolean;
  clienteVoltou: boolean;
  mensagensAposEncerramento: number;
  csatNota: number | null;
  csatRespondido: boolean;
  analiseIa: boolean;
  ticketReaberturaId: string | null;
}

interface Resumo {
  totalAuditados: number;
  prematuros: number;
  resolucoesReais: number;
  reaberturas: number;
  taxaPrematura: number;
  pctReabertura: number;
}

const TIPO_CONFIG: Record<string, { label: string; cor: string; bg: string; icon: any }> = {
  encerramento_prematuro: { label: 'Encerramento Prematuro', cor: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800', icon: AlertTriangle },
  resolucao_real: { label: 'Resolução Real', cor: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800', icon: CheckCircle },
  reabertura: { label: 'Reabertura', cor: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800', icon: RotateCcw },
  sem_dados: { label: 'Sem Dados', cor: 'text-slate-500', bg: 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700', icon: FileText },
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

  const carregar = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [ticketsRes, resumoRes] = await Promise.all([
        api.get('/helpdesk/closure-audit/encerrados', { params: { limit: 50 } }),
        api.get('/helpdesk/closure-audit/resumo', { params: { limit: 100 } }),
      ]);
      setTickets(ticketsRes.data || []);
      setResumo(resumoRes.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao carregar auditoria');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

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
      const { data } = await api.get('/helpdesk/closure-audit/lote', { params: { limit: 50 } });
      const map: Record<string, Auditoria> = {};
      data.auditados.forEach((a: Auditoria) => { map[a.ticketId] = a; });
      setAuditorias(map);
      const resumoRes = await api.get('/helpdesk/closure-audit/resumo', { params: { limit: 100 } });
      setResumo(resumoRes.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao auditar lote');
    } finally {
      setAuditando(false);
    }
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
    { label: 'Resoluções Reais', valor: resumo.resolucoesReais, icon: CheckCircle, cor: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30' },
    { label: 'Reaberturas', valor: resumo.reaberturas, icon: RotateCcw, cor: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/30', extra: `${resumo.pctReabertura}%` },
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
        <div className="flex items-center gap-2">
          <button onClick={carregar}
            className="flex items-center gap-2 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            style={{ fontFamily: 'Lexend, sans-serif' }}>
            <RefreshCw size={14} /> Atualizar
          </button>
          <button onClick={auditarLote} disabled={auditando}
            className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            style={{ fontFamily: 'Lexend, sans-serif' }}>
            {auditando ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Auditar Lote (IA)
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm" style={{ fontFamily: 'Lexend, sans-serif' }}>{error}</div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {resumoCards.map(c => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.cor}`}><Icon size={18} /></div>
                {c.extra && <span className="text-lg font-bold text-slate-400 dark:text-slate-500" style={{ fontFamily: 'Khand, sans-serif' }}>{c.extra}</span>}
              </div>
              <div className="mt-3">
                <div className="text-xl font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>{c.valor}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>{c.label}</div>
              </div>
            </div>
          );
        })}
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
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
