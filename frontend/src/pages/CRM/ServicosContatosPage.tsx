import { useState } from 'react';
import { Plus, Eye, Edit2, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';

type Tab = 'contatos' | 'servicos' | 'contratos';

const CONTATOS = [
  { id: 1, nome: 'Ana Beatriz Oliveira', cargo: 'CEO', email: 'ana@oliveira.com', telefone: '(11) 91234-0001', principal: true },
  { id: 2, nome: 'Carlos Eduardo Santos', cargo: 'CTO', email: 'carlos@santos.com', telefone: '(11) 91234-0002', principal: false },
  { id: 3, nome: 'Marina Costa Lima', cargo: 'Gerente Comercial', email: 'marina@lima.com', telefone: '(21) 92345-0003', principal: false },
  { id: 4, nome: 'Roberto Almeida Neto', cargo: 'Analista de TI', email: 'roberto@almeida.com', telefone: '(31) 93456-0004', principal: false },
  { id: 5, nome: 'Juliana Ferreira Dias', cargo: 'Diretora Financeira', email: 'juliana@dias.com', telefone: '(41) 94567-0005', principal: true },
  { id: 6, nome: 'Thiago Pereira Rocha', cargo: 'Suporte Técnico', email: 'thiago@rocha.com', telefone: '(51) 95678-0006', principal: false },
  { id: 7, nome: 'Larissa Martins Souza', cargo: 'Coordenadora RH', email: 'larissa@mertins.com', telefone: '(61) 96789-0007', principal: false },
  { id: 8, nome: 'Gabriel Nogueira Barros', cargo: 'Analista Jurídico', email: 'gabriel@barros.com', telefone: '(71) 97890-0008', principal: false },
  { id: 9, nome: 'Isabela Cardoso Ribeiro', cargo: 'Marketing Digital', email: 'isabela@ribeiro.com', telefone: '(81) 98901-0009', principal: false },
  { id: 10, nome: 'Rafael Moreira Castro', cargo: 'Assistente Administrativo', email: 'rafael@castro.com', telefone: '(91) 99012-0010', principal: false },
  { id: 11, nome: 'Patrícia Teixeira Antunes', cargo: 'Analista de Sistemas', email: 'patricia@antunes.com', telefone: '(11) 90123-0011', principal: false },
  { id: 12, nome: 'André Luiz Farias', cargo: 'Consultor de Vendas', email: 'andre@farias.com', telefone: '(21) 91234-0012', principal: true },
];

const SERVICOS = [
  { id: 1, nome: 'Suporte Técnico Premium', descricao: 'Atendimento prioritário 24h por dia', valor: 2990.00, vencimento: '10/08/2026', vencido: false, status: 'Ativo' },
  { id: 2, nome: 'Hospedagem Cloud Pro', descricao: 'Servidor dedicado com 64GB RAM', valor: 1890.50, vencimento: '05/05/2026', vencido: true, status: 'Ativo' },
  { id: 3, nome: 'Consultoria SAP', descricao: 'Horas técnicas para implantação',  valor: 9450.00, vencimento: '28/02/2026', vencido: true, status: 'Inativo' },
  { id: 4, nome: 'Licença Office 365', descricao: '50 usuários pacote empresarial',  valor: 1245.75, vencimento: '15/09/2026', vencido: false, status: 'Ativo' },
  { id: 5, nome: 'Firewall Corporativo', descricao: 'Proteção de rede 24/7',  valor: 680.00, vencimento: '01/07/2026', vencido: false, status: 'Inativo' },
  { id: 6, nome: 'Certificação Digital', descricao: 'Certificado A1 válido 12 meses',  valor: 320.00, vencimento: '10/12/2026', vencido: false, status: 'Ativo' },
  { id: 7, nome: 'Monitoramento de Redes', descricao: 'NOC 24h com relatórios mensais',  valor: 1500.00, vencimento: '15/04/2026', vencido: true, status: 'Ativo' },
  { id: 8, nome: 'Backup Gerenciado', descricao: 'Backup automatizado na nuvem',  valor: 890.00, vencimento: '25/08/2026', vencido: false, status: 'Ativo' },
];

const CONTRATOS = [
  { id: 1, contrato: 'CT-2026-001', cliente: 'Empresa ABC Ltda',  valor: 5880.50, inicio: '01/01/2026', fim: '31/12/2026', status: 'Ativo' },
  { id: 2, contrato: 'CT-2025-089', cliente: 'Tech Solutions S.A.',  valor: 15400.00, inicio: '15/03/2025', fim: '14/03/2026', status: 'Expirado' },
  { id: 3, contrato: 'CT-2026-042', cliente: 'Distribuidora Solar',  valor: 3240.00, inicio: '10/06/2026', fim: '10/12/2026', status: 'Ativo' },
  { id: 4, contrato: 'CT-2026-107', cliente: 'Clínica Saúde Total',  valor: 4200.00, inicio: '01/07/2026', fim: '30/06/2027', status: 'Renovação' },
  { id: 5, contrato: 'CT-2025-203', cliente: 'Supermercado Preço Bom',  valor: 8900.00, inicio: '01/01/2025', fim: '31/12/2025', status: 'Expirado' },
];

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function ServicosContatosPage() {
  const [tab, setTab] = useState<Tab>('contatos');

  function TabButton({ value, label, count }: { value: Tab; label: string; count: number }) {
    const active = tab === value;
    return (
      <button onClick={() => setTab(value)}
        className={`relative px-5 py-3 text-sm font-medium transition-colors ${active ? 'text-blue-600' : 'text-neutral-500 hover:text-neutral-700 dark:text-slate-400 dark:hover:text-slate-300'}`}
        style={{ fontFamily: 'Khand, sans-serif' }}>
        {label} ({count})
        {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
      </button>
    );
  }

  const TABS: { value: Tab; label: string; count: number }[] = [
    { value: 'contatos', label: 'Contatos', count: CONTATOS.length },
    { value: 'servicos', label: 'Serviços', count: SERVICOS.length },
    { value: 'contratos', label: 'Contratos', count: CONTRATOS.length },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-neutral-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>CRM &gt; Serviços &amp; Contratos</p>
        <h1 className="text-2xl font-bold text-codemed-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>Serviços &amp; Contratos</h1>
      </div>

      <div className="card p-0 overflow-hidden dark:bg-slate-800 dark:border-slate-700">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
          <div className="flex">
            {TABS.map(t => <TabButton key={t.value} value={t.value} label={t.label} count={t.count} />)}
          </div>
          <div className="pr-4">
            {tab === 'contatos' && (
              <button className="btn-primary flex items-center gap-2 text-sm py-2">
                <Plus size={16} /> Novo Contato
              </button>
            )}
            {tab === 'servicos' && (
              <button className="btn-primary flex items-center gap-2 text-sm py-2">
                <Plus size={16} /> Novo Serviço
              </button>
            )}
            {tab === 'contratos' && (
              <button className="btn-primary flex items-center gap-2 text-sm py-2">
                <Plus size={16} /> Novo Contrato
              </button>
            )}
          </div>
        </div>

        <div className="p-0">
          {tab === 'contatos' && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-900">
                  <tr>
                    {['Nome', 'Cargo', 'Email', 'Telefone', 'Principal', 'Ações'].map(col => (
                      <th key={col} className="text-left px-4 py-3.5 text-xs font-semibold uppercase text-neutral-500 tracking-wider dark:text-slate-400" style={{ fontFamily: 'Khand, sans-serif' }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-slate-700">
                  {CONTATOS.map(c => (
                    <tr key={c.id} className="hover:bg-neutral-50 transition-colors dark:hover:bg-slate-700">
                      <td className="px-4 py-3 text-sm font-medium text-codemed-800 dark:text-slate-100">{c.nome}</td>
                      <td className="px-4 py-3 text-sm text-neutral-600 dark:text-slate-400">{c.cargo}</td>
                      <td className="px-4 py-3 text-sm text-neutral-600 dark:text-slate-400">{c.email}</td>
                      <td className="px-4 py-3 text-sm text-neutral-600 dark:text-slate-400">{c.telefone}</td>
                      <td className="px-4 py-3">
                        {c.principal
                          ? <span className="badge bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Sim</span>
                          : <span className="text-neutral-400 text-sm dark:text-slate-500">—</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors dark:hover:bg-blue-900/30" title="Ver"><Eye size={16} /></button>
                          <button className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600 transition-colors dark:hover:bg-amber-900/30" title="Editar"><Edit2 size={16} /></button>
                          <button className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors dark:hover:bg-red-900/30" title="Excluir"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'servicos' && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-900">
                  <tr>
                    {['Nome', 'Descrição', 'Valor', 'Vencimento', 'Status', 'Ações'].map(col => (
                      <th key={col} className="text-left px-4 py-3.5 text-xs font-semibold uppercase text-neutral-500 tracking-wider dark:text-slate-400" style={{ fontFamily: 'Khand, sans-serif' }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-slate-700">
                  {SERVICOS.map(s => (
                    <tr key={s.id} className="hover:bg-neutral-50 transition-colors dark:hover:bg-slate-700">
                      <td className="px-4 py-3 text-sm font-medium text-codemed-800 dark:text-slate-100">{s.nome}</td>
                      <td className="px-4 py-3 text-sm text-neutral-600 max-w-64 truncate dark:text-slate-400">{s.descricao}</td>
                      <td className="px-4 py-3 text-sm text-neutral-700 font-medium dark:text-slate-300">{formatCurrency(s.valor)}</td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-1.5">
                          <span className="text-neutral-700 dark:text-slate-300">{s.vencimento}</span>
                          {s.vencido && <span className="badge bg-red-100 text-red-700 text-xs dark:bg-red-900/30 dark:text-red-400">Vencido</span>}
                          {s.vencido && <span className="badge bg-red-100 text-red-700 text-xs dark:bg-red-900/30 dark:text-red-400">Inadimplente</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge ${s.status === 'Ativo' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>{s.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors dark:hover:bg-blue-900/30" title="Ver"><Eye size={16} /></button>
                          <button className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600 transition-colors dark:hover:bg-amber-900/30" title="Editar"><Edit2 size={16} /></button>
                          <button className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors dark:hover:bg-red-900/30" title="Excluir"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'contratos' && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-900">
                  <tr>
                    {['Contrato', 'Cliente', 'Valor', 'Início', 'Fim', 'Status', 'Ações'].map(col => (
                      <th key={col} className="text-left px-4 py-3.5 text-xs font-semibold uppercase text-neutral-500 tracking-wider dark:text-slate-400" style={{ fontFamily: 'Khand, sans-serif' }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-slate-700">
                  {CONTRATOS.map(c => (
                    <tr key={c.id} className="hover:bg-neutral-50 transition-colors dark:hover:bg-slate-700">
                      <td className="px-4 py-3 text-sm font-medium text-codemed-800 dark:text-slate-100">{c.contrato}</td>
                      <td className="px-4 py-3 text-sm text-neutral-600 dark:text-slate-400">{c.cliente}</td>
                      <td className="px-4 py-3 text-sm text-neutral-700 font-medium dark:text-slate-300">{formatCurrency(c.valor)}</td>
                      <td className="px-4 py-3 text-sm text-neutral-600 dark:text-slate-400">{c.inicio}</td>
                      <td className="px-4 py-3 text-sm text-neutral-600 dark:text-slate-400">{c.fim}</td>
                      <td className="px-4 py-3">
                        <span className={`badge ${
                          c.status === 'Ativo' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          c.status === 'Expirado' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                          'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        }`}>{c.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors dark:hover:bg-blue-900/30" title="Ver"><Eye size={16} /></button>
                          <button className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600 transition-colors dark:hover:bg-amber-900/30" title="Editar"><Edit2 size={16} /></button>
                          <button className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors dark:hover:bg-red-900/30" title="Excluir"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}