import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import {
  Loader2, AlertTriangle, Sparkles, Gauge, ShieldAlert, TrendingUp,
  RotateCcw, Repeat, Star, Users, Building2, Layers, Activity, RefreshCw,
  FileText, ClipboardList, Calendar,
} from 'lucide-react';
import ReportActions from '../../components/reports/ReportActions';
import ReportKpiCard from '../../components/reports/ReportKpiCard';
import { AcronymText } from '../../components/AcronymText';

interface Panorama {
  periodo: { inicio: string | null; fim: string | null };
  indicadores: any;
  rankingAnalistas: any[];
  topClientesRisco: any[];
  topAssuntos: any[];
  padroesGlobais: any[];
  alertasGerenciais: Array<{ tipo: string; mensagem: string; gravidade: string }>;
}

const CLASS_CONFIG: Record<string, { label: string; cor: string; bg: string }> = {
  EXCELENTE: { label: 'Excelente', cor: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/40' },
  MUITO_BOM: { label: 'Muito Bom', cor: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-100 dark:bg-teal-900/40' },
  BOM: { label: 'Bom', cor: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/40' },
  ATENCAO: { label: 'Atenção', cor: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/40' },
  ABAIXO_DA_MEDIA: { label: 'Abaixo da Média', cor: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/40' },
  CRITICO: { label: 'Crítico', cor: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/40' },
};

const GRAVIDADE_CONFIG: Record<string, { label: string; badge: string }> = {
  baixa: { label: 'Baixa', badge: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  media: { label: 'Média', badge: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300' },
  alta: { label: 'Alta', badge: 'bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300' },
  critica: { label: 'Crítica', badge: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300' },
};

const RESOLUCAO_LABEL: Record<string, string> = {
  RESOLVIDO: 'Resolvido',
  PROVAVELMENTE_RESOLVIDO: 'Provável',
  PARCIALMENTE_RESOLVIDO: 'Parcial',
  NAO_RESOLVIDO: 'Não resolvido',
  SEM_CONFIRMACAO: 'Sem confirmação',
  REABERTO: 'Reaberto',
  TRANSFERIDO: 'Transferido',
  PRECISOU_DE_DESENVOLVIMENTO: 'Precisou de dev',
  IMPLANTACAO: 'Implantação',
  OUTRO_SETOR: 'Outro setor',
};

const PADRAO_LABEL: Record<string, string> = {
  EVENTO_ISOLADO: 'Evento isolado',
  PADRAO_RECORRENTE: 'Padrão recorrente',
  PROBLEMA_FREQUENTE: 'Problema frequente',
  PROBLEMA_CRITICO: 'Problema crítico',
  PROBLEMA_SISTEMICO: 'Problema sistêmico',
};

function notaBarra(nota: number): string {
  if (nota >= 80) return 'bg-emerald-500';
  if (nota >= 60) return 'bg-amber-500';
  if (nota >= 40) return 'bg-orange-500';
  return 'bg-red-500';
}

export default function AuditoriaGeralPage() {
  const [panorama, setPanorama] = useState<Panorama | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dias, setDias] = useState('30');

  const carregar = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/auditoria/panorama', { params: { dias } });
      setPanorama(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao carregar o panorama de auditoria');
    } finally {
      setLoading(false);
    }
  }, [dias]);

  useEffect(() => { carregar(); }, [carregar]);

  const ind = panorama?.indicadores;

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>
            Auditoria Geral
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
            Panorama consolidado das auditorias IA · analistas, clientes, assuntos e padrões
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={dias}
            onChange={(e) => setDias(e.target.value)}
            className="input w-auto text-sm"
          >
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
          </select>
          <ReportActions onRefresh={carregar} onPrint={() => window.print()} />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="animate-spin text-indigo-500" size={28} />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-40 gap-2 text-red-500">
          <AlertTriangle size={28} />
          <p className="text-sm" style={{ fontFamily: 'Lexend, sans-serif' }}>{error}</p>
        </div>
      ) : !ind ? (
        <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-400">
          <FileText size={28} />
          <p className="text-sm" style={{ fontFamily: 'Lexend, sans-serif' }}>
            Nenhuma auditoria no período. As auditorias são geradas automaticamente ao encerrar tickets.
          </p>
        </div>
      ) : (
        <>
          {/* Alertas gerenciais */}
          {panorama!.alertasGerenciais.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {panorama!.alertasGerenciais.map((a, i) => {
                const g = GRAVIDADE_CONFIG[a.gravidade] || GRAVIDADE_CONFIG.media;
                return (
                  <div key={i} className={`rounded-xl border p-4 ${g.badge}`} style={{ fontFamily: 'Lexend, sans-serif' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <ShieldAlert size={15} />
                      <span className="text-[10px] font-bold uppercase tracking-wide">{g.label}</span>
                    </div>
                    <p className="text-sm font-semibold">{a.mensagem}</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* KPIs principais */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 print:grid-cols-4">
            <ReportKpiCard label="Auditorias no período" valor={ind.totalAuditadas} icon={Sparkles} cor="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300" />
            <ReportKpiCard label="Cobertura" valor={`${ind.cobertura || 0}%`} icon={Activity} cor="bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300" />
            <ReportKpiCard label="Nota média" valor={`${ind.notaGeralMedia || 0}/100`} icon={Gauge} cor="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300" />
            <ReportKpiCard label="Classificação" valor={(CLASS_CONFIG[ind.classificacaoGeral]?.label) || ind.classificacaoGeral || '—'} icon={ClipboardList} cor="bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300" />
          </div>

          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 print:grid-cols-4">
            <ReportKpiCard label="Taxa de resolução" valor={`${ind.taxaResolucao || 0}%`} icon={TrendingUp} cor="bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-300" />
            <ReportKpiCard label="Reabertura" valor={`${ind.taxaReabertura || 0}%`} icon={RotateCcw} cor={ind.taxaReabertura > 20 ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300'} />
            <ReportKpiCard label="Retrabalho" valor={`${ind.taxaRetrabalho || 0}%`} icon={Repeat} cor="bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300" />
            <ReportKpiCard label="CSAT médio" valor={ind.csatMedia != null ? ind.csatMedia.toFixed(1) : '—'} icon={Star} cor="bg-yellow-100 text-yellow-600 dark:bg-yellow-900/40 dark:text-yellow-300" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Ranking de analistas */}
            <div className="card">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
                <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                  <Users size={14} className="text-blue-600 dark:text-blue-400" />
                </div>
                Ranking de Analistas
              </h3>
              {panorama!.rankingAnalistas.length === 0 ? (
                <p className="text-sm text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>Sem dados no período.</p>
              ) : (
                <div className="space-y-3">
                  {panorama!.rankingAnalistas.map((a) => {
                    const c = CLASS_CONFIG[a.classificacao] || CLASS_CONFIG.ATENCAO;
                    return (
                      <div key={a.agenteId} className="rounded-xl border border-slate-100 dark:border-slate-700 p-3.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Lexend, sans-serif' }}>{a.agenteNome}</span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.bg} ${c.cor}`} style={{ fontFamily: 'Lexend, sans-serif' }}>
                            {c.label}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-slate-500 dark:text-slate-400 w-16" style={{ fontFamily: 'Lexend, sans-serif' }}>{a.notaGeralMedia}/100</span>
                          <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${notaBarra(a.notaGeralMedia)}`} style={{ width: `${a.notaGeralMedia}%` }} />
                          </div>
                          <span className="text-xs text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>{a.totalAuditadas} auditadas</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
                          <span className="flex items-center gap-1"><TrendingUp size={12} /> Resolução {a.taxaResolucao}%</span>
                          <span className="flex items-center gap-1"><RotateCcw size={12} /> Reabertura {a.taxaReabertura}%</span>
                          <span className="flex items-center gap-1"><Repeat size={12} /> Retrabalho {a.taxaRetrabalho}%</span>
                           {a.csatMedia != null && <span className="flex items-center gap-1"><Star size={12} /> <AcronymText text="CSAT" /> {a.csatMedia.toFixed(1)}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Distribuições */}
            <div className="card">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
                <div className="w-7 h-7 rounded-lg bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center">
                  <Layers size={14} className="text-violet-600 dark:text-violet-400" />
                </div>
                Distribuições
              </h3>
              <div className="space-y-5">
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2" style={{ fontFamily: 'Lexend, sans-serif' }}>Classificação geral</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(ind.distribuicaoClassificacao || {}).map(([k, v]) => {
                      const c = CLASS_CONFIG[k] || CLASS_CONFIG.ATENCAO;
                      return (
                        <span key={k} className={`text-xs font-semibold px-2.5 py-1 rounded-full ${c.bg} ${c.cor}`} style={{ fontFamily: 'Lexend, sans-serif' }}>
                          {c.label} · {v as number}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2" style={{ fontFamily: 'Lexend, sans-serif' }}>Resolução</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(ind.distribuicaoResolucao || {}).map(([k, v]) => (
                      <span key={k} className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" style={{ fontFamily: 'Lexend, sans-serif' }}>
                        {RESOLUCAO_LABEL[k] || k} · {v as number}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2" style={{ fontFamily: 'Lexend, sans-serif' }}>Padrões</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(ind.distribuicaoPadrao || {}).map(([k, v]) => (
                      <span key={k} className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" style={{ fontFamily: 'Lexend, sans-serif' }}>
                        {PADRAO_LABEL[k] || k} · {v as number}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Clientes em risco */}
            <div className="card">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
                <div className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
                  <Building2 size={14} className="text-red-600 dark:text-red-400" />
                </div>
                Clientes em Risco
              </h3>
              {panorama!.topClientesRisco.length === 0 ? (
                <p className="text-sm text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>Sem clientes em risco no período.</p>
              ) : (
                <div className="space-y-3">
                  {panorama!.topClientesRisco.map((c, i) => (
                    <div key={i} className="rounded-xl border border-red-100 dark:border-red-900/40 bg-red-50/40 dark:bg-red-900/10 p-3.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Lexend, sans-serif' }}>{c.clienteNome}</span>
                        <span className="text-xs font-bold text-red-600 dark:text-red-400" style={{ fontFamily: 'Lexend, sans-serif' }}>{c.riscoInsatisfacao}</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-3 text-[11px] text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
                        <span className="flex items-center gap-1"><Gauge size={12} /> Nota {c.notaGeralMedia}/100</span>
                        <span className="flex items-center gap-1"><RotateCcw size={12} /> Reabertura {c.taxaReabertura}%</span>
                        <span className="flex items-center gap-1"><Activity size={12} /> {c.totalAuditadas} auditadas</span>
                      </div>
                      {c.principaisProblemas?.length > 0 && (
                        <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
                          {c.principaisProblemas.map((p: any) => p.descricao).join(' · ')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Assuntos recorrentes */}
            <div className="card">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
                <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
                  <Calendar size={14} className="text-amber-600 dark:text-amber-400" />
                </div>
                Assuntos Recorrentes
              </h3>
              {panorama!.topAssuntos.length === 0 ? (
                <p className="text-sm text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>Sem assuntos no período.</p>
              ) : (
                <div className="space-y-3">
                  {panorama!.topAssuntos.map((a, i) => (
                    <div key={i} className="rounded-xl border border-slate-100 dark:border-slate-700 p-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Lexend, sans-serif' }}>{a.categoria}</span>
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>{a.totalAuditadas}</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-3 text-[11px] text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
                        <span className="flex items-center gap-1"><Gauge size={12} /> Nota {a.notaGeralMedia}/100</span>
                        <span className="flex items-center gap-1"><TrendingUp size={12} /> Resolução {a.taxaResolucao}%</span>
                        <span className="flex items-center gap-1"><RotateCcw size={12} /> Reabertura {a.taxaReabertura}%</span>
                        <span className="flex items-center gap-1"><Layers size={12} /> {PADRAO_LABEL[a.padrao] || a.padrao}</span>
                      </div>
                      {a.principaisProblemas?.length > 0 && (
                        <p className="mt-1.5 text-[11px] text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
                          {a.principaisProblemas.map((p: any) => p.descricao).join(' · ')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Padrões globais */}
            <div className="card lg:col-span-2">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
                <div className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
                  <ShieldAlert size={14} className="text-red-600 dark:text-red-400" />
                </div>
                Padrões Globais
              </h3>
              {panorama!.padroesGlobais.length === 0 ? (
                <p className="text-sm text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>Sem padrões identificados no período.</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {panorama!.padroesGlobais.map((p, i) => {
                    const g = GRAVIDADE_CONFIG[p.gravidade] || GRAVIDADE_CONFIG.media;
                    return (
                      <div key={i} className="rounded-xl border border-slate-100 dark:border-slate-700 p-3.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Lexend, sans-serif' }}>{p.descricao}</span>
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${g.badge}`} style={{ fontFamily: 'Lexend, sans-serif' }}>{g.label}</span>
                        </div>
                        <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
                          {p.ocorrencias} ocorrência(s) · {PADRAO_LABEL[p.padrao] || p.padrao}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
            <RefreshCw size={13} />
            <span>
              Atualizado em {new Date(panorama!.periodo?.fim || Date.now()).toLocaleDateString('pt-BR')} · Custo médio operacional {ind.custoOperacionalMedioMin || 0} min · <AcronymText text="CSAT" /> médio {ind.csatMedia != null ? ind.csatMedia.toFixed(1) : '—'}
            </span>
          </div>
        </>
      )}
    </div>
  );
}