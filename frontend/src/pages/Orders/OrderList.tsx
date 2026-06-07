import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { Plus, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCan } from '../../services/useCan';

const LIMIT = 20;

export default function OrderList() {
  const [orders, setOrders] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const canCreate = useCan('order', 'create');
  const totalPages = Math.ceil(total / LIMIT);

  useEffect(() => { loadOrders(); }, [statusFilter, page]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: LIMIT };
      if (statusFilter) params.status = statusFilter;
      const { data } = await api.get('/orders', { params });
      setOrders(data.orders);
      setTotal(data.total);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      rascunho: 'bg-gray-100 text-gray-700', aguardando_assinatura: 'bg-amber-100 text-amber-700',
      assinada: 'bg-green-100 text-green-700', em_execucao: 'bg-blue-100 text-blue-700',
      concluida: 'bg-green-100 text-green-700', cancelada: 'bg-red-100 text-red-700',
    };
    const labels: Record<string, string> = {
      rascunho: 'Rascunho', aguardando_assinatura: 'Aguardando Ass.', assinada: 'Assinada',
      em_execucao: 'Em Execução', concluida: 'Concluída', cancelada: 'Cancelada',
    };
    return <span className={`badge ${styles[status] || ''}`}>{labels[status] || status}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-codemed-700 dark:text-neutral-100">Ordens de Serviço</h1><p className="text-neutral-500 dark:text-neutral-400">{total} OS registradas</p></div>
        {canCreate && (
          <button onClick={() => navigate('/app/orders/new')} className="btn-primary flex items-center gap-2">
            <Plus size={18} /> Nova OS
          </button>
        )}
      </div>

      <div className="flex gap-3">
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="input w-56">
          <option value="">Todos os status</option>
          <option value="rascunho">Rascunho</option>
          <option value="aguardando_assinatura">Aguardando Assinatura</option>
          <option value="assinada">Assinada</option>
          <option value="em_execucao">Em Execução</option>
          <option value="concluida">Concluída</option>
          <option value="cancelada">Cancelada</option>
        </select>
      </div>

      <div className="grid gap-3">
        {orders.map((order) => (
          <div key={order.id} onClick={() => navigate(`/app/orders/${order.id}`)}
            className="card cursor-pointer hover:shadow-md transition-shadow p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                  <FileText size={20} className="text-green-500" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-codemed-700 dark:text-neutral-100">{order.numeroOs}</span>
                    {statusBadge(order.status)}
                  </div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">{order.client?.razaoSocial}</p>
                  <p className="text-xs text-neutral-400">{order.tipoServico} • {order.tecnicoResponsavel?.name}</p>
                </div>
              </div>
              <div className="text-right text-sm">
                {order.valorServico && <p className="font-medium text-codemed-700 dark:text-neutral-100">R$ {order.valorServico}</p>}
                <p className="text-xs text-neutral-400">{new Date(order.dataEmissao).toLocaleDateString('pt-BR')}</p>
                {order.signature?.assinadoEm && <span className="badge bg-green-100 text-green-700 text-xs mt-1 inline-block">Assinada</span>}
              </div>
            </div>
          </div>
        ))}
        {!loading && orders.length === 0 && <div className="text-center py-12 text-neutral-500 dark:text-neutral-400">Nenhuma OS encontrada</div>}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="w-9 h-9 rounded-lg border border-neutral-200 dark:border-neutral-700 flex items-center justify-center hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed">
            <ChevronLeft size={16} />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button key={p} onClick={() => setPage(p)}
              className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${p === page ? 'bg-green-500 text-white' : 'border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800'}`}>
              {p}
            </button>
          ))}
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="w-9 h-9 rounded-lg border border-neutral-200 dark:border-neutral-700 flex items-center justify-center hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed">
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
