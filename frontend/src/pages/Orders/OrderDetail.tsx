import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../services/auth';
import { ArrowLeft, FileText, Send, Download, User, Calendar, DollarSign } from 'lucide-react';

export default function OrderDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => { loadOrder(); }, [id]);

  const loadOrder = async () => {
    try {
      const { data } = await api.get(`/orders/${id}`);
      setOrder(data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const sendForSignature = async () => {
    setSending(true);
    try {
      await api.post(`/orders/${id}/send-signature`);
      loadOrder();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao enviar');
    } finally { setSending(false); }
  };

  if (loading) return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" /></div>;
  if (!order) return <div className="text-center py-12 text-gray-500">OS não encontrada</div>;

  const statusLabels: Record<string, string> = {
    rascunho: 'Rascunho', aguardando_assinatura: 'Aguardando Assinatura', assinada: 'Assinada',
    em_execucao: 'Em Execução', concluida: 'Concluída', cancelada: 'Cancelada',
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <button onClick={() => navigate('/orders')} className="flex items-center gap-2 text-gray-500 hover:text-gray-700">
        <ArrowLeft size={18} /> Voltar
      </button>

      <div className="card">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-codemed-100 rounded-xl flex items-center justify-center">
              <FileText size={24} className="text-codemed-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{order.numeroOs}</h1>
              <p className="text-gray-500">{order.client?.razaoSocial}</p>
            </div>
          </div>
          <span className={`badge text-sm px-3 py-1.5 ${
            order.status === 'assinada' ? 'bg-green-100 text-green-700' :
            order.status === 'aguardando_assinatura' ? 'bg-amber-100 text-amber-700' :
            order.status === 'rascunho' ? 'bg-gray-100 text-gray-700' : 'bg-blue-100 text-blue-700'
          }`}>{statusLabels[order.status]}</span>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-6">
          <div><p className="text-xs text-gray-500">Cliente</p><p className="text-sm font-medium">{order.client?.razaoSocial}</p></div>
          <div><p className="text-xs text-gray-500">Tipo de Serviço</p><p className="text-sm font-medium">{order.tipoServico}</p></div>
          <div><p className="text-xs text-gray-500">Técnico Responsável</p><p className="text-sm font-medium">{order.tecnicoResponsavel?.name}</p></div>
          {order.valorServico && <div><p className="text-xs text-gray-500">Valor</p><p className="text-sm font-medium text-green-600">R$ {order.valorServico}</p></div>}
          <div><p className="text-xs text-gray-500">Data de Emissão</p><p className="text-sm font-medium">{new Date(order.dataEmissao).toLocaleDateString('pt-BR')}</p></div>
          {order.dataPrevistaEntrega && <div><p className="text-xs text-gray-500">Previsão de Entrega</p><p className="text-sm font-medium">{new Date(order.dataPrevistaEntrega).toLocaleDateString('pt-BR')}</p></div>}
        </div>

        {order.descricaoServico && (
          <div className="mt-4">
            <p className="text-xs text-gray-500 mb-1">Descrição do Serviço</p>
            <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">{order.descricaoServico}</p>
          </div>
        )}

        {order.sistemasEnvolvidos?.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-gray-500 mb-1">Sistemas Envolvidos</p>
            <div className="flex gap-2 flex-wrap">
              {order.sistemasEnvolvidos.map((s: string) => (
                <span key={s} className="badge bg-codemed-100 text-codemed-700">{s}</span>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3 mt-6 pt-4 border-t">
          {order.status === 'rascunho' && (
            <button onClick={sendForSignature} disabled={sending} className="btn-primary flex items-center gap-2">
              <Send size={16} /> {sending ? 'Enviando...' : 'Enviar para Assinatura'}
            </button>
          )}
          {order.status === 'rascunho' && (
            <button onClick={() => navigate(`/orders/${id}/edit`)} className="btn-secondary">Editar</button>
          )}
          {order.signature?.pdfPath && (
            <button onClick={() => window.open(`/api/orders/${id}/pdf`, '_blank')} className="btn-secondary flex items-center gap-2">
              <Download size={16} /> Baixar PDF
            </button>
          )}
        </div>
      </div>

      {order.signature && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">📝 Dados da Assinatura</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><p className="text-xs text-gray-500">Assinante</p><p className="text-sm font-medium">{order.signature.assinanteNome}</p></div>
            <div><p className="text-xs text-gray-500">CPF</p><p className="text-sm font-medium">{order.signature.assinanteCpf}</p></div>
            <div><p className="text-xs text-gray-500">Cargo</p><p className="text-sm font-medium">{order.signature.assinanteCargo}</p></div>
            <div><p className="text-xs text-gray-500">Data/Hora</p><p className="text-sm font-medium">{order.signature.assinadoEm ? new Date(order.signature.assinadoEm).toLocaleString('pt-BR') : '-'}</p></div>
          </div>
          {order.signature.assinaturaBase64 && (
            <div className="mt-4">
              <p className="text-xs text-gray-500 mb-2">Assinatura</p>
              <img src={order.signature.assinaturaBase64} alt="Assinatura" className="max-h-24 border border-gray-200 rounded-lg p-2 bg-white" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
