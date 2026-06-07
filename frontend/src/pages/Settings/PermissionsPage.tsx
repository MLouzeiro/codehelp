import { useState, useEffect, useCallback } from 'react';
import {
  Shield, Save, RotateCcw, AlertTriangle, Check, X, RefreshCw, Lock,
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../services/auth';
import { invalidatePermissionCache } from '../../services/useCan';

interface CatalogItem {
  key: string;
  label: string;
  actions: string[];
}

const ACTION_LABELS: Record<string, string> = {
  read: 'Ler',
  create: 'Criar',
  update: 'Editar',
  delete: 'Excluir',
  manage: 'Gerenciar',
  sign: 'Assinar',
  move: 'Mover',
  assign: 'Atribuir',
  resolve: 'Resolver',
  publish: 'Publicar',
  export: 'Exportar',
};

const ROLES = ['admin', 'gerente', 'tecnico', 'comercial', 'vendedor'] as const;
const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  gerente: 'Gerente',
  tecnico: 'Tecnico',
  comercial: 'Comercial',
  vendedor: 'Vendedor',
};

type Matriz = Record<string, Record<string, Record<string, boolean>>>;

export default function PermissionsPage() {
  const { user } = useAuth();
  const isMaster = user?.isMaster || user?.role === 'admin';
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [overrides, setOverrides] = useState<Record<string, Array<{ resource: string; action: string; granted: boolean }>>>({});
  const [defaults, setDefaults] = useState<Matriz>({});
  const [edits, setEdits] = useState<Record<string, Record<string, boolean>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [activeRole, setActiveRole] = useState<string>('gerente');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [catRes, matRes] = await Promise.all([
        api.get('/permissions/catalog'),
        api.get('/permissions/matriz'),
      ]);
      setCatalog(catRes.data);
      setDefaults(matRes.data.matriz);
      const ov: Record<string, Array<{ resource: string; action: string; granted: boolean }>> = {};
      for (const r of ROLES) {
        const rRes = await api.get(`/permissions/${r}`);
        ov[r] = rRes.data.overrides;
      }
      setOverrides(ov);
      setEdits({});
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(t);
  }, [feedback]);

  const effectiveFor = (role: string, resource: string, action: string): boolean => {
    if (edits[role] && edits[role][`${resource}:${action}`] !== undefined) {
      return edits[role][`${resource}:${action}`];
    }
    return defaults[role]?.[resource]?.[action] === true;
  };

  const isOverridden = (role: string, resource: string, action: string): boolean => {
    if (edits[role] && edits[role][`${resource}:${action}`] !== undefined) return true;
    return overrides[role]?.some((o) => o.resource === resource && o.action === action) || false;
  };

  const toggle = (role: string, resource: string, action: string) => {
    const key = `${resource}:${action}`;
    const current = effectiveFor(role, resource, action);
    const roleEdits = { ...(edits[role] || {}) };
    roleEdits[key] = !current;
    setEdits({ ...edits, [role]: roleEdits });
  };

  const hasEdits = (role: string) => Object.keys(edits[role] || {}).length > 0;

  const saveRole = async (role: string) => {
    setSaving(true);
    try {
      const roleEdits = edits[role] || {};
      const permissions = catalog.flatMap((r) => r.actions.map((a) => ({
        resource: r.key,
        action: a,
        granted: effectiveFor(role, r.key, a),
      })));
      await api.put(`/permissions/${role}`, { permissions });
      invalidatePermissionCache();
      setFeedback({ type: 'ok', msg: `Permissoes de "${ROLE_LABELS[role]}" salvas` });
      await load();
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err?.response?.data?.error || 'Erro ao salvar' });
    } finally {
      setSaving(false);
    }
  };

  const resetRole = async (role: string) => {
    if (!window.confirm(`Restaurar permissoes padrao de "${ROLE_LABELS[role]}"? Todos os overrides serao removidos.`)) return;
    setSaving(true);
    try {
      await api.post(`/permissions/${role}/reset`);
      invalidatePermissionCache();
      setFeedback({ type: 'ok', msg: `Permissoes de "${ROLE_LABELS[role]}" restauradas ao padrao` });
      await load();
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err?.response?.data?.error || 'Erro ao resetar' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><RefreshCw className="animate-spin text-emerald-600" size={32} /></div>;
  }

  if (!isMaster) {
    return (
      <div className="card max-w-md mx-auto text-center space-y-3 mt-12">
        <Lock size={32} className="text-red-500 mx-auto" />
        <h2 className="font-bold text-navy-900">Acesso restrito</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Apenas administradores master podem editar a matriz de permissoes.</p>
      </div>
    );
  }

  const roleEditsCount = Object.keys(edits[activeRole] || {}).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="text-emerald-600" size={24} /> Matriz de Permissoes
          </h1>
          <p className="text-gray-500 text-sm">
            Defina o que cada role pode fazer. Alteracoes sao aplicadas imediatamente apos salvar.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
          <Check size={12} className="text-emerald-500" /> permitido &nbsp;
          <X size={12} className="text-red-500" /> negado &nbsp;
          <span className="inline-block w-3 h-3 rounded-full bg-amber-400" /> override custom
        </div>
      </div>

      {feedback && (
        <div className={`text-sm px-3 py-2 rounded-lg ${feedback.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {feedback.msg}
        </div>
      )}

      <div className="flex items-center gap-1 border-b border-neutral-200 dark:border-neutral-700">
        {ROLES.map((r) => {
          const editCount = Object.keys(edits[r] || {}).length;
          return (
            <button key={r} onClick={() => setActiveRole(r)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${activeRole === r ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:text-neutral-50'}`}>
              {ROLE_LABELS[r]}
              {editCount > 0 && (
                <span className="text-[10px] font-bold text-white bg-amber-500 rounded-full px-1.5">{editCount}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between bg-neutral-50 dark:bg-neutral-900/50">
          <div>
            <h3 className="font-semibold text-navy-900">Permissoes de {ROLE_LABELS[activeRole]}</h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {overrides[activeRole]?.length || 0} override(s) customizado(s) no banco
              {roleEditsCount > 0 && ` • ${roleEditsCount} alteracao(oes) nao salva(s)`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => resetRole(activeRole)} disabled={saving} className="btn-secondary text-xs flex items-center gap-1.5">
              <RotateCcw size={12} /> Restaurar padrao
            </button>
            <button onClick={() => saveRole(activeRole)} disabled={saving || roleEditsCount === 0}
              className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50">
              <Save size={12} /> {saving ? 'Salvando...' : `Salvar ${roleEditsCount || ''}`}
            </button>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700">
              <th className="text-left px-4 py-2 font-semibold text-neutral-600 dark:text-neutral-300">Recurso</th>
              {Array.from(new Set(catalog.flatMap((c) => c.actions))).map((a) => (
                <th key={a} className="px-3 py-2 font-semibold text-neutral-600 dark:text-neutral-300 text-center text-xs uppercase tracking-wider">
                  {ACTION_LABELS[a] || a}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {catalog.map((r) => (
              <tr key={r.key} className="border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:bg-neutral-900/50">
                <td className="px-4 py-2 font-medium text-navy-900">{r.label}</td>
                {r.actions.map((a) => {
                  const granted = effectiveFor(activeRole, r.key, a);
                  const overridden = isOverridden(activeRole, r.key, a);
                  return (
                    <td key={a} className="px-3 py-2 text-center">
                      <button
                        onClick={() => toggle(activeRole, r.key, a)}
                        className={`w-7 h-7 rounded-md border-2 flex items-center justify-center transition-all ${
                          granted
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                            : 'border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-neutral-400'
                        } ${overridden ? 'ring-2 ring-amber-300' : ''}`}
                        title={overridden ? 'Override customizado' : 'Valor padrao'}
                      >
                        {granted ? <Check size={12} /> : <X size={12} />}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {Object.values(edits).some((e) => Object.keys(e).length > 0) && (
        <div className="card bg-amber-50 border-amber-200 flex items-start gap-2 p-3">
          <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            Voce tem alteracoes nao salvas. Clique em "Salvar" na aba da role correspondente para aplicar.
          </p>
        </div>
      )}
    </div>
  );
}
