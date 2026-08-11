import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Send, List, BarChart3, X, Check, GripVertical } from 'lucide-react';
import { api } from '../../services/api';
import { useThemeSettings } from '../../services/ThemeContext';

interface Opcao {
  id: number;
  titulo: string;
  descricao?: string;
}

interface Enquete {
  id: string;
  nome: string;
  descricao?: string;
  tipo: string;
  mensagem?: string;
  opcoes: string;
  enviarComo: string;
  ativo: boolean;
  usoCount: number;
  createdAt: string;
}

const INITIAL_FORM = {
  nome: '',
  descricao: '',
  tipo: 'lista',
  mensagem: '',
  opcoes: [{ id: 1, titulo: '', descricao: '' }] as Opcao[],
  enviarComo: 'texto',
};

export default function EnquetesPage() {
  const { theme } = useThemeSettings();
  const [enquetes, setEnquetes] = useState<Enquete[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadEnquetes(); }, []);

  const loadEnquetes = async () => {
    try {
      const { data } = await api.get('/enquetes');
      setEnquetes(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao carregar enquetes');
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => {
    setEditingId(null);
    setForm(INITIAL_FORM);
    setError('');
    setShowModal(true);
  };

  const openEdit = (e: Enquete) => {
    setEditingId(e.id);
    setForm({
      nome: e.nome,
      descricao: e.descricao || '',
      tipo: e.tipo,
      mensagem: e.mensagem || '',
      opcoes: JSON.parse(e.opcoes as string),
      enviarComo: e.enviarComo,
    });
    setError('');
    setShowModal(true);
  };

  const save = async () => {
    setError('');
    if (!form.nome.trim()) {
      setError('Nome é obrigatório');
      return;
    }
    if (form.opcoes.length < 2) {
      setError('Adicione pelo menos 2 opções');
      return;
    }
    if (form.opcoes.some(o => !o.titulo.trim())) {
      setError('Todas as opções devem ter título');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        opcoes: form.opcoes.map((o, i) => ({ ...o, id: i + 1 })),
      };
      if (editingId) {
        await api.put(`/enquetes/${editingId}`, payload);
      } else {
        await api.post('/enquetes', payload);
      }
      setShowModal(false);
      loadEnquetes();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const deleteEnquete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta enquete?')) return;
    try {
      await api.delete(`/enquetes/${id}`);
      loadEnquetes();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao excluir');
    }
  };

  const addOpcao = () => {
    setForm({
      ...form,
      opcoes: [...form.opcoes, { id: form.opcoes.length + 1, titulo: '', descricao: '' }],
    });
  };

  const removeOpcao = (index: number) => {
    if (form.opcoes.length <= 2) return;
    setForm({
      ...form,
      opcoes: form.opcoes.filter((_, i) => i !== index),
    });
  };

  const updateOpcao = (index: number, field: keyof Opcao, value: string) => {
    const newOpcoes = [...form.opcoes];
    newOpcoes[index] = { ...newOpcoes[index], [field]: value };
    setForm({ ...form, opcoes: newOpcoes });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-codemed-700 dark:text-codemed-400">Enquetes e Listas</h1>
          <p className="text-neutral-500 dark:text-slate-400">Crie enquetes e listas interativas para enviar aos clientes</p>
        </div>
        <button onClick={openNew} className="btn-primary text-sm flex items-center gap-2">
          <Plus size={16} /> Nova Enquete
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-neutral-400">Carregando...</div>
      ) : enquetes.length === 0 ? (
        <div className="text-center py-12 text-neutral-400 dark:text-slate-500">
          <BarChart3 size={48} className="mx-auto mb-4 opacity-50" />
          <p>Nenhuma enquete criada</p>
          <p className="text-sm mt-2">Clique em "Nova Enquete" para começar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {enquetes.map((e) => (
            <div key={e.id} className="bg-white dark:bg-slate-800 rounded-xl border border-neutral-200 dark:border-slate-700 p-4 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {e.tipo === 'lista' ? <List size={18} className="text-codemed-500" /> : <BarChart3 size={18} className="text-codemed-500" />}
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100">{e.nome}</h3>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${e.ativo ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-neutral-100 text-neutral-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                  {e.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              
              {e.descricao && (
                <p className="text-sm text-neutral-500 dark:text-slate-400 mb-3">{e.descricao}</p>
              )}
              
              <div className="space-y-1 mb-3">
                {JSON.parse(e.opcoes).slice(0, 3).map((o: Opcao) => (
                  <div key={o.id} className="text-xs text-neutral-600 dark:text-slate-300 flex items-center gap-2">
                    <span className="font-medium text-codemed-600 dark:text-codemed-400">{o.id}.</span>
                    {o.titulo}
                  </div>
                ))}
                {JSON.parse(e.opcoes).length > 3 && (
                  <p className="text-xs text-neutral-400 dark:text-slate-500">+{JSON.parse(e.opcoes).length - 3} mais opções</p>
                )}
              </div>
              
              <div className="flex items-center justify-between text-xs text-neutral-400 dark:text-slate-500 mb-3">
                <span>{e.enviarComo === 'lista' ? '📋 Lista interativa' : '💬 Texto'}</span>
                <span>Usado {e.usoCount}x</span>
              </div>
              
              <div className="flex gap-2">
                <button onClick={() => openEdit(e)} className="flex-1 btn-secondary text-xs py-1.5">
                  <Edit2 size={12} /> Editar
                </button>
                <button onClick={() => deleteEnquete(e.id)} className="btn-danger text-xs py-1.5 px-2">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b border-neutral-200 dark:border-slate-700">
              <h3 className="font-semibold text-lg text-codemed-700 dark:text-codemed-400">
                {editingId ? 'Editar Enquete' : 'Nova Enquete'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-slate-300">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-neutral-500 dark:text-slate-400 mb-1 block">Nome *</label>
                <input type="text" placeholder="Ex: Avaliação de Atendimento" value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })} className="input" />
              </div>
              
              <div>
                <label className="text-xs font-medium text-neutral-500 dark:text-slate-400 mb-1 block">Descrição (opcional)</label>
                <input type="text" placeholder="Descrição curta da enquete" value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })} className="input" />
              </div>
              
              <div>
                <label className="text-xs font-medium text-neutral-500 dark:text-slate-400 mb-1 block">Mensagem de apresentação</label>
                <textarea placeholder="Mensagem que será enviada antes da enquete" value={form.mensagem}
                  onChange={(e) => setForm({ ...form, mensagem: e.target.value })} className="input" rows={2} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-neutral-500 dark:text-slate-400 mb-1 block">Tipo</label>
                  <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className="input">
                    <option value="lista">Lista</option>
                    <option value="enquete">Enquete</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-500 dark:text-slate-400 mb-1 block">Enviar como</label>
                  <select value={form.enviarComo} onChange={(e) => setForm({ ...form, enviarComo: e.target.value })} className="input">
                    <option value="texto">Texto numerado</option>
                    <option value="lista">Lista interativa</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="text-xs font-medium text-neutral-500 dark:text-slate-400 mb-2 block">Opções *</label>
                <div className="space-y-2">
                  {form.opcoes.map((o, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <span className="mt-2 text-sm font-bold text-codemed-600 dark:text-codemed-400 w-6">{i + 1}</span>
                      <input type="text" placeholder="Título da opção" value={o.titulo}
                        onChange={(e) => updateOpcao(i, 'titulo', e.target.value)} className="input flex-1" />
                      <input type="text" placeholder="Descrição (opcional)" value={o.descricao || ''}
                        onChange={(e) => updateOpcao(i, 'descricao', e.target.value)} className="input flex-1" />
                      <button onClick={() => removeOpcao(i)} disabled={form.opcoes.length <= 2}
                        className="mt-1 p-1 text-neutral-400 hover:text-red-500 disabled:opacity-30">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <button onClick={addOpcao} className="mt-2 text-sm text-codemed-600 dark:text-codemed-400 hover:underline flex items-center gap-1">
                  <Plus size={14} /> Adicionar opção
                </button>
              </div>
              
              <div className="bg-neutral-50 dark:bg-slate-900 rounded-lg p-3">
                <p className="text-xs font-medium text-neutral-500 dark:text-slate-400 mb-2">Preview:</p>
                <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-neutral-200 dark:border-slate-700">
                  {form.mensagem && <p className="text-sm mb-2">{form.mensagem}</p>}
                  <div className="space-y-1">
                    {form.opcoes.filter(o => o.titulo).map((o, i) => (
                      <p key={i} className="text-sm">
                        <span className="font-bold text-codemed-600 dark:text-codemed-400">*{i + 1}*</span> - {o.titulo}
                      </p>
                    ))}
                  </div>
                  {form.opcoes.some(o => o.titulo) && (
                    <p className="text-xs text-neutral-400 dark:text-slate-500 mt-2">Responda com o *número* da opção.</p>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 p-4 border-t border-neutral-200 dark:border-slate-700">
              <button onClick={() => setShowModal(false)} className="flex-1 btn-secondary">Cancelar</button>
              <button onClick={save} disabled={saving} className="flex-1 btn-primary">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
