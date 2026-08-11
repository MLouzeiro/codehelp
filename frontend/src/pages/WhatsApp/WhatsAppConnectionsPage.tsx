import { useState, useEffect, useCallback, useRef } from 'react';
import QRCode from 'qrcode';
import {
  Plus, Power, PowerOff, Trash2, QrCode, RefreshCw, Wifi, WifiOff,
  MessageSquare, Building2, Phone, CheckCircle2, XCircle, Loader2, AlertTriangle,
  Server, Cloud, Smartphone, ChevronDown, Settings, Edit3,
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../services/auth';
import type { WhatsAppConnection, WhatsAppConnectionStatus } from '../../types';

type QRStatus = 'idle' | 'initializing' | 'generating' | 'scanning' | 'connected' | 'error';
type WhatsAppProvider = 'baileys' | 'evolution' | 'cloud';

interface ProviderStatus {
  provider: WhatsAppProvider;
  connected: boolean;
  enabled: boolean;
  error?: string;
}

interface EvolutionInstance {
  instanceName: string;
  instanceId: string;
  status: string;
  owner?: string;
}

const QR_POLL_TIMEOUT_MS = 45_000;

const PROVIDER_LABELS: Record<WhatsAppProvider, string> = {
  'baileys': 'Baileys (WebSocket)',
  'evolution': 'Evolution API (Docker)',
  'cloud': 'WhatsApp Cloud API (Meta)',
};

const PROVIDER_ICONS: Record<WhatsAppProvider, typeof Server> = {
  'baileys': Smartphone,
  'evolution': Server,
  'cloud': Cloud,
};

export default function WhatsAppConnectionsPage() {
  const { user } = useAuth();
  const isMaster = user?.isMaster || user?.role === 'admin';

  const [connections, setConnections] = useState<WhatsAppConnection[]>([]);
  const [statuses, setStatuses] = useState<WhatsAppConnectionStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<WhatsAppConnection | null>(null);
  const [form, setForm] = useState({ nome: '', numero: '', departamentoId: '', provider: 'baileys' });
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [qrModal, setQrModal] = useState<{ conn: WhatsAppConnection; qrDataUrl: string | null } | null>(null);
  const [qrStatus, setQrStatus] = useState<QRStatus>('idle');
  const [qrError, setQrError] = useState<string | null>(null);
  const qrPollingRef = useRef<string | null>(null);
  const qrPollStartRef = useRef<number>(0);
  const qrPollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const qrTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [departamentos, setDepartamentos] = useState<Array<{ id: string; nome: string }>>([]);

  // Provider state
  const [activeProvider, setActiveProvider] = useState<WhatsAppProvider>('baileys');
  const [providerStatuses, setProviderStatuses] = useState<ProviderStatus[]>([]);
  const [providersLoading, setProvidersLoading] = useState(true);
  const [switchingProvider, setSwitchingProvider] = useState(false);

  // Evolution API state
  const [evolutionInstances, setEvolutionInstances] = useState<EvolutionInstance[]>([]);
  const [evolutionLoading, setEvolutionLoading] = useState(false);
  const [evolutionCreating, setEvolutionCreating] = useState(false);
  const [evolutionInstanceName, setEvolutionInstanceName] = useState('');

  const loadConnections = useCallback(async () => {
    try {
      const [connsRes, statusesRes] = await Promise.all([
        api.get('/whatsapp/connections?includeInativos=true'),
        api.get('/whatsapp/connections/status'),
      ]);
      setConnections(connsRes.data);
      setStatuses(statusesRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadProviders = useCallback(async () => {
    try {
      setProvidersLoading(true);
      const { data } = await api.get('/whatsapp/unified/providers');
      setActiveProvider(data.active);
      setProviderStatuses(data.providers);
    } catch (err) {
      console.error(err);
    } finally {
      setProvidersLoading(false);
    }
  }, []);

  const loadEvolutionInstances = useCallback(async () => {
    try {
      setEvolutionLoading(true);
      const { data } = await api.get('/whatsapp/evolution/status');
      setEvolutionInstances(data.instances || []);
    } catch (err) {
      console.error(err);
    } finally {
      setEvolutionLoading(false);
    }
  }, []);

  const loadDepartamentos = useCallback(async () => {
    try {
      const { data } = await api.get('/helpdesk/departamentos');
      setDepartamentos(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadConnections();
    loadProviders();
    loadDepartamentos();
  }, [loadConnections, loadProviders, loadDepartamentos]);

  useEffect(() => {
    if (activeProvider === 'evolution') {
      loadEvolutionInstances();
    }
  }, [activeProvider, loadEvolutionInstances]);

  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(t);
  }, [feedback]);

  useEffect(() => {
    return () => {
      if (qrPollTimerRef.current) clearInterval(qrPollTimerRef.current);
      if (qrTimeoutRef.current) clearTimeout(qrTimeoutRef.current);
    };
  }, []);

  const stopQrPolling = useCallback(() => {
    qrPollingRef.current = null;
    if (qrPollTimerRef.current) { clearInterval(qrPollTimerRef.current); qrPollTimerRef.current = null; }
    if (qrTimeoutRef.current) { clearTimeout(qrTimeoutRef.current); qrTimeoutRef.current = null; }
  }, []);

  useEffect(() => {
    if (!qrPollingRef.current) return;
    const connId = qrPollingRef.current;
    qrPollStartRef.current = Date.now();
    setQrStatus('initializing');
    setQrError(null);

    qrTimeoutRef.current = setTimeout(() => {
      if (qrPollingRef.current === connId) {
        stopQrPolling();
        setQrStatus('error');
        setQrError('Tempo esgotado. O QR Code nao foi gerado em 60s. Verifique a conexao e tente novamente.');
      }
    }, 60_000);

    // Wait 3s before first poll (Puppeteer needs time to initialize)
    const startDelay = setTimeout(() => {
      qrPollTimerRef.current = setInterval(async () => {
        if (qrPollingRef.current !== connId) return;
        try {
          const { data } = await api.get(`/whatsapp/connections/${connId}/status`);

          if (data.connected) {
            stopQrPolling();
            setQrModal(null);
            setQrStatus('connected');
            loadConnections();
            setFeedback({ type: 'ok', msg: `Conexao ${data.provider || 'baileys'} conectada com sucesso!` });
            return;
          }

          if (data.error) {
            stopQrPolling();
            setQrStatus('error');
            setQrError(data.error);
            return;
          }

          if (data.qrCode) {
            setQrStatus('generating');
            try {
              const dataUrl = await QRCode.toDataURL(data.qrCode, {
                width: 250,
                margin: 2,
                color: { dark: '#000000', light: '#ffffff' },
              });
              setQrModal((prev) => prev ? { ...prev, qrDataUrl: dataUrl } : null);
              setQrStatus('scanning');
            } catch {
              setQrStatus('scanning');
            }
          }
        } catch (err: any) {
          // Don't silently ignore auth errors
          if (err?.response?.status === 401 || err?.response?.status === 403) {
            stopQrPolling();
            setQrStatus('error');
            setQrError('Sessao expirada. Faca login novamente.');
          }
          if (err?.response?.status === 404) {
            stopQrPolling();
            setQrStatus('error');
            setQrError('Conexao nao encontrada.');
          }
        }
      }, 3000);
    }, 3000);

    return () => {
      clearTimeout(startDelay);
      if (qrPollTimerRef.current) clearInterval(qrPollTimerRef.current);
      if (qrTimeoutRef.current) clearTimeout(qrTimeoutRef.current);
    };
  }, [qrPollingRef.current, loadConnections, stopQrPolling]);

  const getStatus = (connId: string): WhatsAppConnectionStatus | undefined =>
    statuses.find((s) => s.id === connId);

  const handleSwitchProvider = async (provider: WhatsAppProvider) => {
    try {
      setSwitchingProvider(true);
      await api.post('/whatsapp/unified/providers/switch', { provider });
      setActiveProvider(provider);
      setFeedback({ type: 'ok', msg: `Provider alterado para ${PROVIDER_LABELS[provider]}` });
      if (provider === 'evolution') {
        loadEvolutionInstances();
      }
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err?.response?.data?.error || 'Erro ao alterar provider' });
    } finally {
      setSwitchingProvider(false);
    }
  };

  const handleCreateEvolutionInstance = async () => {
    if (!evolutionInstanceName.trim()) {
      setFeedback({ type: 'err', msg: 'Nome da instancia e obrigatorio' });
      return;
    }
    try {
      setEvolutionCreating(true);
      await api.post('/whatsapp/evolution/instance/create', { instanceName: evolutionInstanceName.trim() });
      setFeedback({ type: 'ok', msg: 'Instancia Evolution criada com sucesso' });
      setEvolutionInstanceName('');
      loadEvolutionInstances();
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err?.response?.data?.error || 'Erro ao criar instancia' });
    } finally {
      setEvolutionCreating(false);
    }
  };

  const handleConnectEvolution = async (instanceName: string) => {
    try {
      const { data } = await api.get(`/whatsapp/evolution/instance/connect/${instanceName}`);
      if (data.base64) {
        const dataUrl = `data:image/png;base64,${data.base64}`;
        setQrModal({ conn: { id: instanceName, nome: instanceName } as WhatsAppConnection, qrDataUrl: dataUrl });
      }
      setFeedback({ type: 'ok', msg: `Conectando instancia ${instanceName}...` });
      loadEvolutionInstances();
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err?.response?.data?.error || 'Erro ao conectar instancia' });
    }
  };

  const handleDisconnectEvolution = async (instanceName: string) => {
    try {
      await api.delete(`/whatsapp/evolution/instance/disconnect/${instanceName}`);
      setFeedback({ type: 'ok', msg: `Instancia ${instanceName} desconectada` });
      loadEvolutionInstances();
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err?.response?.data?.error || 'Erro ao desconectar instancia' });
    }
  };

  const handleDeleteEvolution = async (instanceName: string) => {
    if (!confirm(`Tem certeza que deseja deletar a instancia ${instanceName}?`)) return;
    try {
      await api.delete(`/whatsapp/evolution/instance/delete/${instanceName}`);
      setFeedback({ type: 'ok', msg: `Instancia ${instanceName} deletada` });
      loadEvolutionInstances();
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err?.response?.data?.error || 'Erro ao deletar instancia' });
    }
  };

  const handleCreate = async () => {
    if (!form.nome.trim() || !form.numero.trim()) {
      setFeedback({ type: 'err', msg: 'Nome e numero sao obrigatorios' });
      return;
    }
    setSaving(true);
    try {
      await api.post('/whatsapp/connections', {
        nome: form.nome.trim(),
        numero: form.numero.trim(),
        departamentoId: form.departamentoId || undefined,
        provider: form.provider,
      });
      setFeedback({ type: 'ok', msg: 'Conexao criada com sucesso' });
      setCreating(false);
      setForm({ nome: '', numero: '', departamentoId: '', provider: 'baileys' });
      loadConnections();
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err?.response?.data?.error || 'Erro ao criar conexao' });
    } finally {
      setSaving(false);
    }
  };

  const handleConnect = async (conn: WhatsAppConnection) => {
    try {
      const provider = (conn as any).provider || 'baileys';
      await api.post(`/whatsapp/connections/${conn.id}/connect`);
      setFeedback({ type: 'ok', msg: `Conexao ${provider} iniciada. Gerando QR Code...` });
      setQrModal({ conn, qrDataUrl: null });
      qrPollingRef.current = conn.id;
      setQrStatus('initializing');
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err?.response?.data?.error || 'Erro ao conectar' });
    }
  };

  const handleDisconnect = async (conn: WhatsAppConnection) => {
    try {
      await api.post(`/whatsapp/connections/${conn.id}/disconnect`);
      setFeedback({ type: 'ok', msg: 'Conexao desconectada' });
      loadConnections();
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err?.response?.data?.error || 'Erro ao desconectar' });
    }
  };

  const handleToggle = async (conn: WhatsAppConnection) => {
    try {
      await api.patch(`/whatsapp/connections/${conn.id}/toggle`);
      setFeedback({ type: 'ok', msg: `${conn.nome} ${conn.ativo ? 'desativado' : 'reativado'}` });
      loadConnections();
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err?.response?.data?.error || 'Erro' });
    }
  };

  const handleEdit = (conn: WhatsAppConnection) => {
    setEditing(conn);
    setForm({
      nome: conn.nome,
      numero: conn.numero,
      departamentoId: conn.departamentoId || '',
      provider: (conn as any).provider || 'baileys',
    });
  };

  const handleUpdate = async () => {
    if (!editing) return;
    if (!form.nome.trim() || !form.numero.trim()) {
      setFeedback({ type: 'err', msg: 'Nome e numero sao obrigatorios' });
      return;
    }
    setSaving(true);
    try {
      await api.put(`/whatsapp/connections/${editing.id}`, {
        nome: form.nome.trim(),
        numero: form.numero.trim(),
        departamentoId: form.departamentoId || undefined,
        provider: form.provider,
      });
      setFeedback({ type: 'ok', msg: 'Conexao atualizada com sucesso' });
      setEditing(null);
      setForm({ nome: '', numero: '', departamentoId: '', provider: 'baileys' });
      loadConnections();
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err?.response?.data?.error || 'Erro ao atualizar conexao' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (conn: WhatsAppConnection) => {
    if (!confirm(`Tem certeza que deseja excluir a conexao "${conn.nome}"?`)) return;
    try {
      await api.delete(`/whatsapp/connections/${conn.id}`);
      setFeedback({ type: 'ok', msg: `Conexao ${conn.nome} excluida com sucesso` });
      loadConnections();
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err?.response?.data?.error || 'Erro ao excluir conexao' });
    }
  };

  const handleRegenerateQr = async (conn: WhatsAppConnection) => {
    try {
      await api.post(`/whatsapp/connections/${conn.id}/force-reconnect`);
      setQrModal({ conn, qrDataUrl: null });
      qrPollingRef.current = conn.id;
      setQrStatus('initializing');
      setQrError(null);
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err?.response?.data?.error || 'Erro ao regenerar QR' });
    }
  };

  if (loading || providersLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-codemed-600" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-codemed-700 flex items-center gap-2">
            <MessageSquare size={22} /> Conexoes WhatsApp
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Gerencie os numeros do WhatsApp conectados ao sistema
          </p>
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`mb-4 px-4 py-2 rounded-lg text-sm font-medium ${
          feedback.type === 'ok' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {feedback.msg}
        </div>
      )}

      {/* Provider Selection */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Settings size={16} className="text-gray-500" />
          <h3 className="font-semibold text-gray-800">Provider Ativo</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(Object.keys(PROVIDER_LABELS) as WhatsAppProvider[]).map((provider) => {
            const Icon = PROVIDER_ICONS[provider];
            const status = providerStatuses.find((s) => s.provider === provider);
            const isActive = activeProvider === provider;
            const isConfigured = status?.enabled ?? false;
            const isConnected = status?.connected ?? false;

            return (
              <button
                key={provider}
                onClick={() => isMaster && handleSwitchProvider(provider)}
                disabled={!isMaster || switchingProvider || !isConfigured}
                className={`relative p-4 rounded-xl border-2 transition-all text-left ${
                  isActive
                    ? 'border-codemed-500 bg-codemed-50'
                    : isConfigured
                      ? 'border-gray-200 hover:border-gray-300 bg-white'
                      : 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
                }`}
              >
                {isActive && (
                  <div className="absolute top-2 right-2">
                    <span className="text-xs bg-codemed-600 text-white px-2 py-0.5 rounded-full font-medium">
                      Ativo
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={18} className={isActive ? 'text-codemed-600' : 'text-gray-400'} />
                  <span className={`text-sm font-medium ${isActive ? 'text-codemed-700' : 'text-gray-700'}`}>
                    {PROVIDER_LABELS[provider]}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  {isConnected ? (
                    <>
                      <CheckCircle2 size={12} className="text-green-500" />
                      <span className="text-green-600">Conectado</span>
                    </>
                  ) : isConfigured ? (
                    <>
                      <XCircle size={12} className="text-amber-500" />
                      <span className="text-amber-600">{status?.error || 'Configurado'}</span>
                    </>
                  ) : (
                    <>
                      <XCircle size={12} className="text-gray-400" />
                      <span className="text-gray-500">Nao configurado</span>
                    </>
                  )}
                </div>
                {!isConfigured && (
                  <p className="text-xs text-gray-400 mt-2">
                    Configure as variaveis de ambiente para usar
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Provider-specific content */}
      {activeProvider === 'baileys' && (
        <>
          {/* Create form */}
          {creating && isMaster && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-3">Nova Conexao WhatsApp</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Nome</label>
                  <input
                    type="text"
                    placeholder="Ex: Suporte"
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Numero</label>
                  <input
                    type="text"
                    placeholder="Ex: 5511999999999"
                    value={form.numero}
                    onChange={(e) => setForm({ ...form, numero: e.target.value })}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Provider</label>
                  <select
                    value={form.provider}
                    onChange={(e) => setForm({ ...form, provider: e.target.value })}
                    className="input w-full"
                  >
                    <option value="baileys">Baileys (WebSocket - Recomendado)</option>
                    <option value="whatsapp-webjs">WhatsApp Web.js (Chrome)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Departamento (opcional)</label>
                  <select
                    value={form.departamentoId}
                    onChange={(e) => setForm({ ...form, departamentoId: e.target.value })}
                    className="input w-full"
                  >
                    <option value="">Nenhum</option>
                    {departamentos.map((d) => (
                      <option key={d.id} value={d.id}>{d.nome}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={handleCreate} disabled={saving} className="btn-primary text-sm flex items-center gap-1">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Criar
                </button>
                <button onClick={() => setCreating(false)} className="btn-secondary text-sm">Cancelar</button>
              </div>
            </div>
          )}

          {/* Edit form */}
          {editing && isMaster && (
            <div className="bg-white border border-blue-200 rounded-xl p-4 mb-6 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-3">Editar Conexao WhatsApp</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Nome</label>
                  <input
                    type="text"
                    placeholder="Ex: Suporte"
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Numero</label>
                  <input
                    type="text"
                    placeholder="Ex: 5511999999999"
                    value={form.numero}
                    onChange={(e) => setForm({ ...form, numero: e.target.value })}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Provider</label>
                  <select
                    value={form.provider}
                    onChange={(e) => setForm({ ...form, provider: e.target.value })}
                    className="input w-full"
                  >
                    <option value="baileys">Baileys (WebSocket - Recomendado)</option>
                    <option value="whatsapp-webjs">WhatsApp Web.js (Chrome)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Departamento (opcional)</label>
                  <select
                    value={form.departamentoId}
                    onChange={(e) => setForm({ ...form, departamentoId: e.target.value })}
                    className="input w-full"
                  >
                    <option value="">Nenhum</option>
                    {departamentos.map((d) => (
                      <option key={d.id} value={d.id}>{d.nome}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={handleUpdate} disabled={saving} className="btn-primary text-sm flex items-center gap-1">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Salvar
                </button>
                <button onClick={() => { setEditing(null); setForm({ nome: '', numero: '', departamentoId: '', provider: 'baileys' }); }} className="btn-secondary text-sm">Cancelar</button>
              </div>
            </div>
          )}

          {/* Add button */}
          {isMaster && !creating && (
            <div className="mb-4">
              <button
                onClick={() => setCreating(true)}
                className="btn-primary flex items-center gap-2 text-sm"
              >
                <Plus size={16} /> Nova Conexao
              </button>
            </div>
          )}

          {/* Connections list */}
          {connections.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <MessageSquare size={48} className="mx-auto mb-3 opacity-30" />
              <p className="text-lg font-medium">Nenhuma conexao configurada</p>
              <p className="text-sm mt-1">Crie uma conexao para comecar a receber mensagens</p>
            </div>
          ) : (
            <div className="space-y-3">
              {connections.map((conn) => {
                const st = getStatus(conn.id);
                const connected = st?.connected ?? false;
                const scanning = st?.scanning ?? false;

                return (
                  <div
                    key={conn.id}
                    className={`bg-white border rounded-xl p-4 shadow-sm transition-all ${
                      connected ? 'border-green-200' : conn.ativo ? 'border-amber-200' : 'border-gray-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          connected ? 'bg-green-100' : 'bg-gray-100'
                        }`}>
                          {connected ? (
                            <Wifi size={20} className="text-green-600" />
                          ) : (
                            <WifiOff size={20} className="text-gray-400" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-800">{conn.nome}</h3>
                            <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${
                              (conn as any).provider === 'whatsapp-webjs'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-green-100 text-green-700'
                            }`}>
                              {(conn as any).provider === 'whatsapp-webjs' ? 'Web.js' : 'Baileys'}
                            </span>
                            {conn.departamento && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Building2 size={10} /> {conn.departamento.nome}
                              </span>
                            )}
                            {!conn.ativo && (
                              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inativo</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                            <span className="flex items-center gap-1"><Phone size={11} /> {conn.numero}</span>
                            {st && (
                              <>
                                <span className={`flex items-center gap-1 ${connected ? 'text-green-600' : 'text-gray-400'}`}>
                                  {connected ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                                  {connected ? 'Conectado' : scanning ? 'Escaneando...' : 'Desconectado'}
                                </span>
                                {st.lastMessageAt && (
                                  <span>Ultima msg: {new Date(st.lastMessageAt).toLocaleString('pt-BR')}</span>
                                )}
                              </>
                            )}
                          </div>
                          {st?.error && (
                            <p className="text-xs text-red-500 mt-1">{st.error}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {connected ? (
                          <>
                            <button
                              onClick={() => handleRegenerateQr(conn)}
                              className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-700 px-3 py-1.5 rounded-lg font-medium flex items-center gap-1"
                              title="Reconectar"
                            >
                              <RefreshCw size={12} /> Reconectar
                            </button>
                            <button
                              onClick={() => handleDisconnect(conn)}
                              className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-lg font-medium flex items-center gap-1"
                            >
                              <PowerOff size={12} /> Desconectar
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleConnect(conn)}
                            disabled={!conn.ativo}
                            className="text-xs bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1.5 rounded-lg font-medium flex items-center gap-1 disabled:opacity-50"
                          >
                            <Power size={12} /> Conectar
                          </button>
                        )}
                        {isMaster && (
                          <>
                            <button
                              onClick={() => handleEdit(conn)}
                              className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1.5 rounded-lg font-medium flex items-center gap-1"
                              title="Editar conexao"
                            >
                              <Edit3 size={12} /> Editar
                            </button>
                            <button
                              onClick={() => handleDelete(conn)}
                              className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-lg font-medium flex items-center gap-1"
                              title="Excluir conexao"
                            >
                              <Trash2 size={12} /> Excluir
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {conn._count && (
                      <div className="mt-2 text-xs text-gray-400">
                        {conn._count.tickets} ticket(s) vinculado(s)
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {activeProvider === 'evolution' && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <Server size={16} /> Instancias Evolution API
            </h3>
            {isMaster && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Nome da instancia"
                  value={evolutionInstanceName}
                  onChange={(e) => setEvolutionInstanceName(e.target.value)}
                  className="input text-sm"
                />
                <button
                  onClick={handleCreateEvolutionInstance}
                  disabled={evolutionCreating || !evolutionInstanceName.trim()}
                  className="btn-primary text-sm flex items-center gap-1"
                >
                  {evolutionCreating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Criar Instancia
                </button>
              </div>
            )}
          </div>

          {evolutionLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin text-codemed-600" size={24} />
            </div>
          ) : evolutionInstances.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Server size={40} className="mx-auto mb-2 opacity-30" />
              <p className="font-medium">Nenhuma instancia criada</p>
              <p className="text-sm mt-1">Crie uma instancia para conectar ao WhatsApp</p>
            </div>
          ) : (
            <div className="space-y-3">
              {evolutionInstances.map((inst) => {
                const isConnected = inst.status === 'open';
                return (
                  <div
                    key={inst.instanceName}
                    className={`border rounded-lg p-3 flex items-center justify-between ${
                      isConnected ? 'border-green-200 bg-green-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        isConnected ? 'bg-green-100' : 'bg-gray-100'
                      }`}>
                        {isConnected ? (
                          <Wifi size={16} className="text-green-600" />
                        ) : (
                          <WifiOff size={16} className="text-gray-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm text-gray-800">{inst.instanceName}</p>
                        <p className="text-xs text-gray-500">
                          {isConnected ? 'Conectado' : inst.status || 'Desconectado'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isConnected ? (
                        <button
                          onClick={() => handleDisconnectEvolution(inst.instanceName)}
                          className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-lg font-medium"
                        >
                          Desconectar
                        </button>
                      ) : (
                        <button
                          onClick={() => handleConnectEvolution(inst.instanceName)}
                          className="text-xs bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1.5 rounded-lg font-medium"
                        >
                          Conectar
                        </button>
                      )}
                      {isMaster && (
                        <button
                          onClick={() => handleDeleteEvolution(inst.instanceName)}
                          className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg font-medium"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeProvider === 'cloud' && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Cloud size={16} className="text-gray-500" />
            <h3 className="font-semibold text-gray-800">WhatsApp Cloud API (Meta)</h3>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800 mb-2">
              <strong>Configuracao via variaveis de ambiente:</strong>
            </p>
            <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
              <li><code>WHATSAPP_CLOUD_PHONE_NUMBER_ID</code> — ID do numero de telefone</li>
              <li><code>WHATSAPP_CLOUD_ACCESS_TOKEN</code> — Token de acesso da API</li>
              <li><code>WHATSAPP_CLOUD_API_VERSION</code> — Versao da API (default: v19.0)</li>
              <li><code>WHATSAPP_CLOUD_WEBHOOK_VERIFY_TOKEN</code> — Token de verificacao do webhook</li>
            </ul>
            <p className="text-xs text-blue-600 mt-3">
              Configure o webhook URL no Meta Business Suite para: <code>{window.location.origin}/api/whatsapp/cloud/webhook</code>
            </p>
          </div>
          <div className="mt-4 text-sm text-gray-600">
            <p>O Cloud API e a solucao oficial da Meta para envio de mensagens WhatsApp.</p>
            <p className="mt-1">Tier gratuito: 1.000 conversas/mes. Requer verificacao da conta de negócios.</p>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {qrModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">QR Code — {qrModal.conn.nome}</h3>
              <button
                onClick={() => { stopQrPolling(); setQrModal(null); setQrStatus('idle'); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle size={20} />
              </button>
            </div>
            <div className="flex flex-col items-center">
              {qrModal.qrDataUrl ? (
                <>
                  <img
                    src={qrModal.qrDataUrl}
                    alt="QR Code"
                    className="w-60 h-60"
                  />
                  <p className="text-xs text-green-600 mt-2 font-medium">
                    QR Code gerado — Escaneie com o celular
                  </p>
                </>
              ) : qrStatus === 'error' ? (
                <>
                  <div className="w-60 h-60 flex flex-col items-center justify-center bg-red-50 rounded-lg">
                    <AlertTriangle className="text-red-400 mb-2" size={40} />
                    <p className="text-sm text-red-600 text-center px-4">
                      {qrError || 'Erro ao gerar QR Code'}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      stopQrPolling();
                      if (activeProvider === 'evolution' && qrModal.conn.id) {
                        handleConnectEvolution(qrModal.conn.id);
                      } else {
                        handleRegenerateQr(qrModal.conn);
                      }
                    }}
                    className="mt-4 px-4 py-2 bg-codemed-600 hover:bg-codemed-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
                  >
                    <RefreshCw size={14} /> Tentar novamente
                  </button>
                </>
              ) : (
                <div className="w-60 h-60 flex flex-col items-center justify-center bg-gray-50 rounded-lg">
                  <Loader2 className="animate-spin text-codemed-500 mb-2" size={32} />
                  <p className="text-sm text-gray-500 text-center px-4">
                    {qrStatus === 'initializing' && 'Inicializando WhatsApp...'}
                    {qrStatus === 'generating' && 'Gerando QR Code...'}
                    {qrStatus === 'scanning' && 'Aguardando escaneamento...'}
                    {qrStatus === 'idle' && 'Preparando...'}
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    Tempo: {Math.round((Date.now() - qrPollStartRef.current) / 1000)}s
                  </p>
                </div>
              )}
              <p className="text-xs text-gray-500 mt-4 text-center">
                Abra o WhatsApp no celular<br />
                Menu &rarr; Dispositivos conectados &rarr; Conectar dispositivo
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
