import { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../services/auth';
import { Plus, X, Calendar, User } from 'lucide-react';
import { KanbanBoard, Task } from '../../types';

const priorityColors: Record<string, string> = {
  baixa: 'bg-gray-100 text-gray-600', media: 'bg-blue-100 text-blue-600',
  alta: 'bg-amber-100 text-amber-600', urgente: 'bg-red-100 text-red-600',
};

const statusLabels: Record<string, string> = {
  aberta: 'A fazer', em_andamento: 'Em andamento', concluida: 'Concluído', cancelada: 'Cancelado',
};

export default function KanbanPage() {
  const { user } = useAuth();
  const [board, setBoard] = useState<KanbanBoard | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: 'media', assigneeId: '', project: '', dueDate: '' });
  const [dragItem, setDragItem] = useState<string | null>(null);

  useEffect(() => {
    loadBoard();
    loadUsers();
  }, []);

  const loadBoard = async () => {
    try {
      const { data } = await api.get('/kanban/board');
      setBoard(data);
    } catch (err) { console.error(err); }
  };

  const loadUsers = async () => {
    try {
      const { data } = await api.get('/users');
      setUsers(data);
    } catch (err) { console.error(err); }
  };

  const createTask = async () => {
    try {
      await api.post('/tasks', form);
      setShowForm(false);
      setForm({ title: '', description: '', priority: 'media', assigneeId: '', project: '', dueDate: '' });
      loadBoard();
    } catch (err) { console.error(err); }
  };

  const updateStatus = async (taskId: string, status: string) => {
    try {
      await api.put(`/tasks/${taskId}`, { status });
      loadBoard();
    } catch (err) { console.error(err); }
  };

  const columns = board ? Object.entries(board) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Kanban</h1><p className="text-gray-500">Gestão visual de tarefas</p></div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2"><Plus size={18} /> Nova Tarefa</button>
      </div>

      {showForm && (
        <div className="card max-w-lg p-4 space-y-3">
          <div className="flex justify-between items-center"><h3 className="font-semibold">Nova Tarefa</h3><button onClick={() => setShowForm(false)}><X size={18} /></button></div>
          <input type="text" placeholder="Título" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input" />
          <textarea placeholder="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input" rows={2} />
          <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="input">
            <option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option><option value="urgente">Urgente</option>
          </select>
          <select value={form.assigneeId} onChange={(e) => setForm({ ...form, assigneeId: e.target.value })} className="input">
            <option value="">Responsável</option>
            {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <input type="text" placeholder="Projeto" value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} className="input" />
          <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="input" />
          <button onClick={createTask} className="btn-primary w-full">Criar Tarefa</button>
        </div>
      )}

      <div className="grid grid-cols-4 gap-4 overflow-x-auto pb-4">
        {columns.map(([status, column]: any) => (
          <div key={status} className="min-w-[250px] bg-gray-50 rounded-xl p-3 border border-gray-200"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => { if (dragItem) { updateStatus(dragItem, status); setDragItem(null); } }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm text-gray-700">{column.title}</h3>
              <span className="text-xs text-gray-400 bg-white px-2 py-0.5 rounded-full">{column.items.length}</span>
            </div>
            <div className="space-y-2 min-h-[100px]">
              {column.items.map((task: Task) => (
                <div key={task.id} draggable
                  onDragStart={() => setDragItem(task.id)}
                  className="bg-white rounded-lg p-3 shadow-sm border border-gray-100 cursor-grab active:cursor-grabbing hover:shadow transition-shadow">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900 flex-1">{task.title}</p>
                    <span className={`badge text-xs ${priorityColors[task.priority] || ''}`}>{task.priority}</span>
                  </div>
                  {task.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{task.description}</p>}
                  <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-400">
                    {task.assignee?.name && <span className="flex items-center gap-1"><User size={10} />{task.assignee.name}</span>}
                    {task.dueDate && <span className="flex items-center gap-1"><Calendar size={10} />{new Date(task.dueDate).toLocaleDateString('pt-BR')}</span>}
                  </div>
                  {task.project && <span className="badge bg-primary-50 text-primary-600 text-xs mt-2 inline-block">{task.project}</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
