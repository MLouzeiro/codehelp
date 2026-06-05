import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../services/auth';
import { Plus, Search, Edit2, Trash2, User } from 'lucide-react';
import { Client } from '../../types';

export default function ClientList() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadClients();
  }, [page, search]);

  const loadClients = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/clients', { params: { search: search || undefined, page, limit: 10 } });
      setClients(data.clients);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este cliente?')) return;
    try {
      await api.delete(`/clients/${id}`);
      loadClients();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-500">Gerencie seus clientes</p>
        </div>
        <Link to="/app/clients/new" className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Novo Cliente
        </Link>
      </div>

      <div className="relative max-w-md">
        <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nome, email ou empresa..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="input pl-10"
        />
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Carregando...</div>
        ) : clients.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <User size={48} className="mx-auto mb-2 text-gray-300" />
            <p>Nenhum cliente encontrado</p>
            <Link to="/app/clients/new" className="text-primary-500 font-medium mt-2 inline-block">Cadastrar primeiro cliente</Link>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 text-sm font-semibold text-gray-600">Nome</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-600">Email</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-600">Telefone</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-600">Empresa</th>
                {user?.role === 'admin' && <th className="px-4 py-3 text-sm font-semibold text-gray-600">Vendedor</th>}
                <th className="px-4 py-3 text-sm font-semibold text-gray-600">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clients.map((client) => (
                <tr key={client.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link to={`/app/clients/${client.id}`} className="text-primary-600 font-medium hover:underline">
                      {client.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{client.email || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{client.phone || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{client.company || '-'}</td>
                  {user?.role === 'admin' && (
                    <td className="px-4 py-3 text-sm text-gray-600">{client.seller?.name || '-'}</td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link to={`/app/clients/${client.id}/edit`} className="p-1 hover:text-primary-600">
                        <Edit2 size={16} />
                      </Link>
                      {user?.role === 'admin' && (
                        <button onClick={() => handleDelete(client.id)} className="p-1 hover:text-red-600">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button key={p} onClick={() => setPage(p)}
              className={`px-3 py-1 rounded-lg text-sm ${page === p ? 'bg-primary-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
