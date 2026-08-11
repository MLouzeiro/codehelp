import { useState } from 'react';
import { Search, Plus, Eye, Edit2, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';

const MOCK_CLIENTES = [
  { id: 1, nome: 'Empresa ABC Ltda', email: 'contato@abc.com.br', telefone: '(11) 99999-0001', totalTickets: 12, ultimaCompra: '15/03/2026', inadimplente: false, status: 'Ativo', categoria: 'Suporte', plano: 'Enterprise' },
  { id: 2, nome: 'Tech Solutions S.A.', email: 'admin@techsol.com.br', telefone: '(21) 98888-0002', totalTickets: 3, ultimaCompra: '02/01/2026', inadimplente: false, status: 'Ativo', categoria: 'Vendas', plano: 'Premium' },
  { id: 3, nome: 'Comércio Brasil Eireli', email: 'vendas@comerciobrasil.com', telefone: '(31) 97777-0003', totalTickets: 8, ultimaCompra: '20/11/2025', inadimplente: true, status: 'Inativo', categoria: 'Suporte', plano: 'Básico' },
  { id: 4, nome: 'Construtora Nova Era', email: 'obras@novaera.com.br', telefone: '(41) 96666-0004', totalTickets: 1, ultimaCompra: null, inadimplente: false, status: 'Lead', categoria: 'Vendas', plano: 'Básico' },
  { id: 5, nome: 'Farmácia Popular Ltda', email: 'farmacia@popular.com', telefone: '(51) 95555-0005', totalTickets: 25, ultimaCompra: '10/06/2026', inadimplente: false, status: 'Ativo', categoria: 'Suporte', plano: 'Enterprise' },
  { id: 6, nome: 'Auto Peças Veloz', email: 'pedidos@pecasveloz.com', telefone: '(61) 94444-0006', totalTickets: 0, ultimaCompra: null, inadimplente: false, status: 'Lead', categoria: 'Vendas', plano: 'Premium' },
  { id: 7, nome: 'Distribuidora Solar', email: 'logistica@distribsolar.com', telefone: '(71) 93333-0007', totalTickets: 7, ultimaCompra: '22/04/2026', inadimplente: true, status: 'Inativo', categoria: 'Suporte', plano: 'Básico' },
  { id: 8, nome: 'Restaurante Sabor Caseiro', email: 'contato@saborcaseiro.com.br', telefone: '(81) 92222-0008', totalTickets: 2, ultimaCompra: '05/02/2026', inadimplente: false, status: 'Ativo', categoria: 'Suporte', plano: 'Premium' },
  { id: 9, nome: 'Hotel Recanto Verde', email: 'reservas@recantoverde.com', telefone: '(91) 91111-0009', totalTickets: 15, ultimaCompra: '30/05/2026', inadimplente: false, status: 'Ativo', categoria: 'Vendas', plano: 'Enterprise' },
  { id: 10, nome: 'Transportadora Rápida', email: 'frota@transportadorarpida.com', telefone: '(11) 90000-0010', totalTickets: 6, ultimaCompra: '18/12/2025', inadimplente: true, status: 'Inativo', categoria: 'Suporte', plano: 'Básico' },
  { id: 11, nome: 'Clínica Saúde Total', email: 'agenda@saudetotal.com.br', telefone: '(21) 98877-0011', totalTickets: 4, ultimaCompra: '12/04/2026', inadimplente: false, status: 'Ativo', categoria: 'Suporte', plano: 'Premium' },
  { id: 12, nome: 'Escola Futuro Brilhante', email: 'secretaria@futurobrilhante.com', telefone: '(31) 97766-0012', totalTickets: 9, ultimaCompra: '08/03/2026', inadimplente: false, status: 'Ativo', categoria: 'Vendas', plano: 'Enterprise' },
  { id: 13, nome: 'Oficina Mestre Mecânico', email: 'orcamento@mestremecanico.com', telefone: '(41) 96655-0013', totalTickets: 1, ultimaCompra: null, inadimplente: false, status: 'Lead', categoria: 'Vendas', plano: 'Básico' },
  { id: 14, nome: 'Supermercado Preço Bom', email: 'compras@precobom.com.br', telefone: '(51) 95544-0014', totalTickets: 18, ultimaCompra: '25/06/2026', inadimplente: false, status: 'Ativo', categoria: 'Suporte', plano: 'Enterprise' },
  { id: 15, nome: 'Agência Digital Criativa', email: 'projetos@agenciacriativa.com', telefone: '(61) 94433-0015', totalTickets: 5, ultimaCompra: '14/01/2026', inadimplente: false, status: 'Ativo', categoria: 'Suporte', plano: 'Premium' },
];

export default function ClientesTabela() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState('');
  const [planoFilter, setPlanoFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [dataDe, setDataDe] = useState('');
  const [dataAte, setDataAte] = useState('');

  const perPage = 10;
  const totalPages = Math.ceil(MOCK_CLIENTES.length / perPage);
  const paginated = MOCK_CLIENTES.slice((page - 1) * perPage, page * perPage);

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      Ativo: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      Inativo: 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-400',
      Lead: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    };
    return <span className={`badge ${map[status] || 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-400'}`}>{status}</span>;
  };

  const inadiplenteBadge = (inadimplente: boolean) => {
    return inadimplente
      ? <span className="badge bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">Sim</span>
      : <span className="badge bg-gray-100 text-gray-400 dark:bg-slate-700 dark:text-slate-500">Não</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-codemed-800" style={{ fontFamily: 'Khand, sans-serif' }}>Clientes</h1>
          <p className="text-neutral-500" style={{ fontFamily: 'Lexend, sans-serif' }}>{MOCK_CLIENTES.length} clientes cadastrados</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Novo Cliente
        </button>
      </div>

      <div className="flex gap-6">
        <aside className="w-60 shrink-0">
          <div className="card p-5 space-y-5 dark:bg-slate-800 dark:border-slate-700">
            <h3 className="font-semibold text-codemed-800 text-lg dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>Filtros</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 dark:text-slate-400">Status</label>
                <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="input text-sm">
                  <option value="">Todos</option>
                  <option value="Ativo">Ativo</option>
                  <option value="Inativo">Inativo</option>
                  <option value="Lead">Lead</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 dark:text-slate-400">Data Cadastro</label>
                <div className="space-y-2">
                  <input type="date" value={dataDe} onChange={e => setDataDe(e.target.value)} className="input text-sm" placeholder="De" />
                  <input type="date" value={dataAte} onChange={e => setDataAte(e.target.value)} className="input text-sm" placeholder="Até" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 dark:text-slate-400">Categoria</label>
                <select value={categoriaFilter} onChange={e => { setCategoriaFilter(e.target.value); setPage(1); }} className="input text-sm">
                  <option value="">Todas</option>
                  <option value="Suporte">Suporte</option>
                  <option value="Vendas">Vendas</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 dark:text-slate-400">Plano</label>
                <select value={planoFilter} onChange={e => { setPlanoFilter(e.target.value); setPage(1); }} className="input text-sm">
                  <option value="">Todos</option>
                  <option value="Básico">Básico</option>
                  <option value="Premium">Premium</option>
                  <option value="Enterprise">Enterprise</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 dark:text-slate-400">Busca</label>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-slate-500" />
                  <input type="text" value={searchFilter} onChange={e => { setSearchFilter(e.target.value); setPage(1); }}
                    placeholder="Buscar cliente..." className="input text-sm pl-9" />
                </div>
              </div>
            </div>

            <div className="pt-2 space-y-2">
              <button className="btn-primary w-full text-sm justify-center flex items-center gap-2 py-2.5">
                Aplicar
              </button>
              <button onClick={() => { setStatusFilter(''); setCategoriaFilter(''); setPlanoFilter(''); setSearchFilter(''); setDataDe(''); setDataAte(''); setPage(1); }}
                className="btn-outline w-full text-sm justify-center flex items-center gap-2 py-2.5">
                Limpar
              </button>
            </div>
          </div>
        </aside>

        <div className="flex-1">
            <div className="card p-0 overflow-hidden dark:bg-slate-800 dark:border-slate-700">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-neutral-50 dark:bg-slate-900">
                  <tr>
                    {['Nome', 'Email', 'Telefone', 'Total Tickets', 'Última Compra', 'Inadimplente', 'Status', 'Ações'].map(col => (
                      <th key={col} className="text-left px-4 py-3.5 text-xs font-semibold uppercase text-neutral-500 tracking-wider dark:text-slate-400" style={{ fontFamily: 'Khand, sans-serif' }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-slate-700">
                  {paginated.map(cliente => (
                    <tr key={cliente.id} className="hover:bg-neutral-50 transition-colors dark:hover:bg-slate-700">
                      <td className="px-4 py-3 text-sm font-medium text-codemed-800 dark:text-slate-100">{cliente.nome}</td>
                      <td className="px-4 py-3 text-sm text-neutral-600 dark:text-slate-400">{cliente.email}</td>
                      <td className="px-4 py-3 text-sm text-neutral-600 dark:text-slate-400">{cliente.telefone}</td>
                      <td className="px-4 py-3 text-sm text-neutral-700 dark:text-slate-300">{cliente.totalTickets}</td>
                      <td className="px-4 py-3 text-sm text-neutral-600 dark:text-slate-400">{cliente.ultimaCompra || '—'}</td>
                      <td className="px-4 py-3">{inadiplenteBadge(cliente.inadimplente)}</td>
                      <td className="px-4 py-3">{statusBadge(cliente.status)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors dark:hover:bg-blue-900/30" title="Ver">
                            <Eye size={16} />
                          </button>
                          <button className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600 transition-colors dark:hover:bg-amber-900/30" title="Editar">
                            <Edit2 size={16} />
                          </button>
                          <button className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors dark:hover:bg-red-900/30" title="Excluir">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4">
            <p className="text-sm text-neutral-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
              Mostrando {(page - 1) * perPage + 1}–{Math.min(page * perPage, MOCK_CLIENTES.length)} de {MOCK_CLIENTES.length}
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg border border-neutral-200 hover:bg-neutral-50 text-neutral-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors dark:border-slate-700 dark:hover:bg-slate-700 dark:text-slate-400">
                <ChevronLeft size={16} /> Anterior
              </button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button key={i} onClick={() => setPage(i + 1)}
                  className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${page === i + 1 ? 'bg-codemed-800 text-white shadow-sm' : 'border border-neutral-200 hover:bg-neutral-50 text-neutral-600 dark:border-slate-700 dark:hover:bg-slate-700 dark:text-slate-400'}`}
                  style={page === i + 1 ? { fontFamily: 'Khand, sans-serif' } : { fontFamily: 'Lexend, sans-serif' }}>
                  {i + 1}
                </button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg border border-neutral-200 hover:bg-neutral-50 text-neutral-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors dark:border-slate-700 dark:hover:bg-slate-700 dark:text-slate-400">
                Próximo <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
