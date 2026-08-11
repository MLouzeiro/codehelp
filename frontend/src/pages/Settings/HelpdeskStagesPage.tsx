import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Edit2, Power, PowerOff, GripVertical, Save, X, RefreshCw,
  Inbox, CheckCircle, MessageSquare, Sparkles,
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../services/auth';

interface Stage {
  id: string;
  slug: string;
  nome: string;
  descricao: string | null;
  cor: string;
  icone: string;
  ordem: number;
  etapaInicial: boolean;
  autoMessage: string | null;
  enviarAuto: boolean;
  notificarEquipe: boolean;
  ativo: boolean;
}

const ICONES_OPCOES = [
  { value: 'inbox', label: 'Caixa de entrada' },
  { value: 'headphones', label: 'Atendimento' },
  { value: 'clock', label: 'Relógio' },
  { value: 'file-text', label: 'Documento' },
  { value: 'check-circle', label: 'Concluído' },
  { value: 'x-circle', label: 'Descartado' },
  { value: 'bot', label: 'Robô' },
  { value: 'arrow-up-circle', label: 'Escalonado' },
  { value: 'archive', label: 'Arquivo' },
  { value: 'message-square', label: 'Mensagem' },
  { value: 'star', label: 'Estrela' },
];

const CORES_OPCOES = [
  '#f59e0b', '#10b981', '#0ea5e9', '#ec4899',
  '#64748b', '#71717a', '#ef4444', '#3b82f6',
  '#22c55e', '#a855f7', '#f97316', '#06b6d4',
];

const VARIAVEIS = [
  '{{nome_contato}}',
  '{{empresa}}',
  '{{saudacao}}',
  '{{numero_protocolo}}',
  '{{tecnico}}',
  '{{data}}',
  '{{hora}}',
];

const ICONES_MAP: Record<string, any> = {
  inbox: Inbox, headphones: CheckCircle, clock: Inbox, 'file-text': Inbox,
  'check-circle': CheckCircle, 'x-circle': PowerOff, bot: Sparkles,
  'arrow-up-circle': Inbox, archive: Inbox, 'message-square': MessageSquare, star: Sparkles,
};

function IconePreview({ name, cor }: { name: string; cor: string }) {
  const I = ICONES_MAP[name] || Inbox;
  return (
    <div className="w-6 h-6 rounded flex items-center justify-center text-white flex-shrink-0" style={{ backgroundColor: cor }}>
      <I size={12} />
    </div>
  );
}

