import { useState, useEffect, useCallback } from 'react';
import { X, ChevronDown, ChevronRight, Brain, GraduationCap, Target, BarChart3, FileText, AlertTriangle, CheckCircle, TrendingUp, Ticket, ArrowRight, Lightbulb, Shield, Users, Clock, Zap, BookOpen, MessageSquare } from 'lucide-react';
import api from '../services/api';
import AcronymTooltip from './AcronymTooltip';

interface DiagnosticoDrawerProps {
  open: boolean;
  onClose: () => void;
  agentId: string;
  agentName?: string;
  dias?: number;
}

interface Necessidade {
  categoria: string;
  icone: string;
  prioridade: 'alta' | 'media' | 'baixa';
  evidencias: string[];
  conclusao: string;
  treinamentoRecomendado: string;
  areaPrincipal?: string;
  subCategoria?: string;
}

interface Competencia {
  nome: string;
  percentual: number;
  situacao: 'otimo' | 'bom' | 'atencao' | 'critico';
}

interface TicketDiagnostico {
  ticketId: string;
  protocolo: string | null;
  cliente: string | null;
  assunto: string | null;
  csat: number | null;
  resultado: string;
  evidencia: string;
  transferido: boolean;
  reaberto: boolean;
  intervecaoAnalista: boolean;
}

interface DificuldadeAssunto {
  assunto: string;
  totalTickets: number;
  resolvidos: number;
  reabertos: number;
  transferidos: number;
  csatMedio: number | null;
  resolucaoPercentual: number;
}

interface EvidenciaDiagnostico {
  padrao: string;
  ocorrencias: number;
  impacto: string;
  conclusaoIa: string;
}

interface PlanoTreinamento {
  tema: string;
  prioridade: 'alta' | 'media' | 'baixa';
  motivo: string;
  evidencias: string;
}

interface DiagnosticoData {
  agentId: string;
  agentName: string;
  periodo: { inicio: string; fim: string; dias: number };
  resumo: {
    totalTickets: number;
    totalAvaliacoes: number;
    ticketsComTreinamento: number;
    csatMedio: number | null;
    notaIaMedia: number;
    classificacaoGeral: string;
    fcr: number | null;
    taxaResolucao: number | null;
    reaberturas: number;
    transferencias: number;
  };
  diagnosticoIa: string;
  diagnosticoConsolidado: string;
  necessidadePrincipal: { area: string; prioridade: string; confianca: number; motivo: string; detalhe: string } | null;
  classificacaoNecessidade: { categoria: string; icone: string; descricao: string } | null;
  necessidades: Necessidade[];
  assuntoTreinamento: { assunto: string; totalTickets: number; ticketsComDificuldade: number; transferencias: number; reaberturas: number; csatMedio: number | null; fcr: number | null } | null;
  raciocinioIa: string[];
  naoProblema: Array<{ area: string; icone: string; texto: string }>;
  causaProbavel: { tipo: string; label: string; descricao: string; recomendacao: string };
  competencias: Competencia[];
  ticketsAnalisados: TicketDiagnostico[];
  ondeEstaDificuldade: DificuldadeAssunto[];
  evidencias: EvidenciaDiagnostico[];
  separacao: { fatos: string[]; interpretacaoIa: string[]; recomendacao: string[] };
  planoTreinamento: PlanoTreinamento[];
  treinamentoRecomendado: { titulo: string; prioridade: string; objetivo: string; motivo: string; evidencias: string } | null;
  confianca: number;
  confiancaExplicacao: string;
  problemaNaoEhDoAnalista: string | null;
  evolucao: { antes: any; depois: any; temHistorico: boolean };
}

