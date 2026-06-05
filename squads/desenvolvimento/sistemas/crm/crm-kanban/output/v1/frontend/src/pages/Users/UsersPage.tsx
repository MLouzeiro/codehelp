import { useState, useEffect } from 'react';
import api from '../../services/api';
import { Plus, X, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import { User } from '../../types';

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'vendedor', phone: '' });
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    try {
      const { data } = await api.get('/users');
      setUsers(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleSubmit = async () => {
    if (!form.name || !form.email || (!editId && !form.password)) {
      setError('Nome, email e senha são obrigatórios');
      return;
    }
    setError('');
    try {
      if (editId) {
        const payload: any = { name: form.name, email: form.email, role: form.role, phone: form.phone };
        if (form.password) payload.password = form.password;
        await api.put(`/users/${editId}`, payload);
      } else {
        await api.post('/users', form);
      }
      setShowForm(false);
      setEditId(null);
      setForm({ name: '', email: '', password: '', role: 'vendedor', phone: '' });
      loadUsers();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao salvar');
    }
  };

  const toggleActive = async (user: User) => {
    try {
      await api.put(`/users/${user.id}`, { active: !user.active });
      loadUsers();
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza?')) return;
    try {
      await api.delete(`/users/${id}`);
      loadUsers();
    } catch (err) { console.error(err); }
  };

  const openEdit = (user: User) => {
    setEditId(user.id);
    setForm({ name: user.name, email: user.email, password: '', role: user.role, phone: user.phone || '' });
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Usuários</h1><p className="text-gray-500">Gerencie os usuários do sistema</p></div>
        <button onClick={() => { setEditId(null); setForm({ name: '', email: '', password: '', role: 'vendedor', phone: '' }); setShowForm(true); }} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Novo Usuário
        </button>
      </div>

      {showForm && (
        <div className="card max-w-lg p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">{editId ? 'Editar Usuário' : 'Novo Usuário'}</h3>
            <button onClick={() => { setShowForm(false); setEditId(null); }}><X size={18} /></button>
          </div>

          {error && <div className="bg-red-50 text-red-600 text-sm p-2 rounded-lg">{error}</div>}

          <input type="text" placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" />
          <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" />
          <input type="password" placeholder={editId ? 'Nova senha (deixe vazio para manter)' : 'Senha'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input" />
          <input type="text" placeholder="Telefone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="input">
            <option value="vendedor">Vendedor</option>
            <option value="admin">Admin</option>
          </select>
          <button onClick={handleSubmit} className="btn-primary w-full">{editId ? 'Atualizar' : 'Criar Usuário'}</button>
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Carregando...</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Nenhum usuário encontrado</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 text-sm font-semibold text-gray-600">Nome</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-600">Email</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-600">Role</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-600">Ativo</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-600">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium">{u.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{u.email}</td>
                  <td className="px-4 py-3"><span className={`badge ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{u.role}</span></td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleActive(u)} className={u.active ? 'text-green-600' : 'text-gray-400'}>
                      {u.active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(u)} className="text-sm text-primary-600 hover:underline">Editar</button>
                      <button onClick={() => handleDelete(u.id)} className="text-sm text-red-600 hover:underline">Excluir</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
