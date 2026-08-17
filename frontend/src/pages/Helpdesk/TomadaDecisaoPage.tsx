import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import {
  Loader2, AlertTriangle, HeartHandshake, FileText, TrendingUp, Target,
  User, ClipboardList, Flag, ArrowRight, RefreshCw, ListChecks, Sparkles,
} from 'lucide-react';
import ReportKpiCard from '../../components/reports/ReportKpiCard';

interface Recomendacao {
  id: string;
  descricao: string;
  prioridade: string;
  origem: string;
  meta: string;
  acao: string;
  acompanhamento: string;
  prazo: string;
}

interface PlanoAcaoItem {
  etapa: string;
  acoes: string[];
  prazo: string;
}

interface MetaSugerida {
  indicador: string;
  atual: number;
  meta: number;
  prazo: string;
}

interface TomadaDecisao {
  saudeAtendimento: 'BOA' | 'ATENCAO' | 'CRITICA';
  iconeSaude: string;
  notaGeralMedia: number;
  justificativa: string;
  resumoExecutivo: string;
  oQueGestorDeveFazer: string[];
  recomendacoes: Recomendacao[];
  planoAcao: PlanoAcaoItem[];
  metasSugeridas: MetaSugerida[];
  focosPorAnalista: Array<{ agenteNome: string; nota: number; principalMelhoria: string }>;
  padroesCriticos: Array<{ descricao: string; ocorrencias: number; gravidade: string }>;
}

