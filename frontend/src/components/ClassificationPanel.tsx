import { useState, useEffect, useCallback, useMemo } from 'react';
import { Sparkles, Check, X, Tag, Wand2, Loader2, ShieldAlert, ShieldCheck } from 'lucide-react';
import api from '../services/api';
import type { Categoria, Assunto } from '../types';

interface Sugestao {
  categoriaId?: string | null;
  categoria?: string | null;
  assuntoId?: string | null;
  assunto?: string | null;
  confianca: number;
  metodo: string;
  motivo: string;
}

interface ClassificationPanelProps {
  ticketId: string;
  ticket: any;
  onClassificada?: () => void;
}

export default function ClassificationPanel({ ticketId, ticket, onClassificada }: ClassificationPanelProps) {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [assuntos, setAssuntos] = useState<Assunto[]>([]);
  const [categoriaId, setCategoriaId] = useState<string>('');
  const [assuntoId, setAssuntoId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sugerindo, setSugerindo] = useState(false);
  const [sugestao, setSugestao] = useState<Sugestao | null>(null);
  const [exigir, setExigir] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const [catsRes, asstsRes, configRes] = await Promise.all([
        api.get('/helpdesk/categorias?todas=true'),
        api.get('/helpdesk/assuntos?todas=true'),
        api.get('/helpdesk/categorias/config'),
      ]);
      setCategorias(catsRes.data);
      setAssuntos(asstsRes.data);
      setExigir(!!configRes.data?.exigirClassificacao);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!ticket?.id) return;
    setCategoriaId(ticket.categoriaId || '');
    setAssuntoId(ticket.assuntoId || '');
    setSugestao(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket?.id]);

  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 5000);
    return () => clearTimeout(t);
  }, [feedback]);

  const assuntosDaCategoria = useMemo(
    () => assuntos.filter((a) => !categoriaId || a.categoriaId === categoriaId),
    [assuntos, categoriaId]
  );

  const assuntoSelecionado = useMemo(
    () => assuntos.find((a) => a.id === assuntoId),
    [assuntos, assuntoId]
  );

  const handleCategoriaChange = (value: string) => {
    setCategoriaId(value);
    const existeAssunto = assuntos.some((a) => a.id === assuntoId && a.categoriaId === value);
    if (!existeAssunto) setAssuntoId('');
  };

  const salvar = async (payload: { categoriaId?: string; assuntoId?: string; motivo?: string }) => {
    setSaving(true);
    try {
      await api.patch(`/helpdesk/tickets/${ticketId}/classificacao`, payload);
      setFeedback({ type: 'ok', msg: 'Classificação salva' });
      setSugestao(null);
      onClassificada?.();
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err?.response?.data?.error || 'Erro ao salvar classificação' });
    } finally {
      setSaving(false);
    }
  };

  const handleSalvarManual = () => {
    if (!categoriaId && !assuntoId) return;
    salvar({ categoriaId: categoriaId || undefined, assuntoId: assuntoId || undefined, motivo: 'Classificação manual' });
  };

  const sugerir = async () => {
    setSugerindo(true);
    try {
      const { data } = await api.post(`/helpdesk/tickets/${ticketId}/classificacao/sugerir`);
      setSugestao(data);
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err?.response?.data?.error || 'Erro ao sugerir classificação' });
    } finally {
      setSugerindo(false);
    }
  };

  const aceitarSugestao = () => {
    if (!sugestao) return;
    const novaCategoria = sugestao.categoriaId || undefined;
    const novoAssunto = sugestao.assuntoId || undefined;
    setCategoriaId(novaCategoria || '');
    setAssuntoId(novoAssunto || '');
    salvar({ categoriaId: novaCategoria, assuntoId: novoAssunto, motivo: `Sugestão IA (${sugestao.metodo})` });
  };

  if (loading) {
    return (
      <div className="px-5 py-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <Loader2 size={14} className="animate-spin" /> Carregando classificação...
      </div>
    );
  }

  const corAssunto = assuntoSelecionado?.cor;

  return (
    <div className="px-5 py-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Tag size={14} className="text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-semibold text-gray-800 dark:text-slate-100">Classificação do Chamado</span>
          {exigir ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              <ShieldAlert size={10} /> Obrigatória ao concluir
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300">
              <ShieldCheck size={10} /> Opcional
            </span>
          )}
        </div>
        <button onClick={sugerir} disabled={sugerindo}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 dark:bg-violet-900/30 dark:text-violet-300 dark:hover:bg-violet-900/50 disabled:opacity-50">
          {sugerindo ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />} Sugerir com IA
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] font-medium text-gray-500 dark:text-slate-400 block mb-1">Categoria</label>
          <select value={categoriaId} onChange={(e) => handleCategoriaChange(e.target.value)}
            className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800">
            <option value="">Sem categoria</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[11px] font-medium text-gray-500 dark:text-slate-400 block mb-1">Assunto</label>
          <select value={assuntoId} onChange={(e) => setAssuntoId(e.target.value)}
            className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800">
            <option value="">Sem assunto</option>
            {assuntosDaCategoria.map((a) => (
              <option key={a.id} value={a.id}>{a.nome}</option>
            ))}
          </select>
        </div>
      </div>

      {assuntoSelecionado && (
        <div className="flex items-center gap-2 flex-wrap text-[11px] text-gray-500 dark:text-slate-400">
          {corAssunto && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-white font-medium"
              style={{ backgroundColor: corAssunto }}>{assuntoSelecionado.nome}</span>
          )}
          {assuntoSelecionado.prioridadePadrao && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700">
              Prioridade padrão: <strong>{assuntoSelecionado.prioridadePadrao}</strong>
            </span>
          )}
          {assuntoSelecionado.slaPadraoMin != null && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700">
              SLA padrão: <strong>{assuntoSelecionado.slaPadraoMin}min</strong>
            </span>
          )}
        </div>
      )}

      {(categoriaId || assuntoId) && (
        <button onClick={handleSalvarManual} disabled={saving}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 disabled:opacity-50">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Salvar classificação
        </button>
      )}

      {sugestao && sugestao.metodo !== 'nenhum' && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800">
          <Sparkles size={16} className="text-violet-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0 text-sm">
            <p className="font-medium text-violet-800 dark:text-violet-200 flex items-center gap-2 flex-wrap">
              Sugestão IA
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-200 dark:bg-violet-900 text-violet-800 dark:text-violet-200">
                {sugestao.confianca}% · {sugestao.metodo}
              </span>
            </p>
            <p className="text-violet-700 dark:text-violet-300 text-sm mt-0.5">
              Categoria: <strong>{sugestao.categoria || '—'}</strong>
              {sugestao.assunto ? <> · Assunto: <strong>{sugestao.assunto}</strong></> : null}
            </p>
            {sugestao.motivo && <p className="text-xs text-violet-500 dark:text-violet-400 mt-0.5">{sugestao.motivo}</p>}
            <div className="flex gap-2 mt-2">
              <button onClick={aceitarSugestao} disabled={saving}
                className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50">
                <Check size={12} /> Aceitar
              </button>
              <button onClick={() => setSugestao(null)} disabled={saving}
                className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-lg bg-white text-violet-700 dark:bg-slate-800 dark:text-violet-400 border border-violet-300 dark:border-violet-800 hover:bg-violet-50 dark:hover:bg-slate-700 disabled:opacity-50">
                <X size={12} /> Alterar
              </button>
            </div>
          </div>
        </div>
      )}

      {feedback && (
        <div className={`text-xs px-3 py-2 rounded-lg ${feedback.type === 'ok' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'}`}>
          {feedback.msg}
        </div>
      )}
    </div>
  );
}