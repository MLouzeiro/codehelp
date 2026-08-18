import { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, Calendar, Users, User, Check, RotateCcw } from 'lucide-react';

export type AnalistaOpcao = { id: string; name: string; active?: boolean };

export type PresetValor = 'hoje' | 'ontem' | '7dias' | '30dias' | 'mesAtual' | 'mesPassado';

export type PeriodoFiltro =
  | { tipo: 'preset'; valor: PresetValor }
  | { tipo: 'diaUnico'; data: string }
  | { tipo: 'intervalo'; inicio: string; fim: string };

export interface FiltrosAuditoria {
  analistaId: string;
  periodo: PeriodoFiltro;
}

export const PERIODO_PRESETS: { valor: PresetValor; label: string }[] = [
  { valor: 'hoje', label: 'Hoje' },
  { valor: 'ontem', label: 'Ontem' },
  { valor: '7dias', label: 'Últimos 7 dias' },
  { valor: '30dias', label: 'Últimos 30 dias' },
  { valor: 'mesAtual', label: 'Este mês' },
  { valor: 'mesPassado', label: 'Mês passado' },
];

export function periodoLabel(p: PeriodoFiltro): string {
  if (p.tipo === 'preset') {
    return PERIODO_PRESETS.find(x => x.valor === p.valor)?.label || 'Período';
  }
  if (p.tipo === 'diaUnico') {
    return new Date(p.data).toLocaleDateString('pt-BR');
  }
  return `${new Date(p.inicio).toLocaleDateString('pt-BR')} — ${new Date(p.fim).toLocaleDateString('pt-BR')}`;
}

export function periodoParaDatas(p: PeriodoFiltro, agora = new Date()): { inicio: Date; fim: Date } | null {
  if (p.tipo === 'preset') {
    const fim = new Date(agora);
    fim.setHours(23, 59, 59, 999);
    const inicio = new Date(agora);
    inicio.setHours(0, 0, 0, 0);
    switch (p.valor) {
      case 'hoje': return { inicio, fim };
      case 'ontem': {
        const ontem = new Date(inicio);
        ontem.setDate(ontem.getDate() - 1);
        const fimOntem = new Date(fim);
        fimOntem.setDate(fimOntem.getDate() - 1);
        return { inicio: ontem, fim: fimOntem };
      }
      case '7dias': {
        const i = new Date(inicio);
        i.setDate(i.getDate() - 6);
        return { inicio: i, fim };
      }
      case '30dias': {
        const i = new Date(inicio);
        i.setDate(i.getDate() - 29);
        return { inicio: i, fim };
      }
      case 'mesAtual': {
        const i = new Date(inicio);
        i.setDate(1);
        return { inicio: i, fim };
      }
      case 'mesPassado': {
        const i = new Date(inicio.getFullYear(), inicio.getMonth() - 1, 1);
        const f = new Date(i.getFullYear(), i.getMonth() + 1, 0, 23, 59, 59, 999);
        return { inicio: i, fim: f };
      }
    }
  }
  if (p.tipo === 'diaUnico' && p.data) {
    const d = new Date(p.data);
    d.setHours(0, 0, 0, 0);
    const f = new Date(d);
    f.setHours(23, 59, 59, 999);
    return { inicio: d, fim: f };
  }
  if (p.tipo === 'intervalo' && p.inicio && p.fim) {
    const i = new Date(p.inicio);
    i.setHours(0, 0, 0, 0);
    const f = new Date(p.fim);
    f.setHours(23, 59, 59, 999);
    return { inicio: i, fim: f };
  }
  return null;
}

