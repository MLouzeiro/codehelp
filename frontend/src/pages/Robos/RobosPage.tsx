import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import {
  Bot, Brain, TrendingUp, MessageSquare, FileText, CheckCircle,
  RefreshCw, ChevronRight, Zap, Sparkles, AlertTriangle, Settings2,
  Clock, Power, Save, X, Plus, Trash2, ChevronDown,
  Tag, User, MessageCircle, ClipboardList, Globe,
  ArrowRight, Filter, Play, ToggleRight,
} from 'lucide-react';

const TRIGGER_OPTIONS = [
  { value: 'new_ticket', label: 'Novo Ticket', icon: MessageSquare, desc: 'Quando um ticket é aberto' },
  { value: 'new_message', label: 'Nova Mensagem', icon: MessageCircle, desc: 'Quando chega mensagem no WhatsApp' },
  { value: 'new_client', label: 'Novo Cliente', icon: User, desc: 'Quando um cliente é cadastrado' },
  { value: 'os_updated', label: 'OS Atualizada', icon: FileText, desc: 'Quando uma OS muda de status' },
  { value: 'task_overdue', label: 'Tarefa Atrasada', icon: ClipboardList, desc: 'Quando tarefa vence ou está próxima' },
  { value: 'contact_30days', label: 'Sem Contato 30d', icon: Clock, desc: 'Cliente sem interação há 30+ dias' },
];

const CONDITION_OPERATORS = [
  { value: 'equals', label: 'Igual' },
  { value: 'not_equals', label: 'Diferente' },
  { value: 'contains', label: 'Contém' },
  { value: 'in', label: 'Está em' },
  { value: 'greater_than', label: 'Maior que' },
  { value: 'less_than', label: 'Menor que' },
];

const CONDITION_FIELDS = [
  { value: 'ticket.categoria', label: 'Categoria do Ticket' },
  { value: 'ticket.status', label: 'Status do Ticket' },
  { value: 'client.segmento', label: 'Segmento do Cliente' },
  { value: 'client.status', label: 'Status do Cliente' },
  { value: 'client.cidade', label: 'Cidade' },
  { value: 'client.estado', label: 'Estado' },
  { value: 'os.status', label: 'Status da OS' },
  { value: 'os.tipoServico', label: 'Tipo de Serviço' },
  { value: 'task.prioridade', label: 'Prioridade da Tarefa' },
  { value: 'task.status', label: 'Status da Tarefa' },
];

const ACTION_TYPES = [
  { value: 'assign_user', label: 'Atribuir a usuário', icon: User },
  { value: 'change_status', label: 'Alterar status', icon: ToggleRight },
  { value: 'change_priority', label: 'Alterar prioridade', icon: Zap },
  { value: 'send_message', label: 'Enviar mensagem automática', icon: MessageCircle },
  { value: 'create_task', label: 'Criar tarefa', icon: ClipboardList },
  { value: 'add_tag', label: 'Adicionar tag', icon: Tag },
  { value: 'send_webhook', label: 'Enviar webhook', icon: Globe },
];

const VARIAVEIS_MENSAGEM = [
  { value: '{{nome_contato}}', label: 'Nome do Contato' },
  { value: '{{empresa}}', label: 'Empresa' },
  { value: '{{saudacao}}', label: 'Saudação (Bom dia/tarde/noite)' },
  { value: '{{numero_protocolo}}', label: 'Nº Protocolo' },
  { value: '{{categoria}}', label: 'Categoria do Ticket' },
  { value: '{{tecnico}}', label: 'Técnico Responsável' },
  { value: '{{data}}', label: 'Data Atual' },
  { value: '{{hora}}', label: 'Hora Atual' },
];

/* -------- Types -------- */
interface Robot {
  id: string; slug: string; nome: string; descricao: string; icone: string;
  ativo: boolean; inteligente: boolean; ordem: number;
  horarioAtivo: boolean; diasSemana: string; horaInicio: string; horaFim: string;
  fusoHorario: string; config: string; rules: Rule[];
}

interface Trigger { type: string; schedule?: string }
interface Condition { field: string; operator: string; value: string }
interface Action { type: string; params: Record<string, string> }

interface Rule {
  id: string; robotId: string; nome: string; descricao: string | null;
  ativo: boolean; ordem: number;
  trigger: Trigger; conditions: Condition[]; actions: Action[];
  logicOperator: string;
}

/* -------- Helpers -------- */
function parseTrigger(v: string): Trigger { try { return JSON.parse(v); } catch { return { type: v || 'new_ticket' } } }
function parseConditions(v: string): Condition[] { try { return JSON.parse(v); } catch { return [] } }
function parseActions(v: string): Action[] { try { return JSON.parse(v); } catch { return [] } }

/* -------- Page -------- */
export default function RobosPage() {
  const [robos, setRobos] = useState<Robot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRobot, setSelectedRobot] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('vendas');
  const [vendasData, setVendasData] = useState<any>(null);
  const [osAlerts, setOsAlerts] = useState<any[]>([]);
  const [tarefasSugestoes, setTarefasSugestoes] = useState<any[]>([]);
  const [running, setRunning] = useState(false);
  const [showNewRobot, setShowNewRobot] = useState(false);
  const [newRobotName, setNewRobotName] = useState('');
  const [newRobotDesc, setNewRobotDesc] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/ai/status');
      setRobos(data.robos);
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const loadVendas = async () => { try { const { data } = await api.get('/ai/sugestoes-vendas'); setVendasData(data); } catch { } };
  const loadOs = async () => { try { const { data } = await api.get('/ai/os-alerts'); setOsAlerts(data.alerts || []); } catch { } };
  const loadTarefas = async () => { try { const { data } = await api.get('/ai/sugestoes-tarefas'); setTarefasSugestoes(data.sugestoes || []); } catch { } };
  const runClassifier = async () => { setRunning(true); try { const { data } = await api.post('/ai/classificar-tickets'); alert(`${data.classificados} tickets classificados!`); } catch { } finally { setRunning(false); } };

  useEffect(() => {
    if (activeTab === 'vendas') loadVendas();
    if (activeTab === 'os') loadOs();
    if (activeTab === 'tarefas') loadTarefas();
  }, [activeTab]);

  const tabs = [
    { id: 'vendas', label: 'Vendas', icon: TrendingUp },
    { id: 'classificador', label: 'Classificador', icon: MessageSquare },
    { id: 'os', label: 'OS', icon: FileText },
    { id: 'tarefas', label: 'Tarefas', icon: CheckCircle },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    );
  }

  const createRobot = async () => {
    if (!newRobotName.trim()) return;
    try {
      await api.post('/ai/robos', { nome: newRobotName.trim(), descricao: newRobotDesc.trim() });
      setShowNewRobot(false);
      setNewRobotName('');
      setNewRobotDesc('');
      loadAll();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Erro ao criar robô');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 dark:text-slate-100">Robôs Inteligentes</h1>
          <p className="text-neutral-500 dark:text-slate-400">Crie regras de automação com gatilhos, condições e ações</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowNewRobot(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-all text-sm shadow-sm">
            <Plus size={14} /> Novo Robô
          </button>
          <button onClick={loadAll} className="btn-secondary text-sm flex items-center gap-2">
            <RefreshCw size={14} /> Atualizar
          </button>
        </div>
      </div>

      {showNewRobot && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-emerald-200 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-navy-900 dark:text-slate-100 mb-3">Criar Novo Robô</h3>
          <div className="flex items-start gap-3">
            <div className="flex-1 space-y-2">
              <input value={newRobotName} onChange={(e) => setNewRobotName(e.target.value)}
                className="w-full text-sm border border-neutral-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-400/40 outline-none"
                placeholder="Nome do robô (ex: Meu Robô Personalizado)" />
              <input value={newRobotDesc} onChange={(e) => setNewRobotDesc(e.target.value)}
                className="w-full text-sm border border-neutral-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-400/40 outline-none"
                placeholder="Descrição (opcional)" />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button onClick={createRobot}
                className="px-4 py-2 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-all text-sm">
                Criar
              </button>
              <button onClick={() => setShowNewRobot(false)}
                className="px-4 py-2 bg-neutral-100 dark:bg-slate-800 text-neutral-600 dark:text-slate-300 font-semibold rounded-lg hover:bg-neutral-200 transition-all text-sm">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {robos.map((robo) => (
          <div key={robo.id}
            className={`bg-white dark:bg-slate-800 rounded-xl border transition-all relative group
              ${robo.ativo ? 'border-neutral-100 dark:border-slate-700/50' : 'border-neutral-200 dark:border-slate-700 opacity-60'}
              ${selectedRobot === robo.id ? 'ring-2 ring-emerald-300 shadow-md' : 'hover:shadow-md'}`}>
            <div className="p-5 cursor-pointer" onClick={() => setSelectedRobot(selectedRobot === robo.id ? null : robo.id)}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${robo.inteligente ? 'bg-emerald-100 text-emerald-700' : 'bg-navy-50 text-navy-600'}`}>
                  {robo.inteligente ? <Brain size={20} /> : <Bot size={20} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-navy-900 dark:text-slate-100 truncate">{robo.nome}</h3>
                    <button onClick={(e) => { e.stopPropagation(); if (confirm(`Excluir "${robo.nome}"?`)) { api.delete(`/ai/robos/${robo.id}`).then(loadAll).catch(() => alert('Erro ao excluir')); } }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-neutral-400 dark:text-slate-500 hover:text-red-500 transition-all flex-shrink-0 ml-2">
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <p className="text-xs text-neutral-400 dark:text-slate-500 truncate">{robo.descricao}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${robo.ativo ? 'bg-emerald-500' : 'bg-neutral-300'}`} />
                <span className="text-xs text-neutral-500 dark:text-slate-400">{robo.ativo ? 'Ativo' : 'Inativo'}</span>
                {robo.inteligente && (
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                    <Sparkles size={10} /> IA
                  </span>
                )}
                {robo.horarioAtivo && robo.ativo && (
                  <span className="text-[10px] font-semibold text-amber-600 bg-amber-400/10 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                    <Clock size={10} /> {robo.horaInicio}-{robo.horaFim}
                  </span>
                )}
                <span className="ml-auto text-[10px] text-neutral-400 dark:text-slate-500 font-medium">
                  {robo.rules?.length || 0} regras
                </span>
              </div>
            </div>
            {selectedRobot === robo.id && (
              <RobotRulesEditor robot={robo} onUpdate={loadAll} />
            )}
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-neutral-100 dark:border-slate-700/50 shadow-sm">
        <div className="flex border-b border-neutral-100 dark:border-slate-700/50 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors border-b-2 flex-shrink-0 ${activeTab === tab.id ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-neutral-500 dark:text-slate-400 hover:text-neutral-700'}`}>
                <Icon size={16} /> {tab.label}
              </button>
            );
          })}
        </div>
        <div className="p-6">
          {activeTab === 'vendas' && <VendasPanel data={vendasData} onRefresh={loadVendas} />}
          {activeTab === 'classificador' && <ClassificadorPanel onRun={runClassifier} running={running} />}
          {activeTab === 'os' && <OsAlertsPanel alerts={osAlerts} onRefresh={loadOs} />}
          {activeTab === 'tarefas' && <TarefasPanel sugestoes={tarefasSugestoes} onRefresh={loadTarefas} />}
        </div>
      </div>
    </div>
  );
}

/* -------- Editor de Regras -------- */
function RobotRulesEditor({ robot, onUpdate }: { robot: Robot; onUpdate: () => void }) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRules(robot.rules.map((r: any) => ({
      ...r,
      trigger: parseTrigger((r as any).trigger),
      conditions: parseConditions((r as any).conditions),
      actions: parseActions((r as any).actions),
    })));
  }, [robot.rules]);

  const createRule = async () => {
    try {
      const { data } = await api.post(`/ai/robos/${robot.id}/rules`, {
        nome: 'Nova Regra',
        trigger: { type: 'new_ticket' },
        conditions: [],
        actions: [],
      });
      setRules((prev) => [...prev, { ...data, trigger: { type: 'new_ticket' }, conditions: [], actions: [] }]);
      setEditingRuleId(data.id);
      onUpdate();
    } catch {
      alert('Erro ao criar regra. Verifique se o servidor backend está rodando.');
    }
  };

  const saveRule = async (rule: Rule) => {
    setSaving(true);
    try {
      await api.patch(`/ai/rules/${rule.id}`, {
        nome: rule.nome, ativo: rule.ativo, trigger: rule.trigger,
        conditions: rule.conditions, actions: rule.actions, logicOperator: rule.logicOperator,
      });
      setEditingRuleId(null);
      onUpdate();
    } catch { } finally { setSaving(false); }
  };

  const deleteRule = async (id: string) => {
    try { await api.delete(`/ai/rules/${id}`); setRules((prev) => prev.filter((r) => r.id !== id)); onUpdate(); } catch { }
  };

  const editingRule = rules.find((r) => r.id === editingRuleId);

  return (
    <div className="border-t border-neutral-100 dark:border-slate-700/50">
      <div className="p-4 bg-neutral-50 dark:bg-slate-900/50 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-navy-900 dark:text-slate-100 flex items-center gap-1.5">
            <Filter size={14} /> Regras de Automação
          </h4>
          <button onClick={createRule}
            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-all text-xs">
            <Plus size={12} /> Nova Regra
          </button>
        </div>

        {rules.length === 0 && (
          <p className="text-xs text-neutral-400 dark:text-slate-500 text-center py-4">
            Nenhuma regra ainda. Clique em "Nova Regra" para criar.
          </p>
        )}

        <div className="space-y-2">
          {rules.sort((a, b) => a.ordem - b.ordem).map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              onEdit={() => setEditingRuleId(editingRuleId === rule.id ? null : rule.id)}
              onDelete={() => deleteRule(rule.id)}
              onUpdate={(updates) => setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, ...updates } : r))}
            />
          ))}
        </div>
      </div>

      {/* Modal de edição em tela cheia */}
      {editingRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setEditingRuleId(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-[95vw] max-w-5xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 dark:border-slate-700/50 sticky top-0 bg-white dark:bg-slate-800 z-10">
              <h3 className="text-lg font-bold text-navy-900 dark:text-slate-100">Editar Regra</h3>
              <button onClick={() => setEditingRuleId(null)}
                className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-slate-700 text-neutral-400 dark:text-slate-500 hover:text-neutral-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <RuleEditor
                rule={editingRule}
                onUpdate={(updates) => setRules((prev) => prev.map((r) => r.id === editingRule.id ? { ...r, ...updates } : r))}
                onSave={() => { saveRule(editingRule); }}
                onCancel={() => setEditingRuleId(null)}
                saving={saving}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------- Card de Regra (Visual Flow) -------- */
function RuleCard({
  rule, onEdit, onDelete, onUpdate,
}: {
  rule: Rule; onEdit: () => void;
  onDelete: () => void; onUpdate: (u: any) => void;
}) {
  const triggerOpt = TRIGGER_OPTIONS.find((t) => t.value === rule.trigger?.type);
  const TriggerIcon = triggerOpt?.icon || Zap;

  const actionSummary = (a: Action) => {
    const opt = ACTION_TYPES.find((t) => t.value === a.type);
    const label = opt?.label || a.type;
    const val = Object.values(a.params || {}).filter(Boolean).join(', ');
    return val ? `${label}: ${val}` : label;
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-neutral-200 dark:border-slate-700 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md">
      <div className="p-3 flex items-center gap-3">
        <button onClick={() => onUpdate({ ativo: !rule.ativo })}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${rule.ativo ? 'bg-emerald-500' : 'bg-neutral-300'}`}>
          <span className={`inline-block h-3 w-3 transform rounded-full bg-white dark:bg-slate-800 transition-transform ${rule.ativo ? 'translate-x-5' : 'translate-x-1'}`} />
        </button>

        <div className="flex-1 min-w-0" onClick={onEdit}>
          <span className="text-sm font-semibold text-navy-900 dark:text-slate-100">{rule.nome}</span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-neutral-400 dark:text-slate-500 flex items-center gap-0.5">
              <TriggerIcon size={10} /> {triggerOpt?.label || rule.trigger?.type}
            </span>
            {rule.conditions?.length > 0 && (
              <span className="text-[10px] text-neutral-400 dark:text-slate-500">• {rule.conditions.length} condição(ões)</span>
            )}
            {rule.actions?.length > 0 && (
              <span className="text-[10px] text-neutral-400 dark:text-slate-500">• {rule.actions.length} ação(ões)</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button onClick={onEdit} className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-slate-700 text-neutral-400 dark:text-slate-500 transition-colors"><Settings2 size={14} /></button>
          <button onClick={onDelete} className="p-1 rounded hover:bg-red-50 text-neutral-400 dark:text-slate-500 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
        </div>
      </div>

      {/* Mini flow visualization */}
      {(rule.conditions?.length > 0 || rule.actions?.length > 0) && (
        <div className="px-3 pb-3 flex items-center gap-1.5 flex-wrap" onClick={onEdit}>
          <span className="text-[10px] bg-navy-50 text-navy-700 border border-navy-100 px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
            <TriggerIcon size={10} /> {triggerOpt?.label || rule.trigger?.type}
          </span>
          <ArrowRight size={10} className="text-neutral-300 flex-shrink-0" />

          {rule.conditions?.length > 0 && (
            <>
              <span className="text-[10px] bg-amber-400/10 text-amber-600 border border-amber-400/20 px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
                <Filter size={10} /> {rule.conditions.length} cond
              </span>
              <ArrowRight size={10} className="text-neutral-300 flex-shrink-0" />
            </>
          )}

          {rule.actions.slice(0, 2).map((a, i) => {
            const opt = ACTION_TYPES.find((t) => t.value === a.type);
            const Icon = opt?.icon || Zap;
            const summary = actionSummary(a);
            return (
              <span key={i} className="text-[10px] bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
                <Icon size={10} /> {summary.length > 18 ? summary.slice(0, 16) + '…' : summary}
              </span>
            );
          })}
          {rule.actions.length > 2 && (
            <span className="text-[10px] text-neutral-400 dark:text-slate-500 font-medium">+{rule.actions.length - 2}</span>
          )}
        </div>
      )}

    </div>
  );
}

/* -------- Flowchart Editor -------- */
function RuleEditor({
  rule, onUpdate, onSave, onCancel, saving,
}: {
  rule: Rule; onUpdate: (u: any) => void; onSave: () => void;
  onCancel: () => void; saving: boolean;
}) {

  const addCondition = () => onUpdate({
    conditions: [...rule.conditions, { field: 'ticket.categoria', operator: 'equals', value: '' }],
  });
  const removeCondition = (i: number) => onUpdate({ conditions: rule.conditions.filter((_, idx) => idx !== i) });
  const updateCondition = (i: number, field: string, val: string) => {
    const c = [...rule.conditions];
    (c[i] as any)[field] = val;
    onUpdate({ conditions: c });
  };

  const addAction = () => onUpdate({
    actions: [...rule.actions, { type: 'assign_user', params: {} }],
  });
  const removeAction = (i: number) => onUpdate({ actions: rule.actions.filter((_, idx) => idx !== i) });
  const updateActionParam = (i: number, key: string, val: string) => {
    const a = [...rule.actions];
    a[i] = { ...a[i], params: { ...a[i].params, [key]: val } };
    onUpdate({ actions: a });
  };
  const changeActionType = (i: number, type: string) => {
    const a = [...rule.actions];
    a[i] = { type, params: {} };
    onUpdate({ actions: a });
  };

  return (
    <div className="space-y-6">

      {/* Nome da regra */}
      <div>
        <label className="text-xs font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 block">Nome da Regra</label>
        <input value={rule.nome} onChange={(e) => onUpdate({ nome: e.target.value })}
          className="w-full text-sm font-semibold text-navy-900 dark:text-slate-100 border border-neutral-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-400/40 outline-none bg-white dark:bg-slate-800"
          placeholder="Nome da regra" />
      </div>

      {/* Step 1: Trigger Block */}
      <div className="relative">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-navy-100 flex items-center justify-center flex-shrink-0">
            <Zap size={16} className="text-navy-700" />
          </div>
          <div>
            <span className="text-sm font-bold uppercase tracking-wider text-navy-700">Gatilho</span>
            <p className="text-xs text-neutral-400 dark:text-slate-500">O evento que inicia esta regra</p>
          </div>
        </div>
        <div className="bg-navy-50/60 border border-navy-100 rounded-xl p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {TRIGGER_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const selected = rule.trigger?.type === opt.value;
              return (
                <button key={opt.value} onClick={() => onUpdate({ trigger: { ...rule.trigger, type: opt.value } })}
                  className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl text-xs font-medium transition-all ${
                    selected ? 'bg-navy-700 text-white shadow-md ring-2 ring-navy-400' : 'bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 text-neutral-600 dark:text-slate-300 hover:border-navy-300 hover:shadow-sm'
                  }`}>
                  <Icon size={20} className={selected ? 'text-white' : 'text-navy-500'} />
                  <span className="text-center leading-tight">{opt.label}</span>
                  <span className={`text-[10px] ${selected ? 'text-navy-300' : 'text-neutral-400 dark:text-slate-500'}`}>{opt.desc}</span>
                </button>
              );
            })}
          </div>
        </div>
        {/* Connector arrow */}
        <div className="flex justify-center py-2">
          <div className="h-5 w-0.5 bg-gradient-to-b from-navy-300 to-amber-400" />
          <ChevronDown size={14} className="text-amber-500 -ml-[7px] mt-2.5" />
        </div>
      </div>

      {/* Step 2: Conditions Block */}
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-amber-400/20 flex items-center justify-center">
              <Filter size={16} className="text-amber-600" />
            </div>
            <div>
              <span className="text-sm font-bold uppercase tracking-wider text-amber-600">Condições</span>
              {rule.conditions.length > 0 && <span className="text-xs text-neutral-400 dark:text-slate-500 font-medium ml-2">({rule.conditions.length})</span>}
              <p className="text-xs text-neutral-400 dark:text-slate-500">Filtros que determinam quando a regra deve ser executada</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select value={rule.logicOperator} onChange={(e) => onUpdate({ logicOperator: e.target.value })}
              className="text-xs border border-neutral-200 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800 text-neutral-600 dark:text-slate-300 font-medium">
              <option value="all">Todas (AND)</option>
              <option value="any">Qualquer (OR)</option>
            </select>
            <button onClick={addCondition}
              className="text-xs font-semibold flex items-center gap-1 px-3 py-1.5 bg-amber-400/10 text-amber-700 rounded-lg hover:bg-amber-400/20 transition-colors">
              <Plus size={12} /> Adicionar condição
            </button>
          </div>
        </div>

        <div className={`bg-amber-400/5 border border-amber-400/20 rounded-xl p-4 ${rule.conditions.length === 0 ? '' : 'space-y-3'}`}>
          {rule.conditions.length === 0 && (
            <p className="text-sm text-neutral-400 dark:text-slate-500 text-center py-4">Sem condições — a regra executa sempre que o gatilho acontecer</p>
          )}
          {rule.conditions.map((c, i) => (
            <div key={i}>
              {i > 0 && (
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-6 w-0.5 bg-amber-400/30 ml-1" />
                  <span className="text-[11px] font-bold text-amber-600 uppercase bg-amber-400/10 px-2 py-0.5 rounded-md">
                    {rule.logicOperator === 'all' ? 'AND' : 'OR'}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <select value={c.field} onChange={(e) => updateCondition(i, 'field', e.target.value)}
                  className="flex-[2] text-sm border border-amber-400/30 rounded-lg px-3 py-2.5 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-amber-400/40 outline-none">
                  {CONDITION_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
                <select value={c.operator} onChange={(e) => updateCondition(i, 'operator', e.target.value)}
                  className="flex-1 text-sm border border-amber-400/30 rounded-lg px-3 py-2.5 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-amber-400/40 outline-none">
                  {CONDITION_OPERATORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <input value={c.value} onChange={(e) => updateCondition(i, 'value', e.target.value)}
                  className="flex-[2] text-sm border border-amber-400/30 rounded-lg px-3 py-2.5 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-amber-400/40 outline-none"
                  placeholder="Valor" />
                <button onClick={() => removeCondition(i)} className="p-2 text-neutral-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><X size={16} /></button>
              </div>
            </div>
          ))}
        </div>
        {/* Connector arrow */}
        {(rule.conditions.length > 0 || rule.actions.length > 0) && (
          <div className="flex justify-center py-2">
            <div className="h-5 w-0.5 bg-gradient-to-b from-amber-400 to-emerald-400" />
            <ChevronDown size={14} className="text-emerald-500 -ml-[7px] mt-2.5" />
          </div>
        )}
      </div>

      {/* Step 3: Actions Block */}
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center">
              <Play size={16} className="text-emerald-700" />
            </div>
            <div>
              <span className="text-sm font-bold uppercase tracking-wider text-emerald-700">Ações</span>
              {rule.actions.length > 0 && <span className="text-xs text-neutral-400 dark:text-slate-500 font-medium ml-2">({rule.actions.length})</span>}
              <p className="text-xs text-neutral-400 dark:text-slate-500">O que acontece quando as condições são atendidas</p>
            </div>
          </div>
          <button onClick={addAction}
            className="text-xs font-semibold flex items-center gap-1 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors">
            <Plus size={12} /> Adicionar ação
          </button>
        </div>

        <div className="space-y-3">
          {rule.actions.length === 0 && (
            <div className="bg-emerald-50 dark:bg-emerald-900/30/60 border border-emerald-100 rounded-xl p-4">
              <p className="text-sm text-neutral-400 dark:text-slate-500 text-center py-4">Nenhuma ação definida</p>
            </div>
          )}
          {rule.actions.map((a, i) => {
            const ActionIcon = ACTION_TYPES.find((t) => t.value === a.type)?.icon || Zap;
            return (
              <div key={i} className="bg-emerald-50 dark:bg-emerald-900/30/60 border border-emerald-100 rounded-xl p-4 space-y-3 transition-all hover:shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <ActionIcon size={18} className="text-emerald-600" />
                    <select value={a.type} onChange={(e) => changeActionType(i, e.target.value)}
                      className="text-sm font-semibold border border-emerald-200 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-800 text-navy-900 dark:text-slate-100">
                      {ACTION_TYPES.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                  </div>
                  <button onClick={() => removeAction(i)} className="p-1.5 text-neutral-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><X size={16} /></button>
                </div>
                <div className="pl-11">
                  <ActionParamsEditor action={a} onParamChange={(key, val) => updateActionParam(i, key, val)} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-3 pt-4 border-t border-neutral-100 dark:border-slate-700/50">
        <button onClick={onSave} disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all text-sm disabled:opacity-50 shadow-md hover:shadow-lg">
          <Save size={16} /> {saving ? 'Salvando...' : 'Salvar Regra'}
        </button>
        <button onClick={onCancel}
          className="flex items-center gap-2 px-6 py-3 bg-neutral-100 dark:bg-slate-800 text-neutral-600 dark:text-slate-300 font-semibold rounded-xl hover:bg-neutral-200 transition-all text-sm">
          <X size={16} /> Cancelar
        </button>
      </div>
    </div>
  );
}

function ActionParamsEditor({ action, onParamChange }: { action: Action; onParamChange: (k: string, v: string) => void }) {
  const params = action.params || {};
  const [showVariables, setShowVariables] = useState(false);

  const insertVariable = (variable: string) => {
    const current = params.text || '';
    onParamChange('text', current + variable);
  };

  const inputClass = "w-full text-sm border border-neutral-200 dark:border-slate-700 rounded-lg px-3 py-2.5 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-emerald-400/40 outline-none";

  switch (action.type) {
    case 'assign_user':
      return <input value={params.userId || ''} onChange={(e) => onParamChange('userId', e.target.value)}
        className={inputClass}
        placeholder="ID do usuário ou @email (ex: joao@email.com)" />;

    case 'change_status':
      return (
        <select value={params.status || 'ativo'} onChange={(e) => onParamChange('status', e.target.value)}
          className={inputClass}>
          <option value="ativo">Ativo</option><option value="inativo">Inativo</option>
          <option value="aberto">Aberto</option><option value="em_atendimento">Em Andamento</option>
          <option value="fechado">Fechado</option><option value="rascunho">Rascunho</option>
          <option value="assinada">Assinada</option>
        </select>
      );

    case 'change_priority':
      return (
        <select value={params.priority || 'media'} onChange={(e) => onParamChange('priority', e.target.value)}
          className={inputClass}>
          <option value="baixa">Baixa</option><option value="media">Média</option>
          <option value="alta">Alta</option><option value="urgente">Urgente</option>
        </select>
      );

    case 'send_message':
      return (
        <div className="space-y-3">
          <textarea value={params.text || ''} onChange={(e) => onParamChange('text', e.target.value)}
            className="w-full text-sm border border-neutral-200 dark:border-slate-700 rounded-lg px-3 py-2.5 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-emerald-400/40 outline-none resize-y"
            rows={4} placeholder="Digite a mensagem automática..." />
          <div>
            <button onClick={() => setShowVariables(!showVariables)}
              className="text-xs font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1 transition-colors">
              <Tag size={12} /> {showVariables ? 'Ocultar variáveis' : 'Inserir variável'}
            </button>
            {showVariables && (
              <div className="flex flex-wrap gap-1.5 mt-2 p-3 bg-amber-400/5 border border-amber-400/20 rounded-lg">
                {VARIAVEIS_MENSAGEM.map((v) => (
                  <button key={v.value} onClick={() => insertVariable(v.value)}
                    className="text-xs bg-white dark:bg-slate-800 border border-amber-400/30 text-amber-700 px-2.5 py-1 rounded-md hover:bg-amber-400/10 hover:border-amber-400/50 transition-all font-mono"
                    title={v.label}>
                    {v.value}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      );

    case 'create_task':
      return (
        <div className="space-y-2">
          <input value={params.titulo || ''} onChange={(e) => onParamChange('titulo', e.target.value)}
            className={inputClass}
            placeholder="Título da tarefa" />
          <input value={params.atribuirPara || ''} onChange={(e) => onParamChange('atribuirPara', e.target.value)}
            className={inputClass}
            placeholder="Atribuir para (email)" />
          <select value={params.prioridade || 'media'} onChange={(e) => onParamChange('prioridade', e.target.value)}
            className={inputClass}>
            <option value="baixa">Baixa</option><option value="media">Média</option>
            <option value="alta">Alta</option><option value="urgente">Urgente</option>
          </select>
        </div>
      );

    case 'add_tag':
      return <input value={params.tag || ''} onChange={(e) => onParamChange('tag', e.target.value)}
        className={inputClass}
        placeholder="Nome da tag (ex: prioridade, suporte)" />;

    case 'send_webhook':
      return (
        <div className="space-y-2">
          <input value={params.url || ''} onChange={(e) => onParamChange('url', e.target.value)}
            className={inputClass}
            placeholder="URL do webhook (https://...)" />
          <input value={params.method || 'POST'} onChange={(e) => onParamChange('method', e.target.value)}
            className={inputClass}
            placeholder="Método (POST, GET, PUT)" />
        </div>
      );

    default:
      return <p className="text-sm text-neutral-400 dark:text-slate-500">Sem parâmetros</p>;
  }
}

/* -------- Sub-paineis -------- */
function VendasPanel({ data, onRefresh }: { data: any; onRefresh: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-navy-900 dark:text-slate-100">Sugestões de Ações Comerciais</h3>
        <button onClick={onRefresh} className="text-xs text-emerald-600 font-semibold hover:text-emerald-700 flex items-center gap-1">
          <RefreshCw size={12} /> Atualizar
        </button>
      </div>
      {!data ? <div className="text-center py-8 text-neutral-400 dark:text-slate-500">Carregando...</div>
      : data.sugestoes?.length === 0 ? <div className="text-center py-8 text-neutral-400 dark:text-slate-500">Nenhuma sugestão no momento</div>
      : <div className="space-y-3">{data.sugestoes?.map((s: any, i: number) => (
        <div key={i} className={`p-4 rounded-lg border ${
          s.prioridade === 'alta' ? 'bg-semantic-error/5 border-semantic-error/20' :
          s.prioridade === 'media' ? 'bg-amber-400/5 border-amber-400/20' :
          'bg-navy-50 border-navy-100'
        }`}>
          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              s.prioridade === 'alta' ? 'bg-semantic-error/10 text-semantic-error' :
              s.prioridade === 'media' ? 'bg-amber-400/20 text-amber-600' :
              'bg-navy-100 text-navy-700'
            }`}>
              <Zap size={14} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Link to={`/app/crm/${s.clientId}`} className="font-semibold text-sm text-navy-900 dark:text-slate-100 hover:text-emerald-600">
                  {s.cliente}
                </Link>
                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                  s.prioridade === 'alta' ? 'bg-semantic-error/10 text-semantic-error' :
                  s.prioridade === 'media' ? 'bg-amber-400/20 text-amber-700' :
                  'bg-navy-100 text-navy-700'
                }`}>{s.prioridade}</span>
              </div>
              <p className="text-sm text-neutral-700 dark:text-slate-200">{s.acao}</p>
              <p className="text-xs text-neutral-400 dark:text-slate-500 mt-1">{s.motivo}</p>
            </div>
          </div>
        </div>
      ))}</div>}
      {data?.generated && <p className="text-xs text-emerald-600 flex items-center gap-1 mt-2"><Sparkles size={12} /> Sugestões aprimoradas por IA</p>}
    </div>
  );
}

function ClassificadorPanel({ onRun, running }: { onRun: () => void; running: boolean }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-navy-900 dark:text-slate-100">Classificação de Tickets</h3>
          <p className="text-sm text-neutral-500 dark:text-slate-400">Categoriza automaticamente tickets do WhatsApp sem categoria</p>
        </div>
        <button onClick={onRun} disabled={running} className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50">
          {running ? <><RefreshCw size={14} className="animate-spin" /> Classificando...</> : <><Brain size={14} /> Classificar Agora</>}
        </button>
      </div>
      <div className="bg-neutral-50 dark:bg-slate-900 rounded-lg p-4 text-sm text-neutral-600 dark:text-slate-300 leading-relaxed">
        <strong className="text-navy-900 dark:text-slate-100">Categorias suportadas:</strong><br />
        Suporte Técnico • Dúvida Faturamento • Solicitação de Mudança • Treinamento • Reclamação
      </div>
    </div>
  );
}

function OsAlertsPanel({ alerts, onRefresh }: { alerts: any[]; onRefresh: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-navy-900 dark:text-slate-100">Alertas de OS</h3>
        <button onClick={onRefresh} className="text-xs text-emerald-600 font-semibold hover:text-emerald-700 flex items-center gap-1"><RefreshCw size={12} /> Atualizar</button>
      </div>
      {alerts.length === 0 ? <div className="text-center py-8 text-neutral-400 dark:text-slate-500">Nenhum alerta de OS atrasada</div>
      : <div className="space-y-3">{alerts.map((a: any) => (
        <div key={a.orderId} className="p-4 rounded-lg border border-amber-400/20 bg-amber-400/5">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Link to={`/app/orders/${a.orderId}`} className="font-semibold text-sm text-navy-900 dark:text-slate-100 hover:text-emerald-600">{a.numeroOs}</Link>
                <span className="text-xs text-amber-700 bg-amber-400/10 px-2 py-0.5 rounded-full font-medium">{a.diasParada} dias</span>
              </div>
              <p className="text-sm text-neutral-700 dark:text-slate-200">{a.cliente} — {a.tecnico}</p>
              <p className="text-xs text-neutral-500 dark:text-slate-400 mt-1">{a.alerta}</p>
            </div>
            <ChevronRight size={16} className="text-neutral-300 flex-shrink-0" />
          </div>
        </div>
      ))}</div>}
    </div>
  );
}

function TarefasPanel({ sugestoes, onRefresh }: { sugestoes: any[]; onRefresh: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-navy-900 dark:text-slate-100">Sugestões de Prioridades</h3>
        <button onClick={onRefresh} className="text-xs text-emerald-600 font-semibold hover:text-emerald-700 flex items-center gap-1"><RefreshCw size={12} /> Atualizar</button>
      </div>
      {sugestoes.length === 0 ? <div className="text-center py-8 text-neutral-400 dark:text-slate-500">Nenhuma sugestão de prioridade no momento</div>
      : <div className="space-y-3">{sugestoes.map((s: any) => (
        <div key={s.taskId} className="p-4 rounded-lg border border-emerald-100 bg-emerald-50 dark:bg-emerald-900/30">
          <div className="flex items-start gap-3">
            <Zap size={18} className="text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm text-navy-900 dark:text-slate-100">{s.titulo}</p>
              <p className="text-xs text-neutral-500 dark:text-slate-400">Responsável: {s.responsavel}</p>
              <p className="text-sm text-neutral-700 dark:text-slate-200 mt-1">{s.sugestao}</p>
            </div>
          </div>
        </div>
      ))}</div>}
    </div>
  );
}