export default function HelpdeskStagesPage() {
  const { user } = useAuth();
  const isMaster = user?.isMaster || user?.role === 'admin';
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Stage | null>(null);
  const [creating, setCreating] = useState(false);
  const [showInativas, setShowInativas] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/helpdesk/stages?includeInativas=${showInativas}`);
      setStages(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [showInativas]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(t);
  }, [feedback]);

  const handleReorder = async (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const fromIdx = stages.findIndex((s) => s.id === fromId);
    const toIdx = stages.findIndex((s) => s.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const nova = [...stages];
    const [moved] = nova.splice(fromIdx, 1);
    nova.splice(toIdx, 0, moved);
    setStages(nova);
    try {
      await api.patch('/helpdesk/stages/reorder', { stageIds: nova.map((s) => s.id) });
      setFeedback({ type: 'ok', msg: 'Ordem atualizada' });
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err?.response?.data?.error || 'Erro ao reordenar' });
      load();
    }
  };

  const handleToggleAtivo = async (stage: Stage) => {
    if (stage.etapaInicial) {
      setFeedback({ type: 'err', msg: 'A etapa inicial nao pode ser desativada.' });
      return;
    }
    try {
      if (stage.ativo) {
        await api.delete(`/helpdesk/stages/${stage.id}`);
        setFeedback({ type: 'ok', msg: `Etapa "${stage.nome}" desativada` });
      } else {
        await api.post(`/helpdesk/stages/${stage.id}/restore`);
        setFeedback({ type: 'ok', msg: `Etapa "${stage.nome}" reativada` });
      }
      load();
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err?.response?.data?.error || 'Erro' });
    }
  };

  const handleSave = async (data: Partial<Stage>) => {
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/helpdesk/stages/${editing.id}`, data);
        setFeedback({ type: 'ok', msg: 'Etapa atualizada' });
      } else {
        const response = await api.post('/helpdesk/stages', data);
        console.log('[Stages] Etapa criada:', response.data);
        setFeedback({ type: 'ok', msg: 'Etapa criada com sucesso' });
      }
      setEditing(null);
      setCreating(false);
      load();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Erro ao salvar';
      const field = err?.response?.data?.field;
      console.error('[Stages] Erro ao salvar:', { msg, field, status: err?.response?.status, data: err?.response?.data });
      setFeedback({ type: 'err', msg: field ? `${field}: ${msg}` : msg });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><RefreshCw className="animate-spin text-blue-600 dark:text-blue-400" size={32} /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <Inbox className="text-emerald-600" size={24} /> Etapas do Helpdesk
          </h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm">
            {stages.length} etapa(s) {showInativas && '(incluindo inativas)'} • Apenas administradores master podem criar, renomear ou desativar
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowInativas(!showInativas)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${showInativas ? 'bg-amber-100 text-amber-700' : 'bg-neutral-100 dark:bg-slate-800 text-neutral-600 dark:text-slate-300'}`}>
            {showInativas ? 'Mostrando inativas' : 'Mostrar inativas'}
          </button>
          {isMaster && (
            <button onClick={() => { setCreating(true); setEditing(null); }}
              className="btn-primary text-sm flex items-center gap-1.5">
              <Plus size={14} /> Nova etapa
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div className={`text-sm px-3 py-2 rounded-lg ${feedback.type === 'ok' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700' : 'bg-red-50 dark:bg-red-900/30 text-red-700'}`}>
          {feedback.msg}
        </div>
      )}

      <div className="space-y-2">
        {stages.length === 0 && (
          <p className="text-center text-neutral-400 dark:text-slate-500 py-8 text-sm">Nenhuma etapa cadastrada.</p>
        )}
        {stages.map((stage) => (
          <div
            key={stage.id}
            draggable={isMaster}
            onDragStart={() => setDragId(stage.id)}
            onDragEnd={() => setDragId(null)}
            onDragOver={(e) => { e.preventDefault(); }}
            onDrop={(e) => { e.preventDefault(); if (dragId) handleReorder(dragId, stage.id); }}
            className={`card flex items-center gap-3 p-3 transition-all ${dragId === stage.id ? 'opacity-50' : ''} ${!stage.ativo ? 'opacity-60' : ''}`}
          >
            {isMaster && <GripVertical size={14} className="text-neutral-400 dark:text-slate-500 cursor-grab" />}
            <IconePreview name={stage.icone} cor={stage.cor} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-navy-900 dark:text-slate-100 truncate">{stage.nome}</h3>
                <code className="text-[10px] text-neutral-500 dark:text-slate-400 bg-neutral-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono">{stage.slug}</code>
                {stage.etapaInicial && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded uppercase">Inicial</span>
                )}
                {stage.enviarAuto && (
                  <span className="text-[10px] text-blue-700 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded font-medium">Auto</span>
                )}
                {!stage.ativo && (
                  <span className="text-[10px] text-neutral-500 dark:text-slate-400 bg-neutral-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-medium uppercase">Inativa</span>
                )}
              </div>
              {stage.descricao && <p className="text-xs text-neutral-500 dark:text-slate-400 truncate mt-0.5">{stage.descricao}</p>}
            </div>
            {isMaster && (
              <div className="flex items-center gap-1">
                <button onClick={() => { setEditing(stage); setCreating(false); }} className="p-1.5 hover:bg-neutral-100 dark:hover:bg-slate-700 rounded text-neutral-600 dark:text-slate-300" title="Editar">
                  <Edit2 size={14} />
                </button>
                <button onClick={() => handleToggleAtivo(stage)} className="p-1.5 hover:bg-neutral-100 dark:hover:bg-slate-700 rounded text-neutral-600 dark:text-slate-300" title={stage.ativo ? 'Desativar' : 'Reativar'}>
                  {stage.ativo ? <PowerOff size={14} className="text-red-500" /> : <Power size={14} className="text-emerald-500" />}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {(editing || creating) && isMaster && (
        <StageEditor
          stage={editing}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </div>
  );
}

interface EditorProps {
  stage: Stage | null;
  onClose: () => void;
  onSave: (data: Partial<Stage>) => Promise<void>;
  saving: boolean;
}

function StageEditor({ stage, onClose, onSave, saving }: EditorProps) {
  const isNew = !stage;
  const [form, setForm] = useState<Partial<Stage>>(
    stage || {
      slug: '',
      nome: '',
      descricao: '',
      cor: '#3b82f6',
      icone: 'inbox',
      etapaInicial: false,
      autoMessage: '',
      enviarAuto: false,
      notificarEquipe: false,
    }
  );

  const previewMessage = (form.autoMessage || '').replace(/\{\{(\w+)\}\}/g, (_, k) => {
    const samples: Record<string, string> = {
      nome_contato: 'João da Silva',
      empresa: 'Lab São Lucas',
      saudacao: 'Bom dia',
      numero_protocolo: '#ABC-2026-0042',
      tecnico: 'Maria Técnica',
      data: new Date().toLocaleDateString('pt-BR'),
      hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };
    return samples[k] || `{{${k}}}`;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-xl p-5 w-full max-w-2xl my-8 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-navy-900 dark:text-slate-100">{isNew ? 'Nova Etapa' : `Editar "${stage!.nome}"`}</h3>
          <button onClick={onClose} className="text-neutral-400 dark:text-slate-500 hover:text-neutral-600"><X size={18} /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-neutral-700 dark:text-slate-200 block mb-1">Slug (kebab-case) *</label>
            <input
              type="text"
              value={form.slug || ''}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              disabled={!isNew}
              placeholder="em-analise"
              className="w-full text-sm border border-neutral-200 dark:border-slate-700 rounded-lg px-3 py-2 disabled:bg-neutral-50 disabled:text-neutral-500 font-mono"
            />
            <p className="text-[10px] text-neutral-400 dark:text-slate-500 mt-0.5">Identificador interno. Nao pode ser alterado depois.</p>
          </div>
          <div>
            <label className="text-xs font-medium text-neutral-700 dark:text-slate-200 block mb-1">Nome exibido *</label>
            <input type="text" value={form.nome || ''} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="w-full text-sm border border-neutral-200 dark:border-slate-700 rounded-lg px-3 py-2" />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-neutral-700 dark:text-slate-200 block mb-1">Descricao</label>
          <input type="text" value={form.descricao || ''} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className="w-full text-sm border border-neutral-200 dark:border-slate-700 rounded-lg px-3 py-2" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-neutral-700 dark:text-slate-200 block mb-1">Cor</label>
            <div className="flex flex-wrap gap-1.5">
              {CORES_OPCOES.map((c) => (
                <button key={c} type="button" onClick={() => setForm({ ...form, cor: c })}
                  className={`w-7 h-7 rounded border-2 ${form.cor === c ? 'border-gray-900' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-neutral-700 dark:text-slate-200 block mb-1">Icone</label>
            <select value={form.icone} onChange={(e) => setForm({ ...form, icone: e.target.value })} className="w-full text-sm border border-neutral-200 dark:border-slate-700 rounded-lg px-3 py-2">
              {ICONES_OPCOES.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 text-xs text-neutral-700 dark:text-slate-200">
            <input type="checkbox" checked={form.etapaInicial || false} onChange={(e) => setForm({ ...form, etapaInicial: e.target.checked })} />
            <span>Marcar como etapa inicial (novos tickets entram aqui)</span>
          </label>
        </div>

        <div>
          <label className="text-xs font-medium text-neutral-700 dark:text-slate-200 block mb-1">Mensagem automatica (template)</label>
          <textarea
            value={form.autoMessage || ''}
            onChange={(e) => setForm({ ...form, autoMessage: e.target.value })}
            rows={4}
            placeholder="Ola {{nome_contato}}! Recebemos sua solicitacao..."
            className="w-full text-xs border border-neutral-200 dark:border-slate-700 rounded-lg px-3 py-2 font-mono"
          />
          <div className="mt-1.5 flex flex-wrap gap-1">
            {VARIAVEIS.map((v) => (
              <button key={v} type="button" onClick={() => setForm({ ...form, autoMessage: (form.autoMessage || '') + v })}
                className="text-[10px] text-blue-700 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded font-mono hover:bg-blue-100">
                {v}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center gap-2 text-xs text-neutral-700 dark:text-slate-200">
            <input type="checkbox" checked={form.enviarAuto || false} onChange={(e) => setForm({ ...form, enviarAuto: e.target.checked })} />
            <span>Enviar mensagem automatica ao mover</span>
          </label>
          <label className="flex items-center gap-2 text-xs text-neutral-700 dark:text-slate-200">
            <input type="checkbox" checked={form.notificarEquipe || false} onChange={(e) => setForm({ ...form, notificarEquipe: e.target.checked })} />
            <span>Notificar equipe</span>
          </label>
        </div>

        {form.autoMessage && (
          <details className="text-xs">
            <summary className="cursor-pointer text-neutral-500 dark:text-slate-400 font-medium">Preview da mensagem</summary>
            <div className="mt-2 p-2 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 rounded text-emerald-900 whitespace-pre-wrap text-[11px]">
              {previewMessage}
            </div>
          </details>
        )}

        <div className="flex gap-2 pt-3 border-t">
          <button onClick={onClose} disabled={saving} className="flex-1 px-4 py-2 text-sm border border-neutral-200 dark:border-slate-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-slate-700 disabled:opacity-50">Cancelar</button>
          <button onClick={() => onSave(form)} disabled={saving || !form.nome?.trim() || !form.slug?.trim()}
            className="flex-1 px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-1.5">
            <Save size={14} /> {saving ? 'Salvando...' : isNew ? 'Criar etapa' : 'Salvar alteracoes'}
          </button>
        </div>
      </div>
    </div>
  );
}
