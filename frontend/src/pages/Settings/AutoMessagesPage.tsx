import { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../services/auth';
import {
  MessageSquare, Save, RotateCcw, Check, AlertCircle, ChevronDown, ChevronUp, Variable,
  FileText, List, BarChart3, Plus, X,
} from 'lucide-react';

interface AutoMessage {
  slug: string;
  nome: string;
  descricao: string;
  mensagem: string;
  mensagemAtual: string;
  variaveis: string[];
}

interface Enquete {
  id: string;
  nome: string;
  tipo: string;
  opcoes: string;
}

const MENSAGENS_PRONTAS = [
  {
    nome: 'Saudação Padrão',
    mensagem: 'Olá {{nome}}! {{saudacao}}\n\nQue bom ter você por aqui!\n\nPor favor, selecione o departamento desejado:',
  },
  {
    nome: 'Agradecimento',
    mensagem: 'Obrigado pelo seu contato, {{nome}}!\n\nSeu atendimento foi concluído com sucesso.',
  },
  {
    nome: 'Fora de Horário',
    mensagem: 'Olá {{nome}}!\n\nNosso horário de atendimento é de segunda a sexta, das 8h às 18h.\n\nPor favor, aguarde o retorno no próximo dia útil.',
  },
  {
    nome: 'Aguardando Retorno',
    mensagem: 'Olá {{nome}}!\n\nEstamos aguardando seu retorno para continuar com o atendimento.\n\nSe precisar de ajuda, responda esta mensagem.',
  },
  {
    nome: 'CSAT Padrão',
    mensagem: 'Olá {{nome}}!\n\nSeu atendimento foi concluído com sucesso.\n\nPor favor, avalie sua experiência com um número de 1 a 5:\n\n*1* - Péssimo\n*2* - Ruim\n*3* - Regular\n*4* - Bom\n*5* - Excelente\n\nResponda com o *número* (1 a 5).',
  },
  {
    nome: 'Confirmação de Departamento',
    mensagem: 'Obrigado, {{nome}}!\n\nVocê foi direcionado para o departamento de *{{departamento}}*.\n\nUm atendente irá ajudá-lo em breve.',
  },
];

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
  const [enquetes, setEnquetes] = useState<Enquete[]>([]);
  const [showMensagensProntas, setShowMensagensProntas] = useState(false);
  const [showEnquetes, setShowEnquetes] = useState(false);

  useEffect(() => {
    carregarMensagens();
    carregarEnquetes();
  }, []);

  const carregarEnquetes = async () => {
    try {
      const { data } = await api.get('/enquetes');
      setEnquetes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

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

  const inserirMensagemPronta = (mensagem: string) => {
    setEditText(mensagem);
    setShowMensagensProntas(false);
  };

  const inserirEnquete = (enquete: Enquete) => {
    const opcoes = JSON.parse(enquete.opcoes);
    const opcoesTexto = opcoes.map((o: any) => `*${o.id}* - ${o.titulo}`).join('\n');
    const texto = `{{mensagem_enquete_${enquete.id}}}\n\n${opcoesTexto}\n\nResponda com o *número* da opção.`;
    setEditText(prev => prev + '\n\n' + texto);
    setShowEnquetes(false);
  };

  const inserirVariavel = (variavel: string) => {
    setEditText(prev => prev + ' ' + variavel + ' ');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <span className="text-sm text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>Carregando...</span>
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
                    <p className="text-xs text-slate-500 dark:text-slate-300" style={{ fontFamily: 'Lexend, sans-serif' }}>
                      {msg.descricao}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isExpanded ? <ChevronUp size={18} className="text-slate-400 dark:text-slate-300" /> : <ChevronDown size={18} className="text-slate-400 dark:text-slate-300" />}
                </div>
              </div>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-700">
                  <div className="pt-4">
                    {msg.variaveis.length > 0 && (
                      <div className="mb-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                        <div className="flex items-center gap-1.5 mb-2">
                          <Variable size={14} className="text-slate-400 dark:text-slate-300" />
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-200" style={{ fontFamily: 'Lexend, sans-serif' }}>
                            Variáveis disponíveis:
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {msg.variaveis.map((v) => (
                            <button
                              key={v}
                              onClick={() => inserirVariavel(v)}
                              className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-800/40 text-blue-700 dark:text-blue-200 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-700/50 transition-colors font-mono border border-blue-200 dark:border-blue-700/50"
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Mensagens Prontas e Enquetes */}
                    <div className="mb-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => setShowMensagensProntas(!showMensagensProntas)}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-green-100 dark:bg-green-800/40 text-green-700 dark:text-green-200 rounded-lg hover:bg-green-200 dark:hover:bg-green-700/50 transition-colors border border-green-200 dark:border-green-700/50"
                      >
                        <FileText size={12} />
                        Mensagens Prontas
                      </button>
                      <button
                        onClick={() => setShowEnquetes(!showEnquetes)}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-purple-100 dark:bg-purple-800/40 text-purple-700 dark:text-purple-200 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-700/50 transition-colors border border-purple-200 dark:border-purple-700/50"
                      >
                        <BarChart3 size={12} />
                        Inserir Enquete
                      </button>
                    </div>

                    {/* Lista de Mensagens Prontas */}
                    {showMensagensProntas && (
                      <div className="mb-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-green-700 dark:text-green-300">Mensagens Prontas</span>
                          <button onClick={() => setShowMensagensProntas(false)} className="text-green-500 hover:text-green-700">
                            <X size={14} />
                          </button>
                        </div>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {MENSAGENS_PRONTAS.map((mp, i) => (
                            <button
                              key={i}
                              onClick={() => inserirMensagemPronta(mp.mensagem)}
                              className="w-full text-left p-2 bg-white dark:bg-slate-800 rounded-lg border border-green-200 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                            >
                              <span className="text-xs font-medium text-green-800 dark:text-green-200">{mp.nome}</span>
                              <p className="text-[10px] text-green-600 dark:text-green-400 mt-0.5 truncate">{mp.mensagem.substring(0, 60)}...</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Lista de Enquetes */}
                    {showEnquetes && (
                      <div className="mb-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-purple-700 dark:text-purple-300">Enquetes Disponíveis</span>
                          <button onClick={() => setShowEnquetes(false)} className="text-purple-500 hover:text-purple-700">
                            <X size={14} />
                          </button>
                        </div>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {enquetes.length === 0 ? (
                            <p className="text-xs text-purple-500 dark:text-purple-400 text-center py-2">
                              Nenhuma enquete criada.{' '}
                              <a href="/app/settings/enquetes" className="underline">Criar agora</a>
                            </p>
                          ) : (
                            enquetes.map((e) => (
                              <button
                                key={e.id}
                                onClick={() => inserirEnquete(e)}
                                className="w-full text-left p-2 bg-white dark:bg-slate-800 rounded-lg border border-purple-200 dark:border-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                              >
                                <div className="flex items-center gap-2">
                                  {e.tipo === 'lista' ? <List size={12} className="text-purple-500" /> : <BarChart3 size={12} className="text-purple-500" />}
                                  <span className="text-xs font-medium text-purple-800 dark:text-purple-200">{e.nome}</span>
                                </div>
                                <p className="text-[10px] text-purple-600 dark:text-purple-400 mt-0.5">
                                  {JSON.parse(e.opcoes).length} opções
                                </p>
                              </button>
                            ))
                          )}
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
                    <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600">
                      <pre className="text-sm text-slate-700 dark:text-slate-100 whitespace-pre-wrap font-mono leading-relaxed" style={{ fontFamily: 'monospace' }}>
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
