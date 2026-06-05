import { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../services/auth';
import { Plus, DollarSign, Target, X } from 'lucide-react';

const stageLabels: Record<string, string> = {
  prospeccao: 'Prospecção', proposta: 'Proposta', negociacao: 'Negociação', ganho: 'Ganho', perdido: 'Perdido',
};
const stageColors: Record<string, string> = {
  prospeccao: 'bg-blue-100 border-blue-200', proposta: 'bg-amber-100 border-amber-200',
  negociacao: 'bg-purple-100 border-purple-200', ganho: 'bg-green-100 border-green-200',
  perdido: 'bg-red-100 border-red-200',
};

export default function OpportunityPipeline() {
  const { user } = useAuth();
  const [pipeline, setPipeline] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ clientId: '', titulo: '', valorEstimado: '', probabilidade: '50', dataFechamentoPrevista: '' });
  const [clients, setClients] = useState<any[]>([]);

  useEffect(() => {
    loadPipeline();
    loadClients();
  }, []);

  const loadPipeline = async () => {
    try {
      const { data } = await api.get('/crm/pipeline');
      setPipeline(data);
    } catch (err) { console.error(err); }
  };

  const loadClients = async () => {
    try {
      const { data } = await api.get('/crm/clients', { params: { limit: 100 } });
      setClients(data.clients);
    } catch (err) { console.error(err); }
  };

  const createOpportunity = async () => {
    try {
      await api.post('/crm/opportunities', form);
      setShowForm(false);
      setForm({ clientId: '', titulo: '', valorEstimado: '', probabilidade: '50', dataFechamentoPrevista: '' });
      loadPipeline();
    } catch (err) { console.error(err); }
  };

  const updateStage = async (id: string, etapa: string) => {
    try {
      await api.put(`/crm/opportunities/${id}`, { etapa });
      loadPipeline();
    } catch (err) { console.error(err); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pipeline de Oportunidades</h1>
          <p className="text-gray-500">Arraste ou clique para mover entre etapas</p>
        </div>
        {(user?.role === 'admin' || user?.role === 'gerente' || user?.role === 'comercial') && (
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2"><Plus size={18} /> Nova Oportunidade</button>
        )}
      </div>

      {showForm && (
        <div className="card max-w-lg space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Nova Oportunidade</h3>
            <button onClick={() => setShowForm(false)}><X size={18} /></button>
          </div>
          <select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} className="input">
            <option value="">Selecione um cliente</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.razaoSocial}</option>)}
          </select>
          <input type="text" placeholder="Título da oportunidade" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} className="input" />
          <input type="number" placeholder="Valor estimado" value={form.valorEstimado} onChange={(e) => setForm({ ...form, valorEstimado: e.target.value })} className="input" />
          <input type="number" placeholder="Probabilidade (%)" min="0" max="100" value={form.probabilidade} onChange={(e) => setForm({ ...form, probabilidade: e.target.value })} className="input" />
          <input type="date" value={form.dataFechamentoPrevista} onChange={(e) => setForm({ ...form, dataFechamentoPrevista: e.target.value })} className="input" />
          <button onClick={createOpportunity} className="btn-primary w-full">Criar Oportunidade</button>
        </div>
      )}

      <div className="grid grid-cols-5 gap-4 overflow-x-auto pb-4">
        {pipeline.map((stage) => (
          <div key={stage.etapa} className={`min-w-[220px] rounded-xl border p-3 ${stageColors[stage.etapa] || ''}`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">{stageLabels[stage.etapa] || stage.etapa}</h3>
              <span className="badge bg-white/80">{stage.total}</span>
            </div>
            <div className="space-y-2">
              {stage.items.map((opp: any) => (
                <div key={opp.id} className="bg-white rounded-lg p-3 shadow-sm border border-gray-100 cursor-pointer hover:shadow">
                  <p className="text-sm font-medium text-gray-900">{opp.titulo}</p>
                  <p className="text-xs text-gray-500">{opp.client?.razaoSocial}</p>
                  {opp.valorEstimado && <p className="text-sm font-semibold text-green-600 mt-1">R$ {opp.valorEstimado}</p>}
                  {opp.probabilidade && <p className="text-xs text-gray-400">{opp.probabilidade}%</p>}
                  <p className="text-xs text-gray-400 mt-1">{opp.responsavel?.name}</p>
                </div>
              ))}
              {stage.items.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Vazio</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
