import { useState, useEffect, useCallback } from 'react';
import {
  X,
  ShieldAlert,
  AlertTriangle,
  BellRing,
  TrendingUp,
  TrendingDown,
  Users,
  User,
  Tag,
  FileText,
  BarChart3,
  Lightbulb,
  Target,
  Activity,
  Loader2,
  Brain,
} from 'lucide-react';
import api from '../services/api';

interface DetalheAlerta {
  tipo: string;
  titulo: string;
  nivel: string;
  periodo: { inicio: string; fim: string; dias: number };
  valorAtual: number | string;
  meta: number | string;
  diferenca: number | string;
  percentualDiferenca: number;
  totalAmostra: number;
  regra: string;
  calculo: string;
  dadosAnalise: Record<string, number>;
  fatoresPrincipais: Array<{ icone: string; texto: string; nivel: string }>;
  porAnalista: Array<{ nome: string; tickets: number; csat: number; sla: number; fcr: number }>;
  porCliente: Array<{ nome: string; tickets: number; csat: number; reaberturas: number; sla: number }>;
  porCategoria: Array<{ categoria: string; tickets: number; csat: number; tempoMedio: number; sla: number; resolucao: number; fcr: number }>;
  chamadosRelacionados: Array<{ id: string; protocolo: string; cliente: string; analista: string; categoria: string; csat: number; sla: number; tempo: string; status: string }>;
  evolucao: Array<{ data: string; valor: number }>;
  comparativo: { atual: number; anterior: number; variacao: number } | null;
  recomendacoes: Array<{ prioridade: 'alta' | 'media' | 'baixa'; titulo: string; descricao: string; acao: string }>;
  analiseIa: { diagnostico: string; causas: string[]; impacto: string; recomendacao: string; confianca: number } | null;
}

interface AlertDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  tipo: string;
  dias: number;
}

function nivelIcon(tipo: string) {
  const icons: Record<string, React.ReactNode> = {
    sla_violado: <ShieldAlert className="w-4 h-4" />,
    sla_em_risco: <AlertTriangle className="w-4 h-4" />,
    aguardando_resposta: <BellRing className="w-4 h-4" />,
    volume_alto: <TrendingUp className="w-4 h-4" />,
    csat_baixo: <TrendingDown className="w-4 h-4" />,
    parado: <Activity className="w-4 h-4" />,
  };
  return icons[tipo] || <BellRing className="w-4 h-4" />;
}

function nivelBadgeClasses(nivel: string): string {
  switch (nivel) {
    case 'critico':
      return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
    case 'atencao':
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
    default:
      return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
  }
}

function CardValor({ label, valor, icon, destaque }: { label: string; valor: React.ReactNode; icon: React.ReactNode; destaque?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${destaque ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
      <div className="flex items-center gap-2 mb-2 text-slate-500 dark:text-slate-400">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wider" style={{ fontFamily: 'Lexend, sans-serif' }}>{label}</span>
      </div>
      <div className="text-2xl font-bold text-slate-900 dark:text-white" style={{ fontFamily: 'Khand, sans-serif' }}>{valor}</div>
    </div>
  );
}

function Section({ title, icon, id, expanded, onToggle, children }: {
  title: string; icon: React.ReactNode; id: string; expanded: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-blue-500 dark:text-blue-400">{icon}</span>
          <span className="font-semibold text-slate-800 dark:text-white" style={{ fontFamily: 'Khand, sans-serif' }}>{title}</span>
        </div>
        <svg
          className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-700">{children}</div>}
    </div>
  );
}

function NotaBadge({ valor, max }: { valor: number; max?: number }) {
  const m = max || 5;
  const pct = (valor / m) * 100;
  let cls = 'bg-red-500/10 text-red-600 dark:text-red-400';
  if (pct >= 80) cls = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
  else if (pct >= 60) cls = 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {typeof valor === 'number' ? valor.toFixed(1) : valor}{max ? `/${max}` : ''}
    </span>
  );
}

function PercentBadge({ valor }: { valor: number }) {
  let cls = 'bg-red-500/10 text-red-600 dark:text-red-400';
  if (valor >= 80) cls = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
  else if (valor >= 60) cls = 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {valor.toFixed(1)}%
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    aberto: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    em_atendimento: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    aguardando_cliente: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    aguardando_os: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    concluido: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    descartado: 'bg-slate-500/10 text-slate-500 dark:text-slate-400',
  };
  const cls = map[status] || 'bg-slate-500/10 text-slate-500 dark:text-slate-400';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function formatValor(v: number | string): string {
  if (typeof v === 'string') return v;
  if (Number.isInteger(v)) return v.toLocaleString('pt-BR');
  return v.toFixed(1);
}

function prioridadeCor(p: string): string {
  if (p === 'alta') return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
  if (p === 'media') return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
  return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
}

export default function AlertDetailDrawer({ open, onClose, tipo, dias }: AlertDetailDrawerProps) {
  const [dados, setDados] = useState<DetalheAlerta | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [secoes, setSecoes] = useState<Record<string, boolean>>({
    valor: true,
    calculo: false,
    fatores: false,
    analista: false,
    cliente: false,
    categoria: false,
    chamados: false,
    evolucao: false,
    comparativo: false,
    recomendacoes: false,
    ia: false,
  });

  const buscar = useCallback(async () => {
    if (!open || !tipo) return;
    setCarregando(true);
    setErro(null);
    try {
      const { data } = await api.get('/analytics/alert-detail', { params: { tipo, dias } });
      setDados(data);
    } catch (err: any) {
      setErro(err?.response?.data?.message || 'Falha ao carregar detalhes do alerta');
    } finally {
      setCarregando(false);
    }
  }, [open, tipo, dias]);

  useEffect(() => {
    if (open) {
      buscar();
      document.body.style.overflow = 'hidden';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open, buscar]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const toggleSecao = (id: string) => setSecoes((prev) => ({ ...prev, [id]: !prev[id] }));

  if (!open) return null;

  const maxEvolucao = dados?.evolucao?.length
    ? Math.max(...dados.evolucao.map((e) => e.valor), 1)
    : 1;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 shadow-2xl flex flex-col overflow-hidden animate-slide-in-right">
        <style>{`
          @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
          .animate-slide-in-right { animation: slideInRight 0.3s ease-out; }
        `}</style>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-blue-500 dark:text-blue-400 shrink-0">{nivelIcon(tipo)}</span>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate" style={{ fontFamily: 'Khand, sans-serif' }}>
                {dados?.titulo || tipo.replace(/_/g, ' ')}
              </h2>
              {dados && (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${nivelBadgeClasses(dados.nivel)}`}>
                    {dados.nivel}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
                    {dados.periodo.dias}d &middot; {dados.periodo.inicio} a {dados.periodo.fim}
                  </span>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4" style={{ fontFamily: 'Lexend, sans-serif' }}>
          {carregando && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              <span className="text-sm text-slate-500 dark:text-slate-400">Carregando detalhes...</span>
            </div>
          )}

          {erro && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <AlertTriangle className="w-8 h-8 text-red-500" />
              <span className="text-sm text-red-600 dark:text-red-400">{erro}</span>
              <button
                onClick={buscar}
                className="px-4 py-2 text-sm font-medium bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors"
              >
                Tentar novamente
              </button>
            </div>
          )}

          {dados && (
            <>
              {/* Valor Cards */}
              <Section title="Valores" icon={<Target className="w-4 h-4" />} id="valor" expanded={secoes.valor} onToggle={() => toggleSecao('valor')}>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <CardValor label="Valor Atual" valor={formatValor(dados.valorAtual)} icon={<Activity className="w-4 h-4" />} destaque />
                  <CardValor label="Meta" valor={formatValor(dados.meta)} icon={<Target className="w-4 h-4" />} />
                  <CardValor label="Diferença" valor={<span className={typeof dados.diferenca === 'number' ? (dados.diferenca > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400') : ''}>{formatValor(dados.diferenca)}</span>} icon={<BarChart3 className="w-4 h-4" />} />
                  <CardValor label="Amostra" valor={`${dados.totalAmostra} tickets`} icon={<FileText className="w-4 h-4" />} />
                </div>
              </Section>

              {/* Cálculo */}
              <Section title="Cálculo" icon={<BarChart3 className="w-4 h-4" />} id="calculo" expanded={secoes.calculo} onToggle={() => toggleSecao('calculo')}>
                <div className="space-y-3">
                  <div>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Regra</span>
                    <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">{dados.regra}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cálculo</span>
                    <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">{dados.calculo}</p>
                  </div>
                  {Object.keys(dados.dadosAnalise).length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Dados da Análise</span>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {Object.entries(dados.dadosAnalise).map(([chave, valor]) => (
                          <div key={chave} className="bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2 border border-slate-200 dark:border-slate-700">
                            <span className="text-xs text-slate-500 dark:text-slate-400 capitalize">{chave.replace(/_/g, ' ')}</span>
                            <div className="text-sm font-semibold text-slate-800 dark:text-white">{formatValor(valor)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Section>

              {/* Fatores Principais */}
              <Section title="Fatores Principais" icon={<Lightbulb className="w-4 h-4" />} id="fatores" expanded={secoes.fatores} onToggle={() => toggleSecao('fatores')}>
                {dados.fatoresPrincipais.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum fator identificado.</p>
                ) : (
                  <div className="space-y-2">
                    {dados.fatoresPrincipais.map((f, i) => (
                      <div key={i} className="flex items-start gap-3 bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-3 border border-slate-200 dark:border-slate-700">
                        <span className="text-lg shrink-0 mt-0.5">{f.icone}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-700 dark:text-slate-300">{f.texto}</p>
                          <span className={`inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-xs font-medium border ${nivelBadgeClasses(f.nivel)}`}>
                            {f.nivel}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* Por Analista */}
              <Section title="Por Analista" icon={<User className="w-4 h-4" />} id="analista" expanded={secoes.analista} onToggle={() => toggleSecao('analista')}>
                {dados.porAnalista.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">Sem dados por analista.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          <th className="pb-2 pr-4">Analista</th>
                          <th className="pb-2 pr-4 text-right">Tickets</th>
                          <th className="pb-2 pr-4 text-right">CSAT</th>
                          <th className="pb-2 pr-4 text-right">SLA</th>
                          <th className="pb-2 text-right">FCR</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {dados.porAnalista.map((a, i) => (
                          <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="py-2.5 pr-4 text-slate-800 dark:text-white font-medium">{a.nome}</td>
                            <td className="py-2.5 pr-4 text-right text-slate-600 dark:text-slate-300">{a.tickets}</td>
                            <td className="py-2.5 pr-4 text-right"><NotaBadge valor={a.csat} /></td>
                            <td className="py-2.5 pr-4 text-right"><PercentBadge valor={a.sla} /></td>
                            <td className="py-2.5 text-right"><PercentBadge valor={a.fcr} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>

              {/* Por Cliente */}
              <Section title="Por Cliente" icon={<Users className="w-4 h-4" />} id="cliente" expanded={secoes.cliente} onToggle={() => toggleSecao('cliente')}>
                {dados.porCliente.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">Sem dados por cliente.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          <th className="pb-2 pr-4">Cliente</th>
                          <th className="pb-2 pr-4 text-right">Tickets</th>
                          <th className="pb-2 pr-4 text-right">CSAT</th>
                          <th className="pb-2 pr-4 text-right">Reaberturas</th>
                          <th className="pb-2 text-right">SLA</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {dados.porCliente.map((c, i) => (
                          <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="py-2.5 pr-4 text-slate-800 dark:text-white font-medium">{c.nome}</td>
                            <td className="py-2.5 pr-4 text-right text-slate-600 dark:text-slate-300">{c.tickets}</td>
                            <td className="py-2.5 pr-4 text-right"><NotaBadge valor={c.csat} /></td>
                            <td className="py-2.5 pr-4 text-right text-slate-600 dark:text-slate-300">{c.reaberturas}</td>
                            <td className="py-2.5 text-right"><PercentBadge valor={c.sla} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>

              {/* Por Categoria */}
              <Section title="Por Categoria" icon={<Tag className="w-4 h-4" />} id="categoria" expanded={secoes.categoria} onToggle={() => toggleSecao('categoria')}>
                {dados.porCategoria.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">Sem dados por categoria.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          <th className="pb-2 pr-4">Categoria</th>
                          <th className="pb-2 pr-4 text-right">Tickets</th>
                          <th className="pb-2 pr-4 text-right">CSAT</th>
                          <th className="pb-2 pr-4 text-right">Tempo Médio</th>
                          <th className="pb-2 pr-4 text-right">SLA</th>
                          <th className="pb-2 pr-4 text-right">Resolução</th>
                          <th className="pb-2 text-right">FCR</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {dados.porCategoria.map((cat, i) => (
                          <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="py-2.5 pr-4 text-slate-800 dark:text-white font-medium">{cat.categoria}</td>
                            <td className="py-2.5 pr-4 text-right text-slate-600 dark:text-slate-300">{cat.tickets}</td>
                            <td className="py-2.5 pr-4 text-right"><NotaBadge valor={cat.csat} /></td>
                            <td className="py-2.5 pr-4 text-right text-slate-600 dark:text-slate-300">{cat.tempoMedio}min</td>
                            <td className="py-2.5 pr-4 text-right"><PercentBadge valor={cat.sla} /></td>
                            <td className="py-2.5 pr-4 text-right"><PercentBadge valor={cat.resolucao} /></td>
                            <td className="py-2.5 text-right"><PercentBadge valor={cat.fcr} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>

              {/* Chamados Relacionados */}
              <Section title="Chamados Relacionados" icon={<FileText className="w-4 h-4" />} id="chamados" expanded={secoes.chamados} onToggle={() => toggleSecao('chamados')}>
                {dados.chamadosRelacionados.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum chamado relacionado.</p>
                ) : (
                  <div className="space-y-2">
                    {dados.chamadosRelacionados.map((ch, i) => (
                      <div key={i} className="bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-3 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold text-slate-800 dark:text-white">#{ch.protocolo}</span>
                          <StatusBadge status={ch.status} />
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
                          <span>Cliente: {ch.cliente}</span>
                          <span>Analista: {ch.analista}</span>
                          <span>Categoria: {ch.categoria}</span>
                          <span>Tempo: {ch.tempo}</span>
                          <span>CSAT: <NotaBadge valor={ch.csat} /></span>
                          <span>SLA: <PercentBadge valor={ch.sla} /></span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* Evolução */}
              <Section title="Evolução" icon={<BarChart3 className="w-4 h-4" />} id="evolucao" expanded={secoes.evolucao} onToggle={() => toggleSecao('evolucao')}>
                {dados.evolucao.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">Sem dados de evolução.</p>
                ) : (
                  <div className="flex items-end gap-1 h-40">
                    {dados.evolucao.map((e, i) => {
                      const pct = maxEvolucao > 0 ? (e.valor / maxEvolucao) * 100 : 0;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${e.data}: ${e.valor}`}>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">{e.valor}</span>
                          <div className="w-full bg-blue-500 dark:bg-blue-400 rounded-t-md transition-all" style={{ height: `${Math.max(pct, 2)}%` }} />
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate w-full text-center">{e.data.slice(5)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Section>

              {/* Comparativo */}
              {dados.comparativo && (
                <Section title="Comparativo" icon={<TrendingUp className="w-4 h-4" />} id="comparativo" expanded={secoes.comparativo} onToggle={() => toggleSecao('comparativo')}>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-3 border border-slate-200 dark:border-slate-700 text-center">
                      <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Atual</span>
                      <div className="text-xl font-bold text-slate-900 dark:text-white mt-1" style={{ fontFamily: 'Khand, sans-serif' }}>{formatValor(dados.comparativo.atual)}</div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-3 border border-slate-200 dark:border-slate-700 text-center">
                      <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Anterior</span>
                      <div className="text-xl font-bold text-slate-900 dark:text-white mt-1" style={{ fontFamily: 'Khand, sans-serif' }}>{formatValor(dados.comparativo.anterior)}</div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-3 border border-slate-200 dark:border-slate-700 text-center">
                      <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Variação</span>
                      <div className={`flex items-center justify-center gap-1 text-xl font-bold mt-1 ${dados.comparativo.variacao > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`} style={{ fontFamily: 'Khand, sans-serif' }}>
                        {dados.comparativo.variacao > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        {dados.comparativo.variacao > 0 ? '+' : ''}{dados.comparativo.variacao.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </Section>
              )}

              {/* Recomendações */}
              <Section title="Recomendações" icon={<Lightbulb className="w-4 h-4" />} id="recomendacoes" expanded={secoes.recomendacoes} onToggle={() => toggleSecao('recomendacoes')}>
                {dados.recomendacoes.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">Nenhuma recomendação disponível.</p>
                ) : (
                  <div className="space-y-3">
                    {dados.recomendacoes.map((rec, i) => (
                      <div key={i} className="bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-3 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${prioridadeCor(rec.prioridade)}`}>
                            {rec.prioridade}
                          </span>
                          <span className="text-sm font-semibold text-slate-800 dark:text-white">{rec.titulo}</span>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">{rec.descricao}</p>
                        <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">{rec.acao}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* Análise IA */}
              {dados.analiseIa && (
                <Section title="Análise IA" icon={<Brain className="w-4 h-4" />} id="ia" expanded={secoes.ia} onToggle={() => toggleSecao('ia')}>
                  <div className="space-y-4">
                    <div>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Diagnóstico</span>
                      <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">{dados.analiseIa.diagnostico}</p>
                    </div>
                    {dados.analiseIa.causas.length > 0 && (
                      <div>
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Causas</span>
                        <ul className="mt-1 space-y-1">
                          {dados.analiseIa.causas.map((c, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                              <span className="text-blue-500 dark:text-blue-400 mt-1">&#8226;</span>
                              {c}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Impacto</span>
                      <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">{dados.analiseIa.impacto}</p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Recomendação</span>
                      <p className="text-sm text-blue-600 dark:text-blue-400 font-medium mt-1">{dados.analiseIa.recomendacao}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 dark:text-slate-400">Confiança:</span>
                      <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                        <div
                          className="bg-blue-500 dark:bg-blue-400 h-2 rounded-full transition-all"
                          style={{ width: `${dados.analiseIa.confianca}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{dados.analiseIa.confianca}%</span>
                    </div>
                  </div>
                </Section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
