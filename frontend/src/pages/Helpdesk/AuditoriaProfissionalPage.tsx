import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import {
  Loader2, AlertTriangle, CheckCircle, RotateCcw, Search, Eye, EyeOff,
  Sparkles, Gauge, ShieldAlert, ThumbsUp, ThumbsDown, RefreshCw, FileText,
  Download, FileSpreadsheet, Printer, User, Calendar, Target, ClipboardList, X,
} from 'lucide-react';
import ReportActions from '../../components/reports/ReportActions';
import ReportKpiCard from '../../components/reports/ReportKpiCard';

interface ItemFila {
  id: string;
  ticketId: string;
  protocolo: string | null;
  contactName: string | null;
  agenteNome: string | null;
  status: string;
  notaGeral: number;
  classificacao: string;
  auditadoEm: string;
  revisaoStatus: string | null;
  modeloUsado: string | null;
}

interface AuditoriaDetalhe {
  id: string;
  ticketId: string;
  protocolo: string | null;
  contactName: string | null;
  agenteNome: string | null;
  status: string;
  notaGeral: number;
  notaComunicacao: number;
  notaProfissionalismo: number;
  notaEmpatia: number;
  notaClareza: number;
  notaFormalidade: number;
  notaConhecimentoTecnico: number;
  notaDiagnostico: number;
  notaResolucao: number;
  notaGestaoTempo: number;
  notaProcesso: number;
  notaEncerramento: number;
  notaSeguranca: number;
  notaResponsabilidade: number;
  notaSatisfacaoCliente: number;
  classificacao: string;
  classificacaoResolucao: string;
  classificacaoEncerramento: string;
  padrao: string;
  confiancaMedia: number;
  analiseInconclusiva: boolean;
  resumoExecutivo: string | null;
  analiseQualitativa: string | null;
  explicacaoLeiga: string | null;
  evidenciaProblemas: any[];
  pontosFortes: any[];
  riscos: any[];
  recomendacoes: any[];
  planoMelhoria: any[];
  alertas: any[];
  riscoInsatisfacao: string;
  retrabalho: boolean;
  custoOperacionalMin: number | null;
  reaberto: boolean;
  numeroReaberturas: number;
  revisaoStatus: string | null;
  revisaoJustificativa: string | null;
  revisadoEm: string | null;
  modeloUsado: string | null;
  auditadoEm: string;
}

const CLASS_CONFIG: Record<string, { label: string; cor: string; bg: string; barra: string }> = {
  EXCELENTE: { label: 'Excelente', cor: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/40', barra: 'bg-emerald-500' },
  MUITO_BOM: { label: 'Muito Bom', cor: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-100 dark:bg-teal-900/40', barra: 'bg-teal-500' },
  BOM: { label: 'Bom', cor: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/40', barra: 'bg-blue-500' },
  ATENCAO: { label: 'Atenção', cor: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/40', barra: 'bg-amber-500' },
  ABAIXO_DA_MEDIA: { label: 'Abaixo da Média', cor: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/40', barra: 'bg-orange-500' },
  CRITICO: { label: 'Crítico', cor: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/40', barra: 'bg-red-500' },
};

const RESOLUCAO_LABEL: Record<string, string> = {
  RESOLVIDO: 'Resolvido',
  PROVAVELMENTE_RESOLVIDO: 'Provavelmente resolvido',
  PARCIALMENTE_RESOLVIDO: 'Parcialmente resolvido',
  NAO_RESOLVIDO: 'Não resolvido',
  SEM_CONFIRMACAO: 'Sem confirmação',
  REABERTO: 'Reaberto',
  TRANSFERIDO: 'Transferido',
  PRECISOU_DE_DESENVOLVIMENTO: 'Precisou de desenvolvimento',
  IMPLANTACAO: 'Implantação',
  OUTRO_SETOR: 'Outro setor',
};

const ENCERRAMENTO_LABEL: Record<string, string> = {
  ADEQUADO: 'Adequado',
  PARCIAL: 'Parcial',
  INADEQUADO: 'Inadequado',
  SEM_ENCERRAMENTO: 'Sem encerramento',
};

const PADRAO_LABEL: Record<string, string> = {
  EVENTO_ISOLADO: 'Evento isolado',
  PADRAO_RECORRENTE: 'Padrão recorrente',
  PROBLEMA_FREQUENTE: 'Problema frequente',
  PROBLEMA_CRITICO: 'Problema crítico',
  PROBLEMA_SISTEMICO: 'Problema sistêmico',
};

const CATEGORIAS_NOTAS: Array<{ campo: string; label: string }> = [
  { campo: 'notaComunicacao', label: 'Comunicação' },
  { campo: 'notaProfissionalismo', label: 'Profissionalismo' },
  { campo: 'notaEmpatia', label: 'Empatia' },
  { campo: 'notaClareza', label: 'Clareza' },
  { campo: 'notaFormalidade', label: 'Formalidade' },
  { campo: 'notaConhecimentoTecnico', label: 'Conhecimento técnico' },
  { campo: 'notaDiagnostico', label: 'Diagnóstico' },
  { campo: 'notaResolucao', label: 'Resolução' },
  { campo: 'notaGestaoTempo', label: 'Gestão do tempo' },
  { campo: 'notaProcesso', label: 'Processo' },
  { campo: 'notaEncerramento', label: 'Encerramento' },
  { campo: 'notaSeguranca', label: 'Segurança' },
  { campo: 'notaResponsabilidade', label: 'Responsabilidade' },
  { campo: 'notaSatisfacaoCliente', label: 'Satisfação do cliente' },
];

const GRAVIDADE_CONFIG: Record<string, { label: string; badge: string }> = {
  baixa: { label: 'Baixa', badge: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  media: { label: 'Média', badge: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300' },
  alta: { label: 'Alta', badge: 'bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300' },
  critica: { label: 'Crítica', badge: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300' },
};

const REVISAO_CONFIG: Record<string, { label: string; badge: string }> = {
  CONFIRMADO: { label: 'Confirmado', badge: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300' },
  DISCORDO: { label: 'Discordo', badge: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300' },
  REVISAR: { label: 'Revisar', badge: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300' },
  NAO_SE_APLICA: { label: 'N/A', badge: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
};

function parseLista(val: any): any[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try { const p = JSON.parse(val); return Array.isArray(p) ? p : []; } catch { return []; }
}

export default function AuditoriaProfissionalPage() {
  const [items, setItems] = useState<ItemFila[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busca, setBusca] = useState('');
  const [detalhe, setDetalhe] = useState<AuditoriaDetalhe | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [auditando, setAuditando] = useState(false);
  const [justificativa, setJustificativa] = useState('');
  const [filtrando, setFiltrando] = useState<string>('todos');

  const carregar = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/auditoria/list', { params: { limit: 200 } });
      setItems(data.items || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao carregar auditorias');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const abrirDetalhe = async (id: string) => {
    try {
      const { data } = await api.get(`/auditoria/${id}`);
      setDetalhe(data);
      setJustificativa('');
      setModalAberto(true);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao carregar auditoria');
    }
  };

  const auditarTicket = async (ticketId: string) => {
    setAuditando(true);
    try {
      const { data } = await api.post(`/auditoria/ticket/${ticketId}`);
      setDetalhe(data);
      setModalAberto(true);
      await carregar();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao auditar ticket');
    } finally {
      setAuditando(false);
    }
  };

  const revisar = async (status: string) => {
    if (!detalhe) return;
    if (status === 'DISCORDO' && !justificativa.trim()) {
      alert('Informe a justificativa ao discordar da auditoria.');
      return;
    }
    try {
      const { data } = await api.post(`/auditoria/${detalhe.id}/revisar`, {
        revisaoStatus: status,
        justificativa,
      });
      setDetalhe(data);
      await carregar();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao revisar auditoria');
    }
  };

  const exportar = async (tipo: 'csv' | 'excel') => {
    try {
      const resp = await api.get(`/auditoria/exportar/${tipo}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([resp.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `auditoria-ia.${tipo === 'csv' ? 'csv' : 'xlsx'}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao exportar');
    }
  };

  const filtrados = items.filter((i) => {
    if (filtrando !== 'todos' && i.classificacao !== filtrando) return false;
    if (!busca) return true;
    const q = busca.toLowerCase();
    return (i.contactName || '').toLowerCase().includes(q) ||
      (i.agenteNome || '').toLowerCase().includes(q) ||
      (i.protocolo || '').toLowerCase().includes(q);
  });

  const totalAnalisado = items.filter(i => i.status === 'ANALISADO').length;
  const mediaNota = totalAnalisado ? Math.round((items.reduce((a, b) => a + b.notaGeral, 0) / totalAnalisado) * 10) / 10 : 0;
  const criticos = items.filter(i => i.classificacao === 'CRITICO' || i.classificacao === 'ABAIXO_DA_MEDIA').length;
  const emRevisao = items.filter(i => i.revisaoStatus === 'REVISAR' || i.status === 'REVISAR').length;

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>
            Auditoria IA
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
            Auditoria profissional de atendimento por ticket · 14 categorias · evidências reais
          </p>
        </div>
        <ReportActions
          onRefresh={carregar}
          onCsv={() => exportar('csv')}
          onExcel={() => exportar('excel')}
          onPrint={() => window.print()}
        />
      </div>

      {/* KPIs */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 print:grid-cols-4">
        <ReportKpiCard label="Auditorias realizadas" valor={totalAnalisado} icon={Sparkles} cor="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300" />
        <ReportKpiCard label="Nota média" valor={mediaNota ? `${mediaNota}/100` : '—'} icon={Gauge} cor="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300" />
        <ReportKpiCard label="Críticas / abaixo da média" valor={criticos} icon={ShieldAlert} cor="bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300" />
        <ReportKpiCard label="Aguardando revisão" valor={emRevisao} icon={RefreshCw} cor="bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300" />
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap print:hidden">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por cliente, analista ou protocolo..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200"
            style={{ fontFamily: 'Lexend, sans-serif' }}
          />
        </div>
        <select
          value={filtrando}
          onChange={(e) => setFiltrando(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200"
          style={{ fontFamily: 'Lexend, sans-serif' }}
        >
          <option value="todos">Todas as classificações</option>
          {Object.entries(CLASS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
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
      ) : filtrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-400">
          <FileText size={28} />
          <p className="text-sm" style={{ fontFamily: 'Lexend, sans-serif' }}>
            Nenhuma auditoria encontrada. As auditorias são geradas automaticamente ao encerrar tickets ou via "Auditar amostra".
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
          <table className="w-full text-sm print:text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/40 text-left text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Analista</th>
                <th className="px-4 py-3">Nota</th>
                <th className="px-4 py-3">Classificação</th>
                <th className="px-4 py-3">Resolução</th>
                <th className="px-4 py-3">Revisão</th>
                <th className="px-4 py-3">Auditado em</th>
                <th className="px-4 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((i) => {
                const c = CLASS_CONFIG[i.classificacao] || CLASS_CONFIG.ATENCAO;
                const rv = i.revisaoStatus ? REVISAO_CONFIG[i.revisaoStatus] : null;
                return (
                  <tr key={i.id} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200" style={{ fontFamily: 'Lexend, sans-serif' }}>{i.contactName || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>{i.agenteNome || 'Não atribuído'}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Lexend, sans-serif' }}>{i.notaGeral}/100</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${c.bg} ${c.cor}`} style={{ fontFamily: 'Lexend, sans-serif' }}>
                        {c.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
                      {RESOLUCAO_LABEL[i.classificacao] || i.classificacao}
                    </td>
                    <td className="px-4 py-3">
                      {rv ? (
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${rv.badge}`} style={{ fontFamily: 'Lexend, sans-serif' }}>
                          {rv.label}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Pendente</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
                      {new Date(i.auditadoEm).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => abrirDetalhe(i.id)}
                        className="text-indigo-600 dark:text-indigo-400 hover:underline text-xs font-semibold"
                        style={{ fontFamily: 'Lexend, sans-serif' }}
                      >
                        Ver relatório
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de detalhe */}
      {modalAberto && detalhe && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4">
          <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl my-8">
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700">
              <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>
                  Auditoria {detalhe.protocolo || detalhe.ticketId.slice(0, 8)}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
                  {detalhe.contactName} · {detalhe.agenteNome || 'não atribuído'} · {new Date(detalhe.auditadoEm).toLocaleString('pt-BR')}
                </p>
              </div>
              <button onClick={() => setModalAberto(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Nota geral */}
              <div className={`flex items-center gap-4 rounded-2xl p-5 ${CLASS_CONFIG[detalhe.classificacao]?.bg}`}>
                <div className="text-4xl font-bold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>
                  {detalhe.notaGeral}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${CLASS_CONFIG[detalhe.classificacao]?.cor}`} style={{ fontFamily: 'Lexend, sans-serif' }}>
                      {CLASS_CONFIG[detalhe.classificacao]?.label}
                    </span>
                    {detalhe.analiseInconclusiva && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        Análise inconclusiva
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
                    Confiança média: {detalhe.confiancaMedia}% · Modelo: {detalhe.modeloUsado || 'n/a'}
                  </p>
                </div>
                <div className="text-right text-xs space-y-1 text-slate-600 dark:text-slate-300" style={{ fontFamily: 'Lexend, sans-serif' }}>
                  <div>Resolução: <b>{RESOLUCAO_LABEL[detalhe.classificacaoResolucao] || detalhe.classificacaoResolucao}</b></div>
                  <div>Encerramento: <b>{ENCERRAMENTO_LABEL[detalhe.classificacaoEncerramento] || detalhe.classificacaoEncerramento}</b></div>
                  <div>Padrão: <b>{PADRAO_LABEL[detalhe.padrao] || detalhe.padrao}</b></div>
                  <div>Risco insatisfação: <b>{detalhe.riscoInsatisfacao}</b></div>
                </div>
              </div>

              {/* Resumo executivo */}
              {detalhe.resumoExecutivo && (
                <div className="rounded-2xl border border-slate-100 dark:border-slate-700 p-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100 mb-2" style={{ fontFamily: 'Lexend, sans-serif' }}>
                    <FileText size={16} className="text-indigo-500" /> Resumo executivo
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300" style={{ fontFamily: 'Lexend, sans-serif' }}>{detalhe.resumoExecutivo}</p>
                </div>
              )}

              {/* Explicação para leigos */}
              {detalhe.explicacaoLeiga && (
                <div className="rounded-2xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-900/10 p-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-300 mb-2" style={{ fontFamily: 'Lexend, sans-serif' }}>
                    <Eye size={16} /> Em palavras simples
                  </div>
                  <p className="text-sm text-emerald-800 dark:text-emerald-200" style={{ fontFamily: 'Lexend, sans-serif' }}>{detalhe.explicacaoLeiga}</p>
                </div>
              )}

              {/* Análise qualitativa */}
              {detalhe.analiseQualitativa && (
                <div className="rounded-2xl border border-slate-100 dark:border-slate-700 p-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100 mb-2" style={{ fontFamily: 'Lexend, sans-serif' }}>
                    <Sparkles size={16} className="text-violet-500" /> Análise qualitativa
                  </div>
                  <pre className="text-sm whitespace-pre-wrap text-slate-600 dark:text-slate-300 font-sans" style={{ fontFamily: 'Lexend, sans-serif' }}>{detalhe.analiseQualitativa}</pre>
                </div>
              )}

              {/* 14 categorias */}
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3" style={{ fontFamily: 'Khand, sans-serif' }}>
                  14 Categorias (0-100)
                </h3>
                <div className="grid gap-3 md:grid-cols-2">
                  {CATEGORIAS_NOTAS.map((c) => {
                    const nota = (detalhe as any)[c.campo] || 0;
                    const barra = nota >= 80 ? 'bg-emerald-500' : nota >= 60 ? 'bg-amber-500' : nota >= 40 ? 'bg-orange-500' : 'bg-red-500';
                    return (
                      <div key={c.campo} className="rounded-xl border border-slate-100 dark:border-slate-700 p-3">
                        <div className="flex items-center justify-between text-sm" style={{ fontFamily: 'Lexend, sans-serif' }}>
                          <span className="text-slate-700 dark:text-slate-200">{c.label}</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-100">{nota}</span>
                        </div>
                        <div className="mt-2 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${barra}`} style={{ width: `${nota}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Problemas com evidências */}
              {parseLista(detalhe.evidenciaProblemas).length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3" style={{ fontFamily: 'Khand, sans-serif' }}>
                    Problemas identificados ({parseLista(detalhe.evidenciaProblemas).length})
                  </h3>
                  <div className="space-y-3">
                    {parseLista(detalhe.evidenciaProblemas).map((p, i) => {
                      const g = GRAVIDADE_CONFIG[p.gravidade] || GRAVIDADE_CONFIG.media;
                      return (
                        <div key={i} className="rounded-xl border border-red-100 dark:border-red-900/40 bg-red-50/40 dark:bg-red-900/10 p-4">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Lexend, sans-serif' }}>
                              {p.descricao}
                            </p>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${g.badge}`} style={{ fontFamily: 'Lexend, sans-serif' }}>{g.label}</span>
                              <span className="text-xs text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>confiança {p.confianca}%</span>
                            </div>
                          </div>
                          {p.trecho && (
                            <blockquote className="mt-2 text-xs text-slate-600 dark:text-slate-300 border-l-2 border-red-300 pl-3 italic" style={{ fontFamily: 'Lexend, sans-serif' }}>
                              "{p.trecho}"
                              {p.data && <span className="not-italic text-slate-400"> — {new Date(p.data).toLocaleString('pt-BR')}</span>}
                            </blockquote>
                          )}
                          {p.categoria && (
                            <span className="mt-2 inline-block text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full" style={{ fontFamily: 'Lexend, sans-serif' }}>
                              {p.categoria}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Pontos fortes */}
              {parseLista(detalhe.pontosFortes).length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3" style={{ fontFamily: 'Khand, sans-serif' }}>
                    Pontos fortes ({parseLista(detalhe.pontosFortes).length})
                  </h3>
                  <div className="space-y-2">
                    {parseLista(detalhe.pontosFortes).map((pf, i) => (
                      <div key={i} className="rounded-xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-900/10 p-3 flex items-start gap-2">
                        <CheckCircle size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm text-slate-700 dark:text-slate-200" style={{ fontFamily: 'Lexend, sans-serif' }}>{pf.descricao}</p>
                          {pf.trecho && (
                            <blockquote className="mt-1 text-xs text-slate-500 dark:text-slate-400 italic" style={{ fontFamily: 'Lexend, sans-serif' }}>"{pf.trecho}"</blockquote>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Riscos */}
              {parseLista(detalhe.riscos).length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3" style={{ fontFamily: 'Khand, sans-serif' }}>
                    Riscos
                  </h3>
                  <div className="space-y-2">
                    {parseLista(detalhe.riscos).map((r, i) => {
                      const g = GRAVIDADE_CONFIG[r.gravidade] || GRAVIDADE_CONFIG.media;
                      return (
                        <div key={i} className="flex items-start gap-2 rounded-xl border border-amber-100 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-900/10 p-3">
                          <ShieldAlert size={16} className="text-amber-500 mt-0.5 shrink-0" />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <p className="text-sm text-slate-700 dark:text-slate-200" style={{ fontFamily: 'Lexend, sans-serif' }}>{r.descricao}</p>
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${g.badge}`} style={{ fontFamily: 'Lexend, sans-serif' }}>{g.label}</span>
                            </div>
                            {r.tipo && <p className="text-xs text-slate-400 mt-0.5" style={{ fontFamily: 'Lexend, sans-serif' }}>{r.tipo}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Recomendações */}
              {parseLista(detalhe.recomendacoes).length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3" style={{ fontFamily: 'Khand, sans-serif' }}>
                    Recomendações
                  </h3>
                  <div className="space-y-2">
                    {parseLista(detalhe.recomendacoes).map((r, i) => (
                      <div key={i} className="rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/40 dark:bg-indigo-900/10 p-3">
                        <p className="text-sm text-slate-700 dark:text-slate-200" style={{ fontFamily: 'Lexend, sans-serif' }}>{r.descricao}</p>
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
                          {r.meta && <span className="flex items-center gap-1"><Target size={12} /> {r.meta}</span>}
                          {r.acao && <span className="flex items-center gap-1"><ClipboardList size={12} /> {r.acao}</span>}
                          {r.prioridade && <span>Prioridade: {r.prioridade}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Plano de melhoria */}
              {parseLista(detalhe.planoMelhoria).length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3" style={{ fontFamily: 'Khand, sans-serif' }}>
                    Plano de melhoria
                  </h3>
                  <div className="space-y-2">
                    {parseLista(detalhe.planoMelhoria).map((pm, i) => (
                      <div key={i} className="flex items-start gap-2 rounded-xl border border-slate-100 dark:border-slate-700 p-3">
                        <RefreshCw size={16} className="text-violet-500 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm text-slate-700 dark:text-slate-200" style={{ fontFamily: 'Lexend, sans-serif' }}>{pm.descricao}</p>
                          <div className="mt-1 flex gap-3 text-xs text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
                            {pm.prazo && <span>Prazo: {pm.prazo}</span>}
                            {pm.acompanhamento && <span>Acompanhamento: {pm.acompanhamento}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Revisão humana */}
              <div className="rounded-2xl border border-slate-100 dark:border-slate-700 p-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3" style={{ fontFamily: 'Khand, sans-serif' }}>
                  Revisão humana
                </h3>
                {detalhe.revisaoStatus ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold px-3 py-1 rounded-full ${REVISAO_CONFIG[detalhe.revisaoStatus]?.badge}`} style={{ fontFamily: 'Lexend, sans-serif' }}>
                        {REVISAO_CONFIG[detalhe.revisaoStatus]?.label}
                      </span>
                      {detalhe.revisadoEm && (
                        <span className="text-xs text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
                          em {new Date(detalhe.revisadoEm).toLocaleString('pt-BR')}
                        </span>
                      )}
                    </div>
                    {detalhe.revisaoJustificativa && (
                      <p className="text-sm text-slate-600 dark:text-slate-300" style={{ fontFamily: 'Lexend, sans-serif' }}>
                        <b>Justificativa:</b> {detalhe.revisaoJustificativa}
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => revisar('CONFIRMADO')} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 hover:bg-emerald-200" style={{ fontFamily: 'Lexend, sans-serif' }}>
                        <ThumbsUp size={14} /> Confirmo a auditoria
                      </button>
                      <button onClick={() => revisar('DISCORDO')} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 hover:bg-red-200" style={{ fontFamily: 'Lexend, sans-serif' }}>
                        <ThumbsDown size={14} /> Discordo
                      </button>
                      <button onClick={() => revisar('REVISAR')} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 hover:bg-amber-200" style={{ fontFamily: 'Lexend, sans-serif' }}>
                        <RefreshCw size={14} /> Revisar novamente
                      </button>
                      <button onClick={() => revisar('NAO_SE_APLICA')} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200" style={{ fontFamily: 'Lexend, sans-serif' }}>
                        <EyeOff size={14} /> Não se aplica
                      </button>
                    </div>
                    <textarea
                      value={justificativa}
                      onChange={(e) => setJustificativa(e.target.value)}
                      placeholder="Justificativa (obrigatória ao discordar)..."
                      className="mt-3 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 min-h-[70px]"
                      style={{ fontFamily: 'Lexend, sans-serif' }}
                    />
                    <div className="mt-2 flex items-center gap-2 text-xs text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
                      <Gauge size={13} />
                      <span>A IA apenas sugere. Sua decisão como gestor é a fonte de verdade.</span>
                    </div>
                  </>
                )}
              </div>

              {/* Metadados */}
              <div className="grid gap-2 grid-cols-2 md:grid-cols-4 text-xs text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
                <div className="flex items-center gap-1"><RotateCcw size={13} /> Reaberto: {detalhe.reaberto ? 'sim' : 'não'}</div>
                <div className="flex items-center gap-1"><RotateCcw size={13} /> Reaberturas: {detalhe.numeroReaberturas}</div>
                <div className="flex items-center gap-1"><AlertTriangle size={13} /> Retrabalho: {detalhe.retrabalho ? 'sim' : 'não'}</div>
                <div className="flex items-center gap-1"><Calendar size={13} /> Custo: {detalhe.custoOperacionalMin || 0} min</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}