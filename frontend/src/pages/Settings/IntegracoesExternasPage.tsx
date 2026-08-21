import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, Power, Play, List, RefreshCw, X, ShieldCheck, Clock } from 'lucide-react';
import api from '../../services/api';
import { useThemeSettings } from '../../services/ThemeContext';

interface ExternalIntegration {
  id: string;
  nome: string;
  slug: string;
  tipo: string;
  baseUrl: string;
  authType: string;
  hasApiKey: boolean;
  hasToken: boolean;
  headersJson: string;
  timeoutMs: number;
  ativo: boolean;
  webhookPath?: string | null;
  hasWebhookSecret: boolean;
  lastTestAt?: string | null;
  lastTestStatus?: string | null;
  lastTestError?: string | null;
  createdAt: string;
}

interface IntegrationLog {
  id: string;
  direction: string;
  endpoint?: string | null;
  method?: string | null;
  status?: number | null;
  requestBody?: string | null;
  responseBody?: string | null;
  error?: string | null;
  durationMs?: number | null;
  createdAt: string;
}

const EMPTY_FORM = {
  nome: '',
  slug: '',
  tipo: 'crm',
  baseUrl: '',
  authType: 'api_key',
  apiKey: '',
  token: '',
  headersJson: '',
  timeoutMs: 15000,
  webhookPath: '',
  webhookSecret: '',
};

const AUTH_TYPES = [
  { value: 'api_key', label: 'API Key (header X-API-Key)' },
  { value: 'bearer_token', label: 'Bearer Token' },
  { value: 'oauth2', label: 'OAuth2 / Bearer' },
];

