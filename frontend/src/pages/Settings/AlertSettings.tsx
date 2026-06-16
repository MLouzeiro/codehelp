import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useAuth } from '../../services/auth';
import { playSound, SOUND_LABELS } from '../../services/soundAlerts';
import {
  Bell, Volume2, VolumeX, Save, Check, AlertCircle,
  Settings, Palette, Loader,
} from 'lucide-react';

interface AlertConfig {
  tipo: string;
  habilitado: boolean;
  comSom: boolean;
  cor: string;
  prioridade: 'baixa' | 'media' | 'alta' | 'critica';
}

const ALERT_LABELS: Record<string, string> = {
  novo_ticket: 'Novo Ticket',
  ticket_atribuido: 'Ticket Atribuído',
  sla_alerta_75: 'SLA 75% Consumido',
  sla_alerta_90: 'SLA 90% Consumido',
  sla_violado: 'SLA Violado',
  cliente_resposta: 'Resposta do Cliente',
  ticket_escalacao: 'Escalação de Ticket',
  csat_recebido: 'CSAT Recebido',
  aprovacao_pendente: 'Aprovação Pendente',
};

const ALERT_ICONS: Record<string, string> = {
  novo_ticket: '🎫',
  ticket_atribuido: '👤',
  sla_alerta_75: '⚠️',
  sla_alerta_90: '🔶',
  sla_violado: '🔴',
  cliente_resposta: '💬',
  ticket_escalacao: '📈',
  csat_recebido: '⭐',
  aprovacao_pendente: '🛡️',
};

const PRIORIDADE_LABELS: Record<string, { label: string; color: string }> = {
  baixa: { label: 'Baixa', color: 'text-slate-500 bg-slate-100 dark:bg-slate-700' },
  media: { label: 'Média', color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30' },
  alta: { label: 'Alta', color: 'text-orange-600 bg-orange-100 dark:bg-orange-900/30' },
  critica: { label: 'Crítica', color: 'text-red-600 bg-red-100 dark:bg-red-900/30' },
};

const COR_OPTIONS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#0ea5e9', '#6366f1', '#14b8a6', '#f97316',
];

export default function AlertSettings() {
  const { user } = useAuth();
  const [configs, setConfigs] = useState<AlertConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [testSound, setTestSound] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    carregarConfigs();
  }, []);

  const carregarConfigs = async () => {
    try {
      const { data } = await api.get('/alerts/agent/config');
      if (Array.isArray(data) && data.length > 0) {
        setConfigs(data);
      }
    } catch (err) {
      console.error('[AlertSettings] Erro ao carregar:', err);
    } finally {
      setLoading(false);
    }
  };

  const salvarConfigs = useCallback(async (novosConfigs: AlertConfig[]) => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.post('/alerts/agent/config', { configs: novosConfigs });
      setSuccess('Salvo com sucesso');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) {
      console.error('[AlertSettings] Erro ao salvar:', err);
      setError(err.response?.data?.error || 'Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  }, []);

  const toggleAlert = async (tipo: string, field: 'habilitado' | 'comSom') => {
    const novosConfigs = configs.map(c =>
      c.tipo === tipo ? { ...c, [field]: !c[field] } : c
    );
    setConfigs(novosConfigs);
    await salvarConfigs(novosConfigs);
  };

  const setCor = async (tipo: string, cor: string) => {
    const novosConfigs = configs.map(c =>
      c.tipo === tipo ? { ...c, cor } : c
    );
    setConfigs(novosConfigs);
    await salvarConfigs(novosConfigs);
  };

  const setPrioridade = async (tipo: string, prioridade: AlertConfig['prioridade']) => {
    const novosConfigs = configs.map(c =>
      c.tipo === tipo ? { ...c, prioridade } : c
    );
    setConfigs(novosConfigs);
    await salvarConfigs(novosConfigs);
  };

  const testarSom = async (tipo: string) => {
    setTestSound(tipo);
    await playSound('nova_mensagem', true);
    setTimeout(() => setTestSound(null), 1500);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <span className="text-sm text-slate-500" style={{ fontFamily: 'Lexend, sans-serif' }}>Carregando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>
            Configuração de Alertas
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1" style={{ fontFamily: 'Lexend, sans-serif' }}>
            Configure notificações e sons para cada tipo de alerta
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saving && <Loader size={16} className="animate-spin text-blue-500" />}
          {success && (
            <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
              <Check size={16} /> Salvo
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400">
          <AlertCircle size={18} />
          <span className="text-sm" style={{ fontFamily: 'Lexend, sans-serif' }}>{error}</span>
        </div>
      )}

      <div className="space-y-3">
        {configs.map((config) => {
          const priorInfo = PRIORIDADE_LABELS[config.prioridade];
          const isExpanded = expanded === config.tipo;
          return (
            <div
              key={config.tipo}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden"
            >
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
                onClick={() => setExpanded(isExpanded ? null : config.tipo)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{ALERT_ICONS[config.tipo] || '🔔'}</span>
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: config.cor }}
                  />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Lexend, sans-serif' }}>
                      {ALERT_LABELS[config.tipo] || config.tipo}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${priorInfo.color}`} style={{ fontFamily: 'Lexend, sans-serif' }}>
                        {priorInfo.label}
                      </span>
                      {config.habilitado && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
                          Ativo
                        </span>
                      )}
                      {config.comSom && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
                          🔊 Som
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => testarSom(config.tipo)}
                    className="p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg"
                    title="Testar som"
                  >
                    {testSound === config.tipo ? (
                      <Volume2 size={16} className="text-blue-600 animate-pulse" />
                    ) : (
                      <VolumeX size={16} />
                    )}
                  </button>

                  <button
                    onClick={() => toggleAlert(config.tipo, 'comSom')}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      config.comSom ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'
                    }`}
                    title={config.comSom ? 'Som ativado' : 'Som desativado'}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      config.comSom ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>

                  <button
                    onClick={() => toggleAlert(config.tipo, 'habilitado')}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      config.habilitado ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-600'
                    }`}
                    title={config.habilitado ? 'Alerta ativado' : 'Alerta desativado'}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      config.habilitado ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-700 pt-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <Palette size={14} className="text-slate-400" />
                      <span className="text-xs text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>Cor:</span>
                    </div>
                    {COR_OPTIONS.map((cor) => (
                      <button
                        key={cor}
                        onClick={() => setCor(config.tipo, cor)}
                        className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                          config.cor === cor ? 'border-slate-800 dark:border-slate-200 scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: cor }}
                      />
                    ))}

                    <div className="ml-2 flex items-center gap-1.5">
                      <span className="text-xs text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>Prioridade:</span>
                      {(Object.keys(PRIORIDADE_LABELS) as Array<AlertConfig['prioridade']>).map((p) => (
                        <button
                          key={p}
                          onClick={() => setPrioridade(config.tipo, p)}
                          className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                            config.prioridade === p
                              ? PRIORIDADE_LABELS[p].color + ' font-semibold'
                              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                          }`}
                          style={{ fontFamily: 'Lexend, sans-serif' }}
                        >
                          {PRIORIDADE_LABELS[p].label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2 mb-2">
          <Settings size={16} className="text-slate-400" />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300" style={{ fontFamily: 'Lexend, sans-serif' }}>
            Legenda
          </span>
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
          <span className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full bg-emerald-600" /> Habilitado
          </span>
          <span className="flex items-center gap-1.5">
            <Volume2 size={14} /> Com som
          </span>
          <span className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-slate-300" /> Cor do badge
          </span>
        </div>
        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2" style={{ fontFamily: 'Lexend, sans-serif' }}>
          Todas as alterações são salvas automaticamente ao clicar nos controles.
        </p>
      </div>
    </div>
  );
}
