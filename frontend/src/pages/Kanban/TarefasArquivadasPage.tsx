import { useState, useEffect, useCallback } from 'react';
import {
  Archive, RotateCcw, Trash2, Loader2, Search, ChevronLeft, ChevronRight,
  X, FileText, User, Building2,
} from 'lucide-react';
import { useKanban } from '../../hooks/useKanban';
import type { KanbanTask } from '../../types/kanban';

interface ArchivedItem {
  id: string;
  numero: number;
  titulo: string;
  descricao?: string | null;
  statusPrazo?: string | null;
  tipoTarefa?: string | null;
  arquivadoEm?: string | null;
  arquivadoMotivo?: string | null;
  arquivadoPor?: { id: string; name: string } | null;
  responsavel?: { id: string; name: string } | null;
  client?: { id: string; razaoSocial: string; nomeFantasia?: string } | null;
  column?: { id: string; nome: string } | null;
  departamento?: { id: string; nome: string } | null;
  _count?: { subtasks: number; activities: number };
}

export default function TarefasArquivadasPage() {
  const { listArchivedTasks, restoreTask, deleteTaskDefinitive, loading } = useKanban();
  const [items, setItems] = useState<ArchivedItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState<ArchivedItem | null>(null);
  const [deleteMotivo, setDeleteMotivo] = useState('');

  const load = useCallback(async () => {
    const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    const result = await listArchivedTasks({ ...clean, page, pageSize });
    setItems(result?.items || []);
    setTotal(result?.total || 0);
  }, [filters, page, pageSize, listArchivedTasks]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRestore = async (task: ArchivedItem) => {
    if (!confirm(`Restaurar a tarefa #${task.numero}?`)) return;
    await restoreTask(task.id);
    load();
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    if (!deleteMotivo.trim()) { alert('Informe o motivo da exclusão definitiva'); return; }
    const ok = await deleteTaskDefinitive(confirmDelete.id, deleteMotivo);
    if (ok) {
      setConfirmDelete(null);
      setDeleteMotivo('');
      load();
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-slate-900">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <Archive size={22} className="text-gray-400" /> Tarefas Arquivadas
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">{total} tarefa(s) arquivada(s)</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="px-6 py-3 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            placeholder="Buscar por título ou número..."
            className="input pl-8 text-sm w-64"
            value={filters.busca || ''}
            onChange={(e) => setFilters((f) => ({ ...f, busca: e.target.value }))}
          />
        </div>
        <select
          className="input text-sm"
          value={filters.statusPrazo || ''}
          onChange={(e) => setFilters((f) => ({ ...f, statusPrazo: e.target.value }))}
        >
          <option value="">Status de prazo</option>
          <option value="no_prazo">No prazo</option>
          <option value="proxima">Próxima</option>
          <option value="atencao">Atenção</option>
          <option value="atrasada">Atrasada</option>
          <option value="concluida">Concluída</option>
        </select>
        <input
          type="date"
          className="input text-sm"
          value={filters.dataArquivadoDe || ''}
          onChange={(e) => setFilters((f) => ({ ...f, dataArquivadoDe: e.target.value }))}
          title="Arquivadas a partir de"
        />
        <input
          type="date"
          className="input text-sm"
          value={filters.dataArquivadoAte || ''}
          onChange={(e) => setFilters((f) => ({ ...f, dataArquivadoAte: e.target.value }))}
          title="Arquivadas até"
        />
        <button onClick={() => { setFilters({}); setPage(1); }} className="text-xs text-gray-500 dark:text-slate-400 hover:text-red-500 flex items-center gap-1">
          <X size={12} /> Limpar
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="animate-spin text-codemed-500" size={32} />
          </div>
        ) : (
          <div className="space-y-3">
            {items.length === 0 && (
              <div className="text-center py-16 text-gray-400 dark:text-slate-500">
                <Archive size={48} className="mx-auto mb-3 opacity-50" />
                <p className="text-sm">Nenhuma tarefa arquivada encontrada.</p>
              </div>
            )}
            {items.map((task) => (
              <div key={task.id} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-gray-400">#{task.numero}</span>
                    <span className="font-semibold text-gray-800 dark:text-slate-100 truncate">{task.titulo}</span>
                    {task.statusPrazo && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300">
                        {task.statusPrazo}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-slate-400 flex-wrap">
                    {task.responsavel && <span className="flex items-center gap-1"><User size={12} /> {task.responsavel.name}</span>}
                    {task.client && <span className="flex items-center gap-1"><Building2 size={12} /> {task.client.nomeFantasia || task.client.razaoSocial}</span>}
                    {task.column && <span className="flex items-center gap-1"><FileText size={12} /> {task.column.nome}</span>}
                    {task.arquivadoPor && <span>Arquivado por {task.arquivadoPor.name}</span>}
                    {task.arquivadoEm && <span>em {new Date(task.arquivadoEm).toLocaleDateString('pt-BR')}</span>}
                    {task._count && <span>{task._count.subtasks} subtarefa(s) · {task._count.activities} atividades</span>}
                  </div>
                  {task.arquivadoMotivo && (
                    <p className="mt-1 text-xs text-gray-400 italic">Motivo: {task.arquivadoMotivo}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleRestore(task)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 flex items-center gap-1"
                  >
                    <RotateCcw size={12} /> Restaurar
                  </button>
                  <button
                    onClick={() => setConfirmDelete(task)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 flex items-center gap-1"
                  >
                    <Trash2 size={12} /> Excluir
                  </button>
                </div>
              </div>
            ))}

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1 disabled:opacity-40"
                >
                  <ChevronLeft size={14} /> Anterior
                </button>
                <span className="text-xs text-gray-500 dark:text-slate-400">Página {page} de {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1 disabled:opacity-40"
                >
                  Próxima <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirmação de exclusão definitiva */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setConfirmDelete(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                <Trash2 size={18} className="text-red-500" /> Excluir definitivamente
              </h3>
              <button onClick={() => setConfirmDelete(null)}><X size={18} className="text-gray-400" /></button>
            </div>
            <p className="text-sm text-gray-600 dark:text-slate-300 mb-2">
              Esta ação <strong>não pode ser desfeita</strong>. A tarefa <strong>#{confirmDelete.numero} - {confirmDelete.titulo}</strong> e todos os seus registros (subtasks, atividades, anexos, tags, tempo) serão removidos permanentemente.
            </p>
            <p className="text-sm text-gray-600 dark:text-slate-300 mb-4">
              O motivo é obrigatório e ficará registrado na auditoria.
            </p>
            <input
              autoFocus
              value={deleteMotivo}
              onChange={(e) => setDeleteMotivo(e.target.value)}
              placeholder="Motivo da exclusão definitiva"
              className="input w-full text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleDelete()}
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setConfirmDelete(null)} className="btn-secondary text-sm">Cancelar</button>
              <button onClick={handleDelete} disabled={!deleteMotivo.trim()} className="btn-primary text-sm bg-red-600 hover:bg-red-700 border-red-600 disabled:opacity-50">
                Excluir definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}