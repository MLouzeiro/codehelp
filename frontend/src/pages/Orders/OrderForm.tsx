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
    tipoImplantacao: '',
    precoImplantacao: '',
    horasDev: '',
    horasSuporte: '',
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
        tipoImplantacao: data.tipoImplantacao || '',
        precoImplantacao: data.precoImplantacao?.toString() || '',
        horasDev: data.horasDev?.toString() || '',
        horasSuporte: data.horasSuporte?.toString() || '',
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
        precoImplantacao: form.precoImplantacao ? parseFloat(form.precoImplantacao) : 0,
        horasDev: form.horasDev ? parseFloat(form.horasDev) : 0,
        horasSuporte: form.horasSuporte ? parseFloat(form.horasSuporte) : 0,
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">{isEdit ? 'Editar OS' : 'Nova Ordem de Serviço'}</h1>
        <p className="text-gray-500 dark:text-slate-400">Preencha os dados da OS</p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4 dark:bg-slate-800 dark:border-slate-700">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Cliente *</label>
            <select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} className="input" required>
              <option value="">Selecione um cliente</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.razaoSocial}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Tipo de Serviço *</label>
            <select value={form.tipoServico} onChange={(e) => setForm({ ...form, tipoServico: e.target.value })} className="input">
              <option value="implantacao">Implantação</option>
              <option value="suporte">Suporte</option>
              <option value="treinamento">Treinamento</option>
              <option value="desenvolvimento">Desenvolvimento</option>
              <option value="manutencao">Manutenção</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Técnico Responsável *</label>
            <select value={form.tecnicoResponsavelId} onChange={(e) => setForm({ ...form, tecnicoResponsavelId: e.target.value })} className="input" required>
              <option value="">Selecione</option>
              {technicians.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Descrição do Serviço</label>
            <textarea value={form.descricaoServico} onChange={(e) => setForm({ ...form, descricaoServico: e.target.value })} className="input" rows={4} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Sistemas Envolvidos</label>
            <input type="text" value={form.sistemasEnvolvidos} onChange={(e) => setForm({ ...form, sistemasEnvolvidos: e.target.value })} className="input" placeholder="LIS, GLPI, Módulo Fiscal" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Equipamentos</label>
            <input type="text" value={form.equipamentos} onChange={(e) => setForm({ ...form, equipamentos: e.target.value })} className="input" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Valor do Serviço (R$)</label>
            <input type="number" step="0.01" value={form.valorServico} onChange={(e) => setForm({ ...form, valorServico: e.target.value })} className="input" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Previsão de Entrega</label>
            <input type="date" value={form.dataPrevistaEntrega} onChange={(e) => setForm({ ...form, dataPrevistaEntrega: e.target.value })} className="input" />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Observações</label>
            <textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} className="input" rows={2} />
          </div>
        </div>

        {form.tipoServico === 'implantacao' && (
          <div className="border-t border-gray-200 dark:border-slate-700 pt-4 mt-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Dados de Implantação</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Tipo de Implantação</label>
                <select value={form.tipoImplantacao} onChange={(e) => setForm({ ...form, tipoImplantacao: e.target.value })} className="input">
                  <option value="">Selecione</option>
                  <option value="padrao">Padrão</option>
                  <option value="customizada">Customizada</option>
                  <option value="rapida">Rápida</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Preço da Implantação (R$)</label>
                <input type="number" step="0.01" value={form.precoImplantacao} onChange={(e) => setForm({ ...form, precoImplantacao: e.target.value })} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Horas de Desenvolvimento</label>
                <input type="number" step="0.5" value={form.horasDev} onChange={(e) => setForm({ ...form, horasDev: e.target.value })} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Horas de Suporte</label>
                <input type="number" step="0.5" value={form.horasSuporte} onChange={(e) => setForm({ ...form, horasSuporte: e.target.value })} className="input" />
              </div>
            </div>
          </div>
        )}

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