export default function IntegracoesExternasPage() {
  const { theme } = useThemeSettings();
  const [integrations, setIntegrations] = useState<ExternalIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ExternalIntegration | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [logsFor, setLogsFor] = useState<ExternalIntegration | null>(null);
  const [logs, setLogs] = useState<IntegrationLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const loadIntegrations = useCallback(async () => {
    try {
      const { data } = await api.get('/integrations/external');
      setIntegrations(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao carregar integrações');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadIntegrations(); }, [loadIntegrations]);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError('');
    setShowModal(true);
  };

  const openEdit = (it: ExternalIntegration) => {
    setEditing(it);
    setForm({
      nome: it.nome,
      slug: it.slug,
      tipo: it.tipo,
      baseUrl: it.baseUrl,
      authType: it.authType,
      apiKey: '',
      token: '',
      headersJson: it.headersJson && it.headersJson !== '{}' ? it.headersJson : '',
      timeoutMs: it.timeoutMs,
      webhookPath: it.webhookPath || '',
      webhookSecret: '',
    });
    setError('');
    setShowModal(true);
  };

  const save = async () => {
    setError('');
    if (!form.nome.trim()) { setError('Nome é obrigatório'); return; }
    if (!form.baseUrl.trim() || !/^https?:\/\//i.test(form.baseUrl)) { setError('URL base inválida (use http(s)://)'); return; }
    setSaving(true);
    try {
      const payload: any = { ...form };
      if (!payload.slug) payload.slug = payload.nome;
      if (editing) {
        await api.put(`/integrations/external/${editing.id}`, payload);
      } else {
        await api.post('/integrations/external', payload);
      }
      setShowModal(false);
      loadIntegrations();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (it: ExternalIntegration) => {
    try {
      await api.patch(`/integrations/external/${it.id}/toggle`, { ativo: !it.ativo });
      loadIntegrations();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao alternar integração');
    }
  };

  const remove = async (it: ExternalIntegration) => {
    if (!confirm(`Remover a integração "${it.nome}"? Os logs serão apagados.`)) return;
    try {
      await api.delete(`/integrations/external/${it.id}`);
      loadIntegrations();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao excluir');
    }
  };

  const testConnection = async (it: ExternalIntegration) => {
    setTesting(it.id);
    try {
      const { data } = await api.post(`/integrations/external/${it.id}/test`);
      alert(data.ok ? `Conexão OK em ${data.durationMs}ms` : `Falha: ${data.error}`);
      loadIntegrations();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao testar conexão');
    } finally {
      setTesting(null);
    }
  };

  const openLogs = async (it: ExternalIntegration) => {
    setLogsFor(it);
    setLogs([]);
    setLogsLoading(true);
    try {
      const { data } = await api.get(`/integrations/external/${it.id}/logs?limit=50`);
      setLogs(Array.isArray(data.logs) ? data.logs : []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao carregar logs');
    } finally {
      setLogsLoading(false);
    }
  };

  const formatDate = (d?: string | null) => {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    } catch { return d; }
  };

  const lastTestClass = (s?: string | null) => {
    if (!s) return 'text-neutral-400 dark:text-slate-500';
    if (s.startsWith('ok')) return 'text-green-600 dark:text-green-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-codemed-700 dark:text-codemed-400">Integrações Externas</h1>
          <p className="text-neutral-500 dark:text-slate-400">Conecte o CodeHelp ao seu CRM/sistemas externos</p>
        </div>
        <button onClick={openNew} className="btn-primary text-sm flex items-center gap-2">
          <Plus size={16} /> Nova Integração
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="bg-neutral-50 dark:bg-slate-900 rounded-lg p-4 text-xs text-neutral-500 dark:text-slate-400">
        <p className="font-medium mb-1 flex items-center gap-2"><ShieldCheck size={14} /> Segurança</p>
        <p>Chaves e tokens são criptografados em repouso (AES-256-GCM) e exibidos apenas mascarados. O webhook recebe dados via POST com assinatura HMAC-SHA256.</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-neutral-400">Carregando...</div>
      ) : integrations.length === 0 ? (
        <div className="text-center py-12 text-neutral-400 dark:text-slate-500">
          <RefreshCw size={48} className="mx-auto mb-4 opacity-50" />
          <p>Nenhuma integração configurada</p>
          <p className="text-sm mt-2">Clique em "Nova Integração" para conectar ao seu CRM</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {integrations.map((it) => (
            <div key={it.id} className="bg-white dark:bg-slate-800 rounded-xl border border-neutral-200 dark:border-slate-700 p-4 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${it.ativo ? 'bg-green-500' : 'bg-neutral-300 dark:bg-slate-600'}`} />
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100">{it.nome}</h3>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${it.ativo ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-neutral-100 text-neutral-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                  {it.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>

              <p className="text-sm text-neutral-500 dark:text-slate-400 mb-3 break-all">{it.baseUrl}</p>

              <div className="space-y-1 text-xs text-neutral-600 dark:text-slate-300 mb-3">
                <div className="flex justify-between"><span className="text-neutral-400 dark:text-slate-500">Tipo</span><span>{it.tipo}</span></div>
                <div className="flex justify-between"><span className="text-neutral-400 dark:text-slate-500">Auth</span><span>{AUTH_TYPES.find(a => a.value === it.authType)?.label || it.authType}</span></div>
                <div className="flex justify-between"><span className="text-neutral-400 dark:text-slate-500">API Key</span><span>{it.hasApiKey ? '••••••••' : '—'}</span></div>
                <div className="flex justify-between"><span className="text-neutral-400 dark:text-slate-500">Token</span><span>{it.hasToken ? '••••••••' : '—'}</span></div>
                <div className="flex justify-between"><span className="text-neutral-400 dark:text-slate-500">Webhook</span><span>{it.webhookPath ? `/${it.webhookPath}` : '—'}</span></div>
                <div className="flex justify-between"><span className="text-neutral-400 dark:text-slate-500">Último teste</span><span className={lastTestClass(it.lastTestStatus)}>{it.lastTestAt ? `${it.lastTestStatus} · ${formatDate(it.lastTestAt)}` : '—'}</span></div>
              </div>

              <div className="flex gap-2 flex-wrap">
                <button onClick={() => testConnection(it)} disabled={testing === it.id} className="btn-secondary text-xs py-1.5 px-2">
                  <Play size={12} /> {testing === it.id ? 'Testando...' : 'Testar'}
                </button>
                <button onClick={() => openLogs(it)} className="btn-secondary text-xs py-1.5 px-2">
                  <List size={12} /> Logs
                </button>
                <button onClick={() => openEdit(it)} className="btn-secondary text-xs py-1.5 px-2">
                  <Edit2 size={12} /> Editar
                </button>
                <button onClick={() => toggle(it)} className={`btn-secondary text-xs py-1.5 px-2 ${it.ativo ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                  <Power size={12} /> {it.ativo ? 'Desativar' : 'Ativar'}
                </button>
                <button onClick={() => remove(it)} className="btn-danger text-xs py-1.5 px-2">
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
                {editing ? 'Editar Integração' : 'Nova Integração'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-slate-300">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-neutral-500 dark:text-slate-400 mb-1 block">Nome *</label>
                  <input type="text" placeholder="Ex: CRM Principal" value={form.nome}
                    onChange={(e) => {
                      const nome = e.target.value;
                      setForm({ ...form, nome, slug: form.slug || nome.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') });
                    }} className="input" />
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-500 dark:text-slate-400 mb-1 block">Slug (identificador)</label>
                  <input type="text" placeholder="crm-principal" value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} className="input" />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-500 dark:text-slate-400 mb-1 block">URL Base *</label>
                <input type="text" placeholder="https://api.suacrm.com.br" value={form.baseUrl}
                  onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} className="input" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-neutral-500 dark:text-slate-400 mb-1 block">Tipo</label>
                  <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className="input">
                    <option value="crm">CRM</option>
                    <option value="erp">ERP</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-500 dark:text-slate-400 mb-1 block">Autenticação</label>
                  <select value={form.authType} onChange={(e) => setForm({ ...form, authType: e.target.value })} className="input">
                    {AUTH_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-neutral-500 dark:text-slate-400 mb-1 block">
                    API Key {editing?.hasApiKey && '(deixe em branco para manter)'}
                  </label>
                  <input type="password" placeholder="chave da API" value={form.apiKey}
                    onChange={(e) => setForm({ ...form, apiKey: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-500 dark:text-slate-400 mb-1 block">
                    Token {editing?.hasToken && '(deixe em branco para manter)'}
                  </label>
                  <input type="password" placeholder="token de acesso" value={form.token}
                    onChange={(e) => setForm({ ...form, token: e.target.value })} className="input" />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-500 dark:text-slate-400 mb-1 block">Headers adicionais (JSON)</label>
                <input type="text" placeholder='{"X-Tenant": "123"}' value={form.headersJson}
                  onChange={(e) => setForm({ ...form, headersJson: e.target.value })} className="input" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-neutral-500 dark:text-slate-400 mb-1 block">Timeout (ms)</label>
                  <input type="number" min={1000} max={120000} value={form.timeoutMs}
                    onChange={(e) => setForm({ ...form, timeoutMs: Number(e.target.value) })} className="input" />
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-500 dark:text-slate-400 mb-1 block">Caminho do webhook</label>
                  <input type="text" placeholder="webhook-crm" value={form.webhookPath}
                    onChange={(e) => setForm({ ...form, webhookPath: e.target.value })} className="input" />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-500 dark:text-slate-400 mb-1 block">
                  Secret do webhook (HMAC) {editing?.hasWebhookSecret && '(deixe em branco para manter)'}
                </label>
                <input type="password" placeholder="secreto compartilhado p/ validar chamadas recebidas" value={form.webhookSecret}
                  onChange={(e) => setForm({ ...form, webhookSecret: e.target.value })} className="input" />
                <p className="text-xs text-neutral-400 dark:text-slate-500 mt-1">
                  URL de recebimento: <code className="bg-neutral-100 dark:bg-slate-900 px-1 rounded">POST /api/integrations/external/webhook/&#123;slug&#125;</code> — header <code className="bg-neutral-100 dark:bg-slate-900 px-1 rounded">X-Webhook-Signature</code> (HMAC-SHA256 do corpo).
                </p>
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

      {logsFor && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setLogsFor(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b border-neutral-200 dark:border-slate-700">
              <h3 className="font-semibold text-lg text-codemed-700 dark:text-codemed-400 flex items-center gap-2">
                <Clock size={18} /> Logs — {logsFor.nome}
              </h3>
              <button onClick={() => setLogsFor(null)} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-slate-300">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {logsLoading ? (
                <div className="text-center py-8 text-neutral-400">Carregando...</div>
              ) : logs.length === 0 ? (
                <div className="text-center py-8 text-neutral-400 dark:text-slate-500">Nenhum log registrado</div>
              ) : (
                logs.map((l) => (
                  <div key={l.id} className="rounded-lg border border-neutral-200 dark:border-slate-700 p-3 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`px-1.5 py-0.5 rounded-full font-medium ${l.direction === 'inbound' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'}`}>
                        {l.direction === 'inbound' ? 'Recebido' : 'Enviado'} {l.method ? `· ${l.method}` : ''}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-400 dark:text-slate-500">{formatDate(l.createdAt)}{l.durationMs != null ? ` · ${l.durationMs}ms` : ''}</span>
                        <span className={`font-bold ${(l.status ?? 0) < 400 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {l.status ?? '—'}
                        </span>
                      </div>
                    </div>
                    <p className="text-neutral-500 dark:text-slate-400 break-all mb-1">{l.endpoint}</p>
                    {l.error && <p className="text-red-600 dark:text-red-400">Erro: {l.error}</p>}
                    {l.responseBody && <pre className="bg-neutral-50 dark:bg-slate-900 rounded p-2 overflow-x-auto max-h-24 text-[10px] text-neutral-600 dark:text-slate-300">{l.responseBody}</pre>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}