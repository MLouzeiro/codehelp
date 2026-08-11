import { useState, useEffect, useCallback, useRef } from 'react';
import QRCode from 'qrcode';
import {
  Plus, Power, PowerOff, Trash2, RefreshCw, Wifi, WifiOff,
  MessageSquare, Phone, CheckCircle2, XCircle, Loader2, AlertTriangle,
  Server, Cloud, Smartphone, Mail, Send, Globe, ArrowLeft,
  Lightbulb, Zap, Users, Bot, Edit3,
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../services/auth';
import type { WhatsAppConnection, WhatsAppConnectionStatus, Channel } from '../../types';

type QRStatus = 'idle' | 'initializing' | 'generating' | 'scanning' | 'connected' | 'error';
type WhatsAppProvider = 'baileys' | 'evolution' | 'cloud';
type ViewMode = 'grid' | 'detail';

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

interface ConnectionType {
  id: string;
  name: string;
  description: string;
  icon: typeof Mail;
  color: string;
  status: 'available' | 'limit' | 'unavailable';
  statusLabel?: string;
  badge?: string;
}

const CONNECTION_TYPES: ConnectionType[] = [
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    description: 'Configure sua conta e comece a usar esta conexao.',
    icon: MessageSquare,
    color: '#25d366',
    status: 'available',
    badge: 'Baileys + Evolution + Cloud',
  },
  {
    id: 'email',
    name: 'Email',
    description: 'Configure sua conta e comece a usar esta conexao.',
    icon: Mail,
    color: '#3b82f6',
    status: 'available',
  },
  {
    id: 'webchat',
    name: 'Webchat',
    description: 'Configure sua conta e comece a usar esta conexao.',
    icon: Globe,
    color: '#8b5cf6',
    status: 'available',
    badge: '1 disponivel',
  },
  {
    id: 'telegram',
    name: 'Telegram',
    description: 'Configure sua conta e comece a usar esta conexao.',
    icon: Send,
    color: '#0088cc',
    status: 'available',
    badge: '1 disponivel',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    description: 'Configure sua conta e comece a usar esta conexao.',
    icon: Globe,
    color: '#e4405f',
    status: 'available',
    badge: '1 disponivel',
  },
  {
    id: 'facebook',
    name: 'Facebook Messenger',
    description: 'Configure sua conta e comece a usar esta conexao.',
    icon: Users,
    color: '#1877f2',
    status: 'available',
    badge: '1 disponivel',
  },
  {
    id: 'sms',
    name: 'SMS',
    description: 'Configure sua conta e comece a usar esta conexao.',
    icon: MessageSquare,
    color: '#f59e0b',
    status: 'available',
    badge: '1 disponivel',
  },
  {
    id: 'whatsapp-business',
    name: 'WhatsApp Business API',
    description: 'Configure sua conta e comece a usar esta conexao.',
    icon: Bot,
    color: '#075e54',
    status: 'available',
    badge: '1 disponivel',
  },
];

interface Props {
  onConnectionsChange?: () => void;
}