const PRIORIDADE_CONFIG: Record<string, { label: string; badge: string }> = {
  baixa: { label: 'Baixa', badge: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  media: { label: 'Média', badge: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300' },
  alta: { label: 'Alta', badge: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300' },
  urgente: { label: 'Urgente', badge: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300' },
};

const SAUDE_CONFIG: Record<string, { label: string; card: string; badge: string; border: string }> = {
  BOA: { label: 'Saúde do Atendimento: BOA', card: 'from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-emerald-200 dark:border-emerald-800', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', border: 'border-emerald-300 dark:border-emerald-700' },
  ATENCAO: { label: 'Saúde do Atendimento: ATENÇÃO', card: 'from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-800', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', border: 'border-amber-300 dark:border-amber-700' },
  CRITICA: { label: 'Saúde do Atendimento: CRÍTICA', card: 'from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border-red-200 dark:border-red-800', badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300', border: 'border-red-300 dark:border-red-700' },
};

export default function TomadaDecisaoPage() {
  const [dados, setDados] = useState<TomadaDecisao | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/auditoria/decisao');
      setDados(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao carregar tomada de decisão');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-indigo-500" size={32} />
      </div>
    );
  }

  if (error || !dados) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-red-500">
        <AlertTriangle size={32} />
        <p className="text-sm" style={{ fontFamily: 'Lexend, sans-serif' }}>{error || 'Sem dados'}</p>
      </div>
    );
  }

  const saude = SAUDE_CONFIG[dados.saudeAtendimento];
  const prioridadeList = ['urgente', 'alta', 'media', 'baixa'];
  const recomendacoesOrdenadas = [...dados.recomendacoes].sort(
    (a, b) => prioridadeList.indexOf(a.prioridade) - prioridadeList.indexOf(b.prioridade)
  );

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>
            Tomada de Decisão
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
            Saúde do atendimento, recomendações automáticas e plano de ação para o gestor
          </p>
        </div>
        <button
          onClick={carregar}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl"
          style={{ fontFamily: 'Lexend, sans-serif' }}
        >
          <RefreshCw size={16} /> Atualizar
        </button>
      </div>

      {/* Card de saúde */}
      <div className={`rounded-2xl border p-6 bg-gradient-to-r ${saude.card}`}>
        <div className="flex items-start gap-4">
          <div className="text-4xl">{dados.iconeSaude}</div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>
                {saude.label}
              </h2>
              <span className={`text-xs font-semibold px-3 py-1 rounded-full ${saude.badge}`} style={{ fontFamily: 'Lexend, sans-serif' }}>
                Nota {dados.notaGeralMedia}/100
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300" style={{ fontFamily: 'Lexend, sans-serif' }}>
              {dados.justificativa}
            </p>
          </div>
        </div>
        <div className={`mt-4 p-4 rounded-xl bg-white/60 dark:bg-slate-900/40 border ${saude.border}`}>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200" style={{ fontFamily: 'Lexend, sans-serif' }}>
            <FileText size={16} /> Resumo executivo
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300" style={{ fontFamily: 'Lexend, sans-serif' }}>
            {dados.resumoExecutivo}
          </p>
        </div>
      </div>

      {/* O que o gestor deve fazer */}
      {dados.oQueGestorDeveFazer.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 print:break-inside-avoid">
          <div className="flex items-center gap-2 mb-3">
            <Flag className="text-indigo-500" size={18} />
            <h3 className="font-bold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>
              O que o gestor deve fazer?
            </h3>
          </div>
          <ul className="space-y-2">
            {dados.oQueGestorDeveFazer.map((acao, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300" style={{ fontFamily: 'Lexend, sans-serif' }}>
                <ArrowRight size={16} className="text-indigo-400 mt-0.5 shrink-0" /> {acao}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recomendações */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="text-amber-500" size={18} />
          <h3 className="font-bold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>
            Recomendações automáticas
          </h3>
        </div>
        <div className="grid gap-3 md:grid-cols-2 print:grid-cols-1">
          {recomendacoesOrdenadas.map((r) => {
            const p = PRIORIDADE_CONFIG[r.prioridade] || PRIORIDADE_CONFIG.media;
            return (
              <div key={r.id} className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 print:break-inside-avoid">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Lexend, sans-serif' }}>
                    {r.descricao}
                  </p>
                  <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${p.badge}`} style={{ fontFamily: 'Lexend, sans-serif' }}>
                    {p.label}
                  </span>
                </div>
                <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300" style={{ fontFamily: 'Lexend, sans-serif' }}>
                  <div className="flex gap-2"><Target size={15} className="text-emerald-500 mt-0.5 shrink-0" /><span><b>Meta:</b> {r.meta}</span></div>
                  <div className="flex gap-2"><ClipboardList size={15} className="text-blue-500 mt-0.5 shrink-0" /><span><b>Ação:</b> {r.acao}</span></div>
                  <div className="flex gap-2"><RefreshCw size={15} className="text-violet-500 mt-0.5 shrink-0" /><span><b>Acompanhamento:</b> {r.acompanhamento}</span></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Plano de ação + Metas */}
      <div className="grid gap-6 lg:grid-cols-2 print:grid-cols-1">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 print:break-inside-avoid">
          <div className="flex items-center gap-2 mb-3">
            <ListChecks className="text-emerald-500" size={18} />
            <h3 className="font-bold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>
              Plano de ação
            </h3>
          </div>
          <div className="space-y-4">
            {dados.planoAcao.map((p, i) => (
              <div key={i} className={`rounded-xl border p-3 ${i === 0 ? 'border-red-200 bg-red-50/50 dark:border-red-900/40 dark:bg-red-900/10' : i === 1 ? 'border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-900/10' : 'border-slate-200 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-900/30'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200" style={{ fontFamily: 'Lexend, sans-serif' }}>{p.etapa}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>{p.prazo}</span>
                </div>
                <ul className="mt-2 space-y-1">
                  {p.acoes.map((a, j) => (
                    <li key={j} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300" style={{ fontFamily: 'Lexend, sans-serif' }}>
                      <ArrowRight size={13} className="mt-0.5 shrink-0" /> {a}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 print:break-inside-avoid">
            <div className="flex items-center gap-2 mb-3">
              <Target className="text-indigo-500" size={18} />
              <h3 className="font-bold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>
                Metas sugeridas
              </h3>
            </div>
            <div className="space-y-3">
              {dados.metasSugeridas.map((m, i) => {
                const pct = m.meta > 0 ? Math.min(100, Math.round((m.atual / m.meta) * 100)) : 0;
                const atingida = m.atual >= m.meta;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between text-sm" style={{ fontFamily: 'Lexend, sans-serif' }}>
                      <span className="text-slate-700 dark:text-slate-200">{m.indicador}</span>
                      <span className={`font-semibold ${atingida ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                        {m.atual} → {m.meta} · {m.prazo}
                      </span>
                    </div>
                    <div className="mt-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${atingida ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {dados.focosPorAnalista.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 print:break-inside-avoid">
              <div className="flex items-center gap-2 mb-3">
                <User className="text-violet-500" size={18} />
                <h3 className="font-bold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>
                  Foco por analista
                </h3>
              </div>
              <div className="space-y-2">
                {dados.focosPorAnalista.map((f, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-slate-700 px-3 py-2 text-sm" style={{ fontFamily: 'Lexend, sans-serif' }}>
                    <div className="flex items-center gap-2">
                      <User size={15} className="text-slate-400" />
                      <span className="text-slate-700 dark:text-slate-200">{f.agenteNome}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`font-semibold ${f.nota >= 70 ? 'text-emerald-600 dark:text-emerald-400' : f.nota >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                        {f.nota}/100
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{f.principalMelhoria}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Padrões críticos */}
      {dados.padroesCriticos.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 print:break-inside-avoid">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="text-red-500" size={18} />
            <h3 className="font-bold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>
              Padrões críticos identificados
            </h3>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {dados.padroesCriticos.map((p, i) => (
              <div key={i} className="flex items-start gap-2 rounded-xl border border-red-100 dark:border-red-900/40 bg-red-50/50 dark:bg-red-900/10 px-3 py-2 text-sm" style={{ fontFamily: 'Lexend, sans-serif' }}>
                <AlertTriangle size={15} className="text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-slate-700 dark:text-slate-200">{p.descricao}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{p.ocorrencias} ocorrência(s) · gravidade {p.gravidade}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rodapé de confidencialidade */}
      <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500" style={{ fontFamily: 'Lexend, sans-serif' }}>
        <HeartHandshake size={14} />
        <span>As decisões pertencem ao gestor. A IA apenas sugere com base em evidências reais do atendimento.</span>
      </div>
    </div>
  );
}