import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../services/auth';
import { ArrowLeft } from 'lucide-react';
import { User } from '../../types';

export default function ClientForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEdit = !!id;

  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', sellerId: '' });
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user?.role === 'admin') {
      api.get('/users').then(({ data }) => setUsers(data)).catch(() => {});
    }
    if (isEdit) {
      api.get(`/clients/${id}`).then(({ data }) => {
        setForm({ name: data.name, email: data.email || '', phone: data.phone || '', company: data.company || '', sellerId: data.sellerId || '' });
      }).catch(() => navigate('/app/clients'));
    }
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) { setError('Nome é obrigatório'); return; }
    setLoading(true);
    setError('');
    try {
      if (isEdit) {
        await api.put(`/clients/${id}`, form);
      } else {
        await api.post('/clients', form);
      }
      navigate('/app/clients');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao salvar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg space-y-4">
      <button onClick={() => navigate('/app/clients')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={16} /> Voltar
      </button>

      <h1 className="text-2xl font-bold text-gray-900">{isEdit ? 'Editar Cliente' : 'Novo Cliente'}</h1>

      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">{error}</div>}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
          <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" required />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
          <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Empresa</label>
          <input type="text" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="input" />
        </div>

        {user?.role === 'admin' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vendedor</label>
            <select value={form.sellerId} onChange={(e) => setForm({ ...form, sellerId: e.target.value })} className="input">
              <option value="">Selecione um vendedor</option>
              {users.filter((u) => u.role === 'vendedor').map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={() => navigate('/app/clients')} className="btn-secondary flex-1">Cancelar</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  );
}
