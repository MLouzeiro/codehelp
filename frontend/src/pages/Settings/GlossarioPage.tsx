import { useState } from 'react';
import { BookOpen, Search, ChevronDown, ChevronRight, GraduationCap, Target, Info } from 'lucide-react';
import { METRIC_GLOSSARY, TRAINING_CATEGORIES, CAUSAS_PROVEIS, type GlossaryEntry, type TrainingCategory } from '../../lib/metricGlossary';

function MetricCard({ entry }: { entry: GlossaryEntry }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm">
            {entry.sigla}
          </div>
          <div>
            <div className="font-semibold text-sm text-slate-800 dark:text-slate-200">{entry.sigla}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{entry.nome}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {entry.meta && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-medium">
              Meta: {entry.meta}
            </span>
          )}
          {open ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-100 dark:border-slate-700 pt-3">
          <div>
            <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Nome Completo</h4>
            <p className="text-sm text-slate-700 dark:text-slate-300">{entry.nomeCompleto}</p>
          </div>
          <div>
            <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">O que mede</h4>
            <p className="text-sm text-slate-700 dark:text-slate-300">{entry.descricao}</p>
          </div>
          <div>
            <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Como e calculado</h4>
            <p className="text-sm text-slate-600 dark:text-slate-400">{entry.comoCalculado}</p>
          </div>
          <div className="flex items-center gap-4">
            <div>
              <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Unidade</h4>
              <p className="text-sm text-slate-700 dark:text-slate-300">{entry.unidade}</p>
            </div>
            {entry.meta && (
              <div>
                <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Meta</h4>
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{entry.meta}</p>
              </div>
            )}
          </div>
          {entry.interpretacao && (
            <div>
              <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Interpretacao</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">{entry.interpretacao}</p>
            </div>
          )}
          {entry.exemplos && entry.exemplos.length > 0 && (
            <div>
              <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Exemplos</h4>
              <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                {entry.exemplos.map((ex, i) => <li key={i} className="flex items-start gap-1"><span className="text-violet-400 mt-0.5">•</span>{ex}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TrainingCategoryCard({ cat }: { cat: TrainingCategory }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{cat.icone}</span>
        <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">{cat.nome}</span>
      </div>
      <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">{cat.descricao}</p>
      {cat.exemplos.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {cat.exemplos.map((ex, i) => (
            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">{ex}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function GlossarioPage() {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'metricas' | 'treinamento' | 'causas'>('metricas');

  const filteredMetrics = METRIC_GLOSSARY.filter((e) =>
    !search || e.sigla.toLowerCase().includes(search.toLowerCase()) || e.nome.toLowerCase().includes(search.toLowerCase()) || e.descricao.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2" style={{ fontFamily: 'Khand, sans-serif' }}>
            <BookOpen size={24} className="text-violet-600" /> Glossario de Metricas
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Definicoes centralizadas de todas as metricas e siglas do sistema.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar metrica..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          />
        </div>
        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
          {(['metricas', 'treinamento', 'causas'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${tab === t ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}>
              {t === 'metricas' ? 'Metricas' : t === 'treinamento' ? 'Categorias Treinamento' : 'Causas Provaveis'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'metricas' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredMetrics.map((entry) => (
            <MetricCard key={entry.sigla} entry={entry} />
          ))}
          {filteredMetrics.length === 0 && (
            <div className="col-span-2 text-center py-12 text-slate-400 dark:text-slate-500 text-sm">
              Nenhuma metrica encontrada para "{search}"
            </div>
          )}
        </div>
      )}

      {tab === 'treinamento' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {TRAINING_CATEGORIES.map((cat) => (
            <TrainingCategoryCard key={cat.id} cat={cat} />
          ))}
        </div>
      )}

      {tab === 'causas' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {CAUSAS_PROVEIS.map((c) => (
            <div key={c.tipo} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-2">
                <Target size={16} className="text-violet-600" />
                <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">{c.label}</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">{c.descricao}</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-violet-50 dark:bg-violet-900/10 border border-violet-200 dark:border-violet-800 rounded-xl p-4">
        <div className="flex items-start gap-2">
          <Info size={16} className="text-violet-600 dark:text-violet-400 mt-0.5" />
          <div className="text-sm text-violet-700 dark:text-violet-300">
            <strong>Como usar:</strong> Passe o mouse sobre qualquer sigla em qualquer tela do sistema para ver uma explicacao rapida. Clique para ver os detalhes completos.
          </div>
        </div>
      </div>
    </div>
  );
}
