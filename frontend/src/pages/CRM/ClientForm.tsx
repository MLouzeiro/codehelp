import { useState, useEffect, FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import { ArrowLeft, Save, Building2 } from 'lucide-react';

export default function ClientForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    razaoSocial: '',
    nomeFantasia: '',
    cnpjCpf: '',
    segmento: 'laboratorio',
    telefone: '',
    email: '',
    cidade: '',
    estado: '',
    status: 'ativo',
    origem: 'manual',
  });

  useEffect(() => {
    if (id) {
      setLoading(true);
      api.get(`/crm/clients/${id}`)
        .then(({ data }) => {
          setForm({
            razaoSocial: data.razaoSocial || '',
            nomeFantasia: data.nomeFantasia || '',
            cnpjCpf: data.cnpjCpf || '',
            segmento: data.segmento || 'laboratorio',
            telefone: data.telefone || '',
            email: data.email || '',
            cidade: data.cidade || '',
            estado: data.estado || '',
            status: data.status || 'ativo',
            origem: data.origem || 'manual',
          });
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [id]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.razaoSocial) return;
    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/crm/clients/${id}`, form);
      } else {
        await api.post('/crm/clients', form);
      }
      navigate('/app/crm');
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const update = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/app/crm')} className="w-9 h-9 rounded-lg border border-neutral-200 flex items-center justify-center hover:bg-neutral-50 transition-colors">
          <ArrowLeft size={18} className="text-neutral-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-codemed-700">{isEdit ? 'Editar Cliente' : 'Novo Cliente'}</h1>
          <p className="text-sm text-neutral-500">{isEdit ? 'Atualize os dados do cliente' : 'Cadastre um novo cliente'}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-neutral-100 shadow-sm p-6 space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-neutral-700 mb-1">Razão Social *</label>
            <input type="text" value={form.razaoSocial} onChange={(e) => update('razaoSocial', e.target.value)}
              className="input" required placeholder="Nome da empresa" />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Nome Fantasia</label>
            <input type="text" value={form.nomeFantasia} onChange={(e) => update('nomeFantasia', e.target.value)}
              className="input" placeholder="Nome fantasia" />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">CNPJ/CPF</label>
            <input type="text" value={form.cnpjCpf} onChange={(e) => update('cnpjCpf', e.target.value)}
              className="input" placeholder="00.000.000/0001-00" />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Telefone</label>
            <input type="text" value={form.telefone} onChange={(e) => update('telefone', e.target.value)}
              className="input" placeholder="(99) 99999-9999" />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Email</label>
            <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)}
              className="input" placeholder="email@exemplo.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Segmento</label>
            <select value={form.segmento} onChange={(e) => update('segmento', e.target.value)} className="input">
              <option value="laboratorio">Laboratório</option>
              <option value="clinica">Clínica</option>
              <option value="hospital">Hospital</option>
              <option value="outro">Outro</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Cidade</label>
            <input type="text" value={form.cidade} onChange={(e) => update('cidade', e.target.value)}
              className="input" placeholder="Cidade" />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Estado</label>
            <select value={form.estado} onChange={(e) => update('estado', e.target.value)} className="input">
              <option value="">Selecione</option>
              {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map((uf) => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Status</label>
            <select value={form.status} onChange={(e) => update('status', e.target.value)} className="input">
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
              <option value="prospecto">Prospecto</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button type="submit" disabled={saving || !form.razaoSocial} className="btn-primary flex items-center gap-2">
            <Save size={16} /> {saving ? 'Salvando...' : isEdit ? 'Salvar Alterações' : 'Cadastrar Cliente'}
          </button>
          <button type="button" onClick={() => navigate('/app/crm')} className="btn-secondary">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