function iniciais(nome: string): string {
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

interface Props {
  analistas: AnalistaOpcao[];
  filtros: FiltrosAuditoria;
  onChange: (filtros: FiltrosAuditoria) => void;
  onApply: () => void;
  loading?: boolean;
  analistasCarregando?: boolean;
}

const selectCls = 'px-2.5 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg text-sm text-slate-700 dark:text-slate-200';
const inputCls = 'px-2.5 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg text-sm text-slate-700 dark:text-slate-200';

export default function AuditoriaFiltros({ analistas, filtros, onChange, onApply, loading, analistasCarregando }: Props) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [modoCustom, setModoCustom] = useState<'dia' | 'intervalo'>('intervalo');
  const [erroPeriodo, setErroPeriodo] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fechar = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    };
    document.addEventListener('mousedown', fechar);
    return () => document.removeEventListener('mousedown', fechar);
  }, []);

  const selecionado = analistas.find(a => a.id === filtros.analistaId);
  const opcoesFiltradas = analistas.filter(a => a.name.toLowerCase().includes(busca.toLowerCase()));

  const setAnalista = (id: string) => {
    onChange({ ...filtros, analistaId: id });
    setAberto(false);
    setBusca('');
  };

  const setPreset = (valor: PresetValor) => {
    setErroPeriodo('');
    onChange({ ...filtros, periodo: { tipo: 'preset', valor } });
  };

  const setDiaUnico = (data: string) => {
    setErroPeriodo('');
    onChange({ ...filtros, periodo: { tipo: 'diaUnico', data } });
  };

  const setIntervalo = (inicio: string, fim: string) => {
    setErroPeriodo('');
    const prox: PeriodoFiltro = { tipo: 'intervalo', inicio, fim };
    const datas = periodoParaDatas(prox);
    if (datas) {
      const diff = (datas.fim.getTime() - datas.inicio.getTime()) / 86400000;
      if (diff > 90) {
        setErroPeriodo('O intervalo máximo permitido é de 90 dias.');
      } else if (datas.fim < datas.inicio) {
        setErroPeriodo('A data final não pode ser anterior à inicial.');
      }
    }
    onChange({ ...filtros, periodo: prox });
  };

  const customAtivo = filtros.periodo.tipo !== 'preset';

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 space-y-3 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        {/* Select de analista com busca */}
        <div className="relative" ref={containerRef}>
          <button
            type="button"
            onClick={() => setAberto(!aberto)}
            className="flex items-center gap-2 px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg text-sm text-slate-700 dark:text-slate-200 min-w-[220px] justify-between"
            style={{ fontFamily: 'Lexend, sans-serif' }}
          >
            <span className="flex items-center gap-2 min-w-0">
              {filtros.analistaId === 'todos' || !selecionado ? (
                <span className="w-6 h-6 rounded-full bg-red-600/10 text-red-600 dark:text-red-400 flex items-center justify-center flex-shrink-0">
                  <Users size={13} />
                </span>
              ) : (
                <span className="w-6 h-6 rounded-full bg-red-600/10 text-red-600 dark:text-red-400 flex items-center justify-center flex-shrink-0 text-[10px] font-bold">
                  {iniciais(selecionado.name)}
                </span>
              )}
              <span className="truncate">
                {analistasCarregando ? 'Carregando...' : filtros.analistaId === 'todos' || !selecionado ? 'Todos os Analistas' : selecionado.name}
              </span>
            </span>
            <ChevronDown size={14} className="text-slate-400 flex-shrink-0" />
          </button>

          {aberto && (
            <div className="absolute z-30 mt-2 w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl">
              <div className="p-2 border-b border-slate-100 dark:border-slate-700">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar analista..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className={`${inputCls} w-full pl-8`}
                    autoFocus
                  />
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto py-1">
                <button
                  type="button"
                  onClick={() => setAnalista('todos')}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${filtros.analistaId === 'todos' ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'}`}
                  style={{ fontFamily: 'Lexend, sans-serif' }}
                >
                  <span className="w-6 h-6 rounded-full bg-red-600/10 text-red-600 dark:text-red-400 flex items-center justify-center flex-shrink-0">
                    <Users size={13} />
                  </span>
                  <span className="flex-1">Todos os Analistas</span>
                  {filtros.analistaId === 'todos' && <Check size={14} />}
                </button>
                {opcoesFiltradas.map(a => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setAnalista(a.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${filtros.analistaId === a.id ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'}`}
                    style={{ fontFamily: 'Lexend, sans-serif' }}
                  >
                    <span className="w-6 h-6 rounded-full bg-red-600/10 text-red-600 dark:text-red-400 flex items-center justify-center flex-shrink-0 text-[10px] font-bold">
                      {iniciais(a.name)}
                    </span>
                    <span className="flex-1 truncate">{a.name}</span>
                    {!a.active && <span className="text-[10px] text-slate-400">inativo</span>}
                    {filtros.analistaId === a.id && <Check size={14} />}
                  </button>
                ))}
                {opcoesFiltradas.length === 0 && (
                  <p className="px-3 py-3 text-sm text-slate-400 text-center">Nenhum analista encontrado</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Presets de período */}
        <div className="flex flex-wrap items-center gap-1.5">
          {PERIODO_PRESETS.map(p => (
            <button
              key={p.valor}
              type="button"
              onClick={() => setPreset(p.valor)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${!customAtivo && filtros.periodo.tipo === 'preset' && filtros.periodo.valor === p.valor
                ? 'bg-red-600 text-white'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
              style={{ fontFamily: 'Lexend, sans-serif' }}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setErroPeriodo('');
              onChange({
                ...filtros,
                periodo: filtros.periodo.tipo === 'preset'
                  ? { tipo: 'intervalo', inicio: '', fim: '' }
                  : { tipo: 'preset', valor: '30dias' },
              });
            }}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${customAtivo
              ? 'bg-red-600 text-white'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
            style={{ fontFamily: 'Lexend, sans-serif' }}
          >
            Personalizado
          </button>
        </div>

        {/* Botão Auditar */}
        <button
          type="button"
          onClick={onApply}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ fontFamily: 'Lexend, sans-serif' }}
        >
          {loading ? 'Auditando...' : 'Auditar'}
        </button>
      </div>

      {/* Painel personalizado: dia único ou intervalo */}
      {customAtivo && (
        <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
            <Calendar size={13} /> Tipo:
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setModoCustom('dia');
                setErroPeriodo('');
                onChange({ ...filtros, periodo: { tipo: 'diaUnico', data: filtros.periodo.tipo === 'diaUnico' ? filtros.periodo.data : new Date().toISOString().slice(0, 10) } });
              }}
              className={`px-3 py-1 rounded-lg text-xs transition-colors ${modoCustom === 'dia' ? 'bg-red-600 text-white' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'}`}
            >
              Dia único
            </button>
            <button
              type="button"
              onClick={() => {
                setModoCustom('intervalo');
                setErroPeriodo('');
                onChange({ ...filtros, periodo: { tipo: 'intervalo', inicio: '', fim: '' } });
              }}
              className={`px-3 py-1 rounded-lg text-xs transition-colors ${modoCustom === 'intervalo' ? 'bg-red-600 text-white' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'}`}
            >
              Intervalo
            </button>
          </div>

          {modoCustom === 'dia' ? (
            <input
              type="date"
              value={filtros.periodo.tipo === 'diaUnico' ? filtros.periodo.data : ''}
              onChange={(e) => e.target.value && setDiaUnico(e.target.value)}
              className={inputCls}
            />
          ) : (
            <>
              <input
                type="date"
                value={filtros.periodo.tipo === 'intervalo' ? filtros.periodo.inicio : ''}
                onChange={(e) => {
                  const fim = filtros.periodo.tipo === 'intervalo' ? filtros.periodo.fim : '';
                  setIntervalo(e.target.value, fim);
                }}
                className={inputCls}
              />
              <span className="text-xs text-slate-400">até</span>
              <input
                type="date"
                value={filtros.periodo.tipo === 'intervalo' ? filtros.periodo.fim : ''}
                onChange={(e) => {
                  const inicio = filtros.periodo.tipo === 'intervalo' ? filtros.periodo.inicio : '';
                  setIntervalo(inicio, e.target.value);
                }}
                className={inputCls}
              />
            </>
          )}

          {erroPeriodo && (
            <span className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1" style={{ fontFamily: 'Lexend, sans-serif' }}>
              <RotateCcw size={12} /> {erroPeriodo}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
