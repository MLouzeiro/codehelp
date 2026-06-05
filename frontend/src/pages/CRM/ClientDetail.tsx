import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../services/auth';
import { ArrowLeft, Phone, Mail, MapPin, Building2, Calendar, User, Plus } from 'lucide-react';

export default function ClientDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactForm, setContactForm] = useState({ tipo: 'ligacao', descricao: '', duracaoMinutos: '' });

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
    </div>
  );
}
