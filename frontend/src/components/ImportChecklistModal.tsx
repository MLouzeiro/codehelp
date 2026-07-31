import { useState, useEffect, useCallback } from 'react';
import { X, Download } from 'lucide-react';
import api from '../services/api';
import { ChecklistTemplate } from '../types';

interface Props {
  ticketId?: string;
  taskId?: string;
  onClose: () => void;
  onImported: () => void;
}

export default function ImportChecklistModal({ ticketId, taskId, onClose, onImported }: Props) {
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [importando, setImportando] = useState<string | null>(null);

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

  const handleImport = async (templateId: string) => {
    setImportando(templateId);
    try {
      if (ticketId) {
        await api.post(`/helpdesk/checklist-templates/${templateId}/import-ticket`, { ticketId });
      } else if (taskId) {
        await api.post(`/helpdesk/checklist-templates/${templateId}/import-kanban`, { taskId });
      }
      onImported();
      onClose();
    } catch (err) {
      console.error('Erro ao importar template:', err);
    } finally {
      setImportando(null);
    }
  };

  const parseItems = (items: string) => {
    try { return JSON.parse(items); } catch { return []; }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 w-full max-w-md max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Download size={16} className="text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Importar Checklist</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="text-sm text-slate-400 text-center py-8">Carregando...</div>
          ) : templates.length === 0 ? (
            <div className="text-sm text-slate-400 text-center py-8">Nenhum template disponivel</div>
          ) : (
            templates.map(t => {
              const items = parseItems(t.items);
              return (
                <button key={t.id} onClick={() => handleImport(t.id)} disabled={importando !== null}
                  className="w-full text-left bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 hover:border-blue-400 dark:hover:border-blue-500 transition-colors disabled:opacity-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-slate-700 dark:text-slate-300">{t.nome}</div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500">{t.categoria} · {items.length} itens</div>
                    </div>
                    {importando === t.id ? (
                      <span className="text-[11px] text-blue-600 dark:text-blue-400">Importando...</span>
                    ) : (
                      <Download size={14} className="text-slate-400" />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
