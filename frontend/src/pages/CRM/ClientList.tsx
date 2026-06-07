import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { Plus, Search, Mail, Phone, MapPin, Building2, ChevronLeft, ChevronRight } from 'lucide-react';

export default function ClientList() {
  const [clients, setClients] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadClients();
  }, [search, statusFilter, page]);

  const loadClients = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 20 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const { data } = await api.get('/crm/clients', { params });
      setClients(data.clients);
      setTotal(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      ativo: 'bg-green-100 text-green-700',
      inativo: 'bg-red-100 text-red-700',
      prospecto: 'bg-blue-100 text-blue-700',
    };
    return <span className={`badge ${styles[status] || 'bg-gray-100 text-gray-700'}`}>{status}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-codemed-700 dark:text-neutral-100">Clientes</h1>
          <p className="text-neutral-500 dark:text-neutral-400">{total} clientes cadastrados</p>
        </div>
          <button onClick={() => navigate('/app/crm/new')} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Novo Cliente
        </button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input type="text" placeholder="Buscar por nome, CNPJ, telefone, email..."
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="input pl-10" />
        </div>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="input w-44">
          <option value="">Todos os status</option>
          <option value="ativo">Ativo</option>
          <option value="inativo">Inativo</option>
          <option value="prospecto">Prospecto</option>
        </select>
      </div>

      <div className="grid gap-4">
        {clients.map((client) => (
          <div key={client.id} onClick={() => navigate(`/app/crm/${client.id}`)}
            className="card cursor-pointer hover:shadow-md transition-shadow p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Building2 size={18} className="text-neutral-400" />
                  <span className="font-semibold text-codemed-700 dark:text-neutral-100">{client.razaoSocial}</span>
                  {statusBadge(client.status)}
                </div>
                {client.nomeFantasia && <p className="text-sm text-neutral-500 dark:text-neutral-400">{client.nomeFantasia}</p>}
                <div className="flex flex-wrap gap-4 text-sm text-neutral-500 dark:text-neutral-400">
                  {client.email && <span className="flex items-center gap-1"><Mail size={14} />{client.email}</span>}
                  {client.telefone && <span className="flex items-center gap-1"><Phone size={14} />{client.telefone}</span>}
                  {client.cidade && <span className="flex items-center gap-1"><MapPin size={14} />{client.cidade}/{client.estado}</span>}
                </div>
              </div>
              <div className="text-right text-sm text-neutral-400">
                {client.responsavelTecnico?.name && <p>Resp: {client.responsavelTecnico.name}</p>}
              </div>
            </div>
          </div>
        ))}
        {!loading && clients.length === 0 && (
          <div className="text-center py-12 text-neutral-500 dark:text-neutral-400">Nenhum cliente encontrado</div>
        )}
      </div>

      {total > 20 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          {Array.from({ length: Math.ceil(total / 20) }, (_, i) => (
            <button key={i} onClick={() => setPage(i + 1)}
              className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${page === i + 1 ? 'bg-green-500 text-white' : 'border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300'}`}>
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
