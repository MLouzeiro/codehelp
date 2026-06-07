import { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../services/auth';
import { Plus, X, Calendar, User, AlertCircle } from 'lucide-react';

const priorityColors: Record<string, string> = {
  baixa: 'bg-gray-100 text-gray-600', media: 'bg-blue-100 text-blue-600',
  alta: 'bg-amber-100 text-amber-600', urgente: 'bg-red-100 text-red-600',
};

export default function KanbanPage() {
  const { user } = useAuth();
  const [board, setBoard] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ titulo: '', descricao: '', prioridade: 'media', responsavelId: '', projeto: '', sprint: '', dataVencimento: '' });
  const [dragItem, setDragItem] = useState<any>(null);

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
      const { data } = await api.get('/auth/users');
      setUsers(data);
    } catch (err) { console.error(err); }
  };

  const createTask = async () => {
    try {
      await api.post('/kanban/tasks', form);
      setShowForm(false);
      setForm({ titulo: '', descricao: '', prioridade: 'media', responsavelId: '', projeto: '', sprint: '', dataVencimento: '' });
      loadBoard();
    } catch (err) { console.error(err); }
  };

  const updateStatus = async (taskId: string, status: string) => {
    try {
      await api.put(`/kanban/tasks/${taskId}`, { status });
      loadBoard();
    } catch (err) { console.error(err); }
  };

  const columns = board ? Object.entries(board) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Kanban de Tarefas</h1><p className="text-gray-500">Gestão visual de tarefas e projetos</p></div>
        {(user?.role === 'admin' || user?.role === 'gerente') && (
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2"><Plus size={18} /> Nova Tarefa</button>
        )}
      </div>

      {showForm && (
        <div className="card max-w-lg space-y-3">
          <div className="flex justify-between items-center"><h3 className="font-semibold">Nova Tarefa</h3><button onClick={() => setShowForm(false)}><X size={18} /></button></div>
          <input type="text" placeholder="Título da tarefa" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} className="input" />
          <textarea placeholder="Descrição" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className="input" rows={2} />
          <select value={form.prioridade} onChange={(e) => setForm({ ...form, prioridade: e.target.value })} className="input">
            <option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option><option value="urgente">Urgente</option>
          </select>
          <select value={form.responsavelId} onChange={(e) => setForm({ ...form, responsavelId: e.target.value })} className="input">
            <option value="">Responsável</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <input type="text" placeholder="Projeto" value={form.projeto} onChange={(e) => setForm({ ...form, projeto: e.target.value })} className="input" />
          <input type="text" placeholder="Sprint" value={form.sprint} onChange={(e) => setForm({ ...form, sprint: e.target.value })} className="input" />
          <input type="date" value={form.dataVencimento} onChange={(e) => setForm({ ...form, dataVencimento: e.target.value })} className="input" />
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
              {column.items.map((task: any) => (
                <div key={task.id} draggable
                  onDragStart={() => setDragItem(task.id)}
                  className="bg-white rounded-lg p-3 shadow-sm border border-gray-100 cursor-grab active:cursor-grabbing hover:shadow transition-shadow">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900 flex-1">{task.titulo}</p>
                    <span className={`badge text-xs ${priorityColors[task.prioridade] || ''}`}>{task.prioridade}</span>
                  </div>
                  {task.descricao && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{task.descricao}</p>}
                  <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-400">
                    {task.responsavel?.name && <span className="flex items-center gap-1"><User size={10} />{task.responsavel.name}</span>}
                    {task.dataVencimento && <span className="flex items-center gap-1"><Calendar size={10} />{new Date(task.dataVencimento).toLocaleDateString('pt-BR')}</span>}
                  </div>
                  {task.projeto && <span className="badge bg-codemed-50 text-codemed-600 text-xs mt-2 inline-block">{task.projeto}</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
