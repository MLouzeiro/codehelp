import { useState, useCallback, useEffect, useRef, lazy, Suspense, Component, type ReactNode } from 'react';
import {
  DndContext, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDroppable } from '@dnd-kit/core';
import {
  Plus, Trash2, Edit3, Calendar, CheckCircle2, Circle, X, Upload,
  Image as ImageIcon, Paperclip, Settings, Tag, GripVertical, Eye, EyeOff,
  LayoutGrid, Search, Copy, ArrowRightLeft, AlertTriangle, Clock, Download,
  Loader2, Sparkles, Play, Pause, Square, Archive, RotateCcw, FolderOpen,
} from 'lucide-react';
import DOMPurify from 'dompurify';
import { useKanban } from '../../hooks/useKanban';
import { useAuth } from '../../services/auth';
import api from '../../services/api';
import ImportChecklistModal from '../ImportChecklistModal';
import TaskTimeline from './TaskTimeline';
import { matchSearch } from '../../utils/text';
import type { KanbanBoard, KanbanColumn, KanbanTask, KanbanAttachment, KanbanTaskTag } from '../../types/kanban';
import { STATUS_PRAZO_LABEL, TIPOS_TAREFA } from '../../types/kanban';

const RichTextEditor = lazy(() => import('./RichTextEditor').then(m => ({ default: m.RichTextEditor })));

class ErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { hasError: boolean; error: any }> {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-4 text-center text-sm text-red-500 dark:text-red-400">
          <p>Erro ao carregar componente.</p>
          <button onClick={() => this.setState({ hasError: false, error: null })} className="mt-2 text-xs text-codemed-600 hover:underline">Tentar novamente</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const priorityColors: Record<string, string> = {
  baixa: 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300',
  media: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  alta: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  urgente: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

const COLUMN_COLORS = ['#6b7280', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

interface KanbanBoardProps {
  board: KanbanBoard;
  onTaskClick?: (task: KanbanTask) => void;
  onRefresh?: () => void;
  onBackToGallery?: () => void;
}

function TaskCard({ task, onClick }: { task: KanbanTask; onClick?: () => void }) {
  const subtasksDone = task._count?.subtasks ?? task.subtasks?.filter(s => s.concluida).length ?? 0;
  const subtasksTotal = task._count?.subtasks ?? task.subtasks?.length ?? 0;
  const progress = subtasksTotal > 0 ? Math.round((subtasksDone / subtasksTotal) * 100) : 0;

  const priorityConfig: Record<string, { label: string; color: string; bg: string }> = {
    baixa: { label: 'Baixa', color: 'text-gray-600 dark:text-slate-300', bg: 'bg-gray-100 dark:bg-slate-700' },
    media: { label: 'Normal', color: 'text-blue-600 dark:text-blue-300', bg: 'bg-blue-100 dark:bg-blue-900/40' },
    alta: { label: 'Alta', color: 'text-amber-600 dark:text-amber-300', bg: 'bg-amber-100 dark:bg-amber-900/40' },
    urgente: { label: 'Urgente', color: 'text-red-600 dark:text-red-300', bg: 'bg-red-100 dark:bg-red-900/40' },
  };
  const pri = priorityConfig[task.prioridade] || priorityConfig.media;

  const lastActivity = task.activities?.[0]?.createdAt || task.lastActivityAt || task.updatedAt;
  const hoursSinceActivity = lastActivity ? Math.floor((Date.now() - new Date(lastActivity).getTime()) / 3600000) : 999;
  const isInactive = hoursSinceActivity >= 24;
  const isVeryInactive = hoursSinceActivity >= 72;

  const imageAttachments = (task.attachments || []).filter(a => a.tipoMime?.startsWith('image/'));

  return (
    <div onClick={onClick} className={`bg-white dark:bg-slate-800 rounded-lg p-3 shadow-sm border cursor-pointer hover:shadow-md transition-all group ${isVeryInactive ? 'border-red-300 dark:border-red-700' : isInactive ? 'border-amber-300 dark:border-amber-700' : 'border-gray-100 dark:border-slate-700/50'}`}>
      {/* Inactivity Alert */}
      {isInactive && (
        <div className={`flex items-center gap-1 mb-2 px-1.5 py-0.5 rounded text-[10px] font-medium ${isVeryInactive ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'}`}>
          <AlertTriangle size={10} />
          {isVeryInactive ? `${Math.floor(hoursSinceActivity / 24)}d sem interação` : `${hoursSinceActivity}h sem interação`}
        </div>
      )}

      {/* Header: ID + Priority + Client badge */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-400 dark:text-slate-500 font-mono">#{task.numero}</span>
          {task.ticketId && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 font-medium" title="Vinculado a ticket">
              TICKET
            </span>
          )}
          {task.client && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 font-medium truncate max-w-[100px]">
              {task.client.nomeFantasia || task.client.razaoSocial}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {task.responsavel && (
            <div className="w-5 h-5 rounded-full bg-codemed-500 flex items-center justify-center text-white text-[8px] font-bold" title={task.responsavel.name}>
              {task.responsavel.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </div>

      {/* Image Thumbnail */}
      {imageAttachments.length > 0 && (
        <div className="mb-2">
          <div className="flex gap-1">
            {imageAttachments.slice(0, 3).map(att => (
              <div key={att.id} className="w-12 h-12 rounded border border-gray-200 dark:border-slate-700 overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-slate-700">
                <img
                  src={att.url}
                  alt={att.nomeArquivo}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent && !parent.querySelector('.img-error-icon')) {
                      const errorDiv = document.createElement('div');
                      errorDiv.className = 'img-error-icon w-full h-full flex items-center justify-center text-gray-400';
                      errorDiv.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
                      parent.appendChild(errorDiv);
                    }
                  }}
                />
              </div>
            ))}
            {imageAttachments.length > 3 && (
              <div className="w-12 h-12 rounded border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 flex items-center justify-center text-[10px] text-gray-400">
                +{imageAttachments.length - 3}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Title */}
      <p className="text-sm font-medium text-gray-900 dark:text-slate-100 mb-1 leading-snug line-clamp-2">{task.titulo}</p>

      {/* Description preview */}
      {task.descricao && (
        <p className="text-xs text-gray-500 dark:text-slate-400 mb-2 line-clamp-2 leading-relaxed">
          {task.descricao.replace(/<[^>]*>/g, '').slice(0, 120)}{task.descricao.length > 120 ? '...' : ''}
        </p>
      )}

      {/* Tags */}
      {task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.tags.slice(0, 3).map(tt => (
            <span key={tt.id} className="text-[9px] px-1.5 py-0.5 rounded-full text-white font-medium" style={{ backgroundColor: tt.tag.cor }}>{tt.tag.nome}</span>
          ))}
          {task.tags.length > 3 && <span className="text-[9px] text-gray-400">+{task.tags.length - 3}</span>}
        </div>
      )}

      {/* Progress bar (only if has subtasks) */}
      {subtasksTotal > 0 && (
        <div className="mb-2">
          <div className="flex items-center justify-between text-[10px] text-gray-400 dark:text-slate-500 mb-1">
            <span>{subtasksDone}/{subtasksTotal} subtarefas</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-codemed-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* Footer: Priority badge + Category + Due date */}
      <div className="flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className={`px-1.5 py-0.5 rounded-full font-medium ${pri.bg} ${pri.color}`}>{pri.label}</span>
          {task.categoria && (
            <span className="px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 font-medium">{task.categoria}</span>
          )}
        </div>
        {task.prazoEntrega && (
          <span
            className="flex items-center gap-1 font-medium"
            style={{ color: STATUS_PRAZO_LABEL[task.statusPrazo || 'no_prazo']?.cor || '#6b7280' }}
            title={`Prazo: ${new Date(task.prazoEntrega).toLocaleString('pt-BR')} · Status: ${STATUS_PRAZO_LABEL[task.statusPrazo || 'no_prazo']?.label || 'No prazo'}`}
          >
            {STATUS_PRAZO_LABEL[task.statusPrazo || 'no_prazo']?.emoji || '🟢'}
            <span>{new Date(task.prazoEntrega).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
          </span>
        )}
        {task.tipoTarefa && task.tipoTarefa !== 'outro' && (
          <span className="text-[10px] text-gray-400 dark:text-slate-500" title={TIPOS_TAREFA.find(t => t.value === task.tipoTarefa)?.label}>
            {TIPOS_TAREFA.find(t => t.value === task.tipoTarefa)?.icon || '📋'}
          </span>
        )}
      </div>
    </div>
  );
}

function SortableTaskCard({ task, onClick }: { task: KanbanTask; onClick?: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, data: { type: 'task', task } });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return <div ref={setNodeRef} style={style} {...attributes} {...listeners}><TaskCard task={task} onClick={onClick} /></div>;
}

function ColumnContainer({ column, onTaskClick, onAddTask, onDeleteColumn, searchTitle, searchId, filterPriority }: {
  column: KanbanColumn; onTaskClick?: (t: KanbanTask) => void;
  onAddTask: (columnId: string) => void; onDeleteColumn?: (col: KanbanColumn) => void;
  searchTitle?: string; searchId?: string; filterPriority?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id, data: { type: 'column', column } });

  const filteredTasks = column.tasks.filter(task => {
    if (searchTitle && !matchSearch(task.titulo, searchTitle)) return false;
    if (searchId && !String(task.numero).includes(searchId)) return false;
    if (filterPriority && task.prioridade !== filterPriority) return false;
    return true;
  });

  const taskIds = filteredTasks.map(t => t.id);

  return (
    <div className={`flex flex-col min-w-[280px] max-w-[280px] bg-gray-50 dark:bg-slate-900/50 rounded-xl border transition-colors ${isOver ? 'border-codemed-500 bg-codemed-50/30 dark:bg-codemed-900/10' : 'border-gray-200 dark:border-slate-700'}`}>
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: column.cor || '#6b7280' }} />
          <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-200">{column.nome}</h3>
          <span className="text-[11px] text-gray-400 dark:text-slate-500 bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded-full">{filteredTasks.length}</span>
          {column.wipLimit && column.tasks.length >= column.wipLimit && <span className="text-[10px] text-red-500 font-medium">WIP: {column.wipLimit}</span>}
        </div>
        {onDeleteColumn && (
          <button onClick={() => onDeleteColumn(column)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
        )}
      </div>
      <div ref={setNodeRef} className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-280px)]">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {filteredTasks.map(task => <SortableTaskCard key={task.id} task={task} onClick={() => onTaskClick?.(task)} />)}
        </SortableContext>
        {filteredTasks.length === 0 && <div className="text-center py-8 text-xs text-gray-400 dark:text-slate-500">{column.tasks.length > 0 ? 'Nenhum resultado' : 'Arraste tarefas aqui'}</div>}
      </div>
      <button onClick={() => onAddTask(column.id)} className="flex items-center gap-1 px-3 py-2 text-xs text-gray-500 dark:text-slate-400 hover:text-codemed-600 dark:hover:text-codemed-400 transition-colors border-t border-gray-100 dark:border-slate-800">
        <Plus size={14} /> Adicionar tarefa
      </button>
    </div>
  );
}

export default function KanbanBoard({ board, onTaskClick, onRefresh, onBackToGallery }: KanbanBoardProps) {
  const { user } = useAuth();
  const { moveTask, createTask, createColumn, deleteColumn } = useKanban();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTaskColumnId, setNewTaskColumnId] = useState('');
  const [newTaskForm, setNewTaskForm] = useState({ titulo: '', descricao: '', prioridade: 'media', categoria: '', classificacao: '', responsavelId: '', dataInicio: '', prazoEntrega: '', tags: [] as string[] });
  const [showNewColumn, setShowNewColumn] = useState(false);
  const [newColumnForm, setNewColumnForm] = useState({ nome: '', cor: '#3b82f6' });
  const [selectedTask, setSelectedTask] = useState<KanbanTask | null>(null);
  const [showBoardSettings, setShowBoardSettings] = useState(false);
  const [searchTitle, setSearchTitle] = useState('');
  const [searchId, setSearchId] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    if (showNewTask && users.length === 0) {
      api.get('/auth/users').then(({ data }) => setUsers(data)).catch(() => {});
    }
  }, [showNewTask]);

  const handleDragStart = useCallback((event: DragStartEvent) => setActiveId(event.active.id as string), []);
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;
    const activeTask = active.data.current?.task as KanbanTask | undefined;
    if (!activeTask) return;
    let targetColumnId: string;
    const overData = over.data.current;
    if (overData?.type === 'column') targetColumnId = over.id as string;
    else if (overData?.type === 'task') targetColumnId = overData.task.columnId;
    else targetColumnId = over.id as string;
    if (activeTask.columnId !== targetColumnId || active.id !== over.id) {
      await moveTask(activeTask.id, targetColumnId);
      onRefresh?.();
    }
  }, [moveTask, onRefresh]);

  const handleAddTask = (columnId: string) => { setNewTaskColumnId(columnId); setNewTaskForm({ titulo: '', descricao: '', prioridade: 'media', categoria: '', classificacao: '', responsavelId: '', dataInicio: '', prazoEntrega: '', tags: [] }); setShowNewTask(true); };
  const handleSubmitTask = async () => {
    if (!newTaskForm.titulo.trim()) return;
    await createTask(board.id, {
      titulo: newTaskForm.titulo,
      columnId: newTaskColumnId,
      descricao: newTaskForm.descricao || undefined,
      prioridade: newTaskForm.prioridade,
      categoria: newTaskForm.categoria || undefined,
      classificacao: newTaskForm.classificacao || undefined,
      responsavelId: newTaskForm.responsavelId || undefined,
      dataInicio: newTaskForm.dataInicio || undefined,
      prazoEntrega: newTaskForm.prazoEntrega || undefined,
      tags: newTaskForm.tags.length > 0 ? newTaskForm.tags : undefined,
    });
    setShowNewTask(false); onRefresh?.();
  };
  const handleSubmitColumn = async () => {
    if (!newColumnForm.nome.trim()) return;
    await createColumn(board.id, { nome: newColumnForm.nome, cor: newColumnForm.cor });
    setShowNewColumn(false); setNewColumnForm({ nome: '', cor: '#3b82f6' }); onRefresh?.();
  };
  const handleDeleteColumn = async (col: KanbanColumn) => {
    if (col.tasks.length > 0 && !confirm(`A coluna "${col.nome}" tem ${col.tasks.length} tarefa(s). Elas serão movidas para a primeira coluna. Continuar?`)) return;
    await deleteColumn(col.id); onRefresh?.();
  };

  const activeTask = activeId ? board.columns.flatMap(c => c.tasks).find(t => t.id === activeId) : null;
  const currentTask = selectedTask ? board.columns.flatMap(c => c.tasks).find(t => t.id === selectedTask.id) || selectedTask : null;
  const isAdmin = user?.role === 'admin' || user?.role === 'gerente';

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          {onBackToGallery && (
            <button onClick={onBackToGallery} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors" title="Voltar aos quadros">
              <LayoutGrid size={18} />
            </button>
          )}
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xl" style={{ backgroundColor: `${board.cor || '#3b82f6'}20` }}>
            {board.icone || '📋'}
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">{board.nome}</h2>
            {board.descricao && <p className="text-sm text-gray-500 dark:text-slate-400">{board.descricao}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 dark:text-slate-500">{board.columns.filter(c => !c.hidden).length} colunas</span>
          {isAdmin && (
            <>
              <button onClick={() => setShowBoardSettings(true)} className="btn-secondary text-xs flex items-center gap-1" title="Configurações do quadro">
                <Settings size={14} />
              </button>
              <button onClick={() => setShowNewColumn(true)} className="btn-secondary text-xs flex items-center gap-1"><Plus size={14} /> Coluna</button>
            </>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3 px-6 py-2 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/30">
        <div className="relative flex-1 max-w-[200px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Pesquisar por Título..." value={searchTitle} onChange={e => setSearchTitle(e.target.value)} className="input w-full pl-8 py-1.5 text-xs" />
        </div>
        <div className="relative flex-1 max-w-[150px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Pesquisar por ID..." value={searchId} onChange={e => setSearchId(e.target.value)} className="input w-full pl-8 py-1.5 text-xs" />
        </div>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="input py-1.5 text-xs max-w-[130px]">
          <option value="">Prioridade</option>
          <option value="baixa">Baixa</option>
          <option value="media">Normal</option>
          <option value="alta">Alta</option>
          <option value="urgente">Urgente</option>
        </select>
        {(searchTitle || searchId || filterPriority) && (
          <button onClick={() => { setSearchTitle(''); setSearchId(''); setFilterPriority(''); }} className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1">
            <X size={12} /> Limpar
          </button>
        )}
      </div>

      <div className="flex-1 overflow-x-auto p-6">
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 h-full">
            {board.columns.filter(col => !col.hidden).sort((a, b) => a.ordem - b.ordem).map(col => (
              <ColumnContainer key={col.id} column={col} onTaskClick={(t) => { setSelectedTask(t); onTaskClick?.(t); }} onAddTask={handleAddTask} onDeleteColumn={isAdmin ? handleDeleteColumn : undefined} searchTitle={searchTitle} searchId={searchId} filterPriority={filterPriority} />
            ))}
          </div>
          <DragOverlay>{activeTask && <div className="rotate-2 opacity-90"><TaskCard task={activeTask} /></div>}</DragOverlay>
        </DndContext>
      </div>

      {showNewTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowNewTask(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-slate-100">Nova Tarefa</h3>
              <button onClick={() => setShowNewTask(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <input type="text" placeholder="Título *" value={newTaskForm.titulo} onChange={e => setNewTaskForm({ ...newTaskForm, titulo: e.target.value })} className="input w-full" autoFocus />
              <textarea placeholder="Descrição" value={newTaskForm.descricao} onChange={e => setNewTaskForm({ ...newTaskForm, descricao: e.target.value })} className="input w-full" rows={2} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1 block">Início Previsto</label>
                  <input type="datetime-local" value={newTaskForm.dataInicio} onChange={e => setNewTaskForm({ ...newTaskForm, dataInicio: e.target.value })} className="input w-full" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1 block">Prazo de Entrega</label>
                  <input type="datetime-local" value={newTaskForm.prazoEntrega} onChange={e => setNewTaskForm({ ...newTaskForm, prazoEntrega: e.target.value })} className="input w-full" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <select value={newTaskForm.prioridade} onChange={e => setNewTaskForm({ ...newTaskForm, prioridade: e.target.value })} className="input">
                  <option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option><option value="urgente">Urgente</option>
                </select>
                <select value={newTaskForm.categoria} onChange={e => setNewTaskForm({ ...newTaskForm, categoria: e.target.value })} className="input">
                  <option value="">Categoria</option>
                  {['Outros', 'Suporte', 'Desenvolvimento', 'Marketing', 'Financeiro', 'Comercial'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={newTaskForm.classificacao} onChange={e => setNewTaskForm({ ...newTaskForm, classificacao: e.target.value })} className="input">
                  <option value="">Classificação</option>
                  {['Tarefa sem classificação específica', 'Bug', 'Feature', 'Melhoria', 'Documentação', 'Refatoração'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1 block">Responsável</label>
                <select value={newTaskForm.responsavelId} onChange={e => setNewTaskForm({ ...newTaskForm, responsavelId: e.target.value })} className="input w-full">
                  <option value="">Selecionar responsável...</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              {board.tags && board.tags.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1 block">Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {board.tags.map(tag => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => {
                          const newTags = newTaskForm.tags.includes(tag.id)
                            ? newTaskForm.tags.filter(t => t !== tag.id)
                            : [...newTaskForm.tags, tag.id];
                          setNewTaskForm({ ...newTaskForm, tags: newTags });
                        }}
                        className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${newTaskForm.tags.includes(tag.id) ? 'ring-2 ring-offset-1' : ''}`}
                        style={{ backgroundColor: tag.cor || '#6b7280', color: '#fff' }}
                      >
                        {tag.nome}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <button onClick={handleSubmitTask} className="btn-primary w-full" disabled={!newTaskForm.titulo.trim()}>Criar Tarefa</button>
            </div>
          </div>
        </div>
      )}

      {showNewColumn && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowNewColumn(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-slate-100">Nova Coluna</h3>
              <button onClick={() => setShowNewColumn(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <input type="text" placeholder="Nome da coluna *" value={newColumnForm.nome} onChange={e => setNewColumnForm({ ...newColumnForm, nome: e.target.value })} className="input w-full" autoFocus />
              <div className="flex gap-2 flex-wrap">
                {COLUMN_COLORS.map(c => <button key={c} onClick={() => setNewColumnForm({ ...newColumnForm, cor: c })} className={`w-7 h-7 rounded-full border-2 transition-all ${newColumnForm.cor === c ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />)}
              </div>
              <button onClick={handleSubmitColumn} className="btn-primary w-full" disabled={!newColumnForm.nome.trim()}>Criar Coluna</button>
            </div>
          </div>
        </div>
      )}

      {currentTask && (
        <ErrorBoundary fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSelectedTask(null)}><div className="bg-white dark:bg-slate-800 rounded-xl p-6 text-center" onClick={e => e.stopPropagation()}><p className="text-red-500 dark:text-red-400 text-sm mb-3">Erro ao carregar detalhes da tarefa.</p><button onClick={() => setSelectedTask(null)} className="btn-primary text-xs px-4 py-2">Fechar</button></div></div>}>
          <TaskDetailPanel task={currentTask} onClose={() => setSelectedTask(null)} onRefresh={onRefresh} />
        </ErrorBoundary>
      )}
      {showBoardSettings && <BoardSettingsModal board={board} onClose={() => setShowBoardSettings(false)} onRefresh={onRefresh} />}
    </div>
  );
}

function TaskDetailPanel({ task, onClose, onRefresh }: { task: KanbanTask; onClose: () => void; onRefresh?: () => void }) {
  const { user } = useAuth();
  const kanbanCtx = useKanban();
  const { updateTask, createSubtask, toggleSubtask, deleteSubtask, addComment, getActivityLog, uploadAttachments, deleteAttachment, createTag, deleteTag, transferTask, duplicateTask, boards, fetchBoards, archiveTask, reopenTask, getTaskTimeSummary, pauseTimer, resumeTimer } = kanbanCtx;
  const isAdmin = user?.role === 'admin' || user?.role === 'gerente';
  const [activity, setActivity] = useState<any[]>([]);
  const [comment, setComment] = useState('');
  const [newSubtask, setNewSubtask] = useState('');
  const [editing, setEditing] = useState(false);
  const [timeSummary, setTimeSummary] = useState<any>(null);
  const [runningTimer, setRunningTimer] = useState<any>(null);
  const [timerBusy, setTimerBusy] = useState(false);
  const [showReopen, setShowReopen] = useState(false);
  const [reopenMotivo, setReopenMotivo] = useState('');
  const [showArchive, setShowArchive] = useState(false);
  const [archiveMotivo, setArchiveMotivo] = useState('');
  const [form, setForm] = useState({
    titulo: task?.titulo || '',
    descricao: task?.descricao || '',
    prioridade: task?.prioridade || 'media',
    categoria: task?.categoria || '',
    classificacao: task?.classificacao || '',
    prazoEntrega: task?.prazoEntrega ? task.prazoEntrega.split('T')[0] : '',
    dataInicio: task?.dataInicio ? task.dataInicio.split('T')[0] : '',
    estimativaHoras: task?.estimativaHoras?.toString() || '',
    responsavelId: task?.responsavelId || '',
    tipoTarefa: task?.tipoTarefa || 'outro',
  });
  const [attachments, setAttachments] = useState<KanbanAttachment[]>((task as any)?.attachments || []);
  const [activeTab, setActiveTab] = useState<'info' | 'checklist' | 'activity' | 'attachments'>('info');
  const [uploading, setUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showTagInput, setShowTagInput] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#6366f1');
  const [taskTags, setTaskTags] = useState<KanbanTaskTag[]>(task?.tags || []);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferBoardId, setTransferBoardId] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [showImportChecklist, setShowImportChecklist] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [descricaoLocal, setDescricaoLocal] = useState(task?.descricao || '');
  const [localSubtasks, setLocalSubtasks] = useState<any[]>(task?.subtasks || []);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!task?.id) return;
    getActivityLog(task.id).then(setActivity).catch(() => {});
    setAttachments((task as any)?.attachments || []);
    setDescricaoLocal(task?.descricao || '');
    setLocalSubtasks(task?.subtasks || []);
    setTaskTags(task?.tags || []);
    api.get('/users', { params: { active: 'true' } }).then(({ data }) => setUsers(data?.users || [])).catch(() => {});
    getTaskTimeSummary(task.id).then(setTimeSummary).catch(() => {});
    api.get('/timetracking/running').then(({ data }) => setRunningTimer(data || null)).catch(() => {});
  }, [task?.id, task?.subtasks]);

  if (!task) return null;

  const timeOpen = task.createdAt ? Math.floor((Date.now() - new Date(task.createdAt).getTime()) / 3600000) : 0;
  const timeOpenStr = timeOpen > 24 ? `${Math.floor(timeOpen / 24)}d ${timeOpen % 24}h` : `${timeOpen}h`;

  const isTaskTimerRunning = runningTimer?.tarefaId === task.id && !runningTimer.dataFim;

  const handleStartTimer = async () => {
    if (!user?.id) return;
    setTimerBusy(true);
    try {
      const { data } = await api.post('/timetracking/start', { tarefaId: task.id, ticketId: task.ticketId, clienteId: task.clientId, tipo: task.tipoTarefa || 'suporte', descricao: `Tarefa #${task.numero} - ${task.titulo}` });
      setRunningTimer(data);
      onRefresh?.();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao iniciar tempo');
    } finally {
      setTimerBusy(false);
    }
  };

  const handlePauseTimer = async () => {
    if (!runningTimer) return;
    setTimerBusy(true);
    try {
      const data = await pauseTimer(runningTimer.id);
      setRunningTimer(data);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao pausar tempo');
    } finally {
      setTimerBusy(false);
    }
  };

  const handleResumeTimer = async () => {
    if (!runningTimer) return;
    setTimerBusy(true);
    try {
      const data = await resumeTimer(runningTimer.id);
      setRunningTimer(data);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao retomar tempo');
    } finally {
      setTimerBusy(false);
    }
  };

  const handleStopTimer = async () => {
    if (!runningTimer) return;
    setTimerBusy(true);
    try {
      const { data } = await api.post(`/timetracking/${runningTimer.id}/stop`);
      setRunningTimer(null);
      const summary = await getTaskTimeSummary(task.id);
      setTimeSummary(summary);
      onRefresh?.();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao parar tempo');
    } finally {
      setTimerBusy(false);
    }
  };

  const handleArchive = async () => {
    if (!confirm('Arquivar esta tarefa?')) return;
    await archiveTask(task.id, archiveMotivo || undefined);
    onClose();
    onRefresh?.();
  };

  const handleReopen = async () => {
    if (!reopenMotivo.trim()) { alert('Informe o motivo da reabertura'); return; }
    await reopenTask(task.id, reopenMotivo);
    setShowReopen(false);
    setReopenMotivo('');
    onRefresh?.();
  };

  const handleSave = async () => {
    await updateTask(task.id, {
      titulo: form.titulo,
      descricao: form.descricao,
      prioridade: form.prioridade,
      categoria: form.categoria || undefined,
      classificacao: form.classificacao || undefined,
      prazoEntrega: form.prazoEntrega ? new Date(form.prazoEntrega).toISOString() : null,
      dataInicio: form.dataInicio ? new Date(form.dataInicio).toISOString() : null,
      estimativaHoras: form.estimativaHoras ? parseFloat(form.estimativaHoras) : undefined,
      responsavelId: form.responsavelId || undefined,
      tipoTarefa: form.tipoTarefa || undefined,
    });
    setEditing(false);
    onRefresh?.();
  };

  const handleAddSubtask = async () => {
    if (!newSubtask.trim()) return;
    const now = new Date().toISOString();
    const optimistic = { id: `temp-${Date.now()}`, titulo: newSubtask.trim(), concluida: false, ordem: localSubtasks.length, taskId: task.id, createdAt: now, updatedAt: now } as any;
    setLocalSubtasks(prev => [...prev, optimistic]);
    setNewSubtask('');
    await createSubtask(task.id, optimistic.titulo);
    onRefresh?.();
  };

  const handleToggleSubtask = async (subtaskId: string) => {
    setLocalSubtasks(prev => prev.map(s => s.id === subtaskId ? { ...s, concluida: !s.concluida } : s));
    await toggleSubtask(subtaskId);
    onRefresh?.();
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    setLocalSubtasks(prev => prev.filter(s => s.id !== subtaskId));
    await deleteSubtask(subtaskId);
    onRefresh?.();
  };
  const handleComment = async () => { if (!comment.trim()) return; await addComment(task.id, comment); setComment(''); const log = await getActivityLog(task.id); setActivity(log); };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const result = await uploadAttachments(task.id, files);
    if (result) {
      setAttachments(prev => [...prev, ...(Array.isArray(result) ? result : [result])]);
      onRefresh?.();
    }
    setUploading(false);
  };

  const handleDeleteAttachment = async (attId: string) => {
    if (!confirm('Remover este anexo?')) return;
    const ok = await deleteAttachment(attId);
    if (ok) setAttachments(prev => prev.filter(a => a.id !== attId));
  };

  const handleDescricaoChange = (html: string) => {
    setDescricaoLocal(html);
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      updateTask(task.id, { descricao: html });
      onRefresh?.();
    }, 800);
  };

  const handleResponsavelChange = async (responsavelId: string) => {
    await updateTask(task.id, { responsavelId: responsavelId || undefined });
    onRefresh?.();
  };

  const handleAutoCategorize = async () => {
    setAiLoading(true);
    try {
      const { data } = await api.post(`/kanban/tasks/${task.id}/auto-categorize`);
      const cat = data.categorization;
      setForm(f => ({
        ...f,
        prioridade: cat.prioridade || f.prioridade,
        classificacao: cat.classificacao || f.classificacao,
        categoria: cat.categoria || f.categoria,
      }));
      await updateTask(task.id, {
        prioridade: cat.prioridade,
        classificacao: cat.classificacao,
        categoria: cat.categoria,
      });
      onRefresh?.();
    } catch (err) {
      console.error('Erro ao categorizar:', err);
    } finally {
      setAiLoading(false);
    }
  };

  const handleAddTag = async () => {
    if (!newTagName.trim()) return;
    const tag = await createTag(task.boardId, { nome: newTagName, cor: newTagColor });
    if (tag) {
      const updatedTags = [...taskTags, { id: `temp-${tag.id}`, taskId: task.id, tagId: tag.id, tag }];
      await updateTask(task.id, { tags: updatedTags.map(t => t.tagId) } as any);
      setTaskTags(updatedTags);
      setNewTagName('');
      setShowTagInput(false);
      onRefresh?.();
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    const updatedTags = taskTags.filter(t => t.tagId !== tagId);
    await updateTask(task.id, { tags: updatedTags.map(t => t.tagId) } as any);
    setTaskTags(updatedTags);
    onRefresh?.();
  };

  const handleTransfer = async () => {
    if (!transferBoardId) return;
    setTransferring(true);
    const result = await transferTask(task.id, transferBoardId);
    setTransferring(false);
    if (result) { setShowTransfer(false); onClose(); onRefresh?.(); }
  };

  const handleDuplicate = async () => {
    setDuplicating(true);
    const result = await duplicateTask(task.id);
    setDuplicating(false);
    if (result) { onClose(); onRefresh?.(); }
  };

  const TAG_COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

  const imageAttachments = attachments.filter(a => a.tipoMime?.startsWith('image/'));
  const otherAttachments = attachments.filter(a => !a.tipoMime?.startsWith('image/'));
  const subtasksDone = localSubtasks.filter((s: any) => s.concluida).length;
  const subtasksTotal = localSubtasks.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-5 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono text-gray-400">#{task.numero}</span>
            {editing ? <input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} className="input text-lg font-bold" />
              : <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">{task.titulo}</h2>}
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <>
                <button onClick={handleDuplicate} disabled={duplicating} className="text-xs text-gray-500 dark:text-slate-400 hover:text-codemed-600 flex items-center gap-1" title="Duplicar tarefa">
                  <Copy size={14} /> {duplicating ? 'Duplicando...' : 'Duplicar'}
                </button>
                <button onClick={() => { setShowTransfer(true); fetchBoards(); }} className="text-xs text-gray-500 dark:text-slate-400 hover:text-codemed-600 flex items-center gap-1" title="Transferir para outro quadro">
                  <ArrowRightLeft size={14} /> Transferir
                </button>
              </>
            )}
            {task.dataConclusao && (
              <button onClick={() => setShowReopen(true)} className="text-xs text-orange-600 hover:underline flex items-center gap-1" title="Reabrir tarefa">
                <RotateCcw size={14} /> Reabrir
              </button>
            )}
            {isAdmin && !task.arquivado && (
              <button onClick={() => setShowArchive(true)} className="text-xs text-gray-500 dark:text-slate-400 hover:text-red-600 flex items-center gap-1" title="Arquivar tarefa">
                <Archive size={14} /> Arquivar
              </button>
            )}
            {isAdmin && <button onClick={() => editing ? handleSave() : setEditing(true)} className="text-xs text-codemed-600 hover:underline">{editing ? 'Salvar' : 'Editar'}</button>}
            <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
          </div>
        </div>

        {/* Reopen Modal */}
        {showReopen && (
          <div className="px-5 py-3 bg-orange-50 dark:bg-slate-900/60 border-b border-orange-200 dark:border-slate-700">
            <label className="text-xs text-orange-700 dark:text-orange-400 font-medium block mb-1">Motivo da reabertura (obrigatório)</label>
            <div className="flex gap-2">
              <input autoFocus value={reopenMotivo} onChange={e => setReopenMotivo(e.target.value)} className="input text-sm flex-1" placeholder="Ex: cliente retornou com o problema" onKeyDown={e => e.key === 'Enter' && handleReopen()} />
              <button onClick={handleReopen} disabled={!reopenMotivo.trim()} className="btn-primary text-xs px-3">Reabrir</button>
              <button onClick={() => setShowReopen(false)} className="text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300">Cancelar</button>
            </div>
          </div>
        )}

        {/* Archive Modal */}
        {showArchive && (
          <div className="px-5 py-3 bg-gray-50 dark:bg-slate-900/60 border-b border-gray-200 dark:border-slate-700">
            <label className="text-xs text-gray-600 dark:text-slate-300 font-medium block mb-1">Motivo do arquivamento (opcional)</label>
            <div className="flex gap-2">
              <input autoFocus value={archiveMotivo} onChange={e => setArchiveMotivo(e.target.value)} className="input text-sm flex-1" placeholder="Ex: concluído e sem acompanhamento" onKeyDown={e => e.key === 'Enter' && handleArchive()} />
              <button onClick={handleArchive} className="btn-primary text-xs px-3">Arquivar</button>
              <button onClick={() => setShowArchive(false)} className="text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300">Cancelar</button>
            </div>
          </div>
        )}

        {/* Transfer Modal */}
        {showTransfer && (
          <div className="px-5 py-3 bg-gray-50 dark:bg-slate-900/50 border-b border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-slate-300">Transferir para:</span>
              <select value={transferBoardId} onChange={e => setTransferBoardId(e.target.value)} className="input text-sm flex-1">
                <option value="">Selecione um quadro</option>
                {boards.filter(b => b.id !== task.boardId).map(b => (
                  <option key={b.id} value={b.id}>{b.icone} {b.nome}</option>
                ))}
              </select>
              <button onClick={handleTransfer} disabled={!transferBoardId || transferring} className="btn-primary text-xs px-3">
                {transferring ? 'Transferindo...' : 'Transferir'}
              </button>
              <button onClick={() => setShowTransfer(false)} className="text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300">Cancelar</button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-slate-700 flex-shrink-0">
          {([['info', 'Informações'], ['checklist', 'Checklist'], ['attachments', `Anexos (${attachments.length})`], ['activity', 'Atividade']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setActiveTab(key)} className={`px-4 py-2.5 text-xs font-medium transition-colors ${activeTab === key ? 'text-codemed-600 border-b-2 border-codemed-600' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'}`}>{label}</button>
          ))}
        </div>

        <div className="p-5 flex-1 overflow-y-auto">
          {/* Info Tab */}
          {activeTab === 'info' && (
            <div className="space-y-5">
              {editing ? (
                <div className="space-y-3">
                  <ErrorBoundary fallback={<div className="h-32 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-sm text-gray-400">Editor indisponível</div>}>
                    <Suspense fallback={<div className="h-32 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />}>
                      <RichTextEditor content={form.descricao} onChange={html => setForm({ ...form, descricao: html })} placeholder="Descrição da tarefa..." minHeight="120px" />
                    </Suspense>
                  </ErrorBoundary>
                  <div className="grid grid-cols-2 gap-3">
                    <select value={form.prioridade} onChange={e => setForm({ ...form, prioridade: e.target.value })} className="input">
                      <option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option><option value="urgente">Urgente</option>
                    </select>
                    <select value={form.tipoTarefa} onChange={e => setForm({ ...form, tipoTarefa: e.target.value })} className="input">
                      {TIPOS_TAREFA.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} className="input">
                      <option value="">Categoria</option>
                      {['Outros', 'Suporte', 'Desenvolvimento', 'Marketing', 'Financeiro', 'Comercial'].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex gap-2 items-end">
                      <select value={form.classificacao} onChange={e => setForm({ ...form, classificacao: e.target.value })} className="input flex-1">
                        <option value="">Classificação</option>
                        {['Bug', 'Melhoria', 'Feature', 'Manutenção', 'Correção', 'Implantação', 'Treinamento', 'Outros'].map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <button onClick={handleAutoCategorize} disabled={aiLoading} className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 text-white hover:from-violet-600 hover:to-indigo-700 transition-all disabled:opacity-50" title="Categorizar com IA">
                        {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      </button>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 dark:text-slate-500 mb-1 block">Estimativa de Horas</label>
                      <input type="number" value={form.estimativaHoras} onChange={e => setForm({ ...form, estimativaHoras: e.target.value })} className="input w-full" placeholder="Ex: 8" min="0" step="0.5" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-400 dark:text-slate-500 mb-1 block">Data de Início</label>
                      <input type="date" value={form.dataInicio} onChange={e => setForm({ ...form, dataInicio: e.target.value })} className="input w-full" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 dark:text-slate-500 mb-1 block">Prazo de Entrega</label>
                      <input type="date" value={form.prazoEntrega} onChange={e => setForm({ ...form, prazoEntrega: e.target.value })} className="input w-full" />
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Descrição sempre editável */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-xs text-gray-400 dark:text-slate-500 font-medium uppercase tracking-wide">Descrição</span>
                    </div>
                    <ErrorBoundary fallback={<div className="h-32 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-sm text-gray-400">Editor indisponível</div>}>
                      <Suspense fallback={<div className="h-32 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />}>
                        <RichTextEditor content={descricaoLocal} onChange={handleDescricaoChange} placeholder="Adicione uma descrição..." minHeight="100px" />
                      </Suspense>
                    </ErrorBoundary>
                  </div>

                  {/* Responsável — sempre visível */}
                  <div>
                    <label className="text-xs text-gray-400 dark:text-slate-500 mb-1 block">Responsável</label>
                    <select
                      value={task.responsavelId || ''}
                      onChange={e => handleResponsavelChange(e.target.value)}
                      className="input w-full text-sm"
                    >
                      <option value="">Sem responsável</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>

                  {/* Timeline Summary */}
                  <div className="bg-gray-50 dark:bg-slate-900/50 rounded-lg p-3 text-sm">
                    <div className="flex items-center gap-2 text-gray-600 dark:text-slate-300 mb-2">
                      <Clock size={14} />
                      <span className="font-medium">Tempo aberto: <strong>{timeOpenStr}</strong></span>
                      {task.statusPrazo && STATUS_PRAZO_LABEL[task.statusPrazo] && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ backgroundColor: STATUS_PRAZO_LABEL[task.statusPrazo].cor + '22', color: STATUS_PRAZO_LABEL[task.statusPrazo].cor }}>
                          {STATUS_PRAZO_LABEL[task.statusPrazo].emoji} {STATUS_PRAZO_LABEL[task.statusPrazo].label}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-slate-400">
                      <div>Criado: {task.createdAt ? new Date(task.createdAt).toLocaleDateString('pt-BR') : '—'}</div>
                      {task.dataInicio && <div>Início: {new Date(task.dataInicio).toLocaleDateString('pt-BR')}</div>}
                      {task.prazoEntrega && <div>Prazo: {new Date(task.prazoEntrega).toLocaleDateString('pt-BR')}</div>}
                      {task.dataConclusao && <div>Concluído: {new Date(task.dataConclusao).toLocaleDateString('pt-BR')}</div>}
                      {task.estimativaHoras && <div>Estimativa: {task.estimativaHoras}h</div>}
                      {task.horasTrabalhadas && <div>Trabalhadas: {task.horasTrabalhadas}h</div>}
                      {timeSummary && <div>Trabalhado (apontado): {(timeSummary.totalHoras ?? 0).toFixed(2)}h</div>}
                      {timeSummary && <div>Pausas: {(timeSummary.pausasMin ?? 0)}min</div>}
                    </div>
                    {timeSummary && timeSummary.porEtapa && timeSummary.porEtapa.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-700">
                        <span className="text-xs font-medium text-gray-500 dark:text-slate-400 block mb-1">Tempo por etapa</span>
                        <div className="flex flex-wrap gap-1.5">
                          {timeSummary.porEtapa.map((e: any) => (
                            <span key={e.id} className="text-[11px] px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300">
                              {e.etapa}: {(e.duracaoMin / 60).toFixed(2)}h{e.emAndamento ? ' (atual)' : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Controle de tempo */}
                  <div className="bg-gray-50 dark:bg-slate-900/50 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-600 dark:text-slate-300">Controle de tempo</span>
                      {!runningTimer && (
                        <button onClick={handleStartTimer} disabled={timerBusy} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1">
                          <Play size={12} /> Iniciar
                        </button>
                      )}
                      {isTaskTimerRunning && !runningTimer?.pausado && (
                        <button onClick={handlePauseTimer} disabled={timerBusy} className="btn-warning text-xs px-3 py-1.5 flex items-center gap-1">
                          <Pause size={12} /> Pausar
                        </button>
                      )}
                      {isTaskTimerRunning && runningTimer?.pausado && (
                        <button onClick={handleResumeTimer} disabled={timerBusy} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1">
                          <Play size={12} /> Retomar
                        </button>
                      )}
                      {runningTimer && (
                        <button onClick={handleStopTimer} disabled={timerBusy} className="text-xs px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center gap-1 hover:bg-red-200 dark:hover:bg-red-900/50">
                          <Square size={12} /> Parar
                        </button>
                      )}
                    </div>
                    {runningTimer && runningTimer.tarefaId !== task.id && (
                      <p className="text-[11px] text-gray-400 mt-1.5">Há um timer ativo em outra tarefa. Pare-o antes de iniciar nesta.</p>
                    )}
                    {isTaskTimerRunning && (
                      <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1.5">
                        {runningTimer?.pausado ? '⏸ Tempo pausado' : '▶ Cronometrando...'} · iniciado em {runningTimer?.dataInicio ? new Date(runningTimer.dataInicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-400 dark:text-slate-500 mb-1 block">Prioridade</label>
                      <select value={task.prioridade} onChange={async e => { await updateTask(task.id, { prioridade: e.target.value }); onRefresh?.(); }} className="input w-full text-sm">
                        <option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option><option value="urgente">Urgente</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 dark:text-slate-500 mb-1 block">Categoria</label>
                      <select value={task.categoria || ''} onChange={async e => { await updateTask(task.id, { categoria: e.target.value || undefined }); onRefresh?.(); }} className="input w-full text-sm">
                        <option value="">Sem categoria</option>
                        {['Outros', 'Suporte', 'Desenvolvimento', 'Marketing', 'Financeiro', 'Comercial'].map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 dark:text-slate-500 mb-1 block">Classificação</label>
                      <div className="flex gap-1.5">
                        <select value={task.classificacao || ''} onChange={async e => { await updateTask(task.id, { classificacao: e.target.value || undefined }); onRefresh?.(); }} className="input flex-1 text-sm">
                          <option value="">Sem classificação</option>
                          {['Bug', 'Melhoria', 'Feature', 'Manutenção', 'Correção', 'Implantação', 'Treinamento', 'Outros'].map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <button onClick={handleAutoCategorize} disabled={aiLoading} className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 text-white hover:from-violet-600 hover:to-indigo-700 transition-all disabled:opacity-50" title="Categorizar com IA">
                          {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 dark:text-slate-500 mb-1 block">Prazo de Entrega</label>
                      <input type="date" value={task.prazoEntrega ? task.prazoEntrega.split('T')[0] : ''} onChange={async e => { await updateTask(task.id, { prazoEntrega: e.target.value ? new Date(e.target.value).toISOString() : null }); onRefresh?.(); }} className="input w-full text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 dark:text-slate-500 mb-1 block">Tipo de tarefa</label>
                      <select value={task.tipoTarefa || 'outro'} onChange={async e => { await updateTask(task.id, { tipoTarefa: e.target.value }); onRefresh?.(); }} className="input w-full text-sm">
                        {TIPOS_TAREFA.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                      </select>
                    </div>
                    {task.ticketId && (
                      <div className="col-span-2"><span className="text-gray-400 dark:text-slate-500 text-xs">Ticket</span><span className="ml-2 text-purple-600 dark:text-purple-400 text-xs font-mono">#{task.ticketId.slice(0, 8)}</span></div>
                    )}
                  </div>

                  {/* Tags Section */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-400 dark:text-slate-500 text-sm">Tags</span>
                      {isAdmin && (
                        <button onClick={() => setShowTagInput(!showTagInput)} className="text-xs text-codemed-600 hover:underline flex items-center gap-1">
                          <Tag size={12} /> {showTagInput ? 'Cancelar' : 'Adicionar tag'}
                        </button>
                      )}
                    </div>
                    {showTagInput && (
                      <div className="flex items-center gap-2 mb-2 p-2 bg-gray-50 dark:bg-slate-900/50 rounded-lg">
                        <input type="text" placeholder="Nome da tag" value={newTagName} onChange={e => setNewTagName(e.target.value)} className="input flex-1 text-sm" onKeyDown={e => e.key === 'Enter' && handleAddTag()} />
                        <div className="flex gap-1">
                          {TAG_COLORS.map(c => (
                            <button key={c} onClick={() => setNewTagColor(c)} className={`w-5 h-5 rounded-full border-2 transition-all ${newTagColor === c ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                          ))}
                        </div>
                        <button onClick={handleAddTag} className="btn-primary text-xs px-3" disabled={!newTagName.trim()}>+</button>
                      </div>
                    )}
                    {taskTags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {taskTags.map(tt => (
                          <span key={tt.tagId} className="text-xs px-2 py-0.5 rounded-full text-white flex items-center gap-1" style={{ backgroundColor: tt.tag.cor }}>
                            {tt.tag.nome}
                            {isAdmin && (
                              <button onClick={() => handleRemoveTag(tt.tagId)} className="ml-0.5 hover:text-gray-200">
                                <X size={10} />
                              </button>
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Subtasks */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-slate-200 mb-2">Subtarefas ({subtasksDone}/{subtasksTotal})</h4>
                <div className="space-y-1.5">
                  {localSubtasks.map(st => (
                    <div key={st.id} className="flex items-center gap-2 text-sm group">
                      <button onClick={() => handleToggleSubtask(st.id)} className="flex-shrink-0">
                        {st.concluida ? <CheckCircle2 size={16} className="text-green-500" /> : <Circle size={16} className="text-gray-300 dark:text-slate-600" />}
                      </button>
                      <span className={st.concluida ? 'line-through text-gray-400 dark:text-slate-500' : 'text-gray-700 dark:text-slate-200'}>{st.titulo}</span>
                      <button onClick={() => handleDeleteSubtask(st.id)} className="ml-auto text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <input type="text" placeholder="Nova subtarefa" value={newSubtask} onChange={e => setNewSubtask(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddSubtask()} className="input flex-1 text-sm" />
                  <button onClick={handleAddSubtask} className="btn-secondary text-xs px-3" disabled={!newSubtask.trim()}>+</button>
                </div>
              </div>
            </div>
          )}

          {/* Checklist Tab */}
          {activeTab === 'checklist' && (
            <div className="space-y-4">
              {(() => {
                const subtasksDone = localSubtasks.filter(s => s.concluida).length;
                const subtasksTotal = localSubtasks.length;
                const pct = subtasksTotal > 0 ? Math.round((subtasksDone / subtasksTotal) * 100) : 0;
                return (
                  <>
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-slate-200">
                        Checklist ({subtasksDone}/{subtasksTotal})
                      </h4>
                      <button onClick={() => setShowImportChecklist(true)} className="text-xs text-codemed-600 hover:underline flex items-center gap-1">
                        <Download size={12} /> Importar
                      </button>
                    </div>
                    {subtasksTotal > 0 && (
                      <div>
                        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400 mb-1">
                          <span>Progresso</span>
                          <span>{pct}%</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                          <div className="bg-emerald-500 h-2 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )}
                    <div className="space-y-1.5">
                      {localSubtasks.map(st => (
                        <div key={st.id} className="flex items-center gap-2 text-sm group hover:bg-gray-50 dark:hover:bg-slate-900/30 rounded-lg px-2 py-1">
                          <button onClick={() => handleToggleSubtask(st.id)} className="flex-shrink-0">
                            {st.concluida ? <CheckCircle2 size={18} className="text-green-500" /> : <Circle size={18} className="text-gray-300 dark:text-slate-600 hover:text-emerald-400 transition-colors" />}
                          </button>
                          <span className={st.concluida ? 'line-through text-gray-400 dark:text-slate-500' : 'text-gray-700 dark:text-slate-200'}>{st.titulo}</span>
                          <button onClick={() => handleDeleteSubtask(st.id)} className="ml-auto text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-slate-700">
                      <input type="text" placeholder="Adicionar item ao checklist..." value={newSubtask} onChange={e => setNewSubtask(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddSubtask()} className="input flex-1 text-sm" />
                      <button onClick={handleAddSubtask} className="btn-primary text-xs px-3 flex items-center gap-1" disabled={!newSubtask.trim()}>
                        <Plus size={14} /> Adicionar
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* Attachments Tab */}
          {activeTab === 'attachments' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-slate-200">Anexos</h4>
                <label className="btn-secondary text-xs flex items-center gap-1 cursor-pointer">
                  <Upload size={14} /> {uploading ? 'Enviando...' : 'Adicionar'}
                  <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip" className="hidden" onChange={e => handleUpload(e.target.files)} disabled={uploading} />
                </label>
              </div>
              {imageAttachments.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mb-2">Imagens</p>
                  <div className="grid grid-cols-3 gap-2">
                    {imageAttachments.map(att => (
                      <div key={att.id} className="relative group rounded-lg overflow-hidden border border-gray-200 dark:border-slate-700 bg-gray-100 dark:bg-slate-700">
                        <img
                          src={att.url}
                          alt={att.nomeArquivo}
                          className="w-full h-24 object-cover cursor-pointer"
                          onClick={() => setPreviewImage(att.url)}
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent && !parent.querySelector('.img-error-detail')) {
                              const errorDiv = document.createElement('div');
                              errorDiv.className = 'img-error-detail w-full h-24 flex flex-col items-center justify-center text-gray-400 gap-1';
                              errorDiv.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><span class="text-[9px] truncate max-w-[90%] px-1">' + att.nomeArquivo + '</span>';
                              parent.appendChild(errorDiv);
                            }
                          }}
                        />
                        <button onClick={() => handleDeleteAttachment(att.id)} className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X size={10} /></button>
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] px-1.5 py-0.5 truncate">{att.nomeArquivo}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {otherAttachments.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mb-2">Outros arquivos</p>
                  <div className="space-y-1">
                    {otherAttachments.map(att => (
                      <div key={att.id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-slate-900/50 text-sm">
                        <Paperclip size={14} className="text-gray-400" />
                        <a href={att.url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-codemed-600 hover:underline">{att.nomeArquivo}</a>
                        <button onClick={() => handleDeleteAttachment(att.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={12} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {attachments.length === 0 && !uploading && (
                <div className="text-center py-8 text-gray-400 dark:text-slate-500">
                  <ImageIcon size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhum anexo ainda</p>
                  <p className="text-xs">Arraste arquivos ou clique em "Adicionar"</p>
                </div>
              )}
            </div>
          )}

          {/* Activity Tab */}
          {activeTab === 'activity' && (
            <div className="space-y-4">
              <TaskTimeline activities={activity} />
              <div className="flex gap-2 mt-3">
                <input type="text" placeholder="Comentar..." value={comment} onChange={e => setComment(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleComment()} className="input flex-1 text-sm" />
                <button onClick={handleComment} className="btn-secondary text-xs px-3" disabled={!comment.trim()}>Enviar</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showImportChecklist && (
        <ImportChecklistModal taskId={task.id} onClose={() => setShowImportChecklist(false)} onImported={() => { onRefresh?.(); }} />
      )}

      {previewImage && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center" onClick={() => setPreviewImage(null)}>
          <img src={previewImage} alt="Preview" className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl" />
          <button className="absolute top-4 right-4 text-white"><X size={24} /></button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Board Settings Modal
// ---------------------------------------------------------------------------

function BoardSettingsModal({ board, onClose, onRefresh }: { board: KanbanBoard; onClose: () => void; onRefresh?: () => void }) {
  const { user } = useAuth();
  const { updateColumn, reorderColumns, updateBoard } = useKanban();
  const isAdmin = user?.role === 'admin' || user?.role === 'gerente';
  const [columns, setColumns] = useState<KanbanColumn[]>([...board.columns].sort((a, b) => a.ordem - b.ordem));
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ nome: '', cor: '' });
  const [draggedColId, setDraggedColId] = useState<string | null>(null);
  const [boardName, setBoardName] = useState(board.nome);
  const [editingBoardName, setEditingBoardName] = useState(false);

  const handleDragStart = (colId: string) => setDraggedColId(colId);
  
  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedColId || draggedColId === targetId) return;
    const draggedIdx = columns.findIndex(c => c.id === draggedColId);
    const targetIdx = columns.findIndex(c => c.id === targetId);
    if (draggedIdx === -1 || targetIdx === -1) return;
    const newCols = [...columns];
    const [removed] = newCols.splice(draggedIdx, 1);
    newCols.splice(targetIdx, 0, removed);
    setColumns(newCols);
  };

  const handleDragEnd = async () => {
    setDraggedColId(null);
    const columnIds = columns.map(c => c.id);
    await reorderColumns(columnIds);
    onRefresh?.();
  };

  const handleToggleHidden = async (colId: string) => {
    const col = columns.find(c => c.id === colId);
    if (!col) return;
    await updateColumn(colId, { hidden: !col.hidden });
    setColumns(prev => prev.map(c => c.id === colId ? { ...c, hidden: !c.hidden } : c));
    onRefresh?.();
  };

  const handleStartEdit = (col: KanbanColumn) => {
    setEditingColId(col.id);
    setEditForm({ nome: col.nome, cor: col.cor || '#6b7280' });
  };

  const handleSaveEdit = async (colId: string) => {
    await updateColumn(colId, { nome: editForm.nome, cor: editForm.cor });
    setColumns(prev => prev.map(c => c.id === colId ? { ...c, nome: editForm.nome, cor: editForm.cor } : c));
    setEditingColId(null);
    onRefresh?.();
  };

  const handleSaveBoardName = async () => {
    if (boardName.trim() && boardName !== board.nome) {
      await updateBoard(board.id, { nome: boardName.trim() });
      onRefresh?.();
    }
    setEditingBoardName(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-gray-500 dark:text-slate-400" />
            <h3 className="font-semibold text-gray-900 dark:text-slate-100">Configurações do Quadro</h3>
          </div>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Board Name */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1 block">Nome do Quadro</label>
            {editingBoardName ? (
              <div className="flex gap-2">
                <input type="text" value={boardName} onChange={e => setBoardName(e.target.value)} className="input flex-1" autoFocus onKeyDown={e => e.key === 'Enter' && handleSaveBoardName()} />
                <button onClick={handleSaveBoardName} className="btn-primary text-xs px-3">Salvar</button>
                <button onClick={() => { setEditingBoardName(false); setBoardName(board.nome); }} className="btn-secondary text-xs px-3">Cancelar</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700 dark:text-slate-200">{board.nome}</span>
                {isAdmin && <button onClick={() => setEditingBoardName(true)} className="text-xs text-codemed-600 hover:underline">Editar</button>}
              </div>
            )}
          </div>

          {/* Columns */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-2 block">Colunas (arraste para reordenar)</label>
            <div className="space-y-2">
              {columns.map(col => (
                <div
                  key={col.id}
                  draggable
                  onDragStart={() => handleDragStart(col.id)}
                  onDragOver={(e) => handleDragOver(e, col.id)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${col.hidden ? 'bg-gray-50 dark:bg-slate-900/30 border-gray-200 dark:border-slate-700 opacity-60' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700'} ${draggedColId === col.id ? 'ring-2 ring-codemed-500' : ''}`}
                >
                  <GripVertical size={14} className="text-gray-400 cursor-move flex-shrink-0" />
                  
                  {editingColId === col.id ? (
                    <>
                      <input type="text" value={editForm.nome} onChange={e => setEditForm({ ...editForm, nome: e.target.value })} className="input flex-1 text-sm" autoFocus />
                      <div className="flex gap-1">
                        {COLUMN_COLORS.map(c => (
                          <button key={c} onClick={() => setEditForm({ ...editForm, cor: c })} className={`w-5 h-5 rounded-full border-2 transition-all ${editForm.cor === c ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                        ))}
                      </div>
                      <button onClick={() => handleSaveEdit(col.id)} className="text-xs text-codemed-600 hover:underline">Salvar</button>
                      <button onClick={() => setEditingColId(null)} className="text-xs text-gray-400 hover:underline">Cancelar</button>
                    </>
                  ) : (
                    <>
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: col.cor || '#6b7280' }} />
                      <span className="flex-1 text-sm text-gray-700 dark:text-slate-200 truncate">{col.nome}</span>
                      <span className="text-[10px] text-gray-400 dark:text-slate-500">{col.tasks.length} tarefas</span>
                      {isAdmin && (
                        <>
                          <button onClick={() => handleToggleHidden(col.id)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300" title={col.hidden ? 'Mostrar coluna' : 'Ocultar coluna'}>
                            {col.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                          <button onClick={() => handleStartEdit(col)} className="text-gray-400 hover:text-codemed-600" title="Editar coluna">
                            <Edit3 size={14} />
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-gray-200 dark:border-slate-700 flex justify-end">
          <button onClick={onClose} className="btn-secondary text-sm">Fechar</button>
        </div>
      </div>
    </div>
  );
}
