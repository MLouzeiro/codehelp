import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Edit3, Save, X, Copy, ListChecks } from 'lucide-react';
import api from '../services/api';
import { ChecklistTemplate } from '../types';

interface Props {
  onSelectTemplate?: (template: ChecklistTemplate) => void;
  mode?: 'manage' | 'select';
}

export default function ChecklistTemplateManager({ onSelectTemplate, mode = 'manage' }: Props) {
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<string | null>(null);
  const [novoTemplate, setNovoTemplate] = useState(false);
  const [form, setForm] = useState({ nome: '', descricao: '', categoria: 'geral', items: [{ titulo: '', ordem: 0 }], publico: false });
  const [salvando, setSalvando] = useState(false);

  const loadTemplates = useCallback(async () => {
    try {
      const { data } = await api.get('/helpdesk/checklist-templates');
      setTemplates(data);
    } catch (err) {
      console.error('Erro ao carregar templates:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const parseItems = (items: string) => {
    try { return JSON.parse(items); } catch { return []; }
  };

  const handleSave = async () => {
    if (!form.nome.trim()) return;
    setSalvando(true);
    try {
      const validItems = form.items.filter(i => i.titulo.trim()).map((item, idx) => ({ ...item, ordem: idx }));
      if (editando) {
        await api.put(`/helpdesk/checklist-templates/${editando}`, { ...form, items: validItems });
      } else {
        await api.post('/helpdesk/checklist-templates', { ...form, items: validItems });
      }
      setEditando(null);
      setNovoTemplate(false);
      setForm({ nome: '', descricao: '', categoria: 'geral', items: [{ titulo: '', ordem: 0 }], publico: false });
      loadTemplates();
    } catch (err) {
      console.error('Erro ao salvar template:', err);
    } finally {
      setSalvando(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este template?')) return;
    try {
      await api.delete(`/helpdesk/checklist-templates/${id}`);
      loadTemplates();
    } catch (err) {
      console.error('Erro ao deletar template:', err);
    }
  };

  const startEdit = (t: ChecklistTemplate) => {
    setEditando(t.id);
    setNovoTemplate(false);
    setForm({
      nome: t.nome,
      descricao: t.descricao || '',
      categoria: t.categoria || 'geral',
      items: parseItems(t.items),
      publico: t.publico,
    });
  };

  if (loading) return <div className="text-sm text-slate-400 py-4">Carregando templates...</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListChecks size={16} className="text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Templates de Checklist</span>
        </div>
        {mode === 'manage' && (
          <button onClick={() => { setNovoTemplate(true); setEditando(null); setForm({ nome: '', descricao: '', categoria: 'geral', items: [{ titulo: '', ordem: 0 }], publico: false }); }}
            className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
            <Plus size={14} /> Novo
          </button>
        )}
      </div>

      {(novoTemplate || editando) && (
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 space-y-2">
          <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome do template"
            className="w-full text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-400 text-slate-700 dark:text-slate-300" />
          <input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Descricao (opcional)"
            className="w-full text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-400 text-slate-700 dark:text-slate-300" />
          <div className="flex gap-2">
            <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
              className="flex-1 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 outline-none text-slate-700 dark:text-slate-300">
              <option value="geral">Geral</option>
              <option value="desenvolvimento">Desenvolvimento</option>
              <option value="marketing">Marketing</option>
              <option value="interface">Interface</option>
              <option value="suporte">Suporte</option>
            </select>
            <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
              <input type="checkbox" checked={form.publico} onChange={e => setForm(f => ({ ...f, publico: e.target.checked }))} className="rounded" />
              Publico
            </label>
          </div>
          <div className="space-y-1">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Itens:</span>
            {form.items.map((item, idx) => (
              <div key={idx} className="flex gap-1">
                <input value={item.titulo} onChange={e => {
                  const items = [...form.items]; items[idx] = { ...items[idx], titulo: e.target.value, ordem: idx }; setForm(f => ({ ...f, items }));
                }} placeholder={`Item ${idx + 1}`}
                  className="flex-1 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 outline-none focus:border-blue-400 text-slate-700 dark:text-slate-300" />
                {form.items.length > 1 && (
                  <button onClick={() => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))}
                    className="text-red-400 hover:text-red-600 p-1"><Trash2 size={12} /></button>
                )}
              </div>
            ))}
            <button onClick={() => setForm(f => ({ ...f, items: [...f.items, { titulo: '', ordem: f.items.length }] }))}
              className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline">+ Adicionar item</button>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleSave} disabled={salvando || !form.nome.trim()}
              className="flex-1 text-xs bg-blue-600 hover:bg-blue-700 text-white py-1.5 rounded-lg font-medium disabled:opacity-40 transition-colors">
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
            <button onClick={() => { setEditando(null); setNovoTemplate(false); }}
              className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 px-3 py-1.5">Cancelar</button>
          </div>
        </div>
      )}

      {templates.length === 0 && !novoTemplate ? (
        <div className="text-xs text-slate-400 dark:text-slate-500 text-center py-4">Nenhum template criado</div>
      ) : (
        <div className="space-y-2">
          {templates.map(t => (
            <div key={t.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{t.nome}</div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500">{t.categoria} · {parseItems(t.items).length} itens</div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {onSelectTemplate && (
                    <button onClick={() => onSelectTemplate(t)} className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline px-1">Usar</button>
                  )}
                  {mode === 'manage' && (
                    <>
                      <button onClick={() => startEdit(t)} className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 p-0.5"><Edit3 size={12} /></button>
                      <button onClick={() => handleDelete(t.id)} className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 p-0.5"><Trash2 size={12} /></button>
                    </>
                  )}
                </div>
              </div>
              {parseItems(t.items).length > 0 && (
                <div className="mt-1.5 space-y-0.5">
                  {parseItems(t.items).slice(0, 5).map((item: any, i: number) => (
                    <div key={i} className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <div className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                      {item.titulo}
                    </div>
                  ))}
                  {parseItems(t.items).length > 5 && (
                    <div className="text-[11px] text-slate-400 dark:text-slate-500">+{parseItems(t.items).length - 5} mais</div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
