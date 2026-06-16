import { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../services/auth';
import { Plus, Edit, Trash2, Tag, Users, Building, FileText, Save, X, Check, AlertCircle, Search } from 'lucide-react';

interface Tema {
  id: string;
  slug: string;
  nome: string;
  descricao: string;
  cor: string;
  icone: string;
  ordem: number;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function CRMThemes() {
  const { user } = useAuth();
  const [temas, setTemas] = useState<Tema[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingTema, setEditingTema] = useState<Tema | null>(null);
  const [formData, setFormData] = useState({
    slug: '',
    nome: '',
    descricao: '',
    cor: '#3b82f6',
    icone: 'tag',
    ordem: 0,
    ativo: true,
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const iconeOptions = [
    { value: 'tag', label: 'Tag' },
    { value: 'users', label: 'Usuários' },
    { value: 'building', label: 'Edifício' },
    { value: 'file-text', label: 'Documento' },
    { value: 'star', label: 'Estrela' },
    { value: 'heart', label: 'Coração' },
    { value: 'briefcase', label: 'Maleta' },
    { value: 'phone', label: 'Telefone' },
    { value: 'mail', label: 'E-mail' },
    { value: 'calendar', label: 'Calendário' },
  ];

  const corOptions = [
    { value: '#3b82f6', label: 'Azul' },
    { value: '#10b981', label: 'Verde' },
    { value: '#f59e0b', label: 'Amarelo' },
    { value: '#ef4444', label: 'Vermelho' },
    { value: '#8b5cf6', label: 'Violeta' },
    { value: '#ec4899', label: 'Rosa' },
    { value: '#6366f1', label: 'Índigo' },
    { value: '#14b8a6', label: 'Turquesa' },
    { value: '#f97316', label: 'Laranja' },
    { value: '#64748b', label: 'Cinza' },
  ];

  useEffect(() => {
    carregarTemas();
  }, []);

  const carregarTemas = async () => {
    try {
      setLoading(true);
      const response = await api.get('/crm/temas');
      setTemas(response.data);
    } catch (error) {
      console.error('Erro ao carregar temas:', error);
    } finally {
      setLoading(false);
    }
  };

  const criarTema = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.slug || !formData.nome) {
      setError('Slug e nome são obrigatórios');
      return;
    }

    try {
      const response = await api.post('/crm/temas', formData);
      setTemas([response.data, ...temas]);
      setSuccess('Tema criado com sucesso');
      fecharFormulario();
    } catch (error: any) {
      setError(error.response?.data?.error || 'Erro ao criar tema');
    }
  };

  const atualizarTema = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!editingTema) return;

    try {
      const response = await api.put(`/crm/temas/${editingTema.id}`, formData);
      setTemas(temas.map(t => t.id === editingTema.id ? response.data : t));
      setSuccess('Tema atualizado com sucesso');
      fecharFormulario();
    } catch (error: any) {
      setError(error.response?.data?.error || 'Erro ao atualizar tema');
    }
  };

  const excluirTema = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este tema?')) return;

    try {
      await api.delete(`/crm/temas/${id}`);
      setTemas(temas.filter(t => t.id !== id));
      setSuccess('Tema excluído com sucesso');
    } catch (error: any) {
      setError(error.response?.data?.error || 'Erro ao excluir tema');
    }
  };

  const abrirFormulario = (tema?: Tema) => {
    if (tema) {
      setEditingTema(tema);
      setFormData({
        slug: tema.slug,
        nome: tema.nome,
        descricao: tema.descricao || '',
        cor: tema.cor,
        icone: tema.icone,
        ordem: tema.ordem,
        ativo: tema.ativo,
      });
    } else {
      setEditingTema(null);
      setFormData({
        slug: '',
        nome: '',
        descricao: '',
        cor: '#3b82f6',
        icone: 'tag',
        ordem: temas.length + 1,
        ativo: true,
      });
    }
    setShowForm(true);
    setError('');
    setSuccess('');
  };

  const fecharFormulario = () => {
    setShowForm(false);
    setEditingTema(null);
    setFormData({
      slug: '',
      nome: '',
      descricao: '',
      cor: '#3b82f6',
      icone: 'tag',
      ordem: temas.length + 1,
      ativo: true,
    });
  };

  const temasFiltrados = temas.filter(tema =>
    tema.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tema.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tema.descricao.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <span className="text-sm text-slate-500" style={{ fontFamily: 'Lexend, sans-serif' }}>Carregando temas...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>Temas</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1" style={{ fontFamily: 'Lexend, sans-serif' }}>
            Gerencie os temas para categorizar clientes e oportunidades
          </p>
        </div>
        <button
          onClick={() => abrirFormulario()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors shadow-sm min-h-[44px]"
          style={{ fontFamily: 'Lexend, sans-serif' }}
        >
          <Plus size={18} />
          Novo Tema
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400">
          <AlertCircle size={18} />
          <span className="text-sm" style={{ fontFamily: 'Lexend, sans-serif' }}>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-green-700 dark:text-green-400">
          <Check size={18} />
          <span className="text-sm" style={{ fontFamily: 'Lexend, sans-serif' }}>{success}</span>
        </div>
      )}

      {/* Search */}
      <div className="max-w-md relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar temas..."
          value={searchTerm}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{ fontFamily: 'Lexend, sans-serif' }}
        />
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-4" style={{ fontFamily: 'Khand, sans-serif' }}>
            {editingTema ? 'Editar Tema' : 'Novo Tema'}
          </h2>
          <form onSubmit={editingTema ? atualizarTema : criarTema} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2" style={{ fontFamily: 'Lexend, sans-serif' }}>
                  Nome *
                </label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ fontFamily: 'Lexend, sans-serif' }}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2" style={{ fontFamily: 'Lexend, sans-serif' }}>
                  Slug *
                </label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ fontFamily: 'Lexend, sans-serif' }}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2" style={{ fontFamily: 'Lexend, sans-serif' }}>
                Descrição
              </label>
              <textarea
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ fontFamily: 'Lexend, sans-serif' }}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2" style={{ fontFamily: 'Lexend, sans-serif' }}>
                  Cor
                </label>
                <div className="flex gap-2">
                  {corOptions.map((cor) => (
                    <button
                      key={cor.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, cor: cor.value })}
                      className={`w-8 h-8 rounded-full border-2 ${formData.cor === cor.value ? 'border-slate-800 dark:border-slate-200' : 'border-slate-300 dark:border-slate-600'}`}
                      style={{ backgroundColor: cor.value }}
                    />
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2" style={{ fontFamily: 'Lexend, sans-serif' }}>
                  Ícone
                </label>
                <select
                  value={formData.icone}
                  onChange={(e) => setFormData({ ...formData, icone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ fontFamily: 'Lexend, sans-serif' }}
                >
                  {iconeOptions.map((icone) => (
                    <option key={icone.value} value={icone.value}>{icone.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2" style={{ fontFamily: 'Lexend, sans-serif' }}>
                  Ordem
                </label>
                <input
                  type="number"
                  value={formData.ordem}
                  onChange={(e) => setFormData({ ...formData, ordem: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ fontFamily: 'Lexend, sans-serif' }}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="ativo"
                checked={formData.ativo}
                onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="ativo" className="text-sm font-medium text-slate-700 dark:text-slate-300" style={{ fontFamily: 'Lexend, sans-serif' }}>
                Ativo
              </label>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors shadow-sm min-h-[44px]"
                style={{ fontFamily: 'Lexend, sans-serif' }}
              >
                <Save size={18} />
                {editingTema ? 'Atualizar' : 'Criar'}
              </button>
              <button
                type="button"
                onClick={fecharFormulario}
                className="flex items-center gap-2 px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl transition-colors shadow-sm min-h-[44px]"
                style={{ fontFamily: 'Lexend, sans-serif' }}
              >
                <X size={18} />
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>Todos os Temas ({temasFiltrados.length})</h2>
        </div>

        {temasFiltrados.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Tag size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
            <h3 className="text-lg font-medium text-slate-500 dark:text-slate-400 mb-2" style={{ fontFamily: 'Lexend, sans-serif' }}>Nenhum tema encontrado</h3>
            <p className="text-sm text-slate-400 dark:text-slate-500" style={{ fontFamily: 'Lexend, sans-serif' }}>
              {searchTerm ? 'Tente buscar com termos diferentes.' : 'Crie seu primeiro tema para começar.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-750 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider" style={{ fontFamily: 'Lexend, sans-serif' }}>Ícone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider" style={{ fontFamily: 'Lexend, sans-serif' }}>Nome</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider" style={{ fontFamily: 'Lexend, sans-serif' }}>Slug</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider" style={{ fontFamily: 'Lexend, sans-serif' }}>Ordem</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider" style={{ fontFamily: 'Lexend, sans-serif' }}>Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider" style={{ fontFamily: 'Lexend, sans-serif' }}>Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {temasFiltrados.map((tema) => (
                  <tr key={tema.id} className="hover:bg-slate-50 dark:hover:bg-slate-750/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                        <span className="text-slate-600 dark:text-slate-400">
                          {tema.icone === 'tag' && <Tag size={16} />}
                          {tema.icone === 'users' && <Users size={16} />}
                          {tema.icone === 'building' && <Building size={16} />}
                          {tema.icone === 'file-text' && <FileText size={16} />}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full mr-3" style={{ backgroundColor: tema.cor }}></div>
                        <div className="text-sm font-medium text-slate-900 dark:text-slate-100" style={{ fontFamily: 'Lexend, sans-serif' }}>{tema.nome}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-500 dark:text-slate-400 font-mono" style={{ fontFamily: 'Lexend, sans-serif' }}>{tema.slug}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-900 dark:text-slate-100" style={{ fontFamily: 'Lexend, sans-serif' }}>{tema.ordem}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${tema.ativo
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-300'
                      }`} style={{ fontFamily: 'Lexend, sans-serif' }}>
                        {tema.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => abrirFormulario(tema)}
                          className="p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg"
                          title="Editar"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => excluirTema(tema.id)}
                          className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg"
                          title="Excluir"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
