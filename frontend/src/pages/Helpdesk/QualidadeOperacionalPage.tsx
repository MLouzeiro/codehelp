import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import {
  RefreshCw, Loader2, RotateCcw, Repeat, RefreshCcw, Target,
  AlertTriangle, TrendingUp, TrendingDown, Lightbulb, GraduationCap,
  Wrench, BookOpen, Settings2, Users as UsersIcon, X,
} from 'lucide-react';
import { AcronymText } from '../../components/AcronymText';
import type {
  QualidadeOperacional,
  CardQualidade,
  AlertaQualidade,
  SugestaoQualidade,
  ReaberturaDetalhe,
  ProblemaRecorrente,
  RetrabalhoDetalhe,
  DiagnosticoIa,
} from '../../types';

const PRESETS = [
  { label: 'Hoje', dias: 1 },
  { label: '7 dias', dias: 7 },
  { label: '30 dias', dias: 30 },
  { label: 'Mês atual', dias: new Date().getDate() },
];

function classPill(c: CardQualidade['classificacao']) {
  switch (c.estado) {
    case 'fora': return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border border-red-200 dark:border-red-800';
    case 'atencao': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800';
    default: return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800';
  }
}

function DeltaPill({ delta, invertido }: { delta: number | null; invertido?: boolean }) {
  if (delta === null) return null;
  const melhora = invertido ? delta < 0 : delta > 0;
  const cor = melhora
    ? 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30'
    : delta === 0
      ? 'text-slate-500 bg-slate-100 dark:text-slate-400 dark:bg-slate-800'
      : 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/30';
  const Icon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cor}`}>
      {Icon && <Icon size={12} />}
      {delta > 0 ? '+' : ''}{delta}%
    </span>
  );
}

const ALERT_ICONS: Record<string, any> = {
  RotateCcw, Repeat, RefreshCcw, Target, AlertTriangle,
};

const SUGESTAO_ICONS: Record<string, any> = {
  treinamento: GraduationCap,
  desenvolvimento: Wrench,
  base_conhecimento: BookOpen,
  processo: Settings2,
  automacao: RefreshCcw,
  gestao: UsersIcon,
};

const SUGESTAO_COLORS: Record<string, string> = {
  treinamento: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  desenvolvimento: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  base_conhecimento: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  processo: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  automacao: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  gestao: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
};

const PRIORIDADE_COLORS: Record<string, string> = {
  alta: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  media: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  baixa: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
};

export default function QualidadeOperacionalPage() {
  const [dados, setDados] = useState<QualidadeOperacional | null>(null);
  const [loading, setLoading] = useState(true);
  const [dias, setDias] = useState(30);
  const [carregando, setCarregando] = useState(false);

  // Modals
  const [modalReabertura, setModalReabertura] = useState(false);
  const [reaberturaDetalhe, setReaberturaDetalhe] = useState<ReaberturaDetalhe[]>([]);
  const [loadingDetalhe, setLoadingDetalhe] = useState(false);

  const [modalRecorrencia, setModalRecorrencia] = useState(false);
  const [recorrenciaDetalhe, setRecorrenciaDetalhe] = useState<ProblemaRecorrente | null>(null);
  const [problemaSelecionado, setProblemaSelecionado] = useState<string>('');

  const [modalRetrabalho, setModalRetrabalho] = useState(false);
  const [retrabalhoDetalhe, setRetrabalhoDetalhe] = useState<RetrabalhoDetalhe[]>([]);

  const [modalDiagnostico, setModalDiagnostico] = useState(false);
  const [diagnostico, setDiagnostico] = useState<DiagnosticoIa | null>(null);
  const [diagnosticoTipo, setDiagnosticoTipo] = useState<string>('');

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    try {
      const { data } = await api.get(`/helpdesk/qualidade?dias=${dias}`);
      setDados(data);
    } catch (err) {
      console.error('Erro ao carregar qualidade:', err);
    } finally {
      setLoading(false);
      setCarregando(false);
    }
  }, [dias]);

  useEffect(() => { carregarDados(); }, [carregarDados]);

  const abrirReabertura = async () => {
    setLoadingDetalhe(true);
    setModalReabertura(true);
    try {
      const { data } = await api.get(`/helpdesk/qualidade/reaberturas?dias=${dias}`);
      setReaberturaDetalhe(data);
    } catch { setReaberturaDetalhe([]); }
    setLoadingDetalhe(false);
  };

  const abrirRecorrencia = async (problema?: string) => {
    if (problema) setProblemaSelecionado(problema);
    setLoadingDetalhe(true);
    setModalRecorrencia(true);
    try {
      const params = new URLSearchParams({ dias: String(dias) });
      if (problema) params.append('problema', problema);
      const { data } = await api.get(`/helpdesk/qualidade/recorrencia?${params}`);
      setRecorrenciaDetalhe(data);
    } catch { setRecorrenciaDetalhe(null); }
    setLoadingDetalhe(false);
  };

  const abrirRetrabalho = async () => {
    setLoadingDetalhe(true);
    setModalRetrabalho(true);
    try {
      const { data } = await api.get(`/helpdesk/qualidade/retrabalho?dias=${dias}`);
      setRetrabalhoDetalhe(data);
    } catch { setRetrabalhoDetalhe([]); }
    setLoadingDetalhe(false);
  };

  const abrirDiagnostico = async (tipo: string) => {
    setLoadingDetalhe(true);
    setDiagnosticoTipo(tipo);
    setModalDiagnostico(true);
    try {
      const { data } = await api.get(`/helpdesk/qualidade/diagnostico/${tipo}?dias=${dias}`);
      setDiagnostico(data);
    } catch { setDiagnostico(null); }
    setLoadingDetalhe(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!dados) {
    return (
      <div className="text-center py-16 text-slate-400">
        <p>Dados não disponíveis</p>
      </div>
    );
  }

  const cards: CardQualidade[] = [
    {
      label: 'Reaberturas',
      valor: dados.reaberturas.total,
      unidade: 'chamados',
      percentual: dados.reaberturas.percentual,
      classificacao: dados.reaberturas.percentual <= 5
        ? { estado: 'dentro', icone: '🟢', texto: 'Baixa' }
        : dados.reaberturas.percentual <= 15
          ? { estado: 'atencao', icone: '🟡', texto: 'Moderada' }
          : { estado: 'fora', icone: '🔴', texto: 'Alta' },
      delta: dados.reaberturas.delta,
      deltaLabel: 'vs período anterior',
    },
    {
      label: 'Recorrência',
      valor: dados.recorrencia.total,
      unidade: 'chamados',
      percentual: dados.recorrencia.percentual,
      classificacao: dados.recorrencia.percentual <= 10
        ? { estado: 'dentro', icone: '🟢', texto: 'Baixa' }
        : dados.recorrencia.percentual <= 25
          ? { estado: 'atencao', icone: '🟡', texto: 'Moderada' }
          : { estado: 'fora', icone: '🔴', texto: 'Alta' },
      delta: dados.recorrencia.delta,
      deltaLabel: 'vs período anterior',
    },
    {
      label: 'Retrabalho',
      valor: `${dados.retrabalho.percentual}%`,
      unidade: `${dados.retrabalho.total} casos`,
      percentual: dados.retrabalho.percentual,
      classificacao: dados.retrabalho.percentual <= 5
        ? { estado: 'dentro', icone: '🟢', texto: 'Dentro da meta' }
        : dados.retrabalho.percentual <= 10
          ? { estado: 'atencao', icone: '🟡', texto: 'Atenção' }
          : { estado: 'fora', icone: '🔴', texto: 'Acima da meta' },
      delta: dados.retrabalho.delta,
      deltaLabel: 'vs período anterior',
    },
    {
      label: 'FCR',
      valor: `${dados.fcr.percentual}%`,
      unidade: `${dados.fcr.resolvidos}/${dados.fcr.total}`,
      percentual: dados.fcr.percentual,
      classificacao: dados.fcr.percentual >= 70
        ? { estado: 'dentro', icone: '🟢', texto: 'Bom' }
        : dados.fcr.percentual >= 60
          ? { estado: 'atencao', icone: '🟡', texto: 'Atenção' }
          : { estado: 'fora', icone: '🔴', texto: 'Abaixo da meta' },
      delta: dados.fcr.delta,
      deltaLabel: 'vs período anterior',
    },
  ];

  const formatTempo = (min: number) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Qualidade Operacional</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Indicadores de qualidade, reaberturas, recorrência, retrabalho e FCR
          </p>
        </div>
        <div className="flex items-center gap-2">
          {PRESETS.map(p => (
            <button
              key={p.dias}
              onClick={() => setDias(p.dias)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                dias === p.dias
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-slate-600'
              }`}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={carregarDados}
            disabled={carregando}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
          >
            <RefreshCw size={16} className={`text-slate-600 dark:text-slate-400 ${carregando ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Cards de Indicadores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, i) => {
          const icons = [RotateCcw, Repeat, RefreshCcw, Target];
          const Icon = icons[i];
          return (
            <button
              key={card.label}
              onClick={() => {
                if (card.label === 'Reaberturas') abrirReabertura();
                else if (card.label === 'Recorrência') abrirRecorrencia();
                else if (card.label === 'Retrabalho') abrirRetrabalho();
                else abrirDiagnostico('fcr');
              }}
              className="text-left rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 flex flex-col gap-2 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                <Icon size={14} className="text-blue-600 dark:text-blue-400" />
                <AcronymText text={card.label} />
              </div>
              <div className="flex items-end justify-between gap-2">
                <div>
                  <span className="text-2xl font-bold text-slate-900 dark:text-white" style={{ fontFamily: 'Khand, sans-serif' }}>
                    {card.valor}
                  </span>
                  <span className="ml-1 text-sm font-medium text-slate-400 dark:text-slate-500">{card.unidade}</span>
                </div>
                <DeltaPill delta={card.delta} invertido={card.label !== 'FCR'} />
              </div>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold w-fit ${classPill(card.classificacao)}`}>
                {card.classificacao.icone} {card.classificacao.texto}
              </span>
            </button>
          );
        })}
      </div>

      {/* Retrabalho extra info */}
      {dados.retrabalho.tempoAdicionalMin > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <RefreshCcw size={16} className="text-amber-500" />
            <span className="font-medium">Tempo adicional de retrabalho:</span>
            <span className="font-bold text-slate-900 dark:text-white">{formatTempo(dados.retrabalho.tempoAdicionalMin)}</span>
          </div>
        </div>
      )}

      {/* Alertas de Qualidade */}
      {dados.alertas.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-500" />
            Alertas de Qualidade
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {dados.alertas.map((alerta, i) => {
              const AlertIcon = ALERT_ICONS[alerta.icone] || AlertTriangle;
              const nivelCor = alerta.nivel === 'critico'
                ? 'border-l-red-500 bg-red-50 dark:bg-red-900/20'
                : alerta.nivel === 'atencao'
                  ? 'border-l-amber-500 bg-amber-50 dark:bg-amber-900/20'
                  : 'border-l-blue-500 bg-blue-50 dark:bg-blue-900/20';
              return (
                <div key={i} className={`rounded-xl border border-slate-200 dark:border-slate-700 border-l-4 p-4 ${nivelCor}`}>
                  <div className="flex items-start gap-3">
                    <AlertIcon size={18} className={`mt-0.5 flex-shrink-0 ${
                      alerta.nivel === 'critico' ? 'text-red-500' : alerta.nivel === 'atencao' ? 'text-amber-500' : 'text-blue-500'
                    }`} />
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm text-slate-900 dark:text-white">{alerta.titulo}</h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{alerta.mensagem}</p>
                      <span className="inline-block mt-1 text-xs font-medium text-slate-500 dark:text-slate-500">
                        {alerta.contagem} ocorrência(s)
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sugestões de Melhoria */}
      {dados.sugestoes.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Lightbulb size={18} className="text-yellow-500" />
            Sugestões de Melhoria
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {dados.sugestoes.map((sug, i) => {
              const SugIcon = SUGESTAO_ICONS[sug.categoria] || Lightbulb;
              return (
                <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${SUGESTAO_COLORS[sug.categoria] || 'bg-slate-100 text-slate-600'}`}>
                      <SugIcon size={12} />
                      {sug.categoria.replace('_', ' ')}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${PRIORIDADE_COLORS[sug.prioridade]}`}>
                      {sug.prioridade}
                    </span>
                  </div>
                  <h3 className="font-semibold text-sm text-slate-900 dark:text-white">{sug.titulo}</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">{sug.diagnostico}</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">{sug.sugestao}</p>
                  {sug.ocorrencias > 0 && (
                    <span className="text-xs text-slate-500 dark:text-slate-500">{sug.ocorrencias} ocorrência(s)</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Problemas Recorrentes */}
      {dados.recorrencia.problemas.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Repeat size={18} className="text-purple-500" />
            Problemas Mais Recorrentes
          </h2>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 dark:bg-slate-900 dark:border-slate-700">
                  <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Problema</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Ocorrências</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Clientes</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Retrabalho</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Ação</th>
                </tr>
              </thead>
              <tbody>
                {dados.recorrencia.problemas.slice(0, 10).map((p, i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-700/50 dark:hover:bg-slate-700">
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-900 dark:text-white">{p.problema}</span>
                      {p.categoria && (
                        <span className="ml-2 text-xs text-slate-500 dark:text-slate-500">({p.categoria})</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-bold text-slate-900 dark:text-white">{p.ocorrencias}</span>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-400">{p.clientesAfetados}</td>
                    <td className="px-4 py-3 text-center">
                      {p.retrabalho > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          {p.retrabalho}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => abrirRecorrencia(p.problema)}
                        className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                      >
                        Detalhar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Retrabalho por Analista */}
      {dados.retrabalho.porAnalista.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <RefreshCcw size={18} className="text-amber-500" />
            Retrabalho por Analista
          </h2>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 dark:bg-slate-900 dark:border-slate-700">
                  <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Analista</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Casos</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Tempo</th>
                </tr>
              </thead>
              <tbody>
                {dados.retrabalho.porAnalista.slice(0, 10).map((a, i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-700/50 dark:hover:bg-slate-700">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{a.agenteNome}</td>
                    <td className="px-4 py-3 text-center font-bold text-slate-900 dark:text-white">{a.total}</td>
                    <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-400">{formatTempo(a.tempoMin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Botão de Diagnóstico IA */}
      <div className="flex gap-2 flex-wrap">
        {['reabertura', 'recorrencia', 'retrabalho', 'fcr'].map(tipo => (
          <button
            key={tipo}
            onClick={() => abrirDiagnostico(tipo)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 transition-colors"
          >
            <Lightbulb size={14} />
            Diagnóstico IA — {tipo === 'fcr' ? 'FCR' : tipo.charAt(0).toUpperCase() + tipo.slice(1)}
          </button>
        ))}
      </div>

      {/* ═══════════ MODALS ═══════════ */}

      {/* Modal Reabertura */}
      {modalReabertura && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setModalReabertura(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">🔄 Chamados Reabertos</h2>
              <button onClick={() => setModalReabertura(false)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {loadingDetalhe ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
              ) : reaberturaDetalhe.length === 0 ? (
                <p className="text-center py-8 text-slate-400">Nenhuma reabertura encontrada no período.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left px-3 py-2 font-medium text-slate-500 dark:text-slate-400">Protocolo</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-500 dark:text-slate-400">Cliente</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-500 dark:text-slate-400">Analista</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-500 dark:text-slate-400">Categoria</th>
                      <th className="text-center px-3 py-2 font-medium text-slate-500 dark:text-slate-400">Reaberturas</th>
                      <th className="text-center px-3 py-2 font-medium text-slate-500 dark:text-slate-400">CSAT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reaberturaDetalhe.map((r, i) => (
                      <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-700/50 dark:hover:bg-slate-700">
                        <td className="px-3 py-2 font-mono text-xs text-slate-900 dark:text-white">{r.protocolo || r.ticketId.slice(0, 8)}</td>
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{r.clientNome || r.contactName || '—'}</td>
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{r.agenteNome || '—'}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{r.categoria || '—'}</td>
                        <td className="px-3 py-2 text-center">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs font-bold">
                            {r.totalReaberturas}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center text-slate-600 dark:text-slate-400">{r.csatNota ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Recorrência */}
      {modalRecorrencia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setModalRecorrencia(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">🔁 Recorrência — {problemaSelecionado || 'Todos'}</h2>
              <button onClick={() => setModalRecorrencia(false)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {loadingDetalhe ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
              ) : !recorrenciaDetalhe ? (
                <p className="text-center py-8 text-slate-400">Problema não encontrado.</p>
              ) : (
                <div className="space-y-4">
                  <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4">
                    <h3 className="font-semibold text-slate-900 dark:text-white">{recorrenciaDetalhe.problema}</h3>
                    <div className="flex gap-4 mt-2 text-sm text-slate-600 dark:text-slate-400">
                      <span>{recorrenciaDetalhe.ocorrencias} ocorrências</span>
                      <span>{recorrenciaDetalhe.clientesAfetados} cliente(s)</span>
                      {recorrenciaDetalhe.retrabalho > 0 && <span className="text-amber-600">{recorrenciaDetalhe.retrabalho} retrabalho(s)</span>}
                    </div>
                  </div>
                  {recorrenciaDetalhe.clientes.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm text-slate-700 dark:text-slate-300 mb-2">Clientes afetados:</h4>
                      {recorrenciaDetalhe.clientes.map((c, i) => (
                        <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
                          <span className="text-sm text-slate-900 dark:text-white">{c.nome}</span>
                          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{c.quantidade} chamado(s)</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Retrabalho */}
      {modalRetrabalho && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setModalRetrabalho(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">♻️ Retrabalho</h2>
              <button onClick={() => setModalRetrabalho(false)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {loadingDetalhe ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
              ) : retrabalhoDetalhe.length === 0 ? (
                <p className="text-center py-8 text-slate-400">Nenhum caso de retrabalho encontrado.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left px-3 py-2 font-medium text-slate-500 dark:text-slate-400">Protocolo</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-500 dark:text-slate-400">Cliente</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-500 dark:text-slate-400">Analista</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-500 dark:text-slate-400">Motivo</th>
                      <th className="text-center px-3 py-2 font-medium text-slate-500 dark:text-slate-400">Tempo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {retrabalhoDetalhe.map((r, i) => (
                      <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-700/50 dark:hover:bg-slate-700">
                        <td className="px-3 py-2 font-mono text-xs text-slate-900 dark:text-white">{r.protocolo || r.ticketId.slice(0, 8)}</td>
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{r.contactName || '—'}</td>
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{r.agenteNome || '—'}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{r.motivo}</td>
                        <td className="px-3 py-2 text-center text-slate-600 dark:text-slate-400">{formatTempo(r.tempoMin)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Diagnóstico IA */}
      {modalDiagnostico && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setModalDiagnostico(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">💡 Como chegamos a essa conclusão?</h2>
              <button onClick={() => setModalDiagnostico(false)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {loadingDetalhe ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
              ) : !diagnostico ? (
                <p className="text-center py-8 text-slate-400">Diagnóstico não disponível.</p>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-2">📊 Dados analisados</h3>
                    <ul className="space-y-1">
                      {diagnostico.dadosAnalisados.map((d, i) => (
                        <li key={i} className="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-2">
                          <span className="text-blue-500 mt-1">•</span> {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {diagnostico.evidencias.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white mb-2">🔍 Evidências</h3>
                      <ul className="space-y-1">
                        {diagnostico.evidencias.map((e, i) => (
                          <li key={i} className="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-2">
                            <span className="text-amber-500 mt-1">•</span> {e}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                    <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-1">📌 Conclusão</h3>
                    <p className="text-sm text-blue-800 dark:text-blue-200">{diagnostico.conclusao}</p>
                  </div>
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4">
                    <h3 className="font-semibold text-emerald-900 dark:text-emerald-300 mb-1">✅ Recomendação</h3>
                    <p className="text-sm text-emerald-800 dark:text-emerald-200">{diagnostico.recomendacao}</p>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-500">
                    Fonte: {diagnostico.modelo}
                    {diagnostico.confianca !== null && ` • Confiança: ${diagnostico.confianca}%`}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
