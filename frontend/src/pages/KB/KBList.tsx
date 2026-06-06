import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useAuth } from '../../services/auth';
import {
  RefreshCw, BookOpen, Plus, Search, Edit, Trash2, Eye, ThumbsUp, ThumbsDown,
  CheckCircle, XCircle, FileText, Tag, EyeOff, Filter, Star,
} from 'lucide-react';
import type { KBArticle, KBListResponse, KBCategoriaRef } from '../../types';

const ROLES_EDIT: Record<string, number> = { admin: 4, gerente: 3, supervisor: 3, tecnico: 2, vendedor: 2 };
const ROLES_PUBLISH: Record<string, number> = { admin: 4, gerente: 3, supervisor: 3 };
const ROLES_DELETE: Record<string, number> = { admin: 4 };

function canEdit(role?: string): boolean {
  if (!role) return false;
  return (ROLES_EDIT[role] || 0) >= 2;
}
function canPublish(role?: string): boolean {
  if (!role) return false;
  return (ROLES_PUBLISH[role] || 0) >= 3;
}
function canDelete(role?: string): boolean {
  if (!role) return false;
  return (ROLES_DELETE[role] || 0) >= 4;
}

interface FormState {
  id?: string;
  titulo: string;
  conteudo: string;
  resumo: string;
  categoriaId: string;
  tags: string;
  publicado: boolean;
}

const FORM_VAZIO: FormState = {
  titulo: '',
  conteudo: '',
  resumo: '',
  categoriaId: '',
  tags: '',
  publicado: false,
};

