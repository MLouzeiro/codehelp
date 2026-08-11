import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Edit2, Power, PowerOff, Save, X, RefreshCw,
  ListTodo, Building2, Layers, Hash,
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../services/auth';
import type { Departamento, NivelSuporte, Fila } from '../../types';

const CORES_OPCOES = [
  '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b',
  '#ef4444', '#ec4899', '#06b6d4', '#64748b',
];

const ICONES_OPCOES = [
  { value: 'list-todo', label: 'Lista' },
  { value: 'headphones', label: 'Suporte' },
  { value: 'trending-up', label: 'Comercial' },
  { value: 'code', label: 'Codigo' },
  { value: 'users', label: 'Equipe' },
  { value: 'wrench', label: 'Manutencao' },
  { value: 'shield', label: 'Seguranca' },
  { value: 'server', label: 'Servidor' },
];

export default function HelpdeskFilasPage() {
  const { user } = useAuth();
  const isMaster = user?.isMaster || user?.role === 'admin';
  const [filas, setFilas] = useState<Fila[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [niveis, setNiveis] = useState<NivelSuporte[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Fila | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterDept, setFilterDept] = useState<string>('');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const [filasRes, deptRes, nivelRes] = await Promise.all([
        api.get(`/helpdesk/filas${filterDept ? `?departamentoId=${filterDept}` : ''}`),
        api.get('/helpdesk/departamentos?includeInativos=true'),
        api.get('/helpdesk/niveis?includeInativos=true'),
      ]);
      setFilas(filasRes.data);
      setDepartamentos(deptRes.data);
      setNiveis(nivelRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filterDept]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(t);
  }, [feedback]);

  const handleToggle = async (fila: Fila) => {
    try {
      const { data } = await api.patch(`/helpdesk/filas/${fila.id}/toggle`);
      setFeedback({ type: 'ok', msg: `Fila "${data.nome}" ${data.ativo ? 'reativada' : 'desativada'}` });
      load();
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err?.response?.data?.error || 'Erro' });
    }
  };

  const handleSave = async (data: Partial<Fila> & { departamentoId: string; nivelSuporteId: string }) => {
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/helpdesk/filas/${editing.id}`, data);
        setFeedback({ type: 'ok', msg: 'Fila atualizada' });
      } else {
        await api.post('/helpdesk/filas', data);
        setFeedback({ type: 'ok', msg: 'Fila criada' });
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

  const getDeptCor = (slug?: string) => {
    const dept = departamentos.find(d => d.slug === slug);
    return dept?.cor || '#64748b';
  };

  const getNivelCor = (slug?: string) => {
    const nivel = niveis.find(n => n.slug === slug);
    return nivel?.cor || '#64748b';
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><RefreshCw className="animate-spin text-blue-600 dark:text-blue-400" size={32} /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <ListTodo className="text-blue-600 dark:text-blue-400" size={24} /> Filas de Atendimento
          </h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm">
            {filas.length} fila(s) cadastrada(s)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="text-xs border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-800"
          >
            <option value="">Todos departamentos</option>
            {departamentos.filter(d => d.ativo).map(d => (
              <option key={d.id} value={d.id}>{d.nome}</option>
            ))}
          </select>
          {isMaster && (
            <button onClick={() => { setCreating(true); setEditing(null); }}
              className="btn-primary text-sm flex items-center gap-1.5">
              <Plus size={14} /> Nova fila
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
        {filas.length === 0 && (
          <p className="text-center text-neutral-400 dark:text-slate-500 py-8 text-sm">Nenhuma fila cadastrada.</p>
        )}
        {filas.map((fila) => {
          const deptNome = fila.departamento?.nome || 'Sem depto';
          const nivelNome = fila.nivelSuporte?.nome || 'Sem nivel';
          return (
            <div key={fila.id} className={`card flex items-center gap-3 p-3 ${!fila.ativo ? 'opacity-60' : ''}`}>
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0 text-xs font-bold"
                style={{ backgroundColor: fila.cor || getDeptCor(fila.departamento?.slug) }}
              >
                <ListTodo size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-sm text-gray-900 dark:text-slate-100 truncate">{fila.nome}</h3>
                  <code className="text-[10px] text-neutral-500 dark:text-slate-400 bg-neutral-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono">{fila.slug}</code>
                  {!fila.ativo && (
                    <span className="text-[10px] text-neutral-500 dark:text-slate-400 bg-neutral-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-medium uppercase">Inativa</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-[10px] text-neutral-500 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <Building2 size={10} style={{ color: fila.departamento?.cor }} />
                    {deptNome}
                  </span>
                  <span className="flex items-center gap-1">
                    <Layers size={10} style={{ color: fila.nivelSuporte?.cor }} />
                    {nivelNome}
                  </span>
                  {fila.slaMinutos > 0 && (
                    <span className="flex items-center gap-1">
                      <Hash size={10} />
                      SLA {fila.slaMinutos}min
                    </span>
                  )}
                  {fila._count && <span>{fila._count.tickets} ticket(s)</span>}
                </div>
                {fila.descricao && <p className="text-xs text-neutral-400 dark:text-slate-500 truncate mt-0.5">{fila.descricao}</p>}
              </div>
              {isMaster && (
                <div className="flex items-center gap-1">
                  <button onClick={() => { setEditing(fila); setCreating(false); }} className="p-1.5 hover:bg-neutral-100 dark:hover:bg-slate-700 rounded text-neutral-600 dark:text-slate-300" title="Editar">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => handleToggle(fila)} className="p-1.5 hover:bg-neutral-100 dark:hover:bg-slate-700 rounded text-neutral-600 dark:text-slate-300" title={fila.ativo ? 'Desativar' : 'Reativar'}>
                    {fila.ativo ? <PowerOff size={14} className="text-red-500" /> : <Power size={14} className="text-emerald-500" />}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {(editing || creating) && isMaster && (
        <FilaEditor
          fila={editing}
          departamentos={departamentos}
          niveis={niveis}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </div>
  );
}

interface EditorProps {
  fila: Fila | null;
  departamentos: Departamento[];
  niveis: NivelSuporte[];
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  saving: boolean;
}

function FilaEditor({ fila, departamentos, niveis, onClose, onSave, saving }: EditorProps) {
  const isNew = !fila;
  const [form, setForm] = useState({
    nome: fila?.nome || '',
    slug: fila?.slug || '',
    descricao: fila?.descricao || '',
    cor: fila?.cor || '#3b82f6',
    icone: fila?.icone || 'list-todo',
    departamentoId: fila?.departamentoId || '',
    nivelSuporteId: fila?.nivelSuporteId || '',
    slaMinutos: fila?.slaMinutos || 0,
    ordem: fila?.ordem || 0,
  });

  const activeDepts = departamentos.filter(d => d.ativo);
  const activeNiveis = niveis.filter(n => n.ativo);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-xl p-5 w-full max-w-lg space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900 dark:text-slate-100">{isNew ? 'Nova Fila' : `Editar "${fila!.nome}"`}</h3>
          <button onClick={onClose} className="text-neutral-400 dark:text-slate-500 hover:text-neutral-600"><X size={18} /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-slate-200 block mb-1">Nome *</label>
            <input type="text" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Ex: Suporte N1" className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-slate-200 block mb-1">Slug (auto-gerado)</label>
            <input type="text" value={form.slug} disabled placeholder="suporte-n1"
              className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 disabled:bg-gray-50 disabled:text-gray-500 font-mono" />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-700 dark:text-slate-200 block mb-1">Descricao</label>
          <input type="text" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-slate-200 block mb-1">Departamento *</label>
            <select value={form.departamentoId} onChange={(e) => setForm({ ...form, departamentoId: e.target.value })}
              className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800">
              <option value="">Selecione...</option>
              {activeDepts.map(d => (
                <option key={d.id} value={d.id}>{d.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-slate-200 block mb-1">Nivel de Suporte *</label>
            <select value={form.nivelSuporteId} onChange={(e) => setForm({ ...form, nivelSuporteId: e.target.value })}
              className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800">
              <option value="">Selecione...</option>
              {activeNiveis.map(n => (
                <option key={n.id} value={n.id}>{n.nome}{n.slaMinutos ? ` (${n.slaMinutos}min)` : ''}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-slate-200 block mb-1">SLA (minutos)</label>
            <input type="number" min={0} value={form.slaMinutos} onChange={(e) => setForm({ ...form, slaMinutos: parseInt(e.target.value) || 0 })}
              className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-slate-200 block mb-1">Ordem</label>
            <input type="number" min={0} value={form.ordem} onChange={(e) => setForm({ ...form, ordem: parseInt(e.target.value) || 0 })}
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
        </div>

        <div className="flex gap-2 pt-3 border-t">
          <button onClick={onClose} disabled={saving} className="flex-1 px-4 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50">Cancelar</button>
          <button onClick={() => onSave({
            ...form,
            slaMinutos: form.slaMinutos || undefined,
          })} disabled={saving || !form.nome.trim() || !form.departamentoId || !form.nivelSuporteId}
            className="flex-1 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-1.5">
            <Save size={14} /> {saving ? 'Salvando...' : isNew ? 'Criar' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
