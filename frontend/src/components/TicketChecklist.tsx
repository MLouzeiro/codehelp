import { useState, useEffect, useCallback } from 'react';
import { Check, Plus, Trash2, GripVertical, ListChecks, Circle, CheckCircle2, Download } from 'lucide-react';
import api from '../services/api';
import type { TicketChecklist as TicketChecklistType } from '../types';
import ImportChecklistModal from './ImportChecklistModal';

interface Props {
  ticketId: string;
  onChange?: () => void;
}

export default function TicketChecklist({ ticketId, onChange }: Props) {
  const [items, setItems] = useState<TicketChecklistType[]>([]);
  const [novoItem, setNovoItem] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editandoTitulo, setEditandoTitulo] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);

  const loadChecklist = useCallback(async () => {
    try {
      const { data } = await api.get(`/helpdesk/tickets/${ticketId}/checklist`);
      setItems(data);
    } catch {
      setItems([]);
    }
  }, [ticketId]);

  useEffect(() => { loadChecklist(); }, [loadChecklist]);

  const addItem = async () => {
    if (!novoItem.trim()) return;
    setSalvando(true);
    try {
      await api.post(`/helpdesk/tickets/${ticketId}/checklist`, {
        titulo: novoItem.trim(),
        ordem: items.length,
      });
      setNovoItem('');
      loadChecklist();
      onChange?.();
    } catch {
    } finally {
      setSalvando(false);
    }
  };

  const toggleItem = async (id: string) => {
    try {
      await api.patch(`/helpdesk/checklist/${id}/toggle`);
      loadChecklist();
      onChange?.();
    } catch {}
  };

  const deleteItem = async (id: string) => {
    try {
      await api.delete(`/helpdesk/checklist/${id}`);
      loadChecklist();
      onChange?.();
    } catch {}
  };

  const salvarEdicao = async (id: string) => {
    if (!editandoTitulo.trim()) return;
    try {
      await api.patch(`/helpdesk/checklist/${id}`, { titulo: editandoTitulo.trim() });
      setEditandoId(null);
      loadChecklist();
    } catch {}
  };

  const concluidos = items.filter((i) => i.concluida).length;
  const total = items.length;
  const percentual = total > 0 ? Math.round((concluidos / total) * 100) : 0;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex items-center gap-2">
        <ListChecks size={16} className="text-blue-600 dark:text-blue-400" />
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Checklist</span>
        {total > 0 && (
          <span className="text-xs text-slate-500 dark:text-slate-400 ml-auto">
            {concluidos}/{total} ({percentual}%)
          </span>
        )}
        <button onClick={() => setShowImportModal(true)} className="ml-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" title="Importar template">
          <Download size={14} />
        </button>
      </div>

      {total > 0 && (
        <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700/50">
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
            <div
              className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${percentual}%` }}
            />
          </div>
        </div>
      )}

      <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/30 group">
            <button onClick={() => toggleItem(item.id)} className="flex-shrink-0">
              {item.concluida ? (
                <CheckCircle2 size={18} className="text-emerald-500" />
              ) : (
                <Circle size={18} className="text-slate-300 dark:text-slate-600 hover:text-emerald-400 transition-colors" />
              )}
            </button>
            {editandoId === item.id ? (
              <input
                type="text"
                value={editandoTitulo}
                onChange={(e) => setEditandoTitulo(e.target.value)}
                onBlur={() => salvarEdicao(item.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') salvarEdicao(item.id);
                  if (e.key === 'Escape') setEditandoId(null);
                }}
                autoFocus
                className="flex-1 text-sm bg-white dark:bg-slate-800 border border-blue-300 dark:border-blue-600 rounded px-2 py-0.5 outline-none text-slate-700 dark:text-slate-300"
              />
            ) : (
              <span
                onDoubleClick={() => {
                  setEditandoId(item.id);
                  setEditandoTitulo(item.titulo);
                }}
                className={`flex-1 text-sm cursor-default ${
                  item.concluida
                    ? 'text-slate-400 dark:text-slate-500 line-through'
                    : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                {item.titulo}
              </span>
            )}
            <button
              onClick={() => deleteItem(item.id)}
              className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-50 dark:hover:bg-red-900/30 rounded text-slate-400 hover:text-red-500"
              title="Remover"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>

      <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-700/50">
        <div className="flex gap-2">
          <input
            type="text"
            value={novoItem}
            onChange={(e) => setNovoItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addItem();
            }}
            placeholder="Adicionar item..."
            className="flex-1 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 outline-none focus:border-blue-400 dark:focus:border-blue-500 transition-colors text-slate-700 dark:text-slate-300 placeholder-slate-400"
            disabled={salvando}
          />
          <button
            onClick={addItem}
            disabled={!novoItem.trim() || salvando}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {showImportModal && (
        <ImportChecklistModal ticketId={ticketId} onClose={() => setShowImportModal(false)} onImported={() => { loadChecklist(); onChange?.(); }} />
      )}
    </div>
  );
}
