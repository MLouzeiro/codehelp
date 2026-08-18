import { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { Plus, X, User, Shield, Mail, Phone, ChevronDown, Check, AlertCircle, Building2, Archive, ArchiveRestore } from 'lucide-react';
import type { Departamento } from '../../types';

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
      'Visualizar Clientes e OS',
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
      'Gerenciar Clientes',
      'Abrir oportunidades',
      'WhatsApp',
      'Visualizar dashboard',
    ],
  },
};

const INITIAL_FORM = { name: '', email: '', password: '', phone: '', signature: '', role: 'tecnico' };

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [roleInfo, setRoleInfo] = useState<string | null>(null);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const initialLoadedRef = useRef(false);

  useEffect(() => { loadUsers(); loadDepartamentos(); }, []);

  const loadDepartamentos = async () => {
    try {
      const { data } = await api.get('/helpdesk/departamentos?includeInativos=true');
      setDepartamentos(Array.isArray(data) ? data : []);
    } catch {}
  };

  const loadUsers = async (archivedOverride?: boolean) => {
    setError('');
    try {
      const archived = archivedOverride ?? showArchived;
      const { data } = await api.get(`/auth/users?active=${archived ? 'false' : 'true'}`);
      setUsers(Array.isArray(data) ? data : []);
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.error;
      if (status === 401) setError('Sessão expirada. Faça login novamente.');
      else if (status === 403) setError(msg || 'Você não tem permissão para listar usuários.');
      else if (status === 500) setError('Erro interno do servidor ao listar usuários.');
      else setError(msg || 'Erro ao carregar lista de usuários.');
    } finally {
      setLoading(false);
      initialLoadedRef.current = true;
    }
  };

  const openNew = () => {
    setEditingId(null);
    setForm(INITIAL_FORM);
    setSelectedDepts([]);
    setError('');
    setShowModal(true);
  };

  const openEdit = (u: any) => {
    setEditingId(u.id);
    setForm({ name: u.name, email: u.email, password: '', phone: u.phone || '', signature: u.signature || '', role: u.role });
    setSelectedDepts(u.departamentos?.map((d: Departamento) => d.id) || []);
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
        const payload: any = { name: form.name, email: form.email, role: form.role, phone: form.phone, signature: form.signature, departamentoIds: selectedDepts };
        if (form.password) payload.password = form.password;
        await api.put(`/auth/users/${editingId}`, payload);
      } else {
        await api.post('/auth/users', { ...form, departamentoIds: selectedDepts });
      }
      setShowModal(false);
      loadUsers();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao salvar');
    } finally { setSaving(false); }
  };

  const archiveUser = async (id: string, name: string) => {
    if (!window.confirm(`Arquivar "${name}"?\n\nO usuário será ocultado da lista de funcionários e não poderá mais entrar no sistema.`)) return;
    try {
      await api.delete(`/auth/users/${id}`);
      loadUsers();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao arquivar usuário');
    }
  };

  const restoreUser = async (id: string) => {
    try {
      await api.put(`/auth/users/${id}`, { active: true });
      loadUsers();
    } catch { }
  };

  const toggleArchivedView = () => {
    const next = !showArchived;
    setShowArchived(next);
    loadUsers(next);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-codemed-700">Funcionários</h1>
          <p className="text-neutral-500 dark:text-slate-400">
            {showArchived ? `${users.length} usuário(s) arquivado(s)` : `${users.length} usuários ativos`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleArchivedView}
            className={`text-xs font-medium px-3 py-2 rounded-lg border transition-colors flex items-center gap-1.5 ${showArchived
              ? 'bg-green-50 dark:bg-green-900/30 text-green-700 border-green-200 dark:border-green-800 hover:bg-green-100'
              : 'bg-white dark:bg-slate-800 text-neutral-600 dark:text-slate-300 border-neutral-200 dark:border-slate-700 hover:bg-neutral-50 dark:hover:bg-slate-700'}`}
          >
            {showArchived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
            {showArchived ? 'Ver ativos' : 'Ver arquivados'}
          </button>
          <button onClick={openNew} className="btn-primary text-sm flex items-center gap-2">
            <Plus size={16} /> Novo Funcionário
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/30 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <div className="grid gap-3">
        {loading && !initialLoadedRef.current ? (
          <div className="text-center py-12 text-neutral-400 dark:text-slate-500">Carregando...</div>
        ) : !error && users.length === 0 ? (
          <div className="text-center py-12 text-neutral-400 dark:text-slate-500">
            {showArchived ? 'Nenhum usuário arquivado' : 'Nenhum funcionário ativo cadastrado'}
          </div>
        ) : !loading && !error && users.length > 0 ? (
          users.map((u) => {
            const roleCfg = ROLE_CONFIG[u.role] || ROLE_CONFIG.tecnico;
            return (
              <div key={u.id} className="bg-white dark:bg-slate-800 rounded-xl border border-neutral-100 dark:border-slate-700/50 shadow-sm p-5 hover:shadow-md transition-shadow">
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
                        {!u.active && <span className="badge bg-red-100 text-red-700">Arquivado</span>}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-slate-400">
                        <span className="flex items-center gap-1"><Mail size={12} /> {u.email}</span>
                        {u.phone && <span className="flex items-center gap-1"><Phone size={12} /> {u.phone}</span>}
                      </div>
                      {u.departamentos && u.departamentos.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          {u.departamentos.map((d: Departamento) => (
                            <span key={d.id} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: d.cor }} />
                              {d.nome}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setRoleInfo(roleInfo === u.id ? null : u.id)} className="text-xs text-neutral-400 dark:text-slate-500 hover:text-green-500 p-1.5 rounded-lg hover:bg-green-50 transition-colors" title="Ver permissões">
                      <Shield size={16} />
                    </button>
                    <button onClick={() => openEdit(u)} className="text-xs text-neutral-400 dark:text-slate-500 hover:text-green-500 p-1.5 rounded-lg hover:bg-green-50 transition-colors">
                      Editar
                    </button>
                    {showArchived ? (
                      <button onClick={() => restoreUser(u.id)}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg text-green-600 hover:bg-green-50 transition-colors flex items-center gap-1">
                        <ArchiveRestore size={14} /> Restaurar
                      </button>
                    ) : (
                      <button onClick={() => archiveUser(u.id, u.name)}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1">
                        <Archive size={14} /> Arquivar
                      </button>
                    )}
                  </div>
                </div>

                {roleInfo === u.id && (
                  <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-slate-700/50">
                    <p className="text-xs font-semibold text-codemed-700 mb-2 uppercase tracking-wider">
                      Permissões de {roleCfg.label}
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {roleCfg.permissions.map((perm, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-neutral-600 dark:text-slate-300">
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
        ) : null}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-xl w-full max-w-md mx-4 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-lg text-codemed-700">
                {editingId ? 'Editar Funcionário' : 'Novo Funcionário'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-neutral-400 dark:text-slate-500 hover:text-neutral-600 p-1">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-neutral-500 dark:text-slate-400 mb-1 block">Nome completo</label>
                <input type="text" placeholder="Ex: João Silva" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500 dark:text-slate-400 mb-1 block">Email</label>
                <input type="email" placeholder="Ex: joao@exemplo.com" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500 dark:text-slate-400 mb-1 block">Telefone (opcional)</label>
                <input type="text" placeholder="Ex: 5511999999999" value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500 dark:text-slate-400 mb-1 block">Assinatura (opcional)</label>
                <textarea placeholder="Ex: Suporte Técnico" value={form.signature}
                  onChange={(e) => setForm({ ...form, signature: e.target.value })} className="input" rows={2} />
                <p className="text-[10px] text-neutral-400 dark:text-slate-500 mt-1">Aparece no final das mensagens enviadas ao cliente</p>
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500 dark:text-slate-400 mb-1 block">
                  {editingId ? 'Nova senha (deixe em branco para manter)' : 'Senha'}
                </label>
                <input type="password" placeholder={editingId ? 'Nova senha' : 'Mínimo 6 caracteres'} value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })} className="input" />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500 dark:text-slate-400 mb-1 block">Perfil de acesso</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="input appearance-none bg-white dark:bg-slate-800">
                  {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.label}</option>
                  ))}
                </select>
                <div className="mt-2 bg-neutral-50 dark:bg-slate-900 rounded-lg p-3">
                  <p className="text-xs font-medium text-codemed-700 mb-1.5">
                    {ROLE_CONFIG[form.role]?.label} pode:
                  </p>
                  <div className="space-y-1">
                    {ROLE_CONFIG[form.role]?.permissions.map((perm, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-slate-300">
                        <Check size={10} className="text-green-400 flex-shrink-0" />
                        {perm}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500 dark:text-slate-400 mb-1 block">
                  <Building2 size={12} className="inline mr-1" />
                  Departamentos (pode pertencer a mais de um)
                </label>
                <div className="border border-gray-200 dark:border-slate-700 rounded-lg p-2 max-h-32 overflow-y-auto space-y-1">
                  {departamentos.filter(d => d.ativo).map((d) => (
                    <label key={d.id} className="flex items-center gap-2 text-xs text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 rounded px-2 py-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedDepts.includes(d.id)}
                        onChange={(e) => {
                          setSelectedDepts(prev =>
                            e.target.checked
                              ? [...prev, d.id]
                              : prev.filter(id => id !== d.id)
                          );
                        }}
                        className="rounded border-gray-300 text-blue-600 dark:text-blue-400 focus:ring-blue-500"
                      />
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.cor }} />
                      {d.nome}
                    </label>
                  ))}
                  {departamentos.filter(d => d.ativo).length === 0 && (
                    <p className="text-xs text-neutral-400 dark:text-slate-500 py-2 text-center">Nenhum departamento cadastrado</p>
                  )}
                </div>
                {selectedDepts.length > 0 && (
                  <p className="text-[10px] text-neutral-400 dark:text-slate-500 mt-1">{selectedDepts.length} selecionado(s)</p>
                )}
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/30 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs">
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
