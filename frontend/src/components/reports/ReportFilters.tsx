import { Calendar, X } from 'lucide-react';

export interface FiltroOpcoes {
  filas: { id: string; nome: string }[];
  departamentos: { id: string; nome: string }[];
  analistas: { id: string; name: string }[];
  clientes: { id: string; nome: string }[];
  canais: string[];
  prioridades: string[];
  statuses: string[];
  categorias: string[];
}

export interface FiltrosBase {
  dias: number;
  inicio: string;
  fim: string;
  filaId: string;
  canal: string;
  prioridade: string;
  status: string;
  departamentoId: string;
  analistaId: string;
  clienteId: string;
  categoria: string;
  assunto: string;
}

export const FILTROS_LIMPOS: FiltrosBase = {
  dias: 30, inicio: '', fim: '', filaId: '', canal: '', prioridade: '', status: '',
  departamentoId: '', analistaId: '', clienteId: '', categoria: '', assunto: '',
};

const PERIODOS = [
  { v: '1', l: 'Hoje' },
  { v: '7', l: '7 dias' },
  { v: '14', l: '14 dias' },
  { v: '30', l: '30 dias' },
  { v: '90', l: '90 dias' },
];

const selectCls = 'px-2.5 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg text-sm text-slate-700 dark:text-slate-200';
const inputCls = 'px-2.5 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg text-sm text-slate-700 dark:text-slate-200';

interface Props {
  opcoes?: FiltroOpcoes | null;
  filtros: FiltrosBase;
  onChange: (filtros: FiltrosBase) => void;
  exibirPeriodo?: boolean;
}

export default function ReportFilters({ opcoes, filtros, onChange, exibirPeriodo = true }: Props) {
  const setCampo = (campo: keyof FiltrosBase, valor: string) => {
    const next = { ...filtros, [campo]: valor };
    if (campo === 'dias') {
      next.inicio = '';
      next.fim = '';
    }
    onChange(next);
  };

  const limpar = () => onChange({ ...FILTROS_LIMPOS });

  const ativos = ['filaId', 'canal', 'prioridade', 'status', 'departamentoId', 'analistaId', 'clienteId', 'categoria', 'assunto', 'inicio'].filter(
    k => (filtros as any)[k]
  ).length;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 space-y-3 print:hidden">
      {exibirPeriodo && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide" style={{ fontFamily: 'Lexend, sans-serif' }}>
            Período:
          </span>
          {PERIODOS.map(p => (
            <button
              key={p.v}
              onClick={() => setCampo('dias', p.v)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${String(filtros.dias) === p.v && !filtros.inicio
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
              style={{ fontFamily: 'Lexend, sans-serif' }}
            >
              {p.l}
            </button>
          ))}
          <input type="date" value={filtros.inicio} onChange={e => setCampo('inicio', e.target.value)} className={inputCls} />
          <input type="date" value={filtros.fim} onChange={e => setCampo('fim', e.target.value)} className={inputCls} />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {opcoes && (
          <>
            <select value={filtros.filaId} onChange={e => setCampo('filaId', e.target.value)} className={selectCls}>
              <option value="">Todas as filas</option>
              {opcoes.filas.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
            <select value={filtros.canal} onChange={e => setCampo('canal', e.target.value)} className={selectCls}>
              <option value="">Todos os canais</option>
              {opcoes.canais.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filtros.prioridade} onChange={e => setCampo('prioridade', e.target.value)} className={selectCls}>
              <option value="">Todas prioridades</option>
              {opcoes.prioridades.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={filtros.status} onChange={e => setCampo('status', e.target.value)} className={selectCls}>
              <option value="">Todos status</option>
              {opcoes.statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filtros.departamentoId} onChange={e => setCampo('departamentoId', e.target.value)} className={selectCls}>
              <option value="">Todos departamentos</option>
              {opcoes.departamentos.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
            </select>
            <select value={filtros.analistaId} onChange={e => setCampo('analistaId', e.target.value)} className={selectCls}>
              <option value="">Todos analistas</option>
              {opcoes.analistas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <select value={filtros.clienteId} onChange={e => setCampo('clienteId', e.target.value)} className={selectCls}>
              <option value="">Todos clientes</option>
              {opcoes.clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <select value={filtros.categoria} onChange={e => setCampo('categoria', e.target.value)} className={selectCls}>
              <option value="">Todas categorias</option>
              {opcoes.categorias.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              type="text"
              placeholder="Assunto..."
              value={filtros.assunto}
              onChange={e => setCampo('assunto', e.target.value)}
              className={inputCls}
            />
          </>
        )}
        {ativos > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-semibold" style={{ fontFamily: 'Lexend, sans-serif' }}>
            <Calendar size={12} /> {ativos} filtros ativos
          </span>
        )}
        <button
          onClick={limpar}
          className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
          style={{ fontFamily: 'Lexend, sans-serif' }}
        >
          <X size={14} /> Limpar filtros
        </button>
      </div>
    </div>
  );
}