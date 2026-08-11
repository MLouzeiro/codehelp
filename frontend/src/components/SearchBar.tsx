import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, User, Ticket as TicketIcon, BookOpen, Users, Loader2 } from 'lucide-react';
import api from '../services/api';

interface SearchSuggestion {
  tipo: string;
  titulo: string;
}

interface SearchResult {
  id: string;
  tipo: 'cliente' | 'ticket' | 'usuario' | 'kb';
  titulo: string;
  subtitulo?: string;
  detalhes?: string;
  rota?: string;
  score: number;
  icone: string;
}

const TIPO_ICONE: Record<string, any> = {
  cliente: User,
  ticket: TicketIcon,
  usuario: Users,
  kb: BookOpen,
};

const TIPO_COR: Record<string, string> = {
  cliente: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  ticket: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  usuario: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  kb: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
};

const TIPO_LABEL: Record<string, string> = {
  cliente: 'Cliente',
  ticket: 'Ticket',
  usuario: 'Usuario',
  kb: 'Base de Conhecimento',
};

interface SearchBarProps {
  onSearch?: (query: string) => void;
  compact?: boolean;
  className?: string;
}

export default function SearchBar({ onSearch, compact, className = '' }: SearchBarProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    try {
      const { data } = await api.get('/search/suggestions', { params: { q } });
      setSuggestions(data.suggestions || []);
    } catch {
      setSuggestions([]);
    }
  }, []);

  const fetchResults = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get('/search', { params: { q, limit: 12 } });
      setResults(data.results || []);
      setShowResults(true);
    } catch {
      setResults([]);
      setShowResults(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (open) {
        fetchResults(query);
      } else {
        fetchSuggestions(query);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, open, fetchSuggestions, fetchResults]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = (result: SearchResult) => {
    if (result.rota) navigate(result.rota);
    setOpen(false);
    setShowResults(false);
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && query.trim()) {
      if (onSearch) {
        onSearch(query);
      } else {
        fetchResults(query);
        setOpen(true);
      }
    }
    if (e.key === 'Escape') {
      setOpen(false);
      setShowResults(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={containerRef} className={`relative z-[50] ${className}`}>
      <div className={`flex items-center gap-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 ${compact ? '' : 'shadow-sm'} focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 dark:focus-within:ring-blue-900/30 transition-all`}>
        <Search size={compact ? 14 : 16} className="text-gray-400 dark:text-slate-500 flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (query.length >= 2) setOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder="Buscar clientes, tickets, usuarios, artigos..."
          className={`flex-1 outline-none bg-transparent text-sm text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 ${compact ? 'text-xs' : ''}`}
        />
        {query && (
          <button onClick={() => { setQuery(''); setSuggestions([]); setResults([]); setShowResults(false); }}
            className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300">
            <X size={compact ? 12 : 14} />
          </button>
        )}
        {loading && <Loader2 size={14} className="text-blue-500 dark:text-blue-400 animate-spin" />}
      </div>

      {open && !showResults && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="px-3 py-2 text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider border-b border-gray-100 dark:border-slate-700">
            Sugestoes
          </div>
          {suggestions.map((s, i) => (
            <button key={i}
              onClick={() => { setQuery(s.titulo); fetchResults(s.titulo); }}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-2 transition-colors">
              <Search size={12} className="text-gray-400 dark:text-slate-500" />
              {s.titulo}
            </button>
          ))}
        </div>
      )}

      {open && showResults && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-lg z-50 overflow-hidden max-h-[70vh] overflow-y-auto">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-400 dark:text-slate-500 text-sm">
              Nenhum resultado para "{query}"
            </div>
          ) : (
            <>
              <div className="px-3 py-2 text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
                <span>{results.length} resultado(s)</span>
                <button onClick={() => { setOpen(false); setShowResults(false); }}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-700 normal-case tracking-normal font-medium">
                  Fechar
                </button>
              </div>
              {results.map((r) => {
                const Icon = TIPO_ICONE[r.tipo] || Search;
                return (
                  <button key={`${r.tipo}-${r.id}`}
                    onClick={() => handleSelect(r)}
                    className="w-full text-left px-3 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-start gap-3 transition-colors border-b border-gray-50 dark:border-slate-700/50 last:border-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${TIPO_COR[r.tipo]}`}>
                      <Icon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{r.titulo}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${TIPO_COR[r.tipo]}`}>
                          {TIPO_LABEL[r.tipo]}
                        </span>
                      </div>
                      {r.subtitulo && <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{r.subtitulo}</p>}
                      {r.detalhes && <p className="text-[10px] text-gray-400 dark:text-slate-500 truncate mt-0.5">{r.detalhes}</p>}
                    </div>
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
