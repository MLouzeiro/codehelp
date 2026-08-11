import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import {
  ArrowLeft, Building2, Users, Wrench, FileText,
  Plus, Edit2, Trash2, X, Star, AlertTriangle,
} from 'lucide-react';

interface Colaborador {
  id: string;
  clientId: string;
  nome: string;
  cargo: string | null;
  setor: string | null;
  email: string | null;
  telefone: string | null;
  whatsapp: string | null;
  principal: boolean;
  observacoes: string | null;
  ativo: boolean;
}

interface Servico {
  id: string;
  nome: string;
  descricao?: string;
  valor: number;
  dataVencimento?: string;
  status: string;
}

const COLAB_FORM_VAZIO = {
  nome: '', cargo: '', setor: '', email: '', telefone: '', whatsapp: '', principal: false, observacoes: '',
};

const TABS = [
  { key: 'contatos', label: 'Contatos', icon: Users },
  { key: 'servicos', label: 'Servicos', icon: Wrench },
  { key: 'contratos', label: 'Contratos', icon: FileText },
];

const SERVICO_STATUS: Record<string, { label: string; emoji: string; className: string }> = {
  ativo: { label: 'Ativo', emoji: '✅', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  pendente: { label: 'Pendente', emoji: '⏳', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  inadimplente: { label: 'Inadimplente', emoji: '⚠️', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('contatos');

  const [showColabForm, setShowColabForm] = useState(false);
  const [colabEdit, setColabEdit] = useState<Colaborador | null>(null);
  const [colabForm, setColabForm] = useState(COLAB_FORM_VAZIO);
  const [colabErro, setColabErro] = useState('');
  const [colabSaving, setColabSaving] = useState(false);

  useEffect(() => { loadClient(); }, [id]);

  const loadClient = async () => {
    try {
      const { data } = await api.get(`/crm/clients/${id}`);
      setClient(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const abrirNovoColab = () => {
    setColabEdit(null);
    setColabForm({
      nome: '', cargo: '', setor: '',
      email: client?.email || '', telefone: client?.telefone || '',
      whatsapp: client?.telefone || '', principal: false, observacoes: '',
    });
    setColabErro('');
    setShowColabForm(true);
  };

  const abrirEdicaoColab = (c: Colaborador) => {
    setColabEdit(c);
    setColabForm({
      nome: c.nome, cargo: c.cargo || '', setor: c.setor || '',
      email: c.email || '', telefone: c.telefone || '', whatsapp: c.whatsapp || '',
      principal: c.principal, observacoes: c.observacoes || '',
    });
    setColabErro('');
    setShowColabForm(true);
  };

  const salvarColab = async () => {
    setColabErro('');
    if (!colabForm.nome.trim()) { setColabErro('Nome e obrigatorio'); return; }
    setColabSaving(true);
    try {
      const payload = {
        nome: colabForm.nome.trim(), cargo: colabForm.cargo.trim() || null,
        setor: colabForm.setor.trim() || null, email: colabForm.email.trim() || null,
        telefone: colabForm.telefone.trim() || null, whatsapp: colabForm.whatsapp.trim() || null,
        principal: colabForm.principal, observacoes: colabForm.observacoes.trim() || null,
      };
      if (colabEdit) { await api.put(`/crm/colaboradores/${colabEdit.id}`, payload); }
      else { await api.post(`/crm/clients/${id}/colaboradores`, payload); }
      setShowColabForm(false);
      loadClient();
    } catch (err: any) {
      setColabErro(err?.response?.data?.error || 'Erro ao salvar');
    } finally {
      setColabSaving(false);
    }
  };

  const deletarColab = async (c: Colaborador) => {
    if (!confirm(`Remover "${c.nome}"?`)) return;
    try { await api.delete(`/crm/colaboradores/${c.id}`); loadClient(); } catch (err) { console.error(err); }
  };

  const marcarPrincipal = async (c: Colaborador) => {
    try { await api.post(`/crm/colaboradores/${c.id}/principal`, { valor: !c.principal }); loadClient(); } catch (err) { console.error(err); }
  };

  if (loading) return (
    <div className="flex justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );

  if (!client) return (
    <div className="text-center py-12 text-gray-500 dark:text-slate-400">Cliente nao encontrado</div>
  );

  const colaboradores: Colaborador[] = client.colaboradores || [];
  const servicos: Servico[] = client.servicos || [];
  const contratos = client.contratos || [];

  return (
    <div className="space-y-6 max-w-6xl">
      <button onClick={() => navigate('/app/crm')} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-300">
        <ArrowLeft size={18} /> Voltar
      </button>

      {/* Header Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 dark:bg-slate-800 dark:border-slate-700">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center dark:bg-blue-900/30">
              <Building2 size={28} className="text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">{client.razaoSocial}</h1>
              {client.nomeFantasia && <p className="text-gray-500 dark:text-slate-400">{client.nomeFantasia}</p>}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${
                  client.status === 'ativo' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-400'
                }`}>
                  {client.status === 'ativo' ? '✅' : '💤'} {client.status}
                </span>
                {client.cnpjCpf && (
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-400">
                    {client.cnpjCpf}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-slate-700">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-slate-400 dark:hover:text-slate-300 dark:hover:border-slate-600'
            }`}
          >
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">

        {/* CONTATOS */}
        {activeTab === 'contatos' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={abrirNovoColab}
                className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Plus size={14} /> Novo Contato
              </button>
            </div>

            {colaboradores.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 text-center py-12 text-gray-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-500">
                <Users size={40} className="mx-auto mb-3 opacity-50" />
                <p>Nenhum contato cadastrado</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden dark:bg-slate-800 dark:border-slate-700">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 dark:bg-slate-900 dark:border-slate-700">
                        <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Nome</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Cargo</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Email</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Telefone</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Principal</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Acoes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {colaboradores.map((c) => (
                        <tr key={c.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 dark:border-slate-700/50 dark:hover:bg-slate-700">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 dark:bg-blue-900/30">
                                <span className="text-blue-700 text-xs font-semibold dark:text-blue-400">{c.nome.charAt(0).toUpperCase()}</span>
                              </div>
                              <span className="font-medium text-gray-900 dark:text-slate-100">{c.nome}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-slate-400">{c.cargo || '-'}</td>
                          <td className="px-4 py-3 text-gray-600 dark:text-slate-400">{c.email || '-'}</td>
                          <td className="px-4 py-3 text-gray-600 dark:text-slate-400">{c.telefone || '-'}</td>
                          <td className="px-4 py-3 text-center">
                            {c.principal ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                <Star size={10} fill="currentColor" /> Sim
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs dark:text-slate-500">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => marcarPrincipal(c)}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  c.principal ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/30' : 'text-gray-400 hover:text-amber-500 dark:text-slate-500'
                                }`}
                                title="Principal"
                              >
                                <Star size={14} fill={c.principal ? 'currentColor' : 'none'} />
                              </button>
                              <button
                                onClick={() => abrirEdicaoColab(c)}
                                className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg transition-colors dark:text-slate-500"
                                title="Editar"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => deletarColab(c)}
                                className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg transition-colors dark:text-slate-500"
                                title="Remover"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SERVICOS */}
        {activeTab === 'servicos' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() => navigate(`/app/services/new?clientId=${client.id}`)}
                className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Plus size={14} /> Novo Servico
              </button>
            </div>

            {servicos.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 text-center py-12 text-gray-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-500">
                <Wrench size={40} className="mx-auto mb-3 opacity-50" />
                <p>Nenhum servico registrado</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden dark:bg-slate-800 dark:border-slate-700">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 dark:bg-slate-900 dark:border-slate-700">
                        <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Nome</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Descricao</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Valor (R$)</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Vencimento</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Status</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Acoes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {servicos.map((s) => {
                        const st = SERVICO_STATUS[s.status] || SERVICO_STATUS.pendente;
                        return (
                          <tr key={s.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 dark:border-slate-700/50 dark:hover:bg-slate-700">
                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-slate-100">{s.nome}</td>
                            <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate dark:text-slate-400">{s.descricao || '-'}</td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-slate-100">
                              R$ {s.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3 text-gray-600 dark:text-slate-400">
                              {s.dataVencimento
                                ? new Date(s.dataVencimento).toLocaleDateString('pt-BR')
                                : '-'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${st.className}`}>
                                {st.emoji} {st.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => navigate(`/app/services/${s.id}/edit`)}
                                  className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg transition-colors dark:text-slate-500"
                                  title="Editar"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm(`Remover servico "${s.nome}"?`)) {
                                      api.delete(`/crm/services/${s.id}`).then(loadClient);
                                    }
                                  }}
                                  className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg transition-colors dark:text-slate-500"
                                  title="Excluir"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* CONTRATOS */}
        {activeTab === 'contratos' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() => navigate(`/app/contracts/new?clientId=${client.id}`)}
                className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Plus size={14} /> Novo Contrato
              </button>
            </div>

            {contratos.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 text-center py-12 text-gray-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-500">
                <FileText size={40} className="mx-auto mb-3 opacity-50" />
                <p>Nenhum contrato registrado</p>
              </div>
            ) : (
              <div className="space-y-3">
                {contratos.map((ct: any) => (
                  <div key={ct.id} className="bg-white rounded-xl border border-gray-200 p-5 dark:bg-slate-800 dark:border-slate-700">
                    <div className="flex items-start justify-between flex-wrap gap-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900 dark:text-slate-100">{ct.numero || ct.tipo || 'Contrato'}</h3>
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${
                            ct.status === 'ativo' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                            ct.status === 'suspenso' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                            'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'
                          }`}>
                            {ct.status === 'ativo' ? '✅' : ct.status === 'suspenso' ? '⏳' : '💤'} {ct.status}
                          </span>
                        </div>
                        {ct.descricao && <p className="text-sm text-gray-500 dark:text-slate-400">{ct.descricao}</p>}
                        <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-slate-500">
                          {ct.valor != null && (
                            <span>Valor: <span className="font-semibold text-gray-700 dark:text-slate-300">R$ {ct.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></span>
                          )}
                          {ct.dataInicio && (
                            <span>Inicio: {new Date(ct.dataInicio).toLocaleDateString('pt-BR')}</span>
                          )}
                          {ct.dataFim && (
                            <span>Fim: {new Date(ct.dataFim).toLocaleDateString('pt-BR')}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => navigate(`/app/contracts/${ct.id}/edit`)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg transition-colors dark:text-slate-500"
                          title="Editar"
                        >
                          <Edit2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Colaborador */}
      {showColabForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={() => setShowColabForm(false)}>
          <div
            className="bg-white rounded-2xl p-6 shadow-xl w-full max-w-lg mx-4 space-y-4 dark:bg-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-lg text-gray-900 dark:text-slate-100">{colabEdit ? 'Editar Contato' : 'Novo Contato'}</h3>
              <button onClick={() => setShowColabForm(false)} className="text-gray-400 hover:text-gray-600 p-1 dark:text-slate-500">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block dark:text-slate-400">Nome completo *</label>
                <input
                  type="text"
                  placeholder="Ex: Maria Silva"
                  value={colabForm.nome}
                  onChange={(e) => setColabForm({ ...colabForm, nome: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block dark:text-slate-400">Cargo</label>
                  <input
                    type="text"
                    placeholder="Ex: Gerente"
                    value={colabForm.cargo}
                    onChange={(e) => setColabForm({ ...colabForm, cargo: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block dark:text-slate-400">Setor</label>
                  <input
                    type="text"
                    placeholder="Ex: Financeiro"
                    value={colabForm.setor}
                    onChange={(e) => setColabForm({ ...colabForm, setor: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block dark:text-slate-400">Email</label>
                <input
                  type="email"
                  placeholder="Ex: maria@empresa.com"
                  value={colabForm.email}
                  onChange={(e) => setColabForm({ ...colabForm, email: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block dark:text-slate-400">Telefone</label>
                  <input
                    type="text"
                    placeholder="Ex: 8533334444"
                    value={colabForm.telefone}
                    onChange={(e) => setColabForm({ ...colabForm, telefone: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block dark:text-slate-400">WhatsApp</label>
                  <input
                    type="text"
                    placeholder="Ex: 85999998888"
                    value={colabForm.whatsapp}
                    onChange={(e) => setColabForm({ ...colabForm, whatsapp: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block dark:text-slate-400">Observacoes</label>
                <textarea
                  value={colabForm.observacoes}
                  onChange={(e) => setColabForm({ ...colabForm, observacoes: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  rows={2}
                  placeholder="Anotacoes..."
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={colabForm.principal}
                  onChange={(e) => setColabForm({ ...colabForm, principal: e.target.checked })}
                  className="rounded border-gray-300 dark:border-slate-600"
                />
                <Star size={14} className="text-amber-500" fill="currentColor" /> Marcar como principal
              </label>
            </div>
            {colabErro && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs dark:bg-red-900/30 dark:border-red-800 dark:text-red-400">
                <AlertTriangle size={14} /> {colabErro}
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowColabForm(false)}
                className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 transition-colors dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={salvarColab}
                disabled={colabSaving}
                className="flex-1 bg-blue-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {colabSaving ? 'Salvando...' : colabEdit ? 'Atualizar' : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
