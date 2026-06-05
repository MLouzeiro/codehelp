import { useState, useEffect } from 'react';
import api from '../../services/api';
import { Plus, X, Bell, Trash2, Send } from 'lucide-react';

export default function AlertsPage() {
  const [recipients, setRecipients] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nome: '', whatsapp: '', cargo: '' });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [recRes, histRes] = await Promise.all([
        api.get('/alerts/recipients'),
        api.get('/alerts/history'),
      ]);
      setRecipients(recRes.data);
      setHistory(histRes.data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const addRecipient = async () => {
    try {
      await api.post('/alerts/recipients', form);
      setShowForm(false);
      setForm({ nome: '', whatsapp: '', cargo: '' });
      loadData();
    } catch (err) { console.error(err); }
  };

  const deleteRecipient = async (id: string) => {
    try {
      await api.delete(`/alerts/recipients/${id}`);
      loadData();
    } catch (err) { console.error(err); }
  };

  const triggerNow = async () => {
    try {
      await api.post('/alerts/trigger');
      alert('Alerta disparado com sucesso!');
      loadData();
    } catch (err) { console.error(err); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Alertas Semanais</h1><p className="text-gray-500">Configuração do relatório automático de segunda-feira</p></div>
        <div className="flex gap-2">
          <button onClick={triggerNow} className="btn-primary flex items-center gap-2"><Send size={16} /> Disparar Agora</button>
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2"><Plus size={18} /> Novo Destinatário</button>
        </div>
      </div>

      <div className="card">
        <p className="text-sm text-gray-500 mb-1">Próximo disparo automático</p>
        <p className="font-medium text-gray-900">Toda segunda-feira às 08:00 (America/Fortaleza)</p>
      </div>

      {showForm && (
        <div className="card max-w-lg space-y-3">
          <div className="flex justify-between items-center"><h3 className="font-semibold">Novo Destinatário</h3><button onClick={() => setShowForm(false)}><X size={18} /></button></div>
          <input type="text" placeholder="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="input" />
          <input type="text" placeholder="WhatsApp (5511999999999)" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} className="input" />
          <input type="text" placeholder="Cargo" value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} className="input" />
          <button onClick={addRecipient} className="btn-primary w-full">Adicionar</button>
        </div>
      )}

      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Bell size={18} /> Destinatários ({recipients.length})</h3>
        <div className="space-y-2">
          {recipients.map((r) => (
            <div key={r.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-900">{r.nome} {!r.ativo && <span className="badge bg-gray-100 text-gray-500">Inativo</span>}</p>
                <p className="text-xs text-gray-500">{r.whatsapp}{r.cargo ? ` • ${r.cargo}` : ''}</p>
              </div>
              <button onClick={() => deleteRecipient(r.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
            </div>
          ))}
          {recipients.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Nenhum destinatário cadastrado</p>}
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-4">Histórico de Disparos</h3>
        <div className="space-y-2">
          {history.slice(0, 10).map((h) => (
            <div key={h.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg text-sm">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${h.status === 'enviado' ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-gray-500">{h.tipo}</span>
                <span className="text-gray-400">{h.destinatarios}</span>
              </div>
              <span className="text-gray-400 text-xs">{new Date(h.enviadoEm).toLocaleString('pt-BR')}</span>
            </div>
          ))}
          {history.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Nenhum disparo realizado</p>}
        </div>
      </div>
    </div>
  );
}
