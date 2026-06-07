import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useAuth } from '../../services/auth';
import {
  RefreshCw, Zap, Plus, Edit, Trash2, Power, PowerOff, Play, X, Code,
  AlertCircle, CheckCircle, GitBranch, Filter, Settings as SettingsIcon,
} from 'lucide-react';
import type {
  AutomationRule, AutomationTrigger, AutomationAction,
  AutomationOperator, AutomationCondition, AutomationActionStep,
} from '../../types';

const ROLES_EDIT: Record<string, number> = { admin: 4, gerente: 3, supervisor: 3, tecnico: 2, vendedor: 2 };
function canEdit(role?: string): boolean { return role ? (ROLES_EDIT[role] || 0) >= 2 : false; }

const TRIGGERS: Array<{ value: AutomationTrigger; label: string; desc: string }> = [
  { value: 'novo_ticket', label: 'Novo Ticket', desc: 'Quando chega um ticket novo do WhatsApp ou e criado manualmente' },
  { value: 'msg_recebida', label: 'Mensagem Recebida', desc: 'Quando o cliente envia uma mensagem em um ticket existente' },
  { value: 'status_alterado', label: 'Status Alterado', desc: 'Quando o status ou etapa do ticket muda' },
  { value: 'sla_alerta', label: 'Alerta de SLA', desc: 'Quando o SLA esta proximo de violar ou foi violado' },
  { value: 'csat_recebido', label: 'CSAT Recebido', desc: 'Quando o cliente responde a pesquisa de satisfacao' },
];

const ACTIONS: Array<{ value: AutomationAction; label: string; params: Array<{ key: string; label: string; type: 'text' | 'number' | 'select'; options?: string[] }> }> = [
  { value: 'definir_categoria', label: 'Definir Categoria', params: [{ key: 'categoria', label: 'Categoria (slug)', type: 'text' }] },
  { value: 'definir_prioridade', label: 'Definir Prioridade', params: [{ key: 'prioridade', label: 'Prioridade', type: 'select', options: ['baixa', 'media', 'alta', 'urgente'] }] },
  { value: 'atribuir_usuario', label: 'Atribuir a Usuario', params: [{ key: 'usuarioId', label: 'ID do Usuario', type: 'text' }] },
  { value: 'mudar_etapa', label: 'Mudar Etapa', params: [{ key: 'etapa', label: 'Etapa', type: 'select', options: ['fila', 'em_atendimento', 'aguardando_cliente', 'aguardando_os', 'concluido', 'descartado'] }] },
  { value: 'enviar_msg', label: 'Enviar Mensagem WhatsApp', params: [{ key: 'mensagem', label: 'Mensagem', type: 'text' }] },
  { value: 'escalar_fila', label: 'Escalar para Fila', params: [
    { key: 'filaId', label: 'ID da Fila', type: 'text' },
    { key: 'motivo', label: 'Motivo', type: 'text' },
  ] },
  { value: 'notificar', label: 'Notificar Usuario', params: [
    { key: 'usuarioId', label: 'ID do Usuario', type: 'text' },
    { key: 'mensagem', label: 'Mensagem', type: 'text' },
  ] },
  { value: 'adicionar_tag', label: 'Adicionar Tag', params: [{ key: 'tag', label: 'Tag', type: 'text' }] },
];

const OPERATORS: Array<{ value: AutomationOperator; label: string }> = [
  { value: 'eq', label: 'igual a' },
  { value: 'neq', label: 'diferente de' },
  { value: 'gt', label: 'maior que' },
  { value: 'gte', label: 'maior ou igual' },
  { value: 'lt', label: 'menor que' },
  { value: 'lte', label: 'menor ou igual' },
  { value: 'contains', label: 'contem' },
  { value: 'in', label: 'esta em (lista)' },
];

interface FormState {
  id?: string;
  nome: string;
  descricao: string;
  trigger: AutomationTrigger;
  condicoes: AutomationCondition[];
  acoes: AutomationActionStep[];
  logicOperator: 'all' | 'any';
  ativo: boolean;
  ordem: number;
}

const FORM_VAZIO: FormState = {
  nome: '',
  descricao: '',
  trigger: 'novo_ticket',
  condicoes: [],
  acoes: [],
  logicOperator: 'all',
  ativo: true,
  ordem: 0,
};

const TEST_FORM_VAZIO = {
  trigger: 'novo_ticket' as AutomationTrigger,
  contexto: '{\n  "ticketId": "",\n  "categoria": "",\n  "prioridade": "media"\n}',
};

export default function AutomationsPage() {
  const { user } = useAuth();
  const [regras, setRegras] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtroTrigger, setFiltroTrigger] = useState<string>('');
  const [filtroAtivo, setFiltroAtivo] = useState<'todos' | 'ativos' | 'inativos'>('todos');
  const [showForm, setShowForm] = useState(false);
  const [showTester, setShowTester] = useState(false);
  const [showView, setShowView] = useState(false);
  const [regraAtual, setRegraAtual] = useState<AutomationRule | null>(null);
  const [form, setForm] = useState<FormState>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [stages, setStages] = useState<Array<{ slug: string; nome: string; cor: string }>>([]);

  const [testForm, setTestForm] = useState(TEST_FORM_VAZIO);
  const [testResultado, setTestResultado] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const params: any = {};
      if (filtroTrigger) params.trigger = filtroTrigger;
      if (filtroAtivo === 'ativos') params.ativo = 'true';
      if (filtroAtivo === 'inativos') params.ativo = 'false';
      const { data } = await api.get<AutomationRule[]>('/automations', { params });
      setRegras(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setErro(err?.response?.data?.error || 'Erro ao carregar regras');
    } finally {
      setLoading(false);
    }
  }, [filtroTrigger, filtroAtivo]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.get('/helpdesk/stages').then(({ data }) => setStages(data)).catch(() => {});
  }, []);

  const abrirNova = () => {
    setForm({
      ...FORM_VAZIO,
      condicoes: [{ campo: '', operador: 'eq', valor: '' }],
      acoes: [{ tipo: 'definir_categoria', parametros: { categoria: '' } }],
    });
    setRegraAtual(null);
    setShowForm(true);
  };

  const abrirEdicao = (r: AutomationRule) => {
    setRegraAtual(r);
    setForm({
      id: r.id,
      nome: r.nome,
      descricao: r.descricao || '',
      trigger: r.trigger,
      condicoes: r.condicoes.length > 0 ? r.condicoes : [{ campo: '', operador: 'eq', valor: '' }],
      acoes: r.acoes.length > 0 ? r.acoes : [{ tipo: 'definir_categoria', parametros: {} }],
      logicOperator: r.logicOperator,
      ativo: r.ativo,
      ordem: r.ordem,
    });
    setShowForm(true);
  };

  const salvar = async () => {
    if (!form.nome.trim() || form.condicoes.length === 0 || form.acoes.length === 0) return;
    setSalvando(true);
    try {
      const condicoesFiltradas = form.condicoes.filter((c) => c.campo.trim() !== '');
      const payload: any = {
        nome: form.nome.trim(),
        descricao: form.descricao.trim() || null,
        trigger: form.trigger,
        condicoes: condicoesFiltradas,
        acoes: form.acoes,
        logicOperator: form.logicOperator,
        ativo: form.ativo,
        ordem: form.ordem,
      };
      if (form.id) {
        await api.patch(`/automations/${form.id}`, payload);
      } else {
        await api.post('/automations', payload);
      }
      setShowForm(false);
      load();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao salvar regra');
    } finally {
      setSalvando(false);
    }
  };

  const deletar = async (r: AutomationRule) => {
    if (!window.confirm(`Excluir regra "${r.nome}"?\n\nEsta acao nao pode ser desfeita.`)) return;
    try {
      await api.delete(`/automations/${r.id}`);
      load();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao deletar regra');
    }
  };

  const toggleAtivo = async (r: AutomationRule) => {
    try {
      await api.patch(`/automations/${r.id}`, { ativo: !r.ativo });
      load();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao alterar estado');
    }
  };

  const executarTeste = async () => {
    setTestLoading(true);
    setTestResultado(null);
    try {
      const contexto = JSON.parse(testForm.contexto);
      const { data } = await api.post('/automations/testar', {
        trigger: testForm.trigger,
        contexto,
      });
      setTestResultado(data);
    } catch (err: any) {
      if (err instanceof SyntaxError) {
        alert('JSON invalido no contexto de teste');
      } else {
        alert(err?.response?.data?.error || 'Erro ao testar');
      }
    } finally {
      setTestLoading(false);
    }
  };

  const totalAtivas = regras.filter((r) => r.ativo).length;
  const triggerLabel = (t: AutomationTrigger) => TRIGGERS.find((x) => x.value === t)?.label || t;
  const actionLabel = (a: AutomationAction) => ACTIONS.find((x) => x.value === a)?.label || a;

  const adicionarCondicao = () => {
    setForm({ ...form, condicoes: [...form.condicoes, { campo: '', operador: 'eq', valor: '' }] });
  };
  const removerCondicao = (idx: number) => {
    setForm({ ...form, condicoes: form.condicoes.filter((_, i) => i !== idx) });
  };
  const adicionarAcao = () => {
    setForm({ ...form, acoes: [...form.acoes, { tipo: 'definir_categoria', parametros: {} }] });
  };
  const removerAcao = (idx: number) => {
    setForm({ ...form, acoes: form.acoes.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
            <Zap className="text-amber-500" size={24} /> Automacoes (WHEN/IF/THEN)
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm">
            {regras.length} regra(s) • {totalAtivas} ativa(s)
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit(user?.role) && (
            <>
              <button onClick={() => { setTestForm(TEST_FORM_VAZIO); setTestResultado(null); setShowTester(true); }}
                className="bg-purple-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-purple-700 flex items-center gap-1">
                <Play size={14} /> Testar
              </button>
              <button onClick={abrirNova} className="btn-primary text-sm flex items-center gap-1">
                <Plus size={14} /> Nova Regra
              </button>
            </>
          )}
          <button onClick={load} disabled={loading} className="btn-secondary text-sm flex items-center gap-1.5 disabled:opacity-50">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Atualizar
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1A2222] rounded-xl border border-neutral-200 dark:border-neutral-700 p-3 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div className="relative">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select value={filtroTrigger} onChange={(e) => setFiltroTrigger(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg focus:ring-1 focus:ring-amber-500 outline-none appearance-none bg-white dark:bg-[#1A2222]">
              <option value="">Todos os gatilhos</option>
              {TRIGGERS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="flex bg-neutral-50 dark:bg-neutral-900 rounded-lg p-0.5 border border-neutral-200 dark:border-neutral-700">
            {(['todos', 'ativos', 'inativos'] as const).map((opt) => (
              <button key={opt} onClick={() => setFiltroAtivo(opt)}
                className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors capitalize ${
                  filtroAtivo === opt ? 'bg-amber-100 text-amber-700' : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:bg-neutral-800'
                }`}>
                {opt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {erro && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{erro}</div>}

      {loading && regras.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="animate-spin text-amber-500" size={32} />
        </div>
      ) : regras.length === 0 ? (
        <div className="bg-white dark:bg-[#1A2222] rounded-xl border border-neutral-200 dark:border-neutral-700 p-12 text-center">
          <Zap className="mx-auto text-neutral-300 mb-3" size={48} />
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Nenhuma regra de automacao cadastrada.</p>
          {canEdit(user?.role) && (
            <button onClick={abrirNova} className="btn-primary text-sm mt-4 inline-flex items-center gap-1">
              <Plus size={14} /> Criar primeira regra
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {regras.map((r) => (
            <div key={r.id} className={`bg-white dark:bg-[#1A2222] rounded-xl border shadow-sm p-4 ${r.ativo ? 'border-neutral-200 dark:border-neutral-700' : 'border-neutral-200 dark:border-neutral-700 opacity-60'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-navy-900">{r.nome}</h3>
                    {r.ativo ? (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">ATIVA</span>
                    ) : (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">INATIVA</span>
                    )}
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                      {r.logicOperator === 'all' ? 'TODAS' : 'ALGUMA'}
                    </span>
                  </div>
                  {r.descricao && <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">{r.descricao}</p>}
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded font-semibold">
                      WHEN {triggerLabel(r.trigger)}
                    </span>
                    <span className="text-neutral-400">IF</span>
                    {r.condicoes.length === 0 ? (
                      <span className="text-neutral-500 dark:text-neutral-400 italic">sempre</span>
                    ) : (
                      r.condicoes.map((c, i) => (
                        <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded">
                          {c.campo} {OPERATORS.find((o) => o.value === c.operador)?.label || c.operador} {String(c.valor)}
                        </span>
                      ))
                    )}
                    <span className="text-neutral-400">THEN</span>
                    {r.acoes.map((a, i) => (
                      <span key={i} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded">
                        {actionLabel(a.tipo)}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {canEdit(user?.role) && (
                    <>
                      <button onClick={() => toggleAtivo(r)}
                        className={`p-1.5 rounded ${r.ativo ? 'hover:bg-amber-50 text-amber-600' : 'hover:bg-emerald-50 text-emerald-600'}`}
                        title={r.ativo ? 'Desativar' : 'Ativar'}>
                        {r.ativo ? <PowerOff size={14} /> : <Power size={14} />}
                      </button>
                      <button onClick={() => abrirEdicao(r)} className="p-1.5 rounded hover:bg-blue-50 text-blue-600" title="Editar">
                        <Edit size={14} />
                      </button>
                      <button onClick={() => deletar(r)} className="p-1.5 rounded hover:bg-red-50 text-red-600" title="Deletar">
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !salvando && setShowForm(false)}>
          <div className="bg-white dark:bg-[#1A2222] rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white dark:bg-[#1A2222] border-b border-neutral-200 dark:border-neutral-700 px-6 py-4 flex items-center justify-between z-10">
              <h3 className="font-semibold text-gray-900">{form.id ? 'Editar Regra' : 'Nova Regra'}</h3>
              <button onClick={() => setShowForm(false)} disabled={salvando} className="text-neutral-400 hover:text-neutral-600 dark:text-neutral-300 p-1 disabled:opacity-50">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">Nome da Regra *</label>
                  <input type="text" value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    placeholder="Ex: Auto-classificar financeiro como alta"
                    className="input w-full" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">Ordem</label>
                  <input type="number" value={form.ordem}
                    onChange={(e) => setForm({ ...form, ordem: parseInt(e.target.value, 10) || 0 })}
                    className="input w-full" />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">Descricao</label>
                <input type="text" value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  placeholder="Frase curta explicando o que a regra faz"
                  className="input w-full" />
              </div>

              <div>
                <label className="text-xs font-semibold text-amber-700 mb-2 block flex items-center gap-1">
                  <Zap size={12} /> WHEN (Gatilho) *
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {TRIGGERS.map((t) => (
                    <button key={t.value} onClick={() => setForm({ ...form, trigger: t.value })}
                      className={`text-left p-3 rounded-lg border transition-colors ${
                        form.trigger === t.value ? 'border-amber-500 bg-amber-50' : 'border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:bg-neutral-900'
                      }`}>
                      <div className="text-sm font-semibold text-navy-900">{t.label}</div>
                      <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-blue-700 flex items-center gap-1">
                    <GitBranch size={12} /> IF (Condicoes)
                  </label>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setForm({ ...form, logicOperator: 'all' })}
                      className={`text-[10px] px-2 py-0.5 rounded ${form.logicOperator === 'all' ? 'bg-blue-100 text-blue-700 font-bold' : 'text-neutral-500 dark:text-neutral-400'}`}>
                      TODAS (AND)
                    </button>
                    <button onClick={() => setForm({ ...form, logicOperator: 'any' })}
                      className={`text-[10px] px-2 py-0.5 rounded ${form.logicOperator === 'any' ? 'bg-blue-100 text-blue-700 font-bold' : 'text-neutral-500 dark:text-neutral-400'}`}>
                      ALGUMA (OR)
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  {form.condicoes.map((c, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-blue-50/50 rounded-lg">
                      <input type="text" placeholder="campo (ex: categoria, prioridade)"
                        value={c.campo}
                        onChange={(e) => {
                          const newC = [...form.condicoes];
                          newC[idx] = { ...c, campo: e.target.value };
                          setForm({ ...form, condicoes: newC });
                        }}
                        className="input flex-1 text-xs" />
                      <select value={c.operador}
                        onChange={(e) => {
                          const newC = [...form.condicoes];
                          newC[idx] = { ...c, operador: e.target.value as AutomationOperator };
                          setForm({ ...form, condicoes: newC });
                        }}
                        className="input text-xs w-32">
                        {OPERATORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      <input type="text" placeholder="valor"
                        value={String(c.valor)}
                        onChange={(e) => {
                          const newC = [...form.condicoes];
                          newC[idx] = { ...c, valor: e.target.value };
                          setForm({ ...form, condicoes: newC });
                        }}
                        className="input flex-1 text-xs" />
                      <button onClick={() => removerCondicao(idx)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" disabled={form.condicoes.length === 1}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                  <button onClick={adicionarCondicao} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
                    <Plus size={12} /> Adicionar condicao
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-emerald-700 mb-2 block flex items-center gap-1">
                  <SettingsIcon size={12} /> THEN (Acoes)
                </label>
                <div className="space-y-2">
                  {form.acoes.map((a, idx) => {
                    const def = ACTIONS.find((x) => x.value === a.tipo);
                    return (
                      <div key={idx} className="p-3 bg-emerald-50/50 rounded-lg space-y-2">
                        <div className="flex items-center gap-2">
                          <select value={a.tipo}
                            onChange={(e) => {
                              const newA = [...form.acoes];
                              newA[idx] = { tipo: e.target.value as AutomationAction, parametros: {} };
                              setForm({ ...form, acoes: newA });
                            }}
                            className="input flex-1 text-xs">
                            {ACTIONS.map((act) => <option key={act.value} value={act.value}>{act.label}</option>)}
                          </select>
                          <button onClick={() => removerAcao(idx)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" disabled={form.acoes.length === 1}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                        {def && def.params.length > 0 && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-2">
                            {def.params.map((p) => (
                              <div key={p.key}>
                                <label className="text-[10px] text-neutral-600 dark:text-neutral-300 mb-0.5 block">{p.label}</label>
                                {p.type === 'select' ? (
                                  <select value={a.parametros[p.key] || ''}
                                    onChange={(e) => {
                                      const newA = [...form.acoes];
                                      newA[idx] = { ...a, parametros: { ...a.parametros, [p.key]: e.target.value } };
                                      setForm({ ...form, acoes: newA });
                                    }}
                                    className="input w-full text-xs">
                                    <option value="">—</option>
                                    {a.tipo === 'mudar_etapa' && p.key === 'etapa' ? (
                                      stages.map((s) => <option key={s.slug} value={s.slug}>{s.nome} ({s.slug})</option>)
                                    ) : (
                                      p.options?.map((o) => <option key={o} value={o}>{o}</option>)
                                    )}
                                  </select>
                                ) : (
                                  <input type={p.type === 'number' ? 'number' : 'text'}
                                    value={a.parametros[p.key] || ''}
                                    onChange={(e) => {
                                      const newA = [...form.acoes];
                                      newA[idx] = { ...a, parametros: { ...a.parametros, [p.key]: e.target.value } };
                                      setForm({ ...form, acoes: newA });
                                    }}
                                    className="input w-full text-xs" />
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <button onClick={adicionarAcao} className="text-xs text-emerald-600 hover:text-emerald-800 flex items-center gap-1">
                    <Plus size={12} /> Adicionar acao
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-neutral-50 dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-700">
                <input type="checkbox" id="ativo" checked={form.ativo}
                  onChange={(e) => setForm({ ...form, ativo: e.target.checked })} className="rounded" />
                <label htmlFor="ativo" className="text-xs text-gray-700 cursor-pointer">
                  Regra ativa (sera executada quando o gatilho ocorrer)
                </label>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white dark:bg-[#1A2222] border-t border-neutral-200 dark:border-neutral-700 px-6 py-3 flex gap-2 justify-end">
              <button onClick={() => setShowForm(false)} disabled={salvando} className="px-4 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm hover:bg-neutral-50 dark:bg-neutral-900 disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={salvar} disabled={!form.nome.trim() || form.condicoes.length === 0 || form.acoes.length === 0 || salvando}
                className="btn-primary disabled:opacity-50">
                {salvando ? 'Salvando...' : form.id ? 'Salvar alteracoes' : 'Criar Regra'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTester && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowTester(false)}>
          <div className="bg-white dark:bg-[#1A2222] rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white dark:bg-[#1A2222] border-b border-neutral-200 dark:border-neutral-700 px-6 py-4 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Play className="text-purple-600" size={16} /> Testar Regras
              </h3>
              <button onClick={() => setShowTester(false)} className="text-neutral-400 hover:text-neutral-600 dark:text-neutral-300 p-1">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">Gatilho a simular</label>
                <select value={testForm.trigger} onChange={(e) => setTestForm({ ...testForm, trigger: e.target.value as AutomationTrigger })}
                  className="input w-full">
                  {TRIGGERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block flex items-center gap-1">
                  <Code size={12} /> Contexto (JSON)
                </label>
                <textarea rows={10} value={testForm.contexto}
                  onChange={(e) => setTestForm({ ...testForm, contexto: e.target.value })}
                  className="input w-full font-mono text-xs" />
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-1">
                  Campos comuns: ticketId, categoria, prioridade, status, etapa, slaPausadoEm, etc.
                </p>
              </div>
              {testResultado && (
                <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
                  <div className="bg-neutral-50 dark:bg-neutral-900 px-3 py-2 text-xs font-semibold text-gray-700 border-b border-neutral-200 dark:border-neutral-700">
                    Resultado ({testResultado.regrasExecutadas?.length || 0} regra(s) executada(s))
                  </div>
                  <pre className="p-3 text-[11px] font-mono bg-white dark:bg-[#1A2222] overflow-x-auto max-h-64 overflow-y-auto">
                    {JSON.stringify(testResultado, null, 2)}
                  </pre>
                </div>
              )}
            </div>
            <div className="sticky bottom-0 bg-white dark:bg-[#1A2222] border-t border-neutral-200 dark:border-neutral-700 px-6 py-3 flex gap-2 justify-end">
              <button onClick={() => setShowTester(false)} className="px-4 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm hover:bg-neutral-50 dark:bg-neutral-900">
                Fechar
              </button>
              <button onClick={executarTeste} disabled={testLoading} className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-700 flex items-center gap-1 disabled:opacity-50">
                {testLoading ? <><RefreshCw size={12} className="animate-spin" /> Testando...</> : <><Play size={12} /> Executar</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
