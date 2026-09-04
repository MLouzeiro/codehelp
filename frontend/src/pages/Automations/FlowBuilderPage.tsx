import { useState, useCallback, useEffect } from 'react';
import ReactFlow, {
  addEdge, applyNodeChanges, applyEdgeChanges,
  Controls, Background, MiniMap, Connection, Edge, Node,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { RefreshCw, Plus, Save, Trash2, Play, X, ArrowLeft } from 'lucide-react';
import api from '../../services/api';
import { nodeTypes } from '../../components/flow/FlowNodes';
import type { AutomationRule, AutomationTrigger, AutomationAction, AutomationOperator, AutomationCondition, AutomationActionStep } from '../../types';

const TRIGGERS: Array<{ value: AutomationTrigger; label: string; desc: string }> = [
  { value: 'novo_ticket', label: 'Novo Ticket', desc: 'Ticket criado via WhatsApp ou manual' },
  { value: 'msg_recebida', label: 'Mensagem Recebida', desc: 'Cliente envia mensagem em ticket' },
  { value: 'status_alterado', label: 'Status Alterado', desc: 'Etapa/status do ticket muda' },
  { value: 'sla_alerta', label: 'Alerta SLA', desc: 'SLA proximo de violar' },
  { value: 'csat_recebido', label: 'CSAT Recebido', desc: 'Resposta de satisfacao' },
];

const CONDITIONS_FIELDS = [
  { value: 'ticket.categoria', label: 'Categoria' },
  { value: 'ticket.prioridade', label: 'Prioridade' },
  { value: 'ticket.status', label: 'Status' },
  { value: 'ticket.etapa', label: 'Etapa' },
  { value: 'ticket.tags', label: 'Tags' },
  { value: 'ticket.clienteNome', label: 'Nome do Cliente' },
  { value: 'ticket.slaStatus', label: 'Status SLA' },
  { value: 'csat.nota', label: 'Nota CSAT' },
];

const OPERATORS: Array<{ value: AutomationOperator; label: string }> = [
  { value: 'eq', label: '=' }, { value: 'neq', label: '!=' },
  { value: 'gt', label: '>' }, { value: 'gte', label: '>=' },
  { value: 'lt', label: '<' }, { value: 'lte', label: '<=' },
  { value: 'contains', label: 'contem' }, { value: 'in', label: 'em lista' },
];

const ACTIONS: Array<{ value: AutomationAction; label: string; params: Array<{ key: string; label: string; type: 'text' | 'select'; options?: string[] }> }> = [
  { value: 'definir_categoria', label: 'Definir Categoria', params: [{ key: 'categoria', label: 'Categoria', type: 'text' }] },
  { value: 'definir_prioridade', label: 'Definir Prioridade', params: [{ key: 'prioridade', label: 'Prioridade', type: 'select', options: ['baixa', 'media', 'alta', 'urgente'] }] },
  { value: 'atribuir_usuario', label: 'Atribuir a Usuario', params: [{ key: 'usuarioId', label: 'ID do Usuario', type: 'text' }] },
  { value: 'mudar_etapa', label: 'Mudar Etapa', params: [{ key: 'etapa', label: 'Etapa', type: 'select', options: ['fila', 'em_atendimento', 'aguardando_cliente', 'aguardando_os', 'concluido', 'descartado'] }] },
  { value: 'enviar_msg', label: 'Enviar Mensagem', params: [{ key: 'mensagem', label: 'Mensagem', type: 'text' }] },
  { value: 'escalar_fila', label: 'Escalar para Fila', params: [{ key: 'filaId', label: 'ID da Fila', type: 'text' }, { key: 'motivo', label: 'Motivo', type: 'text' }] },
  { value: 'notificar', label: 'Notificar Usuario', params: [{ key: 'usuarioId', label: 'ID do Usuario', type: 'text' }, { key: 'mensagem', label: 'Mensagem', type: 'text' }] },
  { value: 'adicionar_tag', label: 'Adicionar Tag', params: [{ key: 'tag', label: 'Tag', type: 'text' }] },
];

interface FlowState {
  trigger: AutomationTrigger;
  condicoes: AutomationCondition[];
  acoes: AutomationActionStep[];
  logicOperator: 'all' | 'any';
}

function buildFlowNodes(state: FlowState): Node[] {
  const nodes: Node[] = [];
  const tDesc = TRIGGERS.find((t) => t.value === state.trigger)?.desc || '';
  nodes.push({ id: 'trigger', type: 'trigger', position: { x: 250, y: 0 }, data: { trigger: state.trigger, descricao: tDesc } });
  if (state.condicoes.length > 0) {
    nodes.push({ id: 'logic', type: 'logic', position: { x: 280, y: 100 }, data: { operator: state.logicOperator } });
    state.condicoes.forEach((c, i) => {
      const xOff = 250 - (state.condicoes.length - 1) * 110 + i * 220;
      nodes.push({ id: 'cond_' + i, type: 'condition', position: { x: xOff, y: 200 }, data: { campo: c.campo, operador: c.operador, valor: c.valor, index: i, total: state.condicoes.length } });
    });
  }
  state.acoes.forEach((a, i) => {
    const xOff = 250 - (state.acoes.length - 1) * 110 + i * 220;
    const yPos = state.condicoes.length > 0 ? 330 : 130;
    nodes.push({ id: 'action_' + i, type: 'action', position: { x: xOff, y: yPos }, data: { actionType: a.tipo, parametros: a.parametros } });
  });
  return nodes;
}

function buildFlowEdges(state: FlowState): Edge[] {
  const edges: Edge[] = [];
  if (state.condicoes.length > 0) {
    edges.push({ id: 'e_trigger_logic', source: 'trigger', target: 'logic', animated: true, style: { stroke: '#f59e0b' } });
    state.condicoes.forEach((_, i) => {
      edges.push({ id: 'e_logic_cond_' + i, source: 'logic', target: 'cond_' + i, style: { stroke: '#3b82f6' } });
    });
  }
  if (state.acoes.length > 0) {
    const srcId = state.condicoes.length > 0 ? 'cond_' + (state.condicoes.length - 1) : 'trigger';
    edges.push({ id: 'e_to_action_0', source: srcId, target: 'action_0', animated: state.condicoes.length === 0, style: { stroke: '#10b981' } });
    for (let i = 1; i < state.acoes.length; i++) {
      edges.push({ id: 'e_action_' + (i - 1) + '_' + i, source: 'action_' + (i - 1), target: 'action_' + i, style: { stroke: '#10b981' } });
    }
  }
  return edges;
}

export default function FlowBuilderPage() {
  const [regras, setRegras] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRule, setSelectedRule] = useState<AutomationRule | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showList, setShowList] = useState(true);
  const [flowState, setFlowState] = useState<FlowState>({
    trigger: 'novo_ticket', condicoes: [],
    acoes: [{ tipo: 'definir_categoria', parametros: { categoria: '' } }],
    logicOperator: 'all',
  });
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [showTestPanel, setShowTestPanel] = useState(false);
  const [testContext, setTestContext] = useState('{\n  "ticketId": ""\n}');
  const [testResult, setTestResult] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [ruleDesc, setRuleDesc] = useState('');
  const [ruleAtivo, setRuleAtivo] = useState(true);

  const loadRules = useCallback(async () => {
    setLoading(true);
    try { const { data } = await api.get<AutomationRule[]>('/automations'); setRegras(Array.isArray(data) ? data : []); }
    catch { /* */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadRules(); }, [loadRules]);
  useEffect(() => { setNodes(buildFlowNodes(flowState)); setEdges(buildFlowEdges(flowState)); }, [flowState]);

  const onNodesChange = useCallback((changes: any) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes: any) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);
  const onConnect = useCallback((conn: Connection) => setEdges((eds) => addEdge({ ...conn, animated: true, style: { stroke: '#a78bfa' } }, eds)), []);

  const startNew = () => {
    setSelectedRule(null); setEditing(true); setShowList(false);
    setRuleName(''); setRuleDesc(''); setRuleAtivo(true);
    setFlowState({ trigger: 'novo_ticket', condicoes: [], acoes: [{ tipo: 'definir_categoria', parametros: { categoria: '' } }], logicOperator: 'all' });
  };

  const startEdit = (rule: AutomationRule) => {
    setSelectedRule(rule); setEditing(true); setShowList(false);
    setRuleName(rule.nome); setRuleDesc(rule.descricao || ''); setRuleAtivo(rule.ativo);
    setFlowState({
      trigger: rule.trigger,
      condicoes: rule.condicoes.length > 0 ? rule.condicoes : [],
      acoes: rule.acoes.length > 0 ? rule.acoes : [{ tipo: 'definir_categoria', parametros: {} }],
      logicOperator: rule.logicOperator || 'all',
    });
  };

  const addCondition = () => setFlowState((s) => ({ ...s, condicoes: [...s.condicoes, { campo: '', operador: 'eq', valor: '' }] }));
  const updateCondition = (idx: number, field: string, value: string) => setFlowState((s) => ({ ...s, condicoes: s.condicoes.map((c, i) => i === idx ? { ...c, [field]: value } : c) }));
  const removeCondition = (idx: number) => setFlowState((s) => ({ ...s, condicoes: s.condicoes.filter((_, i) => i !== idx) }));
  const addAction = () => setFlowState((s) => ({ ...s, acoes: [...s.acoes, { tipo: 'definir_categoria', parametros: {} }] }));
  const updateAction = (idx: number, tipo: AutomationAction) => setFlowState((s) => ({ ...s, acoes: s.acoes.map((a, i) => i === idx ? { tipo, parametros: {} } : a) }));
  const updateActionParam = (idx: number, key: string, value: string) => setFlowState((s) => ({ ...s, acoes: s.acoes.map((a, i) => i === idx ? { ...a, parametros: { ...a.parametros, [key]: value } } : a) }));
  const removeAction = (idx: number) => setFlowState((s) => ({ ...s, acoes: s.acoes.filter((_, i) => i !== idx) }));

  const save = async () => {
    if (!ruleName.trim()) return;
    setSaving(true);
    try {
      const payload = {
        nome: ruleName.trim(), descricao: ruleDesc.trim() || null,
        trigger: flowState.trigger, condicoes: flowState.condicoes.filter((c) => c.campo),
        acoes: flowState.acoes, logicOperator: flowState.logicOperator, ativo: ruleAtivo,
      };
      if (selectedRule) { await api.patch('/automations/' + selectedRule.id, payload); }
      else { await api.post('/automations', payload); }
      setEditing(false); setShowList(true); loadRules();
    } catch { /* */ } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir esta regra?')) return;
    try { await api.delete('/automations/' + id); loadRules(); } catch { /* */ }
  };

  const toggleAtivo = async (rule: AutomationRule) => {
    try { await api.patch('/automations/' + rule.id, { ativo: !rule.ativo }); loadRules(); } catch { /* */ }
  };

  const testRule = async () => {
    setTestLoading(true);
    try { const ctx = JSON.parse(testContext); const { data } = await api.post('/automations/testar', { trigger: flowState.trigger, contexto: ctx }); setTestResult(data); }
    catch (e: any) { setTestResult({ error: e.message }); }
    finally { setTestLoading(false); }
  };

  const TRIGGER_COLORS: Record<string, string> = {
    novo_ticket: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    msg_recebida: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    status_alterado: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
    sla_alerta: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    csat_recebido: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  };

  if (showList) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100" style={{ fontFamily: 'Khand, sans-serif' }}>Construtor de Fluxos</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Crie automacoes visuais com trigger, condicoes e acoes</p>
          </div>
          <button onClick={startNew} className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors text-sm font-medium">
            <Plus size={16} /> Nova Regra
          </button>
        </div>
        {loading ? (
          <div className="flex justify-center py-12"><RefreshCw className="w-6 h-6 text-gray-400 animate-spin" /></div>
        ) : regras.length === 0 ? (
          <div className="text-center py-12 text-gray-500">Nenhuma regra de automacao encontrada</div>
        ) : (
          <div className="grid gap-3">
            {regras.map((r) => (
              <div key={r.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-4">
                  <button onClick={() => toggleAtivo(r)} className={'w-10 h-6 rounded-full transition-colors ' + (r.ativo ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600')}>
                    <div className={'w-5 h-5 rounded-full bg-white shadow transition-transform ' + (r.ativo ? 'translate-x-4' : 'translate-x-0.5')} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800 dark:text-gray-200">{r.nome}</span>
                      <span className={'text-[10px] px-2 py-0.5 rounded-full ' + (TRIGGER_COLORS[r.trigger] || 'bg-gray-100 text-gray-500')}>
                        {TRIGGERS.find((t) => t.value === r.trigger)?.label || r.trigger}
                      </span>
                      <span className="text-[10px] text-gray-400">{r.condicoes.length} cond., {r.acoes.length} acoes</span>
                    </div>
                    {r.descricao && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{r.descricao}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => startEdit(r)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-500 hover:text-violet-600"><Play size={14} /></button>
                    <button onClick={() => remove(r.id)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-500 hover:text-red-500"><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <button onClick={() => { setEditing(false); setShowList(true); }} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><ArrowLeft size={18} className="text-gray-600 dark:text-gray-300" /></button>
        <div className="flex-1">
          <input value={ruleName} onChange={(e) => setRuleName(e.target.value)} placeholder="Nome da regra..." className="bg-transparent text-lg font-bold text-gray-800 dark:text-gray-100 outline-none w-full" style={{ fontFamily: 'Khand, sans-serif' }} />
        </div>
        <button onClick={() => setShowTestPanel(!showTestPanel)} className={'p-2 rounded-lg transition-colors ' + (showTestPanel ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-600' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500')}><Play size={18} /></button>
        <button onClick={save} disabled={saving || !ruleName.trim()} className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors text-sm font-medium">
          <Save size={14} /> {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative">
          <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} nodeTypes={nodeTypes} fitView>
            <Controls /><Background gap={16} /><MiniMap />
          </ReactFlow>
        </div>
        <div className="w-80 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-y-auto">
          <div className="p-4 space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Descricao</label>
              <input value={ruleDesc} onChange={(e) => setRuleDesc(e.target.value)} placeholder="O que esta regra faz..." className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Trigger</label>
              <div className="grid grid-cols-1 gap-1.5">
                {TRIGGERS.map((t) => (
                  <button key={t.value} onClick={() => setFlowState((s) => ({ ...s, trigger: t.value }))}
                    className={'text-left px-3 py-2 rounded-lg border text-xs transition-colors ' + (flowState.trigger === t.value ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400')}>
                    <span className="font-medium">{t.label}</span>
                    <span className="block text-[10px] opacity-70">{t.desc}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Condicoes</label>
                <button onClick={addCondition} className="text-[10px] text-violet-600 hover:text-violet-700 font-medium">+ Adicionar</button>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <button onClick={() => setFlowState((s) => ({ ...s, logicOperator: 'all' }))} className={'text-[10px] px-2 py-1 rounded ' + (flowState.logicOperator === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400')}>AND</button>
                <button onClick={() => setFlowState((s) => ({ ...s, logicOperator: 'any' }))} className={'text-[10px] px-2 py-1 rounded ' + (flowState.logicOperator === 'any' ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400')}>OR</button>
              </div>
              <div className="space-y-2">
                {flowState.condicoes.map((c, i) => (
                  <div key={i} className="border border-blue-200 dark:border-blue-800 rounded-lg p-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-blue-500 font-medium">#{i + 1}</span>
                      <button onClick={() => removeCondition(i)} className="text-gray-400 hover:text-red-500"><X size={12} /></button>
                    </div>
                    <select value={c.campo} onChange={(e) => updateCondition(i, 'campo', e.target.value)} className="w-full px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-xs text-gray-800 dark:text-gray-200 outline-none">
                      <option value="">Selecionar campo...</option>
                      {CONDITIONS_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                    <div className="flex gap-1">
                      <select value={c.operador} onChange={(e) => updateCondition(i, 'operador', e.target.value)} className="flex-1 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-xs text-gray-800 dark:text-gray-200 outline-none">
                        {OPERATORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      <input value={c.valor} onChange={(e) => updateCondition(i, 'valor', e.target.value)} placeholder="Valor" className="flex-1 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-xs text-gray-800 dark:text-gray-200 outline-none" />
                    </div>
                  </div>
                ))}
                {flowState.condicoes.length === 0 && <p className="text-[10px] text-gray-400 text-center py-2">Sem condicoes - executa sempre</p>}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Acoes</label>
                <button onClick={addAction} className="text-[10px] text-emerald-600 hover:text-emerald-700 font-medium">+ Adicionar</button>
              </div>
              <div className="space-y-2">
                {flowState.acoes.map((a, i) => {
                  const actionDef = ACTIONS.find((x) => x.value === a.tipo);
                  return (
                    <div key={i} className="border border-emerald-200 dark:border-emerald-800 rounded-lg p-2 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-emerald-500 font-medium">Acao #{i + 1}</span>
                        <button onClick={() => removeAction(i)} className="text-gray-400 hover:text-red-500"><X size={12} /></button>
                      </div>
                      <select value={a.tipo} onChange={(e) => updateAction(i, e.target.value as AutomationAction)} className="w-full px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-xs text-gray-800 dark:text-gray-200 outline-none">
                        {ACTIONS.map((ac) => <option key={ac.value} value={ac.value}>{ac.label}</option>)}
                      </select>
                      {actionDef?.params.map((p) => (
                        p.type === 'select' ? (
                          <select key={p.key} value={a.parametros[p.key] || ''} onChange={(e) => updateActionParam(i, p.key, e.target.value)} className="w-full px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-xs text-gray-800 dark:text-gray-200 outline-none">
                            <option value="">{p.label}...</option>
                            {p.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : (
                          <input key={p.key} value={a.parametros[p.key] || ''} onChange={(e) => updateActionParam(i, p.key, e.target.value)} placeholder={p.label} className="w-full px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-xs text-gray-800 dark:text-gray-200 outline-none" />
                        )
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        {showTestPanel && (
          <div className="w-80 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 overflow-y-auto p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">Testar Regra</h3>
              <button onClick={() => setShowTestPanel(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <div>
              <label className="text-[10px] font-medium text-gray-500 mb-1 block">Contexto (JSON)</label>
              <textarea value={testContext} onChange={(e) => setTestContext(e.target.value)} rows={6} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-800 dark:text-gray-200 font-mono outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <button onClick={testRule} disabled={testLoading} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 text-sm">
              <Play size={14} /> {testLoading ? 'Testando...' : 'Executar Teste'}
            </button>
            {testResult && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                <p className="text-[10px] font-medium text-gray-500 mb-1">Resultado:</p>
                <pre className="text-[11px] text-gray-700 dark:text-gray-300 whitespace-pre-wrap overflow-auto max-h-60">{JSON.stringify(testResult, null, 2)}</pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
