import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../services/api';
import { ArrowLeft, Edit2, Mail, Phone, Building2, User } from 'lucide-react';
import { Client } from '../../types';

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/clients/${id}`).then(({ data }) => {
      setClient(data);
    }).catch(() => navigate('/app/clients')).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" /></div>;
  if (!client) return null;

  return (
    <div className="max-w-2xl space-y-4">
      <button onClick={() => navigate('/app/clients')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={16} /> Voltar
      </button>

      <div className="card p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
            <p className="text-gray-500">Cliente desde {new Date(client.createdAt).toLocaleDateString('pt-BR')}</p>
          </div>
          <Link to={`/app/clients/${client.id}/edit`} className="btn-secondary flex items-center gap-2">
            <Edit2 size={16} /> Editar
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-6">
          {client.email && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Mail size={16} className="text-gray-400" /> {client.email}
            </div>
          )}
          {client.phone && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Phone size={16} className="text-gray-400" /> {client.phone}
            </div>
          )}
          {client.company && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Building2 size={16} className="text-gray-400" /> {client.company}
            </div>
          )}
          {client.seller && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <User size={16} className="text-gray-400" /> Vendedor: {client.seller.name}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
