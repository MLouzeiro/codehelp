import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Power, PowerOff, Save, X, RefreshCw, MessageCircle, Mail, Instagram, Facebook, Send, Globe, Phone, AlertTriangle, BarChart3, Trash2, ExternalLink } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../services/auth';
import type { Channel, ChannelType, ChannelStats } from '../../types';

const CHANNEL_ICONS: Record<string, any> = {
  whatsapp: MessageCircle,
  email: Mail,
  instagram: Instagram,
  facebook: Facebook,
  telegram: Send,
  web: Globe,
  telefone: Phone,
};

const CHANNEL_COLORS: Record<string, string> = {
  whatsapp: '#25d366',
  email: '#3b82f6',
  instagram: '#e4405f',
  facebook: '#1877f2',
  telegram: '#0088cc',
  web: '#f59e0b',
  telefone: '#8b5cf6',
};

export default function ChannelsPage() {
  const { user } = useAuth();
  const isMaster = user?.isMaster || user?.role === 'admin';

  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelTypes, setChannelTypes] = useState<ChannelType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Channel | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [stats, setStats] = useState<Record<string, ChannelStats>>({});
  const [testingConnection, setTestingConnection] = useState<string | null>(null);
  const [showStats, setShowStats] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [channelsRes, typesRes] = await Promise.all([
        api.get('/channels?includeInativos=true'),
        api.get('/channels/types'),
      ]);
      setChannels(channelsRes.data);
      setChannelTypes(typesRes.data);
    } catch (err) {
      console.error('Erro ao carregar canais:', err);
      setFeedback({ type: 'err', msg: 'Erro ao carregar canais' });
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

  const loadStats = async (channelId: string) => {
    try {
      const { data } = await api.get(`/channels/${channelId}/stats`);
      setStats(prev => ({ ...prev, [channelId]: data }));
    } catch (err) {
      console.error('Erro ao carregar stats:', err);
    }
  };

  const handleSave = async (data: Partial<Channel>) => {
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/channels/${editing.id}`, data);
        setFeedback({ type: 'ok', msg: 'Canal atualizado com sucesso' });
      } else {
        await api.post('/channels', data);
        setFeedback({ type: 'ok', msg: 'Canal criado com sucesso' });
      }
      setEditing(null);
      setCreating(false);
      load();
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err?.response?.data?.error || 'Erro ao salvar canal' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (channel: Channel) => {
    try {
      await api.patch(`/channels/${channel.id}/toggle`);
      setFeedback({ type: 'ok', msg: `Canal ${channel.ativo ? 'desativado' : 'ativado'} com sucesso` });
      load();
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err?.response?.data?.error || 'Erro ao alterar status' });
    }
  };

  const handleDelete = async (channel: Channel) => {
    if (!confirm(`Tem certeza que deseja excluir o canal "${channel.nome}"?`)) return;
    try {
      await api.delete(`/channels/${channel.id}`);
      setFeedback({ type: 'ok', msg: 'Canal excluido com sucesso' });
      load();
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err?.response?.data?.error || 'Erro ao excluir canal' });
    }
  };

  const handleTestConnection = async (channel: Channel) => {
    setTestingConnection(channel.id);
    try {
      let endpoint = '';
      switch (channel.tipo) {
        case 'email':
          endpoint = `/email/test/${channel.id}`;
          break;
        case 'instagram':
          endpoint = `/instagram/test/${channel.id}`;
          break;
        case 'facebook':
          endpoint = `/facebook/test/${channel.id}`;
          break;
        case 'telegram':
          endpoint = `/telegram/test/${channel.id}`;
          break;
        default:
          setFeedback({ type: 'err', msg: 'Teste de conexao nao disponivel para este tipo de canal' });
          return;
      }
      const { data } = await api.post(endpoint);
      if (data.success) {
        setFeedback({ type: 'ok', msg: data.message || 'Conexao testada com sucesso' });
      } else {
        setFeedback({ type: 'err', msg: data.message || 'Falha no teste de conexao' });
      }
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err?.response?.data?.error || 'Erro ao testar conexao' });
    } finally {
      setTestingConnection(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Canais de Atendimento</h1>
          <p className="text-sm text-muted-foreground">
            {channels.length} canal(is) configurado(s)
          </p>
        </div>
        {isMaster && (
          <button
            onClick={() => { setCreating(true); setEditing(null); }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={18} />
            Novo Canal
          </button>
        )}
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`p-3 rounded-xl text-sm font-medium ${
          feedback.type === 'ok'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {feedback.msg}
        </div>
      )}

      {/* Channel List */}
      <div className="space-y-3">
        {channels.length === 0 ? (
          <div className="card p-8 text-center text-muted-foreground">
            <MessageCircle size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Nenhum canal configurado</p>
            <p className="text-sm">Clique em "Novo Canal" para adicionar o primeiro canal de atendimento.</p>
          </div>
        ) : (
          channels.map(channel => {
            const Icon = CHANNEL_ICONS[channel.tipo] || MessageCircle;
            const color = channel.cor || CHANNEL_COLORS[channel.tipo] || '#6b7280';
            const channelStats = stats[channel.id];

            return (
              <div key={channel.id} className={`card p-4 ${!channel.ativo ? 'opacity-60' : ''}`}>
                <div className="flex items-center gap-4">
                  {/* Channel Icon */}
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl"
                    style={{ backgroundColor: color }}
                  >
                    <Icon size={24} />
                  </div>

                  {/* Channel Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg truncate">{channel.nome}</h3>
                      <span className="badge text-xs" style={{ backgroundColor: `${color}20`, color }}>
                        {channel.tipo}
                      </span>
                      {!channel.ativo && (
                        <span className="badge bg-red-100 text-red-700 text-xs">Inativo</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {channel.provider ? `Provider: ${channel.provider}` : `Slug: ${channel.slug}`}
                      {channel.departamento && ` • Dept: ${channel.departamento.nome}`}
                    </p>
                    {channelStats && (
                      <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                        <span>{channelStats.totalTickets} tickets</span>
                        <span>{channelStats.openTickets} abertos</span>
                        <span>{channelStats.messagesLast24h} msgs/24h</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (showStats === channel.id) {
                          setShowStats(null);
                        } else {
                          setShowStats(channel.id);
                          loadStats(channel.id);
                        }
                      }}
                      className="p-2 rounded-lg hover:bg-muted transition-colors"
                      title="Estatisticas"
                    >
                      <BarChart3 size={18} />
                    </button>

                    <button
                      onClick={() => handleTestConnection(channel)}
                      disabled={testingConnection === channel.id}
                      className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                      title="Testar conexao"
                    >
                      {testingConnection === channel.id ? (
                        <RefreshCw size={18} className="animate-spin" />
                      ) : (
                        <ExternalLink size={18} />
                      )}
                    </button>

                    {isMaster && (
                      <>
                        <button
                          onClick={() => setEditing(channel)}
                          className="p-2 rounded-lg hover:bg-muted transition-colors"
                          title="Editar"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleToggle(channel)}
                          className="p-2 rounded-lg hover:bg-muted transition-colors"
                          title={channel.ativo ? 'Desativar' : 'Ativar'}
                        >
                          {channel.ativo ? <PowerOff size={18} /> : <Power size={18} />}
                        </button>
                        <button
                          onClick={() => handleDelete(channel)}
                          className="p-2 rounded-lg hover:bg-red-100 text-red-600 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={18} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Stats Panel */}
                {showStats === channel.id && channelStats && (
                  <div className="mt-4 pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{channelStats.totalTickets}</div>
                      <div className="text-xs text-muted-foreground">Total Tickets</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">{channelStats.openTickets}</div>
                      <div className="text-xs text-muted-foreground">Tickets Abertos</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">{channelStats.totalMessages}</div>
                      <div className="text-xs text-muted-foreground">Total Mensagens</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{channelStats.messagesLast24h}</div>
                      <div className="text-xs text-muted-foreground">Mensagens/24h</div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Risk Alerts */}
      {channels.some(c => c.riskLogs && c.riskLogs.length > 0) && (
        <div className="card p-4 border-orange-200 bg-orange-50">
          <div className="flex items-center gap-2 text-orange-700 mb-2">
            <AlertTriangle size={18} />
            <h3 className="font-semibold">Alertas de Risco</h3>
          </div>
          {channels
            .filter(c => c.riskLogs && c.riskLogs.length > 0)
            .map(c => (
              <div key={c.id} className="text-sm text-orange-600">
                <strong>{c.nome}:</strong> {c.riskLogs![0].mensagem}
              </div>
            ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {(creating || editing) && isMaster && (
        <ChannelEditor
          channel={editing}
          channelTypes={channelTypes}
          saving={saving}
          onSave={handleSave}
          onClose={() => { setCreating(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

// ── Channel Editor Modal ──────────────────────────────────────────────

interface ChannelEditorProps {
  channel: Channel | null;
  channelTypes: ChannelType[];
  saving: boolean;
  onSave: (data: Partial<Channel>) => void;
  onClose: () => void;
}

function ChannelEditor({ channel, channelTypes, saving, onSave, onClose }: ChannelEditorProps) {
  const [nome, setNome] = useState(channel?.nome || '');
  const [tipo, setTipo] = useState(channel?.tipo || 'whatsapp');
  const [provider, setProvider] = useState(channel?.provider || '');
  const [slug, setSlug] = useState(channel?.slug || '');
  const [departamentoId, setDepartamentoId] = useState(channel?.departamentoId || '');
  const [cor, setCor] = useState(channel?.cor || '');
  const [configValues, setConfigValues] = useState<Record<string, string>>(() => {
    if (channel?.config) {
      try { return JSON.parse(channel.config); } catch { return {}; }
    }
    return {};
  });

  const selectedType = channelTypes.find(t => t.tipo === tipo);

  const updateConfig = (key: string, value: string) => {
    setConfigValues(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Filter out empty values and build config JSON
    const filteredConfig = Object.fromEntries(
      Object.entries(configValues).filter(([_, v]) => v.trim() !== '')
    );
    const configStr = Object.keys(filteredConfig).length > 0 ? JSON.stringify(filteredConfig) : undefined;

    onSave({
      nome,
      tipo,
      provider: provider || undefined,
      slug: slug || undefined,
      departamentoId: departamentoId || undefined,
      cor: cor || undefined,
      config: configStr,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-xl p-5 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">
            {channel ? 'Editar Canal' : 'Novo Canal'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome */}
          <div>
            <label className="block text-sm font-medium mb-1">Nome *</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="input w-full"
              placeholder="Ex: WhatsApp Principal"
              required
            />
          </div>

          {/* Tipo */}
          <div>
            <label className="block text-sm font-medium mb-1">Tipo do Canal *</label>
            <select
              value={tipo}
              onChange={(e) => {
                setTipo(e.target.value);
                setProvider('');
                setConfigValues({});
              }}
              className="input w-full"
            >
              {channelTypes.map(t => (
                <option key={t.tipo} value={t.tipo}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Provider */}
          {selectedType && selectedType.providers.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-1">Provider</label>
              <select
                value={provider}
                onChange={(e) => { setProvider(e.target.value); setConfigValues({}); }}
                className="input w-full"
              >
                <option value="">Selecione o provider</option>
                {selectedType.providers.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          )}

          {/* Slug */}
          <div>
            <label className="block text-sm font-medium mb-1">Slug (URL-friendly)</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="input w-full"
              placeholder="auto-gerado se vazio"
            />
          </div>

          {/* Cor */}
          <div>
            <label className="block text-sm font-medium mb-1">Cor</label>
            <div className="flex gap-2">
              <input
                type="color"
                value={cor || CHANNEL_COLORS[tipo] || '#3b82f6'}
                onChange={(e) => setCor(e.target.value)}
                className="w-10 h-10 rounded cursor-pointer"
              />
              <input
                type="text"
                value={cor}
                onChange={(e) => setCor(e.target.value)}
                className="input flex-1"
                placeholder="#3b82f6"
              />
            </div>
          </div>

          {/* ── Dynamic Config Form by Channel Type ── */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              Configuracoes do Canal
            </h3>
            {tipo === 'whatsapp' && (
              <WhatsAppConfigForm provider={provider} config={configValues} onChange={updateConfig} />
            )}
            {tipo === 'email' && (
              <EmailConfigForm config={configValues} onChange={updateConfig} />
            )}
            {tipo === 'instagram' && (
              <InstagramConfigForm config={configValues} onChange={updateConfig} />
            )}
            {tipo === 'facebook' && (
              <FacebookConfigForm config={configValues} onChange={updateConfig} />
            )}
            {tipo === 'telegram' && (
              <TelegramConfigForm config={configValues} onChange={updateConfig} />
            )}
            {!['whatsapp', 'email', 'instagram', 'facebook', 'telegram'].includes(tipo) && (
              <div>
                <label className="block text-sm font-medium mb-1">Configuracoes (JSON)</label>
                <textarea
                  value={configValues._raw || ''}
                  onChange={(e) => updateConfig('_raw', e.target.value)}
                  className="input w-full h-24 font-mono text-xs"
                  placeholder='{"key": "value"}'
                />
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary flex items-center gap-2"
              disabled={saving || !nome.trim()}
            >
              {saving ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              {channel ? 'Salvar' : 'Criar Canal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── WhatsApp Config Form ───────────────────────────────────────────────

function WhatsAppConfigForm({ provider, config, onChange }: { provider: string; config: Record<string, string>; onChange: (k: string, v: string) => void }) {
  if (provider === 'evolution') {
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">Evolution API — self-hosted via Docker</p>
        <div>
          <label className="block text-xs font-medium mb-1">URL da API *</label>
          <input type="url" value={config.apiUrl || ''} onChange={e => onChange('apiUrl', e.target.value)} className="input w-full text-sm" placeholder="http://localhost:8080" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">API Key *</label>
          <input type="password" value={config.apiKey || ''} onChange={e => onChange('apiKey', e.target.value)} className="input w-full text-sm" placeholder="sua-api-key" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Nome da Instancia</label>
          <input type="text" value={config.instanceName || ''} onChange={e => onChange('instanceName', e.target.value)} className="input w-full text-sm" placeholder="minha-instancia" />
        </div>
      </div>
    );
  }

  if (provider === 'cloud') {
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">WhatsApp Cloud API — oficial Meta</p>
        <div>
          <label className="block text-xs font-medium mb-1">Phone Number ID *</label>
          <input type="text" value={config.phoneNumberId || ''} onChange={e => onChange('phoneNumberId', e.target.value)} className="input w-full text-sm" placeholder="123456789" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Access Token *</label>
          <input type="password" value={config.accessToken || ''} onChange={e => onChange('accessToken', e.target.value)} className="input w-full text-sm" placeholder="EAAx..." />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Webhook Verify Token</label>
          <input type="text" value={config.webhookVerifyToken || ''} onChange={e => onChange('webhookVerifyToken', e.target.value)} className="input w-full text-sm" placeholder="token-de-verificacao" />
        </div>
      </div>
    );
  }

  if (provider === 'baileys') {
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">Baileys — WebSocket direto (sem Chrome)</p>
        <div>
          <label className="block text-xs font-medium mb-1">Nome da Sessao</label>
          <input type="text" value={config.sessionName || ''} onChange={e => onChange('sessionName', e.target.value)} className="input w-full text-sm" placeholder="minha-sessao" />
        </div>
        <p className="text-xs text-muted-foreground">Escaneie o QR Code apos criar o canal para conectar.</p>
      </div>
    );
  }

  return (
    <div className="text-sm text-muted-foreground">
      Selecione um provider para configurar.
    </div>
  );
}

// ── Email Config Form ──────────────────────────────────────────────────

function EmailConfigForm({ config, onChange }: { config: Record<string, string>; onChange: (k: string, v: string) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Email — IMAP (receber) + SMTP (enviar)</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1">Servidor IMAP *</label>
          <input type="text" value={config.imapHost || ''} onChange={e => onChange('imapHost', e.target.value)} className="input w-full text-sm" placeholder="imap.gmail.com" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Porta IMAP</label>
          <input type="number" value={config.imapPort || '993'} onChange={e => onChange('imapPort', e.target.value)} className="input w-full text-sm" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1">Servidor SMTP *</label>
          <input type="text" value={config.smtpHost || ''} onChange={e => onChange('smtpHost', e.target.value)} className="input w-full text-sm" placeholder="smtp.gmail.com" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Porta SMTP</label>
          <input type="number" value={config.smtpPort || '587'} onChange={e => onChange('smtpPort', e.target.value)} className="input w-full text-sm" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">Email / Usuario *</label>
        <input type="email" value={config.user || ''} onChange={e => onChange('user', e.target.value)} className="input w-full text-sm" placeholder="suporte@empresa.com" />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">Senha / App Password *</label>
        <input type="password" value={config.password || ''} onChange={e => onChange('password', e.target.value)} className="input w-full text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1">Nome do Remetente</label>
          <input type="text" value={config.fromName || ''} onChange={e => onChange('fromName', e.target.value)} className="input w-full text-sm" placeholder="Suporte" />
        </div>
        <div className="flex items-end gap-2">
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={config.smtpSecure !== 'false'} onChange={e => onChange('smtpSecure', String(e.target.checked))} className="rounded" />
            TLS/SSL
          </label>
        </div>
      </div>
    </div>
  );
}

// ── Instagram Config Form ──────────────────────────────────────────────

function InstagramConfigForm({ config, onChange }: { config: Record<string, string>; onChange: (k: string, v: string) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Instagram — Graph API (Business Account)</p>
      <div>
        <label className="block text-xs font-medium mb-1">Access Token *</label>
        <input type="password" value={config.accessToken || ''} onChange={e => onChange('accessToken', e.target.value)} className="input w-full text-sm" placeholder="EAAx..." />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">Instagram Account ID *</label>
        <input type="text" value={config.instagramAccountId || ''} onChange={e => onChange('instagramAccountId', e.target.value)} className="input w-full text-sm" placeholder="17841400..." />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">Webhook Verify Token</label>
        <input type="text" value={config.webhookVerifyToken || ''} onChange={e => onChange('webhookVerifyToken', e.target.value)} className="input w-full text-sm" placeholder="token-de-verificacao" />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">App Secret (opcional)</label>
        <input type="password" value={config.appSecret || ''} onChange={e => onChange('appSecret', e.target.value)} className="input w-full text-sm" />
      </div>
    </div>
  );
}

// ── Facebook Config Form ───────────────────────────────────────────────

function FacebookConfigForm({ config, onChange }: { config: Record<string, string>; onChange: (k: string, v: string) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Facebook Messenger — Graph API</p>
      <div>
        <label className="block text-xs font-medium mb-1">Page Access Token *</label>
        <input type="password" value={config.pageAccessToken || ''} onChange={e => onChange('pageAccessToken', e.target.value)} className="input w-full text-sm" placeholder="EAAx..." />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">Page ID *</label>
        <input type="text" value={config.pageId || ''} onChange={e => onChange('pageId', e.target.value)} className="input w-full text-sm" placeholder="123456789" />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">App Secret *</label>
        <input type="password" value={config.appSecret || ''} onChange={e => onChange('appSecret', e.target.value)} className="input w-full text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">Verify Token</label>
        <input type="text" value={config.verifyToken || ''} onChange={e => onChange('verifyToken', e.target.value)} className="input w-full text-sm" placeholder="token-de-verificacao" />
      </div>
    </div>
  );
}

// ── Telegram Config Form ───────────────────────────────────────────────

function TelegramConfigForm({ config, onChange }: { config: Record<string, string>; onChange: (k: string, v: string) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Telegram — Bot API oficial</p>
      <div>
        <label className="block text-xs font-medium mb-1">Bot Token *</label>
        <input type="password" value={config.botToken || ''} onChange={e => onChange('botToken', e.target.value)} className="input w-full text-sm" placeholder="123456:ABC-DEF..." />
        <p className="text-xs text-muted-foreground mt-1">Obtenha com @BotFather no Telegram</p>
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">Webhook URL (opcional)</label>
        <input type="url" value={config.webhookUrl || ''} onChange={e => onChange('webhookUrl', e.target.value)} className="input w-full text-sm" placeholder="https://seudominio.com/api/telegram/webhook/..." />
        <p className="text-xs text-muted-foreground mt-1">Deixe vazio para configurar depois</p>
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">Chat IDs permitidos (opcional)</label>
        <input type="text" value={config.allowedChatIds || ''} onChange={e => onChange('allowedChatIds', e.target.value)} className="input w-full text-sm" placeholder="123456789,987654321" />
        <p className="text-xs text-muted-foreground mt-1">Separados por virgula. Vazio = todos os chats</p>
      </div>
    </div>
  );
}
