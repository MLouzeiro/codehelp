import { useState, useEffect } from 'react';
import api from '../../services/api';
import { Plus, X, User, Shield, Mail, Phone, ChevronDown, Check, AlertCircle } from 'lucide-react';

const ROLE_CONFIG: Record<string, { label: string; color: string; permissions: string[] }> = {
  admin: {
    label: 'Admin',
    color: 'bg-purple-100 text-purple-700',
    permissions: [
      'Gerenciar usuários',
      'Acessar todas as configurações',
      'Visualizar todos os módulos',
      'Criar/editar/excluir registros',
    ],
  },
  gerente: {
    label: 'Gerente',
    color: 'bg-blue-100 text-blue-700',
    permissions: [
      'Gerenciar equipe',
      'Acessar relatórios',
      'Visualizar CRM e OS',
      'Gerenciar alertas',
    ],
  },
  tecnico: {
    label: 'Técnico',
    color: 'bg-green-100 text-green-700',
    permissions: [
      'Abrir e editar OS',
      'Usar Kanban de tarefas',
      'Visualizar WhatsApp',
      'Acessar dashboard',
    ],
  },
  comercial: {
    label: 'Comercial',
    color: 'bg-amber-100 text-amber-700',
    permissions: [
      'Gerenciar CRM (clientes)',
      'Abrir oportunidades',
      'WhatsApp',
      'Visualizar dashboard',
    ],
  },
};

const INITIAL_FORM = { name: '', email: '', password: '', phone: '', role: 'tecnico' };

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [roleInfo, setRoleInfo] = useState<string | null>(null);

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    try {
      const { data } = await api.get('/auth/users');
      setUsers(data);
    } catch { } finally { setLoading(false); }
  };

  const openNew = () => {
    setEditingId(null);
    setForm(INITIAL_FORM);
    setError('');
    setShowModal(true);
  };

  const openEdit = (u: any) => {
    setEditingId(u.id);
    setForm({ name: u.name, email: u.email, password: '', phone: u.phone || '', role: u.role });
    setError('');
    setShowModal(true);
  };

  const save = async () => {
    setError('');
    if (!form.name.trim() || !form.email.trim()) {
      setError('Nome e email são obrigatórios');
      return;
    }
    if (!editingId && !form.password) {
      setError('Senha é obrigatória para novos usuários');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const payload: any = { name: form.name, email: form.email, role: form.role, phone: form.phone };
        if (form.password) payload.password = form.password;
        await api.put(`/auth/users/${editingId}`, payload);
      } else {
        await api.post('/auth/users', form);
      }
      setShowModal(false);
      loadUsers();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao salvar');
    } finally { setSaving(false); }
  };

  const toggleActive = async (id: string, active: boolean) => {
    try {
      await api.put(`/auth/users/${id}`, { active: !active });
      loadUsers();
    } catch { }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-codemed-700">Funcionários</h1>
          <p className="text-neutral-500">{users.length} usuários cadastrados</p>
        </div>
        <button onClick={openNew} className="btn-primary text-sm flex items-center gap-2">
          <Plus size={16} /> Novo Funcionário
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <div className="grid gap-3">
        {loading ? (
          <div className="text-center py-12 text-neutral-400">Carregando...</div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 text-neutral-400">Nenhum funcionário cadastrado</div>
        ) : (
          users.map((u) => {
            const roleCfg = ROLE_CONFIG[u.role] || ROLE_CONFIG.tecnico;
            return (
              <div key={u.id} className="bg-white rounded-xl border border-neutral-100 shadow-sm p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-green-700 font-bold text-lg">
                        {u.name?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-codemed-700">{u.name}</span>
                        <span className={`badge ${roleCfg.color}`}>{roleCfg.label}</span>
                        {!u.active && <span className="badge bg-red-100 text-red-700">Inativo</span>}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-neutral-500">
                        <span className="flex items-center gap-1"><Mail size={12} /> {u.email}</span>
                        {u.phone && <span className="flex items-center gap-1"><Phone size={12} /> {u.phone}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setRoleInfo(roleInfo === u.id ? null : u.id)} className="text-xs text-neutral-400 hover:text-green-500 p-1.5 rounded-lg hover:bg-green-50 transition-colors" title="Ver permissões">
                      <Shield size={16} />
                    </button>
                    <button onClick={() => openEdit(u)} className="text-xs text-neutral-400 hover:text-green-500 p-1.5 rounded-lg hover:bg-green-50 transition-colors">
                      Editar
                    </button>
                    <button onClick={() => toggleActive(u.id, u.active)}
                      className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${u.active ? 'text-red-600 hover:bg-red-50' : 'text-green-500 hover:bg-green-50'}`}>
                      {u.active ? 'Desativar' : 'Ativar'}
                    </button>
                  </div>
                </div>

                {roleInfo === u.id && (
                  <div className="mt-4 pt-4 border-t border-neutral-100">
                    <p className="text-xs font-semibold text-codemed-700 mb-2 uppercase tracking-wider">
                      Permissões de {roleCfg.label}
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {roleCfg.permissions.map((perm, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-neutral-600">
                          <Check size={12} className="text-green-400 flex-shrink-0" />
                          {perm}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl p-6 shadow-xl w-full max-w-md mx-4 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-lg text-codemed-700">
                {editingId ? 'Editar Funcionário' : 'Novo Funcionário'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-neutral-400 hover:text-neutral-600 p-1">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-neutral-500 mb-1 block">Nome completo</label>
                <input type="text" placeholder="Ex: João Silva" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500 mb-1 block">Email</label>
                <input type="email" placeholder="Ex: joao@exemplo.com" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500 mb-1 block">Telefone (opcional)</label>
                <input type="text" placeholder="Ex: 5511999999999" value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500 mb-1 block">
                  {editingId ? 'Nova senha (deixe em branco para manter)' : 'Senha'}
                </label>
                <input type="password" placeholder={editingId ? 'Nova senha' : 'Mínimo 6 caracteres'} value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })} className="input" />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500 mb-1 block">Perfil de acesso</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="input appearance-none bg-white">
                  {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.label}</option>
                  ))}
                </select>
                <div className="mt-2 bg-neutral-50 rounded-lg p-3">
                  <p className="text-xs font-medium text-codemed-700 mb-1.5">
                    {ROLE_CONFIG[form.role]?.label} pode:
                  </p>
                  <div className="space-y-1">
                    {ROLE_CONFIG[form.role]?.permissions.map((perm, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs text-neutral-600">
                        <Check size={10} className="text-green-400 flex-shrink-0" />
                        {perm}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs">
                <AlertCircle size={14} /> {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="btn-secondary text-sm flex-1">Cancelar</button>
              <button onClick={save} disabled={saving} className="btn-primary text-sm flex-1 disabled:opacity-50">
                {saving ? 'Salvando...' : editingId ? 'Atualizar' : 'Criar Funcionário'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