function Section({ title, icon: Icon, children, defaultOpen = false, badge }: { title: string; icon: any; children: React.ReactNode; defaultOpen?: boolean; badge?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-gray-500 dark:text-gray-400" />
          <span className="font-medium text-sm text-gray-800 dark:text-gray-200">{title}</span>
          {badge && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400">{badge}</span>}
        </div>
        {open ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
      </button>
      {open && <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">{children}</div>}
    </div>
  );
}

function PrioridadeBadge({ prioridade }: { prioridade: string }) {
  const colors: Record<string, string> = {
    alta: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    media: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    baixa: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  };
  const icons: Record<string, string> = { alta: '🔴', media: '🟡', baixa: '🟢' };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[prioridade] || colors.media}`}>{icons[prioridade] || ''} {prioridade}</span>;
}

function CompetenciaBar({ competencia }: { competencia: Competencia }) {
  const colors: Record<string, string> = { otimo: 'bg-green-500', bom: 'bg-blue-500', atencao: 'bg-amber-500', critico: 'bg-red-500' };
  const textColors: Record<string, string> = { otimo: 'text-green-700 dark:text-green-400', bom: 'text-blue-700 dark:text-blue-400', atencao: 'text-amber-700 dark:text-amber-400', critico: 'text-red-700 dark:text-red-400' };
  const labels: Record<string, string> = { otimo: 'Bom', bom: 'Adequado', atencao: 'Atenção', critico: 'Crítico' };
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-700 dark:text-gray-300 w-36 shrink-0">{competencia.nome}</span>
      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${colors[competencia.situacao]}`} style={{ width: `${competencia.percentual}%` }} />
      </div>
      <span className={`text-sm font-medium w-20 text-right ${textColors[competencia.situacao]}`}>{competencia.percentual}% <span className="text-[10px] opacity-70">{labels[competencia.situacao]}</span></span>
    </div>
  );
}

function CausaTipoIcon({ tipo }: { tipo: string }) {
  const map: Record<string, { icon: any; label: string; color: string }> = {
    analista: { icon: Users, label: 'Analista', color: 'text-amber-600 dark:text-amber-400' },
    sistema: { icon: Zap, label: 'Sistema', color: 'text-red-600 dark:text-red-400' },
    desenvolvimento: { icon: Code, label: 'Desenvolvimento', color: 'text-blue-600 dark:text-blue-400' },
    base_conhecimento: { icon: BookOpen, label: 'Base de Conhecimento', color: 'text-violet-600 dark:text-violet-400' },
    processo: { icon: FileText, label: 'Processo', color: 'text-emerald-600 dark:text-emerald-400' },
    cliente: { icon: MessageSquare, label: 'Cliente', color: 'text-gray-600 dark:text-gray-400' },
  };
  const info = map[tipo] || map.analista;
  const Icon = info.icon;
  return <span className={`inline-flex items-center gap-1 ${info.color}`}><Icon size={14} /> {info.label}</span>;
}

function Code(props: any) { return <FileText {...props} />; }