export default function ConnectionsTab({ onConnectionsChange }: Props) {
  const { user } = useAuth();
  const isMaster = user?.isMaster || user?.role === 'admin';
  const onConnectionsChangeRef = useRef(onConnectionsChange);
  onConnectionsChangeRef.current = onConnectionsChange;

  // Navigation
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedType, setSelectedType] = useState<string | null>(null);

  // WhatsApp state
  const [connections, setConnections] = useState<WhatsAppConnection[]>([]);
  const [statuses, setStatuses] = useState<WhatsAppConnectionStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<WhatsAppConnection | null>(null);
  const [form, setForm] = useState({ nome: '', numero: '', departamentoId: '' });
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

  // Evolution state
  const [evolutionInstances, setEvolutionInstances] = useState<EvolutionInstance[]>([]);
  const [evolutionLoading, setEvolutionLoading] = useState(false);
  const [evolutionCreating, setEvolutionCreating] = useState(false);
  const [evolutionInstanceName, setEvolutionInstanceName] = useState('');

  // Channel state
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [channelEditing, setChannelEditing] = useState<Channel | null>(null);
  const [channelCreating, setChannelCreating] = useState(false);
  const [channelSaving, setChannelSaving] = useState(false);
  const [channelForm, setChannelForm] = useState({
    nome: '', tipo: '', provider: '', slug: '', config: '{}' as any,
  });

  // ── Loaders ──────────────────────────────────────────────────────

  const loadConnections = useCallback(async () => {
    try {
      const [connsRes, statusesRes] = await Promise.all([
        api.get('/whatsapp/connections?includeInativos=true'),
        api.get('/whatsapp/connections/status'),
      ]);
      setConnections(connsRes.data);
      setStatuses(statusesRes.data);
      onConnectionsChangeRef.current?.();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadProviders = useCallback(async () => {
    try {
      const { data } = await api.get('/whatsapp/unified/providers');
      setActiveProvider(data.active);
      setProviderStatuses(data.providers);
    } catch (err) {
      console.error(err);
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

  const loadChannels = useCallback(async () => {
    try {
      setChannelsLoading(true);
      const { data } = await api.get('/channels?includeInativos=true');
      setChannels(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setChannelsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConnections();
    loadProviders();
    loadDepartamentos();
    loadChannels();
  }, [loadConnections, loadProviders, loadDepartamentos, loadChannels]);

  useEffect(() => {
    if (feedback) {
      const t = setTimeout(() => setFeedback(null), 4000);
      return () => clearTimeout(t);
    }
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
    console.log(`[QR Poll] Iniciando polling para conexao ${connId}`);

    qrTimeoutRef.current = setTimeout(() => {
      if (qrPollingRef.current === connId) {
        stopQrPolling();
        setQrStatus('error');
        setQrError('Tempo esgotado. O QR Code nao foi gerado em 120s.');
      }
    }, 120_000);

    const startDelay = setTimeout(() => {
      qrPollTimerRef.current = setInterval(async () => {
        if (qrPollingRef.current !== connId) return;
        try {
          const { data } = await api.get(`/whatsapp/baileys/multi/${connId}/status`);
          if (data.connected) {
            stopQrPolling();
            setQrModal(null);
            setQrStatus('connected');
            loadConnections();
            setFeedback({ type: 'ok', msg: 'Conexao conectada com sucesso!' });
            return;
          }
          if (data.error) {
            stopQrPolling();
            setQrStatus('error');
            setQrError(data.error);
            return;
          }
          if (data.qrCode) {
            console.log(`[QR Poll] QR recebido do backend (${data.qrCode.length} chars). Convertendo para imagem...`);
            setQrStatus('generating');
            try {
              const dataUrl = await QRCode.toDataURL(data.qrCode, { width: 250, margin: 2, color: { dark: '#000000', light: '#ffffff' } });
              setQrModal((prev) => prev ? { ...prev, qrDataUrl: dataUrl } : null);
              setQrStatus('scanning');
              console.log('[QR Poll] QR Code exibido no modal. Aguardando escaneamento...');
            } catch (err) {
              console.error('[QR Poll] Erro ao converter QR para imagem:', err);
              setQrStatus('scanning');
            }
          }
        } catch (err: any) {
          if (err?.response?.status === 401 || err?.response?.status === 403) {
            stopQrPolling(); setQrStatus('error'); setQrError('Sessao expirada. Faca login novamente.');
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

  // ── Helpers ──────────────────────────────────────────────────────

  const getStatus = (connId: string): WhatsAppConnectionStatus | undefined =>
    statuses.find((s) => s.id === connId);

  const getChannelsByType = (tipo: string): Channel[] =>
    channels.filter((c) => c.tipo === tipo);

  const getChannelCount = (tipo: string): number =>
    getChannelsByType(tipo).length;

  const getConnectedCount = (tipo: string): number => {
    if (tipo === 'whatsapp') {
      return connections.filter((c) => {
        const st = getStatus(c.id);
        return st?.connected;
      }).length;
    }
    return getChannelsByType(tipo).filter((c) => c.ativo).length;
  };

  // ── Handlers ─────────────────────────────────────────────────────

  const handleSelectType = (typeId: string) => {
    setSelectedType(typeId);
    setViewMode('detail');
    if (typeId === 'whatsapp') {
      loadConnections();
      loadProviders();
      loadEvolutionInstances();
    } else {
      loadChannels();
    }
  };

  const handleBack = () => {
    setViewMode('grid');
    setSelectedType(null);
    setCreating(false);
    setChannelCreating(false);
    setChannelEditing(null);
  };

  const handleCreate = async () => {
    if (!form.nome.trim() || !form.numero.trim()) {
      setFeedback({ type: 'err', msg: 'Nome e numero sao obrigatorios' });
      return;
    }
    setSaving(true);
    try {
      await api.post('/whatsapp/connections', { nome: form.nome.trim(), numero: form.numero.trim(), departamentoId: form.departamentoId || undefined });
      setFeedback({ type: 'ok', msg: 'Conexao criada com sucesso' });
      setCreating(false);
      setForm({ nome: '', numero: '', departamentoId: '' });
      loadConnections();
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err?.response?.data?.error || 'Erro ao criar conexao' });
    } finally {
      setSaving(false);
    }
  };

  const handleConnect = async (conn: WhatsAppConnection) => {
    try {
      console.log(`[QR] Clicou Conectar para ${conn.id} (${conn.nome})`);
      await api.post(`/whatsapp/baileys/multi/${conn.id}/connect`);
      console.log(`[QR] POST connect enviado. Abrindo modal QR...`);
      setFeedback({ type: 'ok', msg: 'Conexao iniciada. Gerando QR Code...' });
      setQrModal({ conn, qrDataUrl: null });
      qrPollingRef.current = conn.id;
      setQrStatus('initializing');
    } catch (err: any) {
      console.error(`[QR] Erro ao conectar:`, err);
      setFeedback({ type: 'err', msg: err?.response?.data?.error || 'Erro ao conectar' });
    }
  };

  const handleDisconnect = async (conn: WhatsAppConnection) => {
    try {
      await api.post(`/whatsapp/baileys/multi/${conn.id}/disconnect`);
      setFeedback({ type: 'ok', msg: 'Conexao desconectada' });
      loadConnections();
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err?.response?.data?.error || 'Erro ao desconectar' });
    }
  };

  const handleForceReconnect = async (conn: WhatsAppConnection) => {
    try {
      setFeedback({ type: 'ok', msg: 'Limpando sessao e reconectando...' });
      await api.post(`/whatsapp/connections/${conn.id}/force-reconnect`);
      setQrModal({ conn, qrDataUrl: null });
      qrPollingRef.current = conn.id;
      setQrStatus('initializing');
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err?.response?.data?.error || 'Erro ao reconectar' });
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
    setForm({ nome: conn.nome, numero: conn.numero, departamentoId: conn.departamentoId || '' });
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
      });
      setFeedback({ type: 'ok', msg: 'Conexao atualizada com sucesso' });
      setEditing(null);
      setForm({ nome: '', numero: '', departamentoId: '' });
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

  const handleCreateEvolutionInstance = async () => {
    const instanceName = evolutionInstanceName.trim() || `evolution-${Date.now().toString(36)}`;
    try {
      setEvolutionCreating(true);
      await api.post('/whatsapp/evolution/instance/create', { instanceName });
      setFeedback({ type: 'ok', msg: `Instancia "${instanceName}" criada com sucesso` });
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

  // ── Channel CRUD ─────────────────────────────────────────────────
  const handleChannelSave = async () => {
    if (!channelForm.nome.trim()) {
      setFeedback({ type: 'err', msg: 'Nome do canal e obrigatorio' });
      return;
    }
    setChannelSaving(true);
    try {
      const payload: any = {
        nome: channelForm.nome.trim(),
        tipo: channelForm.tipo,
        provider: channelForm.provider || undefined,
        slug: channelForm.slug || channelForm.nome.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        config: JSON.stringify(channelForm.config),
      };
      if (channelEditing) {
        await api.put(`/channels/${channelEditing.id}`, payload);
        setFeedback({ type: 'ok', msg: 'Canal atualizado' });
      } else {
        await api.post('/channels', payload);
        setFeedback({ type: 'ok', msg: 'Canal criado' });
      }
      setChannelEditing(null);
      setChannelCreating(false);
      setChannelForm({ nome: '', tipo: '', provider: '', slug: '', config: '{}' });
      loadChannels();
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err?.response?.data?.error || 'Erro ao salvar canal' });
    } finally {
      setChannelSaving(false);
    }
  };

  const handleChannelDelete = async (ch: Channel) => {
    if (!confirm(`Deletar canal "${ch.nome}"?`)) return;
    try {
      await api.delete(`/channels/${ch.id}`);
      setFeedback({ type: 'ok', msg: 'Canal deletado' });
      loadChannels();
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err?.response?.data?.error || 'Erro ao deletar' });
    }
  };

  // ── Render ───────────────────────────────────────────────────────

  const selectedTypeData = CONNECTION_TYPES.find((t) => t.id === selectedType);

  return (
    <div className="flex h-[calc(100vh-120px)]">
      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Feedback */}
        {feedback && (
          <div className={`mb-4 px-4 py-2 rounded-lg text-sm font-medium ${
            feedback.type === 'ok' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {feedback.msg}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* GRID VIEW                                                   */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {viewMode === 'grid' && (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Adicionar conexao</h2>
              <p className="text-sm text-gray-500 mt-1">Selecione um tipo de conexao para configurar</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {CONNECTION_TYPES.map((type) => {
                const Icon = type.icon;
                const count = type.id === 'whatsapp' ? connections.length : getChannelCount(type.id);
                const connected = type.id === 'whatsapp'
                  ? connections.filter((c) => getStatus(c.id)?.connected).length
                  : getConnectedCount(type.id);
                const isAvailable = type.status === 'available';

                return (
                  <button
                    key={type.id}
                    onClick={() => isAvailable && handleSelectType(type.id)}
                    disabled={!isAvailable}
                    className={`relative text-left p-5 rounded-xl border-2 transition-all group ${
                      isAvailable
                        ? 'border-gray-200 hover:border-codemed-300 bg-white hover:shadow-md cursor-pointer'
                        : 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    {/* Status badge */}
                    {type.badge && (
                      <div className="absolute top-3 right-3">
                        {type.status === 'unavailable' ? (
                          <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">{type.badge}</span>
                        ) : (
                          <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">{type.badge}</span>
                        )}
                      </div>
                    )}

                    {/* Icon */}
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110"
                      style={{ backgroundColor: `${type.color}15` }}
                    >
                      <Icon size={24} style={{ color: type.color }} />
                    </div>

                    {/* Text */}
                    <h3 className="font-semibold text-gray-900 text-sm">{type.name}</h3>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">{type.description}</p>

                    {/* Connection count */}
                    {count > 0 && (
                      <div className="flex items-center gap-1 mt-3 text-xs text-gray-400">
                        <span>{count} conexao(oes)</span>
                        {connected > 0 && (
                          <span className="text-green-600 font-medium">({connected} ativa(s))</span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* DETAIL VIEW                                                 */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {viewMode === 'detail' && selectedTypeData && (
          <>
            {/* Back button + title */}
            <div className="flex items-center gap-3 mb-6">
              <button onClick={handleBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <ArrowLeft size={20} className="text-gray-600" />
              </button>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${selectedTypeData.color}15` }}
                >
                  <selectedTypeData.icon size={20} style={{ color: selectedTypeData.color }} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedTypeData.name}</h2>
                  <p className="text-sm text-gray-500">{selectedTypeData.description}</p>
                </div>
              </div>
            </div>

            {/* ── WhatsApp Detail ──────────────────────────────── */}
            {selectedType === 'whatsapp' && (
              <div className="space-y-6">
                {/* Provider Selection */}
                <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                  <h3 className="font-semibold text-gray-800 mb-3">Provider Ativo</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {(['baileys', 'evolution', 'cloud'] as WhatsAppProvider[]).map((provider) => {
                      const labels = { 'baileys': 'Baileys (WebSocket)', 'evolution': 'Evolution API (Docker)', 'cloud': 'WhatsApp Cloud API (Meta)' };
                      const icons = { 'baileys': Smartphone, 'evolution': Server, 'cloud': Cloud };
                      const Icon = icons[provider];
                      const ps = providerStatuses.find((s) => s.provider === provider);
                      const isActive = activeProvider === provider;
                      const isConfigured = ps?.enabled ?? false;
                      return (
                        <button
                          key={provider}
                          onClick={() => isMaster && setActiveProvider(provider)}
                          disabled={!isMaster}
                          className={`relative p-4 rounded-xl border-2 transition-all text-left ${
                            isActive ? 'border-codemed-500 bg-codemed-50'
                              : isConfigured ? 'border-gray-200 hover:border-gray-300 bg-white'
                              : 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
                          }`}
                        >
                          {isActive && (
                            <span className="absolute top-2 right-2 text-xs bg-codemed-600 text-white px-2 py-0.5 rounded-full font-medium">Ativo</span>
                          )}
                          <div className="flex items-center gap-2 mb-1">
                            <Icon size={16} className={isActive ? 'text-codemed-600' : 'text-gray-400'} />
                            <span className={`text-sm font-medium ${isActive ? 'text-codemed-700' : 'text-gray-700'}`}>{labels[provider]}</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs">
                            {ps?.connected ? (
                              <><CheckCircle2 size={12} className="text-green-500" /><span className="text-green-600">Conectado</span></>
                            ) : isConfigured ? (
                              <><XCircle size={12} className="text-amber-500" /><span className="text-amber-600">{ps?.error || 'Configurado'}</span></>
                            ) : (
                              <><XCircle size={12} className="text-gray-400" /><span className="text-gray-500">Nao configurado</span></>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Baileys connections */}
                {activeProvider === 'baileys' && (
                  <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-800">Conexoes Baileys</h3>
                      {isMaster && !creating && (
                        <button onClick={() => setCreating(true)} className="btn-primary text-sm flex items-center gap-1">
                          <Plus size={14} /> Nova Conexao
                        </button>
                      )}
                    </div>

                    {creating && (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="text-xs font-medium text-gray-500 mb-1 block">Nome</label>
                            <input type="text" placeholder="Ex: Suporte" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="input w-full" />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-500 mb-1 block">Numero</label>
                            <input type="text" placeholder="Ex: 5511999999999" value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} className="input w-full" />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-500 mb-1 block">Departamento</label>
                            <select value={form.departamentoId} onChange={(e) => setForm({ ...form, departamentoId: e.target.value })} className="input w-full">
                              <option value="">Nenhum</option>
                              {departamentos.map((d) => (<option key={d.id} value={d.id}>{d.nome}</option>))}
                            </select>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <button onClick={handleCreate} disabled={saving} className="btn-primary text-sm flex items-center gap-1">
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Criar
                          </button>
                          <button onClick={() => setCreating(false)} className="btn-secondary text-sm">Cancelar</button>
                        </div>
                      </div>
                    )}

                    {editing && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                        <h4 className="text-sm font-semibold text-gray-800 mb-3">Editar Conexao</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="text-xs font-medium text-gray-500 mb-1 block">Nome</label>
                            <input type="text" placeholder="Ex: Suporte" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="input w-full" />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-500 mb-1 block">Numero</label>
                            <input type="text" placeholder="Ex: 5511999999999" value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} className="input w-full" />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-500 mb-1 block">Departamento</label>
                            <select value={form.departamentoId} onChange={(e) => setForm({ ...form, departamentoId: e.target.value })} className="input w-full">
                              <option value="">Nenhum</option>
                              {departamentos.map((d) => (<option key={d.id} value={d.id}>{d.nome}</option>))}
                            </select>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <button onClick={handleUpdate} disabled={saving} className="btn-primary text-sm flex items-center gap-1">
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Edit3 size={14} />} Salvar
                          </button>
                          <button onClick={() => { setEditing(null); setForm({ nome: '', numero: '', departamentoId: '' }); }} className="btn-secondary text-sm">Cancelar</button>
                        </div>
                      </div>
                    )}

                    {connections.length === 0 ? (
                      <div className="text-center py-10 text-gray-400">
                        <MessageSquare size={40} className="mx-auto mb-2 opacity-30" />
                        <p className="font-medium">Nenhuma conexao configurada</p>
                        <p className="text-sm mt-1">Crie uma conexao para comecar a receber mensagens</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {connections.map((conn) => {
                          const st = getStatus(conn.id);
                          const connected = st?.connected ?? false;
                          const scanning = st?.scanning ?? false;
                          return (
                            <div key={conn.id} className={`border rounded-xl p-4 transition-all ${connected ? 'border-green-200 bg-green-50/50' : conn.ativo ? 'border-amber-200' : 'border-gray-200 opacity-60'}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${connected ? 'bg-green-100' : 'bg-gray-100'}`}>
                                    {connected ? <Wifi size={20} className="text-green-600" /> : <WifiOff size={20} className="text-gray-400" />}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <h4 className="font-semibold text-gray-800">{conn.nome}</h4>
                                      {conn.departamento && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{conn.departamento.nome}</span>}
                                      {!conn.ativo && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inativo</span>}
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                                      <span className="flex items-center gap-1"><Phone size={11} /> {conn.numero}</span>
                                      {st && (
                                        <span className={`flex items-center gap-1 ${connected ? 'text-green-600' : 'text-gray-400'}`}>
                                          {connected ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                                          {connected ? 'Conectado' : scanning ? 'Escaneando...' : 'Desconectado'}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {connected ? (
                                    <>
                                      <button onClick={() => handleForceReconnect(conn)} className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1.5 rounded-lg font-medium flex items-center gap-1" title="Limpar sessao e reconectar"><RefreshCw size={12} /> Forcar Reconexao</button>
                                      <button onClick={() => handleDisconnect(conn)} className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-lg font-medium flex items-center gap-1"><PowerOff size={12} /> Desconectar</button>
                                    </>
                                  ) : (
                                    <button onClick={() => handleConnect(conn)} disabled={!conn.ativo} className="text-xs bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1.5 rounded-lg font-medium flex items-center gap-1 disabled:opacity-50"><Power size={12} /> Conectar</button>
                                  )}
                                  {isMaster && (
                                    <>
                                      <button onClick={() => handleEdit(conn)} className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1.5 rounded-lg font-medium flex items-center gap-1" title="Editar conexao">
                                        <Edit3 size={12} /> Editar
                                      </button>
                                      <button onClick={() => handleDelete(conn)} className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-lg font-medium flex items-center gap-1" title="Excluir conexao">
                                        <Trash2 size={12} /> Excluir
                                      </button>
                                      <button onClick={() => handleToggle(conn)} className={`text-xs px-3 py-1.5 rounded-lg font-medium ${conn.ativo ? 'bg-gray-100 hover:bg-gray-200 text-gray-600' : 'bg-green-100 hover:bg-green-200 text-green-700'}`}>
                                        {conn.ativo ? 'Desativar' : 'Ativar'}
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Evolution API */}
                {activeProvider === 'evolution' && (
                  <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-800 flex items-center gap-2"><Server size={16} /> Instancias Evolution API</h3>
                      {isMaster && (
                        <div className="flex items-center gap-2">
                          <input type="text" placeholder="Nome (opcional — auto-gerado se vazio)" value={evolutionInstanceName} onChange={(e) => setEvolutionInstanceName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleCreateEvolutionInstance(); }} className="input text-sm" />
                          <button onClick={handleCreateEvolutionInstance} disabled={evolutionCreating} className="btn-primary text-sm flex items-center gap-1">
                            {evolutionCreating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Criar
                          </button>
                        </div>
                      )}
                    </div>
                    {evolutionLoading ? (
                      <div className="flex items-center justify-center py-8"><Loader2 className="animate-spin text-codemed-600" size={24} /></div>
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
                            <div key={inst.instanceName} className={`border rounded-xl p-4 flex items-center justify-between ${isConnected ? 'border-green-200 bg-green-50/50' : 'border-gray-200'}`}>
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isConnected ? 'bg-green-100' : 'bg-gray-100'}`}>
                                  {isConnected ? <Wifi size={20} className="text-green-600" /> : <WifiOff size={20} className="text-gray-400" />}
                                </div>
                                <div>
                                  <p className="font-medium text-gray-800">{inst.instanceName}</p>
                                  <p className="text-xs text-gray-500">{isConnected ? 'Conectado' : inst.status || 'Desconectado'}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {isConnected ? (
                                  <button onClick={() => handleDisconnectEvolution(inst.instanceName)} className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-lg font-medium">Desconectar</button>
                                ) : (
                                  <button onClick={() => handleConnectEvolution(inst.instanceName)} className="text-xs bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1.5 rounded-lg font-medium">Conectar</button>
                                )}
                                {isMaster && (
                                  <button onClick={() => handleDeleteEvolution(inst.instanceName)} className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg font-medium"><Trash2 size={12} /></button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Cloud API */}
                {activeProvider === 'cloud' && (
                  <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                    <h3 className="font-semibold text-gray-800 flex items-center gap-2 mb-3"><Cloud size={16} /> WhatsApp Cloud API (Meta)</h3>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm text-blue-800 mb-2"><strong>Configuracao via variaveis de ambiente:</strong></p>
                      <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                        <li><code>WHATSAPP_CLOUD_PHONE_NUMBER_ID</code> — ID do numero de telefone</li>
                        <li><code>WHATSAPP_CLOUD_ACCESS_TOKEN</code> — Token de acesso da API</li>
                        <li><code>WHATSAPP_CLOUD_API_VERSION</code> — Versao da API (default: v19.0)</li>
                        <li><code>WHATSAPP_CLOUD_WEBHOOK_VERIFY_TOKEN</code> — Token de verificacao do webhook</li>
                      </ul>
                      <p className="text-xs text-blue-600 mt-3">Webhook URL: <code>{window.location.origin}/api/whatsapp/cloud/webhook</code></p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Email / Instagram / Facebook / Telegram Detail ── */}
            {selectedType && selectedType !== 'whatsapp' && (
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-800">Canais {selectedTypeData?.name}</h3>
                  {isMaster && !channelCreating && !channelEditing && (
                    <button onClick={() => { setChannelCreating(true); setChannelEditing(null); setChannelForm({ nome: '', tipo: selectedType, provider: '', slug: '', config: '{}' }); }} className="btn-primary text-sm flex items-center gap-1">
                      <Plus size={14} /> Novo Canal
                    </button>
                  )}
                </div>

                {/* Create/Edit form */}
                {(channelCreating || channelEditing) && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                    <h4 className="font-medium text-gray-800 mb-3">{channelEditing ? 'Editar Canal' : `Novo Canal ${selectedTypeData?.name}`}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">Nome *</label>
                        <input type="text" placeholder={`Ex: ${selectedTypeData?.name} Comercial`} value={channelForm.nome} onChange={(e) => setChannelForm({ ...channelForm, nome: e.target.value })} className="input w-full" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">Slug</label>
                        <input type="text" placeholder="auto-gerado se vazio" value={channelForm.slug} onChange={(e) => setChannelForm({ ...channelForm, slug: e.target.value })} className="input w-full" />
                      </div>
                    </div>
                    <ChannelConfigForm tipo={selectedType} config={channelForm.config} onChange={(config) => setChannelForm({ ...channelForm, config })} />
                    <div className="flex gap-2 mt-3">
                      <button onClick={handleChannelSave} disabled={channelSaving || !channelForm.nome.trim()} className="btn-primary text-sm flex items-center gap-1">
                        {channelSaving ? <Loader2 size={14} className="animate-spin" /> : null} Salvar
                      </button>
                      <button onClick={() => { setChannelCreating(false); setChannelEditing(null); }} className="btn-secondary text-sm">Cancelar</button>
                    </div>
                  </div>
                )}

                {/* Channel list */}
                {channelsLoading ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="animate-spin text-codemed-600" size={24} /></div>
                ) : getChannelsByType(selectedType).length === 0 ? (
                  <div className="text-center py-10 text-gray-400">
                    {selectedTypeData && <selectedTypeData.icon size={40} className="mx-auto mb-2 opacity-30" style={{ color: selectedTypeData.color }} />}
                    <p className="font-medium">Nenhum canal configurado</p>
                    <p className="text-sm mt-1">Crie um canal para comecar a receber mensagens</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {getChannelsByType(selectedType).map((ch) => (
                      <div key={ch.id} className={`border rounded-xl p-4 transition-all ${ch.ativo ? 'border-green-200 bg-green-50/50' : 'border-gray-200 opacity-60'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${selectedTypeData?.color || '#6b7280'}15` }}>
                              {selectedTypeData && <selectedTypeData.icon size={20} style={{ color: selectedTypeData.color }} />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold text-gray-800">{ch.nome}</h4>
                                {ch.provider && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{ch.provider}</span>}
                                {!ch.ativo && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inativo</span>}
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5">{ch.slug}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {isMaster && (
                              <>
                                <button onClick={() => { setChannelEditing(ch); setChannelCreating(false); setChannelForm({ nome: ch.nome, tipo: ch.tipo, provider: ch.provider || '', slug: ch.slug, config: ch.config ? JSON.parse(ch.config) : {} }); }} className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg font-medium">Editar</button>
                                <button onClick={() => handleChannelDelete(ch)} className="text-xs bg-red-50 hover:bg-red-100 text-red-700 px-3 py-1.5 rounded-lg font-medium"><Trash2 size={12} /></button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Sidebar: Quick Tips ────────────────────────────────── */}
      <div className="w-72 border-l border-gray-200 bg-gray-50 p-6 overflow-y-auto hidden lg:block">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb size={18} className="text-amber-500" />
          <h3 className="font-semibold text-gray-800 text-sm">Aprendizado relampago</h3>
        </div>

        <div className="space-y-4 text-sm text-gray-600">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-800 mb-2">Como conectar</h4>
            <ol className="text-xs space-y-1.5 list-decimal list-inside text-gray-500">
              <li>Selecione o tipo de conexao</li>
              <li>Configure as credenciais</li>
              <li>Escaneie o QR Code (WhatsApp)</li>
              <li>Pronto! As mensagens comecam a chegar</li>
            </ol>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-800 mb-2">Providers WhatsApp</h4>
            <ul className="text-xs space-y-1.5 text-gray-500">
              <li className="flex items-center gap-1.5"><Smartphone size={12} className="text-green-600" /> Baileys — WebSocket (gratis)</li>
              <li className="flex items-center gap-1.5"><Server size={12} className="text-blue-600" /> Evolution — Docker (gratis)</li>
              <li className="flex items-center gap-1.5"><Cloud size={12} className="text-purple-600" /> Cloud API — Meta (1000/mes)</li>
            </ul>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-800 mb-2">Dicas</h4>
            <ul className="text-xs space-y-1.5 text-gray-500">
              <li>Use "Forcar Reconexao" se a conexao travar</li>
              <li>Cada conexao pode ter seu proprio departamento</li>
              <li>Canais podem ser testados individualmente</li>
              <li>O Cloud API e ideal para alto volume</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* QR Code Modal                                               */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {qrModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">QR Code — {qrModal.conn.nome}</h3>
              <button onClick={() => { stopQrPolling(); setQrModal(null); setQrStatus('idle'); }} className="text-gray-400 hover:text-gray-600"><XCircle size={20} /></button>
            </div>
            <div className="flex flex-col items-center">
              {qrModal.qrDataUrl ? (
                <>
                  <img src={qrModal.qrDataUrl} alt="QR Code" className="w-60 h-60" />
                  <p className="text-xs text-green-600 mt-2 font-medium">QR Code gerado — Escaneie com o celular</p>
                </>
              ) : qrStatus === 'error' ? (
                <>
                  <div className="w-60 h-60 flex flex-col items-center justify-center bg-red-50 rounded-lg">
                    <AlertTriangle className="text-red-400 mb-2" size={40} />
                    <p className="text-sm text-red-600 text-center px-4">{qrError || 'Erro ao gerar QR Code'}</p>
                  </div>
                  <button onClick={() => { stopQrPolling(); handleForceReconnect(qrModal.conn); }} className="mt-4 px-4 py-2 bg-codemed-600 hover:bg-codemed-700 text-white rounded-lg text-sm font-medium flex items-center gap-2">
                    <RefreshCw size={14} /> Limpar sessao e tentar novamente
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
                  <p className="text-xs text-gray-400 mt-2">Tempo: {Math.round((Date.now() - qrPollStartRef.current) / 1000)}s</p>
                </div>
              )}
              <p className="text-xs text-gray-500 mt-4 text-center">Abra o WhatsApp no celular<br />Menu &rarr; Dispositivos conectados &rarr; Conectar dispositivo</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Channel-specific config forms
// ═══════════════════════════════════════════════════════════════════

function ChannelConfigForm({ tipo, config, onChange }: { tipo: string; config: any; onChange: (c: any) => void }) {
  const set = (key: string, value: string) => onChange({ ...config, [key]: value });

  if (tipo === 'email') {
    return (
      <div className="mt-4 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase">Configuracao Email (IMAP + SMTP)</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500 mb-1 block">Servidor IMAP</label><input type="text" placeholder="imap.gmail.com" value={config.imapHost || ''} onChange={(e) => set('imapHost', e.target.value)} className="input w-full" /></div>
          <div><label className="text-xs text-gray-500 mb-1 block">Porta IMAP</label><input type="text" placeholder="993" value={config.imapPort || '993'} onChange={(e) => set('imapPort', e.target.value)} className="input w-full" /></div>
          <div><label className="text-xs text-gray-500 mb-1 block">Servidor SMTP</label><input type="text" placeholder="smtp.gmail.com" value={config.smtpHost || ''} onChange={(e) => set('smtpHost', e.target.value)} className="input w-full" /></div>
          <div><label className="text-xs text-gray-500 mb-1 block">Porta SMTP</label><input type="text" placeholder="587" value={config.smtpPort || '587'} onChange={(e) => set('smtpPort', e.target.value)} className="input w-full" /></div>
          <div><label className="text-xs text-gray-500 mb-1 block">Usuario / Email</label><input type="text" value={config.user || ''} onChange={(e) => set('user', e.target.value)} className="input w-full" /></div>
          <div><label className="text-xs text-gray-500 mb-1 block">Senha</label><input type="password" value={config.password || ''} onChange={(e) => set('password', e.target.value)} className="input w-full" /></div>
        </div>
      </div>
    );
  }

  if (tipo === 'instagram') {
    return (
      <div className="mt-4 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase">Configuracao Instagram (Graph API)</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500 mb-1 block">Access Token</label><input type="password" value={config.accessToken || ''} onChange={(e) => set('accessToken', e.target.value)} className="input w-full" /></div>
          <div><label className="text-xs text-gray-500 mb-1 block">Instagram Account ID</label><input type="text" placeholder="17841400..." value={config.instagramAccountId || ''} onChange={(e) => set('instagramAccountId', e.target.value)} className="input w-full" /></div>
          <div><label className="text-xs text-gray-500 mb-1 block">Webhook Verify Token</label><input type="text" value={config.webhookVerifyToken || ''} onChange={(e) => set('webhookVerifyToken', e.target.value)} className="input w-full" /></div>
        </div>
      </div>
    );
  }

  if (tipo === 'facebook') {
    return (
      <div className="mt-4 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase">Configuracao Facebook Messenger (Graph API)</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500 mb-1 block">Page Access Token</label><input type="password" value={config.pageAccessToken || ''} onChange={(e) => set('pageAccessToken', e.target.value)} className="input w-full" /></div>
          <div><label className="text-xs text-gray-500 mb-1 block">Page ID</label><input type="text" value={config.pageId || ''} onChange={(e) => set('pageId', e.target.value)} className="input w-full" /></div>
          <div><label className="text-xs text-gray-500 mb-1 block">App Secret</label><input type="password" value={config.appSecret || ''} onChange={(e) => set('appSecret', e.target.value)} className="input w-full" /></div>
          <div><label className="text-xs text-gray-500 mb-1 block">Verify Token</label><input type="text" value={config.verifyToken || ''} onChange={(e) => set('verifyToken', e.target.value)} className="input w-full" /></div>
        </div>
      </div>
    );
  }

  if (tipo === 'telegram') {
    return (
      <div className="mt-4 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase">Configuracao Telegram (Bot API)</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500 mb-1 block">Bot Token (do @BotFather)</label><input type="password" value={config.botToken || ''} onChange={(e) => set('botToken', e.target.value)} className="input w-full" /></div>
          <div><label className="text-xs text-gray-500 mb-1 block">Chat IDs permitidos (opcional)</label><input type="text" placeholder="Todos se vazio" value={config.allowedChatIds || ''} onChange={(e) => set('allowedChatIds', e.target.value)} className="input w-full" /></div>
        </div>
      </div>
    );
  }

  return null;
}
