import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../../services/api';

export default function OrderForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [clients, setClients] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [form, setForm] = useState({
    clientId: searchParams.get('clientId') || '',
    tipoServico: 'suporte',
    descricaoServico: '',
    sistemasEnvolvidos: '',
    equipamentos: '',
    tecnicoResponsavelId: '',
    valorServico: '',
    dataPrevistaEntrega: '',
    ticketId: searchParams.get('ticketId') || '',
    observacoes: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSelects();
    if (isEdit) loadOrder();
  }, [id]);

  const loadSelects = async () => {
    try {
      const [clientsRes, techsRes] = await Promise.all([
        api.get('/crm/clients', { params: { limit: 200 } }),
        api.get('/auth/users'),
      ]);
      setClients(clientsRes.data.clients);
      setTechnicians(techsRes.data.filter((u: any) => ['admin', 'gerente', 'tecnico'].includes(u.role)));
    } catch (err) { console.error(err); }
  };

  const loadOrder = async () => {
    try {
      const { data } = await api.get(`/orders/${id}`);
      setForm({
        clientId: data.clientId,
        tipoServico: data.tipoServico,
        descricaoServico: data.descricaoServico || '',
        sistemasEnvolvidos: data.sistemasEnvolvidos?.join(', ') || '',
        equipamentos: data.equipamentos || '',
        tecnicoResponsavelId: data.tecnicoResponsavelId,
        valorServico: data.valorServico?.toString() || '',
        dataPrevistaEntrega: data.dataPrevistaEntrega?.split('T')[0] || '',
        ticketId: data.ticketId || '',
        observacoes: data.observacoes || '',
      });
    } catch (err) { console.error(err); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...form,
        sistemasEnvolvidos: form.sistemasEnvolvidos.split(',').map((s) => s.trim()).filter(Boolean),
        valorServico: form.valorServico ? parseFloat(form.valorServico) : null,
      };

      if (isEdit) {
        await api.put(`/orders/${id}`, payload);
      } else {
        await api.post('/orders', payload);
      }
      navigate('/app/orders');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{isEdit ? 'Editar OS' : 'Nova Ordem de Serviço'}</h1>
        <p className="text-gray-500">Preencha os dados da OS</p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
            <select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} className="input" required>
              <option value="">Selecione um cliente</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.razaoSocial}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Serviço *</label>
            <select value={form.tipoServico} onChange={(e) => setForm({ ...form, tipoServico: e.target.value })} className="input">
              <option value="implantacao">Implantação</option>
              <option value="suporte">Suporte</option>
              <option value="treinamento">Treinamento</option>
              <option value="desenvolvimento">Desenvolvimento</option>
              <option value="manutencao">Manutenção</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Técnico Responsável *</label>
            <select value={form.tecnicoResponsavelId} onChange={(e) => setForm({ ...form, tecnicoResponsavelId: e.target.value })} className="input" required>
              <option value="">Selecione</option>
              {technicians.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição do Serviço</label>
            <textarea value={form.descricaoServico} onChange={(e) => setForm({ ...form, descricaoServico: e.target.value })} className="input" rows={4} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sistemas Envolvidos</label>
            <input type="text" value={form.sistemasEnvolvidos} onChange={(e) => setForm({ ...form, sistemasEnvolvidos: e.target.value })} className="input" placeholder="LIS, GLPI, Módulo Fiscal" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Equipamentos</label>
            <input type="text" value={form.equipamentos} onChange={(e) => setForm({ ...form, equipamentos: e.target.value })} className="input" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Valor do Serviço (R$)</label>
            <input type="number" step="0.01" value={form.valorServico} onChange={(e) => setForm({ ...form, valorServico: e.target.value })} className="input" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Previsão de Entrega</label>
            <input type="date" value={form.dataPrevistaEntrega} onChange={(e) => setForm({ ...form, dataPrevistaEntrega: e.target.value })} className="input" />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
            <textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} className="input" rows={2} />
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Salvando...' : isEdit ? 'Atualizar OS' : 'Criar OS'}
          </button>
          <button type="button" onClick={() => navigate('/app/orders')} className="btn-secondary">Cancelar</button>
        </div>
      </form>
    </div>
  );
}
