import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { Plus, Search, ChevronLeft, ChevronRight, Filter, Eye, Edit2, Trash2 } from 'lucide-react';

interface Client {
  id: string;
  razaoSocial: string;
  nomeFantasia?: string;
  email?: string;
  telefone?: string;
  status: string;
  categoria?: string;
  plano?: string;
  dataCadastro: string;
  totalTickets?: number;
  ultimaCompra?: string;
  responsavelTecnico?: { name: string };
}

const STATUS_MAP: Record<string, { label: string; emoji: string; className: string }> = {
  ativo: { label: 'Ativo', emoji: '✅', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  inadimplente: { label: 'Inadimplente', emoji: '⚠️', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  inativo: { label: 'Inativo', emoji: '💤', className: 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400' },
};

export default function ClientList() {
  const [clients, setClients] = useState<Client[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const [filters, setFilters] = useState({
    status: '',
    dataInicio: '',
    dataFim: '',
    categoria: '',
    plano: '',
    busca: '',
  });

  const LIMIT = 20;

  useEffect(() => {
    loadClients();
  }, [filters.status, filters.categoria, filters.plano, filters.busca, page]);

  const loadClients = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: LIMIT };
      if (filters.status) params.status = filters.status;
      if (filters.categoria) params.categoria = filters.categoria;
      if (filters.plano) params.plano = filters.plano;
      if (filters.busca) params.search = filters.busca;
      if (filters.dataInicio) params.dataInicio = filters.dataInicio;
      if (filters.dataFim) params.dataFim = filters.dataFim;
      const { data } = await api.get('/crm/clients', { params });
      setClients(data.clients);
      setTotal(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    setPage(1);
    loadClients();
  };

  const clearFilters = () => {
    setFilters({ status: '', dataInicio: '', dataFim: '', categoria: '', plano: '', busca: '' });
    setPage(1);
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="flex gap-6 items-start">
      {/* Sidebar de Filtros */}
      <aside className="w-60 flex-shrink-0 bg-white rounded-xl border border-gray-200 p-5 space-y-5 dark:bg-slate-800 dark:border-slate-700">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2 dark:text-slate-100">
          <Filter size={16} /> Filtros
        </h2>

        <div className="space-y-4">
          {/* Status */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block dark:text-slate-400">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="">Todos</option>
              <option value="ativo">Ativo</option>
              <option value="inadimplente">Inadimplente</option>
              <option value="inativo">Inativo</option>
            </select>
          </div>

          {/* Data Cadastro */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block dark:text-slate-400">Data Cadastro</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={filters.dataInicio}
                onChange={(e) => setFilters({ ...filters, dataInicio: e.target.value })}
                className="w-1/2 rounded-lg border border-gray-200 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <input
                type="date"
                value={filters.dataFim}
                onChange={(e) => setFilters({ ...filters, dataFim: e.target.value })}
                className="w-1/2 rounded-lg border border-gray-200 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Categoria */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block dark:text-slate-400">Categoria</label>
            <select
              value={filters.categoria}
              onChange={(e) => setFilters({ ...filters, categoria: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="">Todas</option>
              <option value="pj">Pessoa Juridica</option>
              <option value="pf">Pessoa Fisica</option>
            </select>
          </div>

          {/* Plano */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block dark:text-slate-400">Plano</label>
            <select
              value={filters.plano}
              onChange={(e) => setFilters({ ...filters, plano: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="">Todos</option>
              <option value="basico">Basico</option>
              <option value="profissional">Profissional</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>

          {/* Busca */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block dark:text-slate-400">Busca</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Nome, CNPJ, telefone..."
                value={filters.busca}
                onChange={(e) => setFilters({ ...filters, busca: e.target.value })}
                className="w-full rounded-lg border border-gray-200 pl-8 pr-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={applyFilters} className="flex-1 bg-blue-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-blue-700 transition-colors">
            Aplicar
          </button>
          <button onClick={clearFilters} className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 transition-colors dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700">
            Limpar
          </button>
        </div>
      </aside>

      {/* Conteudo Principal */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Cabecalho */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Mostrando <span className="font-semibold text-gray-900 dark:text-slate-100">{clients.length}</span> de{' '}
            <span className="font-semibold text-gray-900 dark:text-slate-100">{total}</span> clientes
          </p>
          <button
            onClick={() => navigate('/app/crm/new')}
            className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus size={16} /> Novo Cliente
          </button>
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden dark:bg-slate-800 dark:border-slate-700">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 dark:bg-slate-900 dark:border-slate-700">
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Nome</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Telefone</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Total Tickets</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Ultima Compra</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Status</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-gray-400 dark:text-slate-500">
                      Carregando...
                    </td>
                  </tr>
                ) : clients.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-gray-400 dark:text-slate-500">
                      Nenhum cliente encontrado
                    </td>
                  </tr>
                ) : (
                  clients.map((client) => {
                    const status = STATUS_MAP[client.status] || STATUS_MAP.inativo;
                    return (
                      <tr
                        key={client.id}
                        className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer dark:border-slate-700/50 dark:hover:bg-slate-700"
                        onClick={() => navigate(`/app/crm/${client.id}`)}
                      >
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-slate-100">{client.razaoSocial}</p>
                            {client.nomeFantasia && (
                              <p className="text-xs text-gray-400 dark:text-slate-500">{client.nomeFantasia}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-slate-400">{client.email || '-'}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-slate-400">{client.telefone || '-'}</td>
                        <td className="px-4 py-3 text-center text-gray-600 dark:text-slate-400">{client.totalTickets ?? 0}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-slate-400">
                          {client.ultimaCompra
                            ? new Date(client.ultimaCompra).toLocaleDateString('pt-BR')
                            : '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${status.className}`}>
                            {status.emoji} {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => navigate(`/app/crm/${client.id}`)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg transition-colors dark:text-slate-500"
                              title="Visualizar"
                            >
                              <Eye size={15} />
                            </button>
                            <button
                              onClick={() => navigate(`/app/crm/${client.id}/edit`)}
                              className="p-1.5 text-gray-400 hover:text-amber-600 rounded-lg transition-colors dark:text-slate-500"
                              title="Editar"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Remover "${client.razaoSocial}"?`)) {
                                  api.delete(`/crm/clients/${client.id}`).then(loadClients);
                                }
                              }}
                              className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg transition-colors dark:text-slate-500"
                              title="Excluir"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Paginacao */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-8 h-8 rounded-lg text-sm flex items-center justify-center border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors dark:border-slate-700 dark:hover:bg-slate-700"
            >
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .reduce<(number | string)[]>((acc, p, idx, arr) => {
                if (idx > 0 && typeof arr[idx - 1] === 'number' && p - (arr[idx - 1] as number) > 1) {
                  acc.push('...');
                }
                acc.push(p);
                return acc;
              }, [])
              .map((p, idx) =>
                typeof p === 'string' ? (
                  <span key={`dots-${idx}`} className="w-8 h-8 flex items-center justify-center text-gray-400 text-sm dark:text-slate-500">
                    ...
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      page === p
                        ? 'bg-blue-600 text-white'
                        : 'border border-gray-200 hover:bg-gray-50 text-gray-600 dark:border-slate-700 dark:hover:bg-slate-700 dark:text-slate-400'
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-8 h-8 rounded-lg text-sm flex items-center justify-center border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors dark:border-slate-700 dark:hover:bg-slate-700"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
