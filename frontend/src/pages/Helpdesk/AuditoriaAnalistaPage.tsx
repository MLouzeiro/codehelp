import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import {
  Loader2, User, FileText, Calendar, Star, Clock, MessageSquare,
  CheckCircle, AlertTriangle, Sparkles, Play,
} from 'lucide-react';
import ReportActions from '../../components/reports/ReportActions';
import ReportKpiCard from '../../components/reports/ReportKpiCard';

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

const FILAS = ['7d', '30d', '90d', 'todos'];

export default function AuditoriaAnalistaPage() {
  const [analistas, setAnalistas] = useState<{ id: string; name: string }[]>([]);
  const [agenteId, setAgenteId] = useState('');
  const [fila, setFila] = useState('30d');
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null);
  const [replay, setReplay] = useState<Replay | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingReplay, setLoadingReplay] = useState(false);
  const [error, setError] = useState('');

  const carregarAnalistas = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/users');
      const lista = Array.isArray(data) ? data : data?.users || data?.data || [];
      const filtrados = lista.filter((u: any) =>
        ['tecnico', 'gerente', 'admin', 'comercial'].includes(u.role)
      );
      setAnalistas(filtrados);
      if (filtrados.length > 0 && !agenteId) setAgenteId(filtrados[0].id);
    } catch (err) {
      setError('Erro ao carregar analistas');
    }
  }, [agenteId]);

  useEffect(() => { carregarAnalistas(); }, [carregarAnalistas]);

  useEffect(() => {
    if (!agenteId) return;
    carregarRelatorio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agenteId, fila]);

  const carregarRelatorio = async () => {
    setLoading(true);
    setError('');
    try {
      const params: any = {};
      if (fila !== 'todos') {
        const fim = new Date();
        const inicio = new Date();
        inicio.setDate(inicio.getDate() - parseInt(fila, 10));
        params.dataInicio = inicio.toISOString();
        params.dataFim = fim.toISOString();
      }
      const { data } = await api.get(`/helpdesk/audit/agent/${agenteId}`, { params });
      setRelatorio(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao carregar relatório');
    } finally {
      setLoading(false);
    }
  };

  const abrirReplay = async (ticketId: string) => {
    setLoadingReplay(true);
    setError('');
    try {
      const { data } = await api.get(`/helpdesk/audit/agent/${agenteId}/ticket/${ticketId}`);
      setReplay(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao carregar replay');
    } finally {
      setLoadingReplay(false);
    }
  };

  if (loading && !relatorio) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-red-600" size={32} />
      </div>
    );
  }

  const resumo = relatorio?.resumo;

  const cards = resumo ? [
    { label: 'Tickets', valor: resumo.totalTickets, icon: FileText, cor: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/30' },
    { label: 'Resolvidos', valor: resumo.ticketsResolvidos, icon: CheckCircle, cor: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30', extra: `${resumo.taxaResolucao}%` },
    { label: 'Nota Auditoria', valor: resumo.notaAuditoriaMedia ? `${resumo.notaAuditoriaMedia}/10` : '—', icon: Sparkles, cor: 'text-violet-600 bg-violet-50 dark:text-violet-400 dark:bg-violet-900/30' },
    { label: 'Tempo Médio Resp.', valor: `${resumo.tempoMedioRespostaMin} min`, icon: Clock, cor: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/30' },
    { label: 'CSAT', valor: resumo.csatRespondidos ? resumo.csatMedia : '—', icon: Star, cor: 'text-pink-600 bg-pink-50 dark:text-pink-400 dark:bg-pink-900/30', extra: resumo.csatRespondidos ? `${resumo.csatRespondidos} respostas` : '' },
    { label: 'FCR', valor: `${resumo.fcr}%`, icon: CheckCircle, cor: 'text-cyan-600 bg-cyan-50 dark:text-cyan-400 dark:bg-cyan-900/30' },
    { label: 'Mensagens Agente', valor: resumo.totalMensagensAgente, icon: MessageSquare, cor: 'text-slate-600 bg-slate-100 dark:text-slate-300 dark:bg-slate-700' },
  ] : [];

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
            <User size={24} className="text-red-600 dark:text-red-400" />
            Auditoria por Analista
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
            Relatório individual com replay de conversa
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={fila}
            onChange={(e) => setFila(e.target.value)}
            className="px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg text-sm text-slate-700 dark:text-slate-200"
            style={{ fontFamily: 'Lexend, sans-serif' }}>
            {FILAS.map(f => (
              <option key={f} value={f}>{f === 'todos' ? 'Todo período' : `Últimos ${f.replace('d', '')} dias`}</option>
            ))}
          </select>
          <select
            value={agenteId}
            onChange={(e) => setAgenteId(e.target.value)}
            className="px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg text-sm text-slate-700 dark:text-slate-200 min-w-[180px]"
            style={{ fontFamily: 'Lexend, sans-serif' }}>
            {analistas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <ReportActions onRefresh={carregarRelatorio} onPrint={() => window.print()} />
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm" style={{ fontFamily: 'Lexend, sans-serif' }}>{error}</div>
      )}

      {relatorio && (
        <>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-red-600/10 text-red-600 dark:text-red-400 flex items-center justify-center">
              <User size={20} />
            </div>
            <div>
              <div className="text-lg font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>
                {relatorio.agenteNome}
              </div>
              <div className="text-xs text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
                Período: {relatorio.periodo.inicio ? new Date(relatorio.periodo.inicio).toLocaleDateString('pt-BR') : 'Todo'} — {relatorio.periodo.fim ? new Date(relatorio.periodo.fim).toLocaleDateString('pt-BR') : 'hoje'}
              </div>
            </div>
            {resumo && resumo.classificacaoAuditoria !== 'sem_dados' && (
              <span className={`text-xs font-medium px-3 py-1 rounded-full ${CLASS_CONFIG[resumo.classificacaoAuditoria]?.bg} ${CLASS_CONFIG[resumo.classificacaoAuditoria]?.cor}`} style={{ fontFamily: 'Lexend, sans-serif' }}>
                {CLASS_CONFIG[resumo.classificacaoAuditoria]?.label}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4">
            {cards.map(c => (
              <ReportKpiCard key={c.label} label={c.label} valor={c.extra ? `${c.valor} · ${c.extra}` : c.valor} icon={c.icon} cor={c.cor} />
            ))}
          </div>

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
                          <span className="flex items-center gap-1"><Calendar size={11} /> {new Date(t.dataAbertura).toLocaleDateString('pt-BR')}</span>
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
                <p className="text-sm text-slate-400 text-center py-8" style={{ fontFamily: 'Lexend, sans-serif' }}>Nenhum ticket no período selecionado</p>
              )}
            </div>
          </div>
        </>
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
