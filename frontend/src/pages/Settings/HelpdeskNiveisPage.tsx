import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Edit2, Power, PowerOff, Save, X, RefreshCw,
  Layers,
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../services/auth';

interface NivelSuporte {
  id: string;
  slug: string;
  nome: string;
  descricao: string | null;
  cor: string;
  icone: string;
  ordem: number;
  slaMinutos: number | null;
  ativo: boolean;
  _count?: { tickets: number; filas: number };
}

const CORES_OPCOES = [
  '#22c55e', '#f59e0b', '#ef4444', '#6366f1',
  '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4',
];

const ICONES_OPCOES = [
  { value: 'user', label: 'Atendente' },
  { value: 'user-check', label: 'Especialista' },
  { value: 'shield-alert', label: 'Critico' },
  { value: 'crown', label: 'Supervisor' },
  { value: 'layers', label: 'Camadas' },
  { value: 'headphones', label: 'Suporte' },
  { value: 'zap', label: 'Urgente' },
  { value: 'star', label: 'Estrela' },
];

export default function HelpdeskNiveisPage() {
  const { user } = useAuth();
  const isMaster = user?.isMaster || user?.role === 'admin';
  const [niveis, setNiveis] = useState<NivelSuporte[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<NivelSuporte | null>(null);
  const [creating, setCreating] = useState(false);
  const [showInativos, setShowInativos] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/helpdesk/niveis?includeInativos=${showInativos}`);
      setNiveis(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [showInativos]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(t);
  }, [feedback]);

  const handleToggle = async (nivel: NivelSuporte) => {
    try {
      const { data } = await api.patch(`/helpdesk/niveis/${nivel.id}/toggle`);
      setFeedback({ type: 'ok', msg: `Nivel "${data.nome}" ${data.ativo ? 'reativado' : 'desativado'}` });
      load();
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err?.response?.data?.error || 'Erro' });
    }
  };

  const handleSave = async (data: Partial<NivelSuporte>) => {
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/helpdesk/niveis/${editing.id}`, data);
        setFeedback({ type: 'ok', msg: 'Nivel atualizado' });
      } else {
        await api.post('/helpdesk/niveis', data);
        setFeedback({ type: 'ok', msg: 'Nivel criado' });
      }
      setEditing(null);
      setCreating(false);
      load();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Erro ao salvar';
      const field = err?.response?.data?.field;
      setFeedback({ type: 'err', msg: field ? `${field}: ${msg}` : msg });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><RefreshCw className="animate-spin text-blue-600 dark:text-blue-400" size={32} /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <Layers className="text-blue-600 dark:text-blue-400" size={24} /> Niveis de Suporte
          </h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm">
            {niveis.length} nivel(is) {showInativos && '(incluindo inativos)'} — Configure N1, N2, N3, Supervisor, etc.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowInativos(!showInativos)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${showInativos ? 'bg-amber-100 text-amber-700' : 'bg-neutral-100 dark:bg-slate-800 text-neutral-600 dark:text-slate-300'}`}>
            {showInativos ? 'Mostrando inativos' : 'Mostrar inativos'}
          </button>
          {isMaster && (
            <button onClick={() => { setCreating(true); setEditing(null); }}
              className="btn-primary text-sm flex items-center gap-1.5">
              <Plus size={14} /> Novo nivel
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div className={`text-sm px-3 py-2 rounded-lg ${feedback.type === 'ok' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700' : 'bg-red-50 dark:bg-red-900/30 text-red-700'}`}>
          {feedback.msg}
        </div>
      )}

      <div className="space-y-2">
        {niveis.length === 0 && (
          <p className="text-center text-neutral-400 dark:text-slate-500 py-8 text-sm">Nenhum nivel cadastrado.</p>
        )}
        {niveis.map((nivel) => (
          <div key={nivel.id} className={`card flex items-center gap-3 p-3 ${!nivel.ativo ? 'opacity-60' : ''}`}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0" style={{ backgroundColor: nivel.cor }}>
              <Layers size={14} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-gray-900 dark:text-slate-100 truncate">{nivel.nome}</h3>
                <code className="text-[10px] text-neutral-500 dark:text-slate-400 bg-neutral-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono">{nivel.slug}</code>
                {nivel.slaMinutos != null && (
                  <span className="text-[10px] text-blue-700 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded font-medium">SLA {nivel.slaMinutos}min</span>
                )}
                {!nivel.ativo && (
                  <span className="text-[10px] text-neutral-500 dark:text-slate-400 bg-neutral-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-medium uppercase">Inativo</span>
                )}
              </div>
              {nivel.descricao && <p className="text-xs text-neutral-500 dark:text-slate-400 truncate mt-0.5">{nivel.descricao}</p>}
              <div className="flex gap-3 mt-1 text-[10px] text-neutral-400 dark:text-slate-500">
                {nivel._count && <span>{nivel._count.tickets} ticket(s)</span>}
                {nivel._count && <span>{nivel._count.filas} fila(s)</span>}
              </div>
            </div>
            {isMaster && (
              <div className="flex items-center gap-1">
                <button onClick={() => { setEditing(nivel); setCreating(false); }} className="p-1.5 hover:bg-neutral-100 dark:hover:bg-slate-700 rounded text-neutral-600 dark:text-slate-300" title="Editar">
                  <Edit2 size={14} />
                </button>
                <button onClick={() => handleToggle(nivel)} className="p-1.5 hover:bg-neutral-100 dark:hover:bg-slate-700 rounded text-neutral-600 dark:text-slate-300" title={nivel.ativo ? 'Desativar' : 'Reativar'}>
                  {nivel.ativo ? <PowerOff size={14} className="text-red-500" /> : <Power size={14} className="text-emerald-500" />}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {(editing || creating) && isMaster && (
        <NivelEditor
          nivel={editing}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </div>
  );
}

interface EditorProps {
  nivel: NivelSuporte | null;
  onClose: () => void;
  onSave: (data: Partial<NivelSuporte>) => Promise<void>;
  saving: boolean;
}

function NivelEditor({ nivel, onClose, onSave, saving }: EditorProps) {
  const isNew = !nivel;
  const [form, setForm] = useState<Partial<NivelSuporte>>(
    nivel || { slug: '', nome: '', descricao: '', cor: '#3b82f6', icone: 'layers', slaMinutos: null }
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-xl p-5 w-full max-w-lg space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900 dark:text-slate-100">{isNew ? 'Novo Nivel' : `Editar "${nivel!.nome}"`}</h3>
          <button onClick={onClose} className="text-neutral-400 dark:text-slate-500 hover:text-neutral-600"><X size={18} /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-slate-200 block mb-1">Slug (kebab-case) *</label>
            <input type="text" value={form.slug || ''} onChange={(e) => setForm({ ...form, slug: e.target.value })}
              disabled={!isNew} placeholder="n1"
              className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 disabled:bg-gray-50 disabled:text-gray-500 font-mono" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-slate-200 block mb-1">Nome *</label>
            <input type="text" value={form.nome || ''} onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="N1 — Primeiro Atendimento"
              className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2" />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-700 dark:text-slate-200 block mb-1">Descricao</label>
          <input type="text" value={form.descricao || ''} onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2" />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-slate-200 block mb-1">SLA (minutos)</label>
            <input type="number" value={form.slaMinutos ?? ''} onChange={(e) => setForm({ ...form, slaMinutos: e.target.value ? Number(e.target.value) : null })}
              placeholder="30" min={0}
              className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-slate-200 block mb-1">Cor</label>
            <div className="flex flex-wrap gap-1.5">
              {CORES_OPCOES.map((c) => (
                <button key={c} type="button" onClick={() => setForm({ ...form, cor: c })}
                  className={`w-6 h-6 rounded border-2 ${form.cor === c ? 'border-gray-900' : 'border-transparent'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-slate-200 block mb-1">Icone</label>
            <select value={form.icone} onChange={(e) => setForm({ ...form, icone: e.target.value })}
              className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2">
              {ICONES_OPCOES.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
            </select>
          </div>
        </div>

        <div className="flex gap-2 pt-3 border-t">
          <button onClick={onClose} disabled={saving} className="flex-1 px-4 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50">Cancelar</button>
          <button onClick={() => onSave(form)} disabled={saving || !form.nome?.trim() || !form.slug?.trim()}
            className="flex-1 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-1.5">
            <Save size={14} /> {saving ? 'Salvando...' : isNew ? 'Criar' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
