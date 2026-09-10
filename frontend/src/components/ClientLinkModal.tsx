import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, X, Building2, Phone, FileText, ExternalLink, Check } from 'lucide-react';
import api from '../services/api';

interface ClientResult {
  id: string;
  razaoSocial: string;
  nomeFantasia?: string;
  cnpjCpf?: string;
  telefone?: string;
  email?: string;
  segmento?: string;
  status?: string;
}

interface ClientLinkModalProps {
  open: boolean;
  onClose: () => void;
  onLinked: () => void;
  ticketId: string;
  ticketContactName?: string;
  ticketContactPhone?: string;
}

export default function ClientLinkModal({ open, onClose, onLinked, ticketId, ticketContactName, ticketContactPhone }: ClientLinkModalProps) {
  const [step, setStep] = useState<'search' | 'confirm'>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ClientResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<ClientResult | null>(null);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (open) {
      setStep('search');
      setQuery('');
      setResults([]);
      setSelected(null);
      setError('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const searchClients = useCallback(async (term: string) => {
    if (!term || term.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/crm/clients', { params: { search: term, limit: 10 } });
      setResults(data.clients || []);
    } catch {
      setError('Erro ao buscar laboratórios');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchClients(value), 300);
  };

  const handleSelect = (client: ClientResult) => {
    setSelected(client);
    setStep('confirm');
  };

  const handleConfirm = async () => {
    if (!selected || !ticketId) return;
    setLinking(true);
    setError('');
    try {
      await api.patch(`/helpdesk/tickets/${ticketId}/client`, { clientId: selected.id });
      onLinked();
      onClose();
    } catch {
      setError('Erro ao vincular laboratório');
    } finally {
      setLinking(false);
    }
  };

  const handleCreateNew = () => {
    window.open('/app/crm/new', '_blank');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col border border-slate-200 dark:border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              {step === 'search' ? 'Vincular Laboratório' : 'Confirmar Vínculo'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {step === 'search'
                ? 'Busque pelo nome, CNPJ ou telefone'
                : `Vincular ao ticket de ${ticketContactName || 'contato'}`
              }
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {step === 'search' ? (
            <>
              {/* Search input */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  placeholder="Ex.: Laboratório São José, 12.345.678/0001-90..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500"
                />
                {loading && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent" />
                  </div>
                )}
              </div>

              {/* Results */}
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-600 dark:text-red-400 mb-3">
                  {error}
                </div>
              )}

              {results.length > 0 && (
                <div className="space-y-2">
                  {results.map((client) => (
                    <div
                      key={client.id}
                      className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm text-slate-800 dark:text-slate-100 truncate">
                            {client.razaoSocial}
                          </div>
                          {client.nomeFantasia && (
                            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                              {client.nomeFantasia}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                            {client.cnpjCpf && (
                              <span className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                                <FileText className="w-3 h-3" /> {client.cnpjCpf}
                              </span>
                            )}
                            {client.telefone && (
                              <span className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                                <Phone className="w-3 h-3" /> {client.telefone}
                              </span>
                            )}
                            {client.segmento && (
                              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                {client.segmento}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleSelect(client)}
                          className="shrink-0 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" /> Vincular
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {query.length >= 2 && !loading && results.length === 0 && !error && (
                <div className="text-center py-8">
                  <Building2 className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                    Nenhum laboratório encontrado para "{query}"
                  </p>
                  <button
                    onClick={handleCreateNew}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium flex items-center gap-1 mx-auto"
                  >
                    <ExternalLink className="w-4 h-4" /> Cadastrar novo laboratório
                  </button>
                </div>
              )}

              {query.length < 2 && results.length === 0 && (
                <div className="text-center py-8">
                  <Search className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Digite pelo menos 2 caracteres para buscar
                  </p>
                </div>
              )}

              {/* Create new button */}
              <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
                <button
                  onClick={handleCreateNew}
                  className="w-full text-sm text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 font-medium py-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-500 transition-colors flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" /> Cadastrar novo laboratório
                </button>
              </div>
            </>
          ) : (
            /* Confirm step */
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Deseja vincular este cliente ao ticket?
              </p>

              {selected && (
                <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg">
                  <div className="text-sm font-medium text-slate-800 dark:text-slate-100 mb-2">
                    {selected.razaoSocial}
                  </div>
                  {selected.nomeFantasia && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                      {selected.nomeFantasia}
                    </div>
                  )}
                  <div className="space-y-1">
                    {selected.cnpjCpf && (
                      <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                        CNPJ: {selected.cnpjCpf}
                      </div>
                    )}
                    {selected.telefone && (
                      <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        Telefone: {selected.telefone}
                      </div>
                    )}
                    {selected.segmento && (
                      <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        Segmento: {selected.segmento}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-600 dark:text-red-400">
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-slate-200 dark:border-slate-700">
          {step === 'confirm' ? (
            <>
              <button
                onClick={() => setStep('search')}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Voltar
              </button>
              <button
                onClick={handleConfirm}
                disabled={linking}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2"
              >
                {linking ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Vinculando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" /> Confirmar Vínculo
                  </>
                )}
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              Cancelar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