export default function DiagnosticoDrawer({ open, onClose, agentId, agentName, dias = 30 }: DiagnosticoDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DiagnosticoData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDiagnostico = useCallback(async () => {
    if (!open || !agentId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/ai/agent-monitor/diagnostico-treinamento/${agentId}?dias=${dias}`);
      setData(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Erro ao carregar diagnóstico');
    } finally {
      setLoading(false);
    }
  }, [open, agentId, dias]);

  useEffect(() => { fetchDiagnostico(); }, [fetchDiagnostico]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
      window.addEventListener('keydown', handleEsc);
      return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', handleEsc); };
    }
  }, [open, onClose]);

  if (!open) return null;

  const formatDate = (s: string) => new Date(s).toLocaleDateString('pt-BR');

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl bg-white dark:bg-gray-900 shadow-2xl flex flex-col animate-slide-in-right overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-violet-600 to-indigo-600">
          <div className="flex items-center gap-3">
            <GraduationCap size={24} className="text-white" />
            <div>
              <h2 className="text-lg font-bold text-white">Diagnóstico de Treinamento</h2>
              <p className="text-sm text-white/80">{data?.agentName || agentName || 'Carregando...'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors"><X size={20} className="text-white" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
              <span className="ml-3 text-gray-500">Gerando diagnóstico detalhado...</span>
            </div>
          )}
          {error && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-400 text-sm">{error}</div>}
          {data && !loading && (
            <>
              {/* RESUMO */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <CardResumo label="Tickets" value={data.resumo.totalTickets} />
                <CardResumo label="Avaliações" value={data.resumo.totalAvaliacoes} />
                <CardResumo label="CSAT" value={data.resumo.csatMedio != null ? `${data.resumo.csatMedio}` : '—'} sub="/5" />
                <CardResumo label={<><AcronymTooltip acronym="FCR" /></>} value={data.resumo.fcr != null ? `${data.resumo.fcr}%` : '—'} />
                <CardResumo label="Reaberturas" value={data.resumo.reaberturas} />
              </div>

              {/* DIAGNÓSTICO CONSOLIDADO */}
              <Section title="Diagnóstico de Desempenho" icon={Brain} defaultOpen badge="Consolidado">
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{data.diagnosticoConsolidado}</p>
                {data.problemaNaoEhDoAnalista && (
                  <div className="mt-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm text-blue-700 dark:text-blue-400">
                    ⚠️ {data.problemaNaoEhDoAnalista}
                  </div>
                )}
              </Section>

              {/* PRINCIPAL NECESSIDADE */}
              {data.necessidadePrincipal && (
                <Section title="Principal Necessidade Identificada" icon={Target} defaultOpen>
                  <div className="bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-900/20 dark:to-indigo-900/20 rounded-lg p-4 border border-violet-200 dark:border-violet-800">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{data.classificacaoNecessidade?.icone || '📌'}</span>
                      <span className="font-bold text-gray-800 dark:text-gray-200">{data.necessidadePrincipal.area}</span>
                      <PrioridadeBadge prioridade={data.necessidadePrincipal.prioridade} />
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{data.necessidadePrincipal.motivo}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>Confiança: <span className="font-bold text-violet-600 dark:text-violet-400">{data.necessidadePrincipal.confianca}%</span></span>
                    </div>
                  </div>
                </Section>
              )}

              {/* CLASSIFICAÇÃO DA NECESSIDADE */}
              {data.classificacaoNecessidade && (
                <Section title="Classificação da Necessidade" icon={BookOpen}>
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span>{data.classificacaoNecessidade.icone}</span>
                      <span className="font-medium text-sm text-gray-800 dark:text-gray-200">{data.classificacaoNecessidade.categoria}</span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{data.classificacaoNecessidade.descricao}</p>
                  </div>
                </Section>
              )}

              {/* ASSUNTO QUE NECESSITA TREINAMENTO */}
              {data.assuntoTreinamento && (
                <Section title="Assunto que Necessita Treinamento" icon={AlertTriangle} badge={data.assuntoTreinamento.assunto}>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <MetricCard label="Tickets analisados" value={data.assuntoTreinamento.totalTickets} />
                    <MetricCard label="Com dificuldade" value={data.assuntoTreinamento.ticketsComDificuldade} color="text-red-600 dark:text-red-400" />
                    <MetricCard label="Transferências" value={data.assuntoTreinamento.transferencias} color="text-amber-600 dark:text-amber-400" />
                    <MetricCard label="Reaberturas" value={data.assuntoTreinamento.reaberturas} color="text-amber-600 dark:text-amber-400" />
                    <MetricCard label="CSAT médio" value={data.assuntoTreinamento.csatMedio != null ? `${data.assuntoTreinamento.csatMedio}` : '—'} sub="/5" />
                    <MetricCard label={<><AcronymTooltip acronym="FCR" /></>} value={data.assuntoTreinamento.fcr != null ? `${data.assuntoTreinamento.fcr}%` : '—'} />
                  </div>
                </Section>
              )}

              {/* POR QUE A IA CHEGOU A ESSA CONCLUSÃO */}
              {data.raciocinioIa.length > 0 && (
                <Section title="Por que a IA chegou a essa conclusão?" icon={Lightbulb} defaultOpen>
                  <div className="space-y-2">
                    {data.raciocinioIa.map((r, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <span className="text-violet-500 mt-0.5">•</span>
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* O QUE NÃO É PROBLEMA */}
              {data.naoProblema.length > 0 && (
                <Section title="Áreas Adequadas (sem necessidade de treinamento)" icon={CheckCircle}>
                  <div className="space-y-2">
                    {data.naoProblema.map((np, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <span>{np.icone}</span>
                        <div>
                          <span className="font-medium text-gray-800 dark:text-gray-200">{np.area}</span>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{np.texto}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* CAUSA PROVÁVEL */}
              <Section title="Causa Provável" icon={Shield}>
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CausaTipoIcon tipo={data.causaProbavel.tipo} />
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">{data.causaProbavel.descricao}</p>
                  <p className="text-xs text-violet-600 dark:text-violet-400 font-medium">→ {data.causaProbavel.recomendacao}</p>
                </div>
              </Section>

              {/* TICKETS QUE INFLUENCIARAM */}
              {data.ticketsAnalisados.length > 0 && (
                <Section title={`Tickets que Influenciaram o Diagnóstico (${data.ticketsAnalisados.length})`} icon={Ticket}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                          <th className="pb-2 font-medium">Ticket</th>
                          <th className="pb-2 font-medium">Assunto</th>
                          <th className="pb-2 font-medium">Resultado</th>
                          <th className="pb-2 font-medium text-center"><AcronymTooltip acronym="CSAT" /></th>
                          <th className="pb-2 font-medium">Evidência</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.ticketsAnalisados.map((t, i) => (
                          <tr key={i} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <td className="py-2">
                              <a href={`/app/helpdesk/ticket/${t.ticketId}`} target="_blank" rel="noopener" className="text-violet-600 dark:text-violet-400 hover:underline font-medium">{t.protocolo || t.ticketId.slice(0, 8)}</a>
                            </td>
                            <td className="py-2 text-gray-600 dark:text-gray-400">{t.assunto || '—'}</td>
                            <td className="py-2">
                              <span className={`text-xs px-1.5 py-0.5 rounded ${t.reaberto ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : t.transferido ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}`}>
                                {t.reaberto ? 'Reaberto' : t.transferido ? 'Transferido' : t.resultado}
                              </span>
                            </td>
                            <td className="py-2 text-center">
                              {t.csat != null ? <span className={`text-xs px-1.5 py-0.5 rounded ${t.csat >= 4 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : t.csat >= 3 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>{t.csat}</span> : <span className="text-gray-400">—</span>}
                            </td>
                            <td className="py-2 text-xs text-gray-500 dark:text-gray-400 max-w-[200px] truncate">{t.evidencia || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Section>
              )}

              {/* COMPETÊNCIAS */}
              {data.competencias.some((c) => c.percentual > 0) && (
                <Section title="Avaliação de Competências" icon={BarChart3}>
                  <div className="space-y-2">
                    {data.competencias.filter((c) => c.percentual > 0).map((c, i) => (
                      <CompetenciaBar key={i} competencia={c} />
                    ))}
                  </div>
                </Section>
              )}

              {/* TREINAMENTO RECOMENDADO */}
              {data.treinamentoRecomendado && (
                <Section title="Treinamento Recomendado" icon={GraduationCap} defaultOpen>
                  <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-lg p-4 border border-emerald-200 dark:border-emerald-800">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-bold text-gray-800 dark:text-gray-200">{data.treinamentoRecomendado.titulo}</span>
                      <PrioridadeBadge prioridade={data.treinamentoRecomendado.prioridade} />
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1"><strong>Objetivo:</strong> {data.treinamentoRecomendado.objetivo}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1"><strong>Motivo:</strong> {data.treinamentoRecomendado.motivo}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">Evidências: {data.treinamentoRecomendado.evidencias}</p>
                  </div>
                </Section>
              )}

              {/* PLANO RECOMENDADO */}
              {data.planoTreinamento.length > 0 && (
                <Section title="Plano Recomendado" icon={FileText}>
                  <div className="space-y-2">
                    {data.planoTreinamento.map((p, i) => (
                      <div key={i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <span className="text-sm font-bold text-gray-400 w-6">{i + 1}.</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-gray-800 dark:text-gray-200">{p.tema}</span>
                            <PrioridadeBadge prioridade={p.prioridade} />
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{p.motivo}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* EVOLUÇÃO */}
              {data.evolucao.temHistorico && data.evolucao.antes && data.evolucao.depois && (
                <Section title="Evolução" icon={TrendingUp}>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-red-50 dark:bg-red-900/10 rounded-lg p-3 border border-red-200 dark:border-red-800">
                      <h4 className="text-xs font-bold text-red-600 dark:text-red-400 mb-2">ANTES</h4>
                      <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                        <div><AcronymTooltip acronym="CSAT" />: {data.evolucao.antes.csat ?? '—'}</div>
                        <div><AcronymTooltip acronym="FCR" />: {data.evolucao.antes.fcr != null ? `${data.evolucao.antes.fcr}%` : '—'}</div>
                        <div>Resolução: {data.evolucao.antes.resolucao != null ? `${data.evolucao.antes.resolucao}%` : '—'}</div>
                        <div>Reaberturas: {data.evolucao.antes.reaberturas}</div>
                      </div>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/10 rounded-lg p-3 border border-green-200 dark:border-green-800">
                      <h4 className="text-xs font-bold text-green-600 dark:text-green-400 mb-2">DEPOIS</h4>
                      <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                        <div><AcronymTooltip acronym="CSAT" />: {data.evolucao.depois.csat ?? '—'}</div>
                        <div><AcronymTooltip acronym="FCR" />: {data.evolucao.depois.fcr != null ? `${data.evolucao.depois.fcr}%` : '—'}</div>
                        <div>Resolução: {data.evolucao.depois.resolucao != null ? `${data.evolucao.depois.resolucao}%` : '—'}</div>
                        <div>Reaberturas: {data.evolucao.depois.reaberturas}</div>
                      </div>
                    </div>
                  </div>
                </Section>
              )}

              {/* COMO CHEGAMOS A ESSA CONCLUSÃO */}
              <Section title="Separando Dados / Interpretação / Recomendação" icon={Lightbulb}>
                <div className="space-y-3">
                  {data.separacao.fatos.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">📊 Dados Observados</h4>
                      <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">{data.separacao.fatos.map((f, i) => <li key={i}>• {f}</li>)}</ul>
                    </div>
                  )}
                  {data.separacao.interpretacaoIa.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">🤖 Interpretação da IA</h4>
                      <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">{data.separacao.interpretacaoIa.map((i, idx) => <li key={idx}>• {i}</li>)}</ul>
                    </div>
                  )}
                  {data.separacao.recomendacao.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">💡 Recomendação</h4>
                      <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">{data.separacao.recomendacao.map((r, i) => <li key={i}>• {r}</li>)}</ul>
                    </div>
                  )}
                </div>
              </Section>

              {/* CONFIANÇA */}
              <Section title="Confiança da Análise" icon={Target}>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${data.confianca >= 70 ? 'bg-green-500' : data.confianca >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${data.confianca}%` }} />
                    </div>
                    <span className="text-lg font-bold text-gray-800 dark:text-gray-200">{data.confianca}%</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{data.confiancaExplicacao}</p>
                </div>
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CardResumo({ label, value, sub }: { label: React.ReactNode; value: React.ReactNode; sub?: string }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 text-center">
      <div className="text-xl font-bold text-gray-800 dark:text-gray-200">{value}{sub && <span className="text-sm font-normal text-gray-500">{sub}</span>}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</div>
    </div>
  );
}

function MetricCard({ label, value, sub, color }: { label: React.ReactNode; value: React.ReactNode; sub?: string; color?: string }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
      <div className={`text-lg font-bold ${color || 'text-gray-800 dark:text-gray-200'}`}>{value}{sub && <span className="text-xs font-normal text-gray-500">{sub}</span>}</div>
      <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{label}</div>
    </div>
  );
}