export default function KBList() {
  const { user } = useAuth();
  const [items, setItems] = useState<KBArticle[]>([]);
  const [total, setTotal] = useState(0);
  const [categorias, setCategorias] = useState<KBCategoriaRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [publicadoFiltro, setPublicadoFiltro] = useState<'todos' | 'publicados' | 'rascunhos'>('todos');
  const [showForm, setShowForm] = useState(false);
  const [showViewer, setShowViewer] = useState(false);
  const [artigoAtual, setArtigoAtual] = useState<KBArticle | null>(null);
  const [form, setForm] = useState<FormState>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const params: any = { limit: 100 };
      if (busca) params.busca = busca;
      if (categoriaFiltro) params.categoriaId = categoriaFiltro;
      if (publicadoFiltro === 'publicados') params.publicado = 'true';
      if (publicadoFiltro === 'rascunhos') params.publicado = 'false';
      const { data } = await api.get<KBListResponse>('/kb', { params });
      setItems(data.items);
      setTotal(data.total);
    } catch (err: any) {
      setErro(err?.response?.data?.error || 'Erro ao carregar artigos');
    } finally {
      setLoading(false);
    }
  }, [busca, categoriaFiltro, publicadoFiltro]);

  const loadCategorias = useCallback(async () => {
    try {
      const { data } = await api.get<KBCategoriaRef[]>('/helpdesk/categorias');
      setCategorias(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Erro ao carregar categorias:', err);
    }
  }, []);

  useEffect(() => { loadCategorias(); }, [loadCategorias]);
  useEffect(() => { load(); }, [load]);

  const abrirNovo = () => {
    setForm(FORM_VAZIO);
    setArtigoAtual(null);
    setShowForm(true);
  };

  const abrirEdicao = (art: KBArticle) => {
    setArtigoAtual(art);
    setForm({
      id: art.id,
      titulo: art.titulo,
      conteudo: art.conteudo,
      resumo: art.resumo || '',
      categoriaId: art.categoriaId || '',
      tags: art.tags || '',
      publicado: art.publicado,
    });
    setShowForm(true);
  };

  const salvar = async () => {
    if (!form.titulo.trim() || !form.conteudo.trim()) return;
    setSalvando(true);
    try {
      const payload: any = {
        titulo: form.titulo.trim(),
        conteudo: form.conteudo.trim(),
        resumo: form.resumo.trim() || null,
        categoriaId: form.categoriaId || null,
        tags: form.tags.trim(),
        publicado: form.publicado,
      };
      if (form.id) {
        await api.patch(`/kb/${form.id}`, payload);
      } else {
        await api.post('/kb', payload);
      }
      setShowForm(false);
      load();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao salvar artigo');
    } finally {
      setSalvando(false);
    }
  };

  const deletar = async (art: KBArticle) => {
    if (!window.confirm(`Excluir artigo "${art.titulo}"?\n\nEsta acao nao pode ser desfeita.`)) return;
    try {
      await api.delete(`/kb/${art.id}`);
      load();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao deletar artigo');
    }
  };

  const togglePublicado = async (art: KBArticle) => {
    try {
      await api.post(`/kb/${art.id}/publicar`, { publicado: !art.publicado });
      load();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao alterar publicacao');
    }
  };

  const verArtigo = (art: KBArticle) => {
    setArtigoAtual(art);
    setShowViewer(true);
  };

  const feedback = async (art: KBArticle, util: boolean) => {
    try {
      await api.post(`/kb/${art.id}/feedback`, { util });
      alert(util ? 'Marcado como util!' : 'Marcado como inutil.');
      if (showViewer) {
        const { data } = await api.get<KBArticle>(`/kb/${art.id}`);
        setArtigoAtual(data);
      }
      load();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao registrar feedback');
    }
  };

  const totalUtil = items.reduce((acc, i) => acc + i.util, 0);
  const totalVisualizacoes = items.reduce((acc, i) => acc + i.visualizacoes, 0);
  const totalPublicados = items.filter((i) => i.publicado).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
            <BookOpen className="text-emerald-600" size={24} /> Base de Conhecimento
          </h1>
          <p className="text-neutral-500 text-sm">
            {total} artigo(s) • {totalPublicados} publicado(s)
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit(user?.role) && (
            <button onClick={abrirNovo} className="btn-primary text-sm flex items-center gap-1">
              <Plus size={14} /> Novo Artigo
            </button>
          )}
          <button onClick={load} disabled={loading}
            className="btn-secondary text-sm flex items-center gap-1.5 disabled:opacity-50">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Atualizar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-neutral-200 p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <FileText className="text-blue-600" size={16} />
            <span className="text-xs font-semibold text-neutral-500 uppercase">Total</span>
          </div>
          <p className="text-2xl font-bold text-navy-900 mt-1">{total}</p>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle className="text-emerald-600" size={16} />
            <span className="text-xs font-semibold text-neutral-500 uppercase">Publicados</span>
          </div>
          <p className="text-2xl font-bold text-navy-900 mt-1">{totalPublicados}</p>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <Eye className="text-purple-600" size={16} />
            <span className="text-xs font-semibold text-neutral-500 uppercase">Visualizacoes</span>
          </div>
          <p className="text-2xl font-bold text-navy-900 mt-1">{totalVisualizacoes}</p>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <ThumbsUp className="text-amber-600" size={16} />
            <span className="text-xs font-semibold text-neutral-500 uppercase">Feedbacks Uteis</span>
          </div>
          <p className="text-2xl font-bold text-navy-900 mt-1">{totalUtil}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 p-3 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Buscar por titulo ou conteudo..."
              value={busca} onChange={(e) => setBusca(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-neutral-200 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none" />
          </div>
          <div className="relative">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select value={categoriaFiltro} onChange={(e) => setCategoriaFiltro(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border border-neutral-200 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none appearance-none bg-white">
              <option value="">Todas categorias</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
          <div className="flex bg-neutral-50 rounded-lg p-0.5 border border-neutral-200">
            {(['todos', 'publicados', 'rascunhos'] as const).map((opt) => (
              <button key={opt} onClick={() => setPublicadoFiltro(opt)}
                className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors capitalize ${
                  publicadoFiltro === opt ? 'bg-emerald-100 text-emerald-700' : 'text-neutral-600 hover:bg-neutral-100'
                }`}>
                {opt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{erro}</div>
      )}

      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="animate-spin text-emerald-600" size={32} />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-neutral-200 p-12 text-center">
          <BookOpen className="mx-auto text-neutral-300 mb-3" size={48} />
          <p className="text-sm text-neutral-500">
            {busca || categoriaFiltro || publicadoFiltro !== 'todos'
              ? 'Nenhum artigo encontrado com esses filtros.'
              : 'Nenhum artigo cadastrado ainda.'}
          </p>
          {canEdit(user?.role) && !busca && !categoriaFiltro && publicadoFiltro === 'todos' && (
            <button onClick={abrirNovo} className="btn-primary text-sm mt-4 inline-flex items-center gap-1">
              <Plus size={14} /> Criar primeiro artigo
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200 text-xs text-neutral-500 uppercase tracking-wider">
                <th className="text-left py-3 px-4">Artigo</th>
                <th className="text-left py-3 px-4 hidden md:table-cell">Categoria</th>
                <th className="text-center py-3 px-4">Status</th>
                <th className="text-center py-3 px-4 hidden sm:table-cell">Stats</th>
                <th className="text-right py-3 px-4">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {items.map((art) => (
                <tr key={art.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-navy-900">{art.titulo}</div>
                    {art.resumo && <p className="text-xs text-neutral-500 mt-0.5 line-clamp-1">{art.resumo}</p>}
                    {art.tags && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {art.tags.split(',').filter(Boolean).slice(0, 3).map((t) => (
                          <span key={t} className="text-[10px] bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded">
                            {t.trim()}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 hidden md:table-cell">
                    {art.categoria ? (
                      <span className="text-xs font-medium text-neutral-700">{art.categoria.nome}</span>
                    ) : (
                      <span className="text-xs text-neutral-400">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {art.publicado ? (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 inline-flex items-center gap-1">
                        <CheckCircle size={10} /> publicado
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 inline-flex items-center gap-1">
                        <XCircle size={10} /> rascunho
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center hidden sm:table-cell">
                    <div className="flex items-center justify-center gap-2 text-[11px] text-neutral-500">
                      <span className="flex items-center gap-0.5"><Eye size={10} />{art.visualizacoes}</span>
                      <span className="flex items-center gap-0.5 text-emerald-600"><ThumbsUp size={10} />{art.util}</span>
                      <span className="flex items-center gap-0.5 text-red-600"><ThumbsDown size={10} />{art.inutil}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => verArtigo(art)} className="p-1.5 rounded hover:bg-neutral-100 text-neutral-600" title="Visualizar">
                        <Eye size={14} />
                      </button>
                      {canEdit(user?.role) && (
                        <button onClick={() => abrirEdicao(art)} className="p-1.5 rounded hover:bg-blue-50 text-blue-600" title="Editar">
                          <Edit size={14} />
                        </button>
                      )}
                      {canPublish(user?.role) && (
                        <button onClick={() => togglePublicado(art)} className={`p-1.5 rounded ${art.publicado ? 'hover:bg-amber-50 text-amber-600' : 'hover:bg-emerald-50 text-emerald-600'}`}
                          title={art.publicado ? 'Despublicar' : 'Publicar'}>
                          {art.publicado ? <EyeOff size={14} /> : <CheckCircle size={14} />}
                        </button>
                      )}
                      {canDelete(user?.role) && (
                        <button onClick={() => deletar(art)} className="p-1.5 rounded hover:bg-red-50 text-red-600" title="Deletar">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !salvando && setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">
                {form.id ? 'Editar Artigo' : 'Novo Artigo'}
              </h3>
              <button onClick={() => setShowForm(false)} disabled={salvando} className="text-neutral-400 hover:text-neutral-600 p-1 disabled:opacity-50">
                <XCircle size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">Titulo *</label>
                <input type="text" value={form.titulo}
                  onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                  placeholder="Ex: Como resolver erro de sincronizacao"
                  className="input w-full" />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">Resumo (opcional)</label>
                <input type="text" value={form.resumo}
                  onChange={(e) => setForm({ ...form, resumo: e.target.value })}
                  placeholder="Frase curta que aparece na busca"
                  className="input w-full" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">Categoria</label>
                  <select value={form.categoriaId}
                    onChange={(e) => setForm({ ...form, categoriaId: e.target.value })}
                    className="input w-full">
                    <option value="">—</option>
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">Tags (separadas por virgula)</label>
                  <input type="text" value={form.tags}
                    onChange={(e) => setForm({ ...form, tags: e.target.value })}
                    placeholder="erp, sync, erro"
                    className="input w-full" />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">Conteudo *</label>
                <textarea rows={14} value={form.conteudo}
                  onChange={(e) => setForm({ ...form, conteudo: e.target.value })}
                  placeholder="Escreva o conteudo do artigo. Suporta Markdown basico (## titulo, **negrito**, - lista)."
                  className="input w-full font-mono text-sm resize-none" />
                <p className="text-[10px] text-neutral-400 mt-1">{form.conteudo.length} caracteres</p>
              </div>

              <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                <input type="checkbox" id="publicado"
                  checked={form.publicado}
                  onChange={(e) => setForm({ ...form, publicado: e.target.checked })}
                  className="rounded" />
                <label htmlFor="publicado" className="text-xs text-emerald-800 cursor-pointer">
                  Publicar imediatamente (visivel para todos)
                </label>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-neutral-200 px-6 py-3 flex gap-2 justify-end">
              <button onClick={() => setShowForm(false)} disabled={salvando} className="px-4 py-2 border border-neutral-200 rounded-lg text-sm hover:bg-neutral-50 disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={salvar} disabled={!form.titulo.trim() || !form.conteudo.trim() || salvando}
                className="btn-primary disabled:opacity-50">
                {salvando ? 'Salvando...' : form.id ? 'Salvar alteracoes' : 'Criar Artigo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showViewer && artigoAtual && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowViewer(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-neutral-200 px-6 py-4 flex items-start justify-between">
              <div className="flex-1 min-w-0 pr-3">
                <h3 className="font-bold text-lg text-navy-900">{artigoAtual.titulo}</h3>
                <div className="flex items-center gap-3 text-xs text-neutral-500 mt-1 flex-wrap">
                  {artigoAtual.categoria && (
                    <span className="flex items-center gap-1"><Tag size={10} /> {artigoAtual.categoria.nome}</span>
                  )}
                  {artigoAtual.autor && <span>por {artigoAtual.autor.name}</span>}
                  <span className="flex items-center gap-1"><Eye size={10} /> {artigoAtual.visualizacoes} views</span>
                  <span>atualizado {new Date(artigoAtual.updatedAt).toLocaleDateString('pt-BR')}</span>
                </div>
              </div>
              <button onClick={() => setShowViewer(false)} className="text-neutral-400 hover:text-neutral-600 p-1 flex-shrink-0">
                <XCircle size={20} />
              </button>
            </div>
            <div className="p-6">
              {artigoAtual.resumo && (
                <p className="text-sm text-neutral-600 italic border-l-2 border-emerald-300 pl-3 mb-4">
                  {artigoAtual.resumo}
                </p>
              )}
              <div className="prose prose-sm max-w-none whitespace-pre-wrap text-navy-900 leading-relaxed">
                {artigoAtual.conteudo}
              </div>
            </div>
            <div className="sticky bottom-0 bg-white border-t border-neutral-200 px-6 py-3 flex items-center justify-between">
              <p className="text-xs text-neutral-500">Este artigo foi util?</p>
              <div className="flex items-center gap-2">
                <button onClick={() => feedback(artigoAtual, true)}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100">
                  <ThumbsUp size={12} /> Util ({artigoAtual.util})
                </button>
                <button onClick={() => feedback(artigoAtual, false)}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 bg-red-50 text-red-700 rounded-lg hover:bg-red-100">
                  <ThumbsDown size={12} /> Inutil ({artigoAtual.inutil})
                </button>
                <button onClick={() => setShowViewer(false)} className="text-xs text-neutral-500 hover:text-neutral-700 ml-2">
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
