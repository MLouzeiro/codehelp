import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../services/auth';
import {
  ArrowLeft, Phone, Mail, MapPin, Building2, Calendar, User, Plus,
  Users, Star, Edit2, Trash2, X, Briefcase, MessageCircle,
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

const COLAB_FORM_VAZIO = {
  nome: '',
  cargo: '',
  setor: '',
  email: '',
  telefone: '',
  whatsapp: '',
  principal: false,
  observacoes: '',
};

export default function ClientDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactForm, setContactForm] = useState({ tipo: 'ligacao', descricao: '', duracaoMinutos: '' });

  const [showColabForm, setShowColabForm] = useState(false);
  const [colabEdit, setColabEdit] = useState<Colaborador | null>(null);
  const [colabForm, setColabForm] = useState(COLAB_FORM_VAZIO);
  const [colabErro, setColabErro] = useState('');
  const [colabSaving, setColabSaving] = useState(false);

  useEffect(() => {
    loadClient();
  }, [id]);

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

  const addContact = async () => {
    try {
      await api.post('/crm/contacts', { clientId: id, ...contactForm });
      setShowContactForm(false);
      setContactForm({ tipo: 'ligacao', descricao: '', duracaoMinutos: '' });
      loadClient();
    } catch (err) {
      console.error(err);
    }
  };

  const abrirNovoColab = () => {
    setColabEdit(null);
    setColabForm(COLAB_FORM_VAZIO);
    setColabErro('');
    setShowColabForm(true);
  };

  const abrirEdicaoColab = (c: Colaborador) => {
    setColabEdit(c);
    setColabForm({
      nome: c.nome,
      cargo: c.cargo || '',
      setor: c.setor || '',
      email: c.email || '',
      telefone: c.telefone || '',
      whatsapp: c.whatsapp || '',
      principal: c.principal,
      observacoes: c.observacoes || '',
    });
    setColabErro('');
    setShowColabForm(true);
  };

  const salvarColab = async () => {
    setColabErro('');
    if (!colabForm.nome.trim()) {
      setColabErro('Nome e obrigatorio');
      return;
    }
    setColabSaving(true);
    try {
      const payload = {
        nome: colabForm.nome.trim(),
        cargo: colabForm.cargo.trim() || null,
        setor: colabForm.setor.trim() || null,
        email: colabForm.email.trim() || null,
        telefone: colabForm.telefone.trim() || null,
        whatsapp: colabForm.whatsapp.trim() || null,
        principal: colabForm.principal,
        observacoes: colabForm.observacoes.trim() || null,
      };
      if (colabEdit) {
        await api.put(`/crm/colaboradores/${colabEdit.id}`, payload);
      } else {
        await api.post(`/crm/clients/${id}/colaboradores`, payload);
      }
      setShowColabForm(false);
      loadClient();
    } catch (err: any) {
      setColabErro(err?.response?.data?.error || 'Erro ao salvar colaborador');
    } finally {
      setColabSaving(false);
    }
  };

  const deletarColab = async (c: Colaborador) => {
    if (!confirm(`Remover colaborador "${c.nome}"?`)) return;
    try {
      await api.delete(`/crm/colaboradores/${c.id}`);
      loadClient();
    } catch (err) {
      console.error(err);
    }
  };

  const marcarPrincipal = async (c: Colaborador) => {
    try {
      await api.post(`/crm/colaboradores/${c.id}/principal`, { valor: !c.principal });
      loadClient();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" /></div>;
  if (!client) return <div className="text-center py-12 text-gray-500">Cliente não encontrado</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <button onClick={() => navigate('/crm')} className="flex items-center gap-2 text-gray-500 hover:text-gray-700">
        <ArrowLeft size={18} /> Voltar
      </button>

      <div className="card">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-codemed-100 rounded-xl flex items-center justify-center">
              <Building2 size={28} className="text-codemed-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{client.razaoSocial}</h1>
              {client.nomeFantasia && <p className="text-gray-500">{client.nomeFantasia}</p>}
              <span className="badge bg-green-100 text-green-700 mt-1 inline-block">{client.status}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => navigate(`/orders/new?clientId=${client.id}`)} className="btn-primary text-sm">
              <Plus size={16} className="inline mr-1" /> Nova OS
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          {client.cnpjCpf && <div><p className="text-xs text-gray-500">CNPJ/CPF</p><p className="text-sm font-medium">{client.cnpjCpf}</p></div>}
          {client.telefone && <div><p className="text-xs text-gray-500">Telefone</p><p className="text-sm font-medium flex items-center gap-1"><Phone size={14} />{client.telefone}</p></div>}
          {client.email && <div><p className="text-xs text-gray-500">Email</p><p className="text-sm font-medium flex items-center gap-1"><Mail size={14} />{client.email}</p></div>}
          {client.cidade && <div><p className="text-xs text-gray-500">Cidade</p><p className="text-sm font-medium flex items-center gap-1"><MapPin size={14} />{client.cidade}/{client.estado}</p></div>}
          <div><p className="text-xs text-gray-500">Segmento</p><p className="text-sm font-medium">{client.segmento}</p></div>
          <div><p className="text-xs text-gray-500">Responsável</p><p className="text-sm font-medium">{client.responsavelTecnico?.name || '-'}</p></div>
          <div><p className="text-xs text-gray-500">Origem</p><p className="text-sm font-medium">{client.origem}</p></div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Users size={18} />
            Colaboradores ({client.colaboradores?.length || 0})
          </h3>
          <button onClick={abrirNovoColab} className="text-sm text-codemed-600 hover:text-codemed-700 font-medium flex items-center gap-1">
            <Plus size={14} /> Novo
          </button>
        </div>

        <div className="space-y-2">
          {client.colaboradores?.map((c: Colaborador) => (
            <div key={c.id} className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg border border-gray-100">
              <div className="w-9 h-9 rounded-full bg-codemed-100 flex items-center justify-center flex-shrink-0">
                <span className="text-codemed-700 font-semibold text-sm">{c.nome.charAt(0).toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-gray-900">{c.nome}</p>
                  {c.principal && (
                    <span className="badge bg-amber-100 text-amber-700 flex items-center gap-1">
                      <Star size={10} fill="currentColor" /> Principal
                    </span>
                  )}
                  {c.cargo && (
                    <span className="badge bg-gray-100 text-gray-600 flex items-center gap-1">
                      <Briefcase size={10} /> {c.cargo}
                    </span>
                  )}
                </div>
                {c.setor && <p className="text-xs text-gray-500 mt-0.5">Setor: {c.setor}</p>}
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                  {c.email && <span className="flex items-center gap-1"><Mail size={11} /> {c.email}</span>}
                  {c.telefone && <span className="flex items-center gap-1"><Phone size={11} /> {c.telefone}</span>}
                  {c.whatsapp && <span className="flex items-center gap-1"><MessageCircle size={11} /> {c.whatsapp}</span>}
                </div>
                {c.observacoes && <p className="text-xs text-gray-400 mt-1 italic">{c.observacoes}</p>}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => marcarPrincipal(c)}
                  className={`p-1.5 rounded-lg transition-colors ${c.principal ? 'text-amber-500 bg-amber-50' : 'text-gray-400 hover:text-amber-500 hover:bg-amber-50'}`}
                  title={c.principal ? 'Desmarcar principal' : 'Marcar como principal'}
                >
                  <Star size={14} fill={c.principal ? 'currentColor' : 'none'} />
                </button>
                <button
                  onClick={() => abrirEdicaoColab(c)}
                  className="p-1.5 text-gray-400 hover:text-codemed-600 hover:bg-codemed-50 rounded-lg transition-colors"
                  title="Editar"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={() => deletarColab(c)}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Remover"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          {(!client.colaboradores || client.colaboradores.length === 0) && (
            <p className="text-sm text-gray-400 text-center py-6">
              Nenhum colaborador cadastrado. Clique em "Novo" para adicionar pessoas que trabalham no cliente.
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Histórico de Contatos</h3>
            <button onClick={() => setShowContactForm(!showContactForm)} className="text-sm text-codemed-600 hover:text-codemed-700 font-medium">+ Novo</button>
          </div>

          {showContactForm && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg space-y-2">
              <select value={contactForm.tipo} onChange={(e) => setContactForm({ ...contactForm, tipo: e.target.value })} className="input text-sm">
                <option value="ligacao">Ligação</option>
                <option value="visita">Visita</option>
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="reuniao">Reunião</option>
              </select>
              <textarea value={contactForm.descricao} onChange={(e) => setContactForm({ ...contactForm, descricao: e.target.value })}
                className="input text-sm" placeholder="Descrição..." rows={2} />
              <input type="number" value={contactForm.duracaoMinutos} onChange={(e) => setContactForm({ ...contactForm, duracaoMinutos: e.target.value })}
                className="input text-sm" placeholder="Duração (min)" />
              <div className="flex gap-2">
                <button onClick={addContact} className="btn-primary text-sm">Salvar</button>
                <button onClick={() => setShowContactForm(false)} className="btn-secondary text-sm">Cancelar</button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {client.contacts?.map((contact: any) => (
              <div key={contact.id} className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Calendar size={14} className="text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{contact.tipo}</p>
                  {contact.descricao && <p className="text-sm text-gray-500 truncate">{contact.descricao}</p>}
                  <p className="text-xs text-gray-400">{new Date(contact.data).toLocaleDateString('pt-BR')} - {contact.usuario?.name}</p>
                </div>
              </div>
            ))}
            {(!client.contacts || client.contacts.length === 0) && (
              <p className="text-sm text-gray-400 text-center py-4">Nenhum contato registrado</p>
            )}
          </div>
        </div>

        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Ordens de Serviço</h3>
          <div className="space-y-2">
            {client.serviceOrders?.map((os: any) => (
              <div key={os.id} onClick={() => navigate(`/orders/${os.id}`)}
                className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
                <div>
                  <p className="text-sm font-medium text-gray-900">{os.numeroOs}</p>
                  <p className="text-xs text-gray-500">{os.tipoServico}</p>
                </div>
                <span className={`badge ${os.status === 'assinada' ? 'bg-green-100 text-green-700' : os.status === 'rascunho' ? 'bg-gray-100 text-gray-700' : 'bg-blue-100 text-blue-700'}`}>{os.status}</span>
              </div>
            ))}
            {(!client.serviceOrders || client.serviceOrders.length === 0) && (
              <p className="text-sm text-gray-400 text-center py-4">Nenhuma OS registrada</p>
            )}
          </div>
        </div>
      </div>

      {showColabForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={() => setShowColabForm(false)}>
          <div className="bg-white rounded-2xl p-6 shadow-xl w-full max-w-lg mx-4 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-lg text-gray-900">
                {colabEdit ? 'Editar Colaborador' : 'Novo Colaborador'}
              </h3>
              <button onClick={() => setShowColabForm(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Nome completo *</label>
                <input type="text" placeholder="Ex: Maria Silva" value={colabForm.nome}
                  onChange={(e) => setColabForm({ ...colabForm, nome: e.target.value })}
                  className="input" autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Cargo</label>
                  <input type="text" placeholder="Ex: Gerente" value={colabForm.cargo}
                    onChange={(e) => setColabForm({ ...colabForm, cargo: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Setor</label>
                  <input type="text" placeholder="Ex: Financeiro" value={colabForm.setor}
                    onChange={(e) => setColabForm({ ...colabForm, setor: e.target.value })} className="input" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Email</label>
                <input type="email" placeholder="Ex: maria@empresa.com" value={colabForm.email}
                  onChange={(e) => setColabForm({ ...colabForm, email: e.target.value })} className="input" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Telefone</label>
                  <input type="text" placeholder="Ex: 8533334444" value={colabForm.telefone}
                    onChange={(e) => setColabForm({ ...colabForm, telefone: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">WhatsApp</label>
                  <input type="text" placeholder="Ex: 85999998888" value={colabForm.whatsapp}
                    onChange={(e) => setColabForm({ ...colabForm, whatsapp: e.target.value })} className="input" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Observações</label>
                <textarea value={colabForm.observacoes} onChange={(e) => setColabForm({ ...colabForm, observacoes: e.target.value })}
                  className="input" rows={2} placeholder="Anotações sobre o contato..." />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={colabForm.principal}
                  onChange={(e) => setColabForm({ ...colabForm, principal: e.target.checked })}
                  className="rounded border-gray-300" />
                <Star size={14} className="text-amber-500" fill="currentColor" />
                Marcar como colaborador principal
              </label>
            </div>

            {colabErro && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs">
                <X size={14} /> {colabErro}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowColabForm(false)} className="btn-secondary text-sm flex-1">Cancelar</button>
              <button onClick={salvarColab} disabled={colabSaving} className="btn-primary text-sm flex-1 disabled:opacity-50">
                {colabSaving ? 'Salvando...' : colabEdit ? 'Atualizar' : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
