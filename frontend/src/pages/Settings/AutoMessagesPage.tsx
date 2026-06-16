import { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../services/auth';
import {
  MessageSquare, Save, RotateCcw, Check, AlertCircle, ChevronDown, ChevronUp, Variable,
} from 'lucide-react';

interface AutoMessage {
  slug: string;
  nome: string;
  descricao: string;
  mensagem: string;
  mensagemAtual: string;
  variaveis: string[];
}

export default function AutoMessagesPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<AutoMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    carregarMensagens();
  }, []);

  const carregarMensagens = async () => {
    try {
      const { data } = await api.get('/helpdesk/auto-messages');
      setMessages(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const iniciarEdicao = (msg: AutoMessage) => {
    setEditing(msg.slug);
    setEditText(msg.mensagemAtual);
    setError('');
    setSuccess('');
  };

  const cancelarEdicao = () => {
    setEditing(null);
    setEditText('');
    setError('');
  };

  const salvar = async (slug: string) => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.put(`/helpdesk/auto-messages/${slug}`, { mensagem: editText });
      setMessages(prev => prev.map(m => m.slug === slug ? { ...m, mensagemAtual: editText } : m));
      setEditing(null);
      setEditText('');
      setSuccess('Mensagem salva com sucesso');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const resetar = async (slug: string) => {
    if (!confirm('Tem certeza que deseja resetar esta mensagem para o padrão?')) return;
    try {
      await api.post(`/helpdesk/auto-messages/${slug}/reset`);
      const msg = messages.find(m => m.slug === slug);
      if (msg) {
        setMessages(prev => prev.map(m => m.slug === slug ? { ...m, mensagemAtual: msg.mensagem } : m));
      }
      setEditing(null);
      setSuccess('Mensagem resetada para o padrão');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao resetar');
    }
  };

  const inserirVariavel = (variavel: string) => {
    setEditText(prev => prev + ' ' + variavel + ' ');
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
            Mensagens Automáticas
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1" style={{ fontFamily: 'Lexend, sans-serif' }}>
            Edite todas as mensagens enviadas automaticamente pela plataforma
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400">
          <AlertCircle size={18} />
          <span className="text-sm" style={{ fontFamily: 'Lexend, sans-serif' }}>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-green-700 dark:text-green-400">
          <Check size={18} />
          <span className="text-sm" style={{ fontFamily: 'Lexend, sans-serif' }}>{success}</span>
        </div>
      )}

      <div className="space-y-3">
        {messages.map((msg) => {
          const isEditing = editing === msg.slug;
          const isExpanded = expanded === msg.slug;

          return (
            <div key={msg.slug} className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
                onClick={() => setExpanded(isExpanded ? null : msg.slug)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                    <MessageSquare size={18} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Lexend, sans-serif' }}>
                      {msg.nome}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
                      {msg.descricao}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isExpanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                </div>
              </div>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-700">
                  <div className="pt-4">
                    {msg.variaveis.length > 0 && (
                      <div className="mb-3 p-3 bg-slate-50 dark:bg-slate-750 rounded-xl">
                        <div className="flex items-center gap-1.5 mb-2">
                          <Variable size={14} className="text-slate-400" />
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
                            Variáveis disponíveis:
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {msg.variaveis.map((v) => (
                            <button
                              key={v}
                              onClick={() => inserirVariavel(v)}
                              className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors font-mono"
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {isEditing ? (
                      <div className="space-y-3">
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          rows={8}
                          className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono"
                          style={{ fontFamily: 'monospace' }}
                        />
                        <div className="flex gap-3">
                          <button
                            onClick={() => salvar(msg.slug)}
                            disabled={saving}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl transition-colors text-sm font-medium min-h-[40px]"
                            style={{ fontFamily: 'Lexend, sans-serif' }}
                          >
                            <Save size={16} />
                            {saving ? 'Salvando...' : 'Salvar'}
                          </button>
                          <button
                            onClick={cancelarEdicao}
                            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl transition-colors text-sm min-h-[40px]"
                            style={{ fontFamily: 'Lexend, sans-serif' }}
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={() => resetar(msg.slug)}
                            className="flex items-center gap-2 px-4 py-2 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-400 rounded-xl transition-colors text-sm min-h-[40px]"
                            style={{ fontFamily: 'Lexend, sans-serif' }}
                          >
                            <RotateCcw size={16} />
                            Resetar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="p-4 bg-slate-50 dark:bg-slate-750 rounded-xl border border-slate-200 dark:border-slate-700">
                          <pre className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-mono" style={{ fontFamily: 'monospace' }}>
                            {msg.mensagemAtual}
                          </pre>
                        </div>
                        <div className="flex gap-3">
                          <button
                            onClick={() => iniciarEdicao(msg)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors text-sm font-medium min-h-[40px]"
                            style={{ fontFamily: 'Lexend, sans-serif' }}
                          >
                            <MessageSquare size={16} />
                            Editar
                          </button>
                          <button
                            onClick={() => resetar(msg.slug)}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl transition-colors text-sm min-h-[40px]"
                            style={{ fontFamily: 'Lexend, sans-serif' }}
                          >
                            <RotateCcw size={16} />
                            Resetar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
