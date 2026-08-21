import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Edit2, Power, PowerOff, Save, X, RefreshCw, Tag, ListTree, FolderOpen,
  Building2, Hash, Trash2, ShieldAlert,
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../services/auth';
import type { Categoria, Assunto, Departamento } from '../../types';

const CORES_OPCOES = [
  '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b',
  '#ef4444', '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#64748b',
];

const ICONES_OPCOES = [
  { value: 'wrench', label: 'Suporte' },
  { value: 'dollar-sign', label: 'Financeiro' },
  { value: 'briefcase', label: 'Comercial' },
  { value: 'x-circle', label: 'Cancelamento' },
  { value: 'printer', label: 'Impressora' },
  { value: 'database', label: 'Banco' },
  { value: 'plug', label: 'Integração' },
  { value: 'clipboard-list', label: 'Procedimento' },
  { value: 'code', label: 'Desenvolvimento' },
  { value: 'rocket', label: 'Implantação' },
  { value: 'help-circle', label: 'Outros' },
];

const PRIORIDADES = ['baixa', 'media', 'alta', 'urgente'];

export default function CategoriasAssuntosPage() {
  const { user } = useAuth();
  const isAdmin = user?.isMaster || user?.role === 'admin';
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [assuntos, setAssuntos] = useState<Assunto[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [exigir, setExigir] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [editingCat, setEditingCat] = useState<Categoria | null>(null);
  const [creatingCat, setCreatingCat] = useState(false);
  const [editingAss, setEditingAss] = useState<Assunto | null>(null);
  const [creatingAss, setCreatingAss] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const [catsRes, asstsRes, deptRes, configRes] = await Promise.all([
        api.get('/helpdesk/categorias?todas=true'),
        api.get('/helpdesk/assuntos?todas=true'),
        api.get('/helpdesk/departamentos?includeInativos=true'),
        api.get('/helpdesk/categorias/config'),
      ]);
      setCategorias(catsRes.data);
      setAssuntos(asstsRes.data);
      setDepartamentos(deptRes.data);
      setExigir(!!configRes.data?.exigirClassificacao);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 5000);
    return () => clearTimeout(t);
  }, [feedback]);

  const toggleExigir = async () => {
    setSavingConfig(true);
    try {
      const novo = !exigir;
      await api.put('/helpdesk/categorias/config', { exigirClassificacao: novo });
      setExigir(novo);
      setFeedback({ type: 'ok', msg: novo ? 'Classificação obrigatória ao concluir chamado' : 'Classificação opcional' });
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err?.response?.data?.error || 'Erro ao salvar configuração' });
    } finally {
      setSavingConfig(false);
    }
  };

  const toggleCategoria = async (cat: Categoria) => {
    try {
      await api.patch(`/helpdesk/categorias/${cat.id}/ativar`, { ativo: !cat.ativo });
      setFeedback({ type: 'ok', msg: `Categoria "${cat.nome}" ${cat.ativo ? 'desativada' : 'ativada'}` });
      load();
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err?.response?.data?.error || 'Erro' });
    }
  };

  const excluirCategoria = async (cat: Categoria) => {
    if (!window.confirm(`Excluir definitivamente a categoria "${cat.nome}"? Só será possível se não houver histórico.`)) return;
    try {
      await api.delete(`/helpdesk/categorias/${cat.id}`);
      setFeedback({ type: 'ok', msg: 'Categoria excluída' });
      load();
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err?.response?.data?.error || 'Erro ao excluir' });
    }
  };

  const toggleAssunto = async (ass: Assunto) => {
    try {
      await api.patch(`/helpdesk/assuntos/${ass.id}/ativar`, { ativo: !ass.ativo });
      setFeedback({ type: 'ok', msg: `Assunto "${ass.nome}" ${ass.ativo ? 'desativado' : 'ativado'}` });
      load();
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err?.response?.data?.error || 'Erro' });
    }
  };

  const salvarCategoria = async (data: any) => {
    setSaving(true);
    try {
      if (editingCat) {
        await api.put(`/helpdesk/categorias/${editingCat.id}`, data);
        setFeedback({ type: 'ok', msg: 'Categoria atualizada' });
      } else {
        await api.post('/helpdesk/categorias', data);
        setFeedback({ type: 'ok', msg: 'Categoria criada' });
      }
      setEditingCat(null);
      setCreatingCat(false);
      load();
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err?.response?.data?.error || 'Erro ao salvar categoria' });
    } finally {
      setSaving(false);
    }
  };

  const salvarAssunto = async (data: any) => {
    setSaving(true);
    try {
      if (editingAss) {
        await api.put(`/helpdesk/assuntos/${editingAss.id}`, data);
        setFeedback({ type: 'ok', msg: 'Assunto atualizado' });
      } else {
        await api.post('/helpdesk/assuntos', data);
        setFeedback({ type: 'ok', msg: 'Assunto criado' });
      }
      setEditingAss(null);
      setCreatingAss(false);
      load();
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err?.response?.data?.error || 'Erro ao salvar assunto' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><RefreshCw className="animate-spin text-blue-600 dark:text-blue-400" size={32} /></div>;
  }

  const assuntosDaCategoria = (categoriaId: string) =>
    assuntos.filter((a) => a.categoriaId === categoriaId);

  const getDeptNome = (id?: string) => departamentos.find((d) => d.id === id)?.nome;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <ListTree className="text-blue-600 dark:text-blue-400" size={24} /> Categorias e Assuntos
          </h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm">
            {categorias.length} categoria(s) · {assuntos.length} assunto(s) cadastrados
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <button onClick={toggleExigir} disabled={savingConfig}
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border transition-colors disabled:opacity-50 ${
                exigir
                  ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800'
                  : 'bg-white text-slate-600 border-gray-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
              }`}>
              <ShieldAlert size={14} />
              {exigir ? 'Classificação obrigatória ao concluir' : 'Classificação opcional'}
            </button>
          )}
          <button onClick={() => { setCreatingAss(true); setEditingAss(null); }}
            className="btn-primary text-sm flex items-center gap-1.5">
            <Plus size={14} /> Novo assunto
          </button>
          <button onClick={() => { setCreatingCat(true); setEditingCat(null); }}
            className="btn-primary text-sm flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700">
            <Plus size={14} /> Nova categoria
          </button>
        </div>
      </div>

      {feedback && (
        <div className={`text-sm px-3 py-2 rounded-lg ${feedback.type === 'ok' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'}`}>
          {feedback.msg}
        </div>
      )}

      <div className="space-y-3">
        {categorias.length === 0 && (
          <p className="text-center text-neutral-400 dark:text-slate-500 py-8 text-sm">Nenhuma categoria cadastrada.</p>
        )}
        {categorias.map((cat) => {
          const deps = assuntosDaCategoria(cat.id);
          return (
            <div key={cat.id} className={`card p-3 ${!cat.ativo ? 'opacity-60' : ''}`}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white flex-shrink-0"
                  style={{ backgroundColor: cat.cor || '#64748b' }}>
                  <FolderOpen size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-sm text-gray-900 dark:text-slate-100">{cat.nome}</h3>
                    <code className="text-[10px] text-neutral-500 dark:text-slate-400 bg-neutral-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono">{cat.slug}</code>
                    {cat.departamento && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-neutral-500 dark:text-slate-400 bg-neutral-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        <Building2 size={10} style={{ color: cat.departamento.cor }} /> {cat.departamento.nome}
                      </span>
                    )}
                    {!cat.ativo && (
                      <span className="text-[10px] text-neutral-500 dark:text-slate-400 bg-neutral-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-medium uppercase">Inativa</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-neutral-500 dark:text-slate-400">
                    <span>{cat._count?.tickets ?? 0} ticket(s)</span>
                    <span>{deps.length} assunto(s)</span>
                  </div>
                  {cat.descricao && <p className="text-xs text-neutral-400 dark:text-slate-500 truncate mt-0.5">{cat.descricao}</p>}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => { setCreatingAss(true); setEditingAss(null); }} className="p-1.5 hover:bg-neutral-100 dark:hover:bg-slate-700 rounded text-neutral-600 dark:text-slate-300" title="Novo assunto nesta categoria">
                    <Tag size={14} />
                  </button>
                  <button onClick={() => { setEditingCat(cat); setCreatingCat(false); }} className="p-1.5 hover:bg-neutral-100 dark:hover:bg-slate-700 rounded text-neutral-600 dark:text-slate-300" title="Editar">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => toggleCategoria(cat)} className="p-1.5 hover:bg-neutral-100 dark:hover:bg-slate-700 rounded text-neutral-600 dark:text-slate-300" title={cat.ativo ? 'Desativar' : 'Reativar'}>
                    {cat.ativo ? <PowerOff size={14} className="text-red-500" /> : <Power size={14} className="text-emerald-500" />}
                  </button>
                  <button onClick={() => excluirCategoria(cat)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded text-red-500" title="Excluir">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {deps.length > 0 && (
                <div className="mt-2 pl-12 space-y-1">
                  {deps.map((a) => (
                    <div key={a.id} className={`flex items-center gap-2 text-xs rounded-lg px-2 py-1 ${!a.ativo ? 'opacity-60' : ''} ${a.cor ? '' : 'bg-slate-50 dark:bg-slate-800/50'}`}
                      style={a.cor ? { backgroundColor: `${a.cor}1a`, border: `1px solid ${a.cor}55` } : undefined}>
                      <Tag size={12} style={{ color: a.cor }} />
                      <span className="font-medium text-gray-800 dark:text-slate-200">{a.nome}</span>
                      {a.prioridadePadrao && (
                        <span className="text-[10px] text-neutral-500 dark:text-slate-400">{a.prioridadePadrao}</span>
                      )}
                      {a.slaPadraoMin != null && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-neutral-500 dark:text-slate-400">
                          <Hash size={10} /> SLA {a.slaPadraoMin}min
                        </span>
                      )}
                      {a._count?.tickets ? <span className="text-[10px] text-neutral-400">{a._count.tickets} ticket(s)</span> : null}
                      <div className="ml-auto flex items-center gap-0.5">
                        <button onClick={() => { setEditingAss(a); setCreatingAss(false); }} className="p-1 hover:bg-neutral-100 dark:hover:bg-slate-700 rounded text-neutral-600 dark:text-slate-300" title="Editar">
                          <Edit2 size={12} />
                        </button>
                        <button onClick={() => toggleAssunto(a)} className="p-1 hover:bg-neutral-100 dark:hover:bg-slate-700 rounded text-neutral-600 dark:text-slate-300" title={a.ativo ? 'Desativar' : 'Reativar'}>
                          {a.ativo ? <PowerOff size={12} className="text-red-500" /> : <Power size={12} className="text-emerald-500" />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {(editingCat || creatingCat) && (
        <CategoriaEditor categoria={editingCat} departamentos={departamentos}
          onClose={() => { setEditingCat(null); setCreatingCat(false); }}
          onSave={salvarCategoria} saving={saving} />
      )}
      {(editingAss || creatingAss) && (
        <AssuntoEditor assunto={editingAss} categorias={categorias}
          onClose={() => { setEditingAss(null); setCreatingAss(false); }}
          onSave={salvarAssunto} saving={saving} />
      )}
    </div>
  );
}

// ── Editor de Categoria ──────────────────────────────────────────────

function CategoriaEditor({ categoria, departamentos, onClose, onSave, saving }: {
  categoria: Categoria | null;
  departamentos: Departamento[];
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  saving: boolean;
}) {
  const isNew = !categoria;
  const [form, setForm] = useState({
    nome: categoria?.nome || '',
    descricao: categoria?.descricao || '',
    cor: categoria?.cor || '#3b82f6',
    icone: categoria?.icone || 'wrench',
    departamentoId: categoria?.departamentoId || '',
    ordem: categoria?.ordem ?? 0,
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-xl p-5 w-full max-w-lg space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900 dark:text-slate-100">{isNew ? 'Nova Categoria' : `Editar "${categoria!.nome}"`}</h3>
          <button onClick={onClose} className="text-neutral-400 dark:text-slate-500 hover:text-neutral-600"><X size={18} /></button>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-700 dark:text-slate-200 block mb-1">Nome *</label>
          <input type="text" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })}
            placeholder="Ex: Impressoras" className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700 dark:text-slate-200 block mb-1">Descrição</label>
          <input type="text" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-slate-200 block mb-1">Departamento (padrão)</label>
            <select value={form.departamentoId} onChange={(e) => setForm({ ...form, departamentoId: e.target.value })}
              className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800">
              <option value="">Sem departamento</option>
              {departamentos.map((d) => (
                <option key={d.id} value={d.id}>{d.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-slate-200 block mb-1">Ordem</label>
            <input type="number" min={0} value={form.ordem} onChange={(e) => setForm({ ...form, ordem: parseInt(e.target.value) || 0 })}
              className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2" />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700 dark:text-slate-200 block mb-1">Cor</label>
          <div className="flex flex-wrap gap-1.5">
            {CORES_OPCOES.map((c) => (
              <button key={c} type="button" onClick={() => setForm({ ...form, cor: c })}
                className={`w-6 h-6 rounded border-2 ${form.cor === c ? 'border-gray-900 dark:border-white' : 'border-transparent'}`}
                style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700 dark:text-slate-200 block mb-1">Ícone</label>
          <div className="flex flex-wrap gap-1.5">
            {ICONES_OPCOES.map((i) => (
              <button key={i.value} type="button" onClick={() => setForm({ ...form, icone: i.value })}
                className={`px-2 py-1 text-[11px] rounded-lg border ${form.icone === i.value ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700' : 'border-gray-200 text-gray-600 dark:border-slate-700 dark:text-slate-300'}`}>
                {i.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-3 border-t">
          <button onClick={onClose} disabled={saving} className="flex-1 px-4 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50">Cancelar</button>
          <button onClick={() => onSave({ ...form, departamentoId: form.departamentoId || undefined })}
            disabled={saving || !form.nome.trim()}
            className="flex-1 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-1.5">
            <Save size={14} /> {saving ? 'Salvando...' : isNew ? 'Criar' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Editor de Assunto ────────────────────────────────────────────────

function AssuntoEditor({ assunto, categorias, onClose, onSave, saving }: {
  assunto: Assunto | null;
  categorias: Categoria[];
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  saving: boolean;
}) {
  const isNew = !assunto;
  const [form, setForm] = useState({
    nome: assunto?.nome || '',
    descricao: assunto?.descricao || '',
    categoriaId: assunto?.categoriaId || '',
    prioridadePadrao: assunto?.prioridadePadrao || 'media',
    slaPadraoMin: assunto?.slaPadraoMin ?? 240,
    icone: assunto?.icone || 'tag',
    cor: assunto?.cor || '',
    ordem: assunto?.ordem ?? 0,
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-xl p-5 w-full max-w-lg space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900 dark:text-slate-100">{isNew ? 'Novo Assunto' : `Editar "${assunto!.nome}"`}</h3>
          <button onClick={onClose} className="text-neutral-400 dark:text-slate-500 hover:text-neutral-600"><X size={18} /></button>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-700 dark:text-slate-200 block mb-1">Nome *</label>
          <input type="text" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })}
            placeholder="Ex: Impressora não imprime" className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700 dark:text-slate-200 block mb-1">Descrição</label>
          <input type="text" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-slate-200 block mb-1">Categoria *</label>
            <select value={form.categoriaId} onChange={(e) => setForm({ ...form, categoriaId: e.target.value })}
              className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800">
              <option value="">Selecione...</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-slate-200 block mb-1">Prioridade padrão</label>
            <select value={form.prioridadePadrao} onChange={(e) => setForm({ ...form, prioridadePadrao: e.target.value })}
              className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800">
              {PRIORIDADES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-slate-200 block mb-1">SLA padrão (minutos)</label>
            <input type="number" min={0} value={form.slaPadraoMin} onChange={(e) => setForm({ ...form, slaPadraoMin: parseInt(e.target.value) || 0 })}
              className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-slate-200 block mb-1">Ordem</label>
            <input type="number" min={0} value={form.ordem} onChange={(e) => setForm({ ...form, ordem: parseInt(e.target.value) || 0 })}
              className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2" />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700 dark:text-slate-200 block mb-1">Cor (opcional)</label>
          <div className="flex flex-wrap gap-1.5 items-center">
            <button type="button" onClick={() => setForm({ ...form, cor: '' })}
              className={`px-2 py-1 text-[11px] rounded-lg border ${!form.cor ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'border-gray-200 text-gray-500 dark:border-slate-700 dark:text-slate-400'}`}>
              Sem cor
            </button>
            {CORES_OPCOES.map((c) => (
              <button key={c} type="button" onClick={() => setForm({ ...form, cor: c })}
                className={`w-6 h-6 rounded border-2 ${form.cor === c ? 'border-gray-900 dark:border-white' : 'border-transparent'}`}
                style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-3 border-t">
          <button onClick={onClose} disabled={saving} className="flex-1 px-4 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50">Cancelar</button>
          <button onClick={() => onSave({ ...form, slaPadraoMin: form.slaPadraoMin || undefined, cor: form.cor || undefined, icone: form.icone || undefined })}
            disabled={saving || !form.nome.trim() || !form.categoriaId}
            className="flex-1 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-1.5">
            <Save size={14} /> {saving ? 'Salvando...' : isNew ? 'Criar' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}