import { useState, useEffect, useMemo } from 'react';
import {
  Plus, Layout, Trash2, Loader2, Search, Copy, ChevronDown,
  FileText, LayoutGrid, Settings, RefreshCw, X, Filter,
} from 'lucide-react';
import { useKanban } from '../../hooks/useKanban';
import { useAuth } from '../../services/auth';
import KanbanBoard from '../../components/KanbanBoard/KanbanBoard';
import type { KanbanBoard as KanbanBoardType, KanbanTemplate } from '../../types/kanban';

const BOARD_ICONS = ['📋', '🚀', '💡', '🎯', '📊', '🔧', '📁', '🏢', '⚙️', '📈', '🛠️', '📦'];
const BOARD_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#6366f1'];

const TEMPLATE_CATEGORIES = [
  'Todos', 'Geral', 'Marketing', 'Financeiro', 'Comercial',
  'Implantação', 'Suporte', 'Desenvolvimento', 'Estudo', 'Contratos',
];

export default function KanbanPage() {
  const { user } = useAuth();
  const {
    boards, currentBoard, loading, fetchBoards, fetchBoard,
    createBoard, deleteBoard, setCurrentBoard,
    fetchTemplates, createBoardFromTemplate,
  } = useKanban();

  const [showNewBoard, setShowNewBoard] = useState(false);
  const [showTemplateGallery, setShowTemplateGallery] = useState(false);
  const [newBoardForm, setNewBoardForm] = useState({
    nome: '', descricao: '', cor: '#3b82f6', icone: '📋',
  });
  const [templates, setTemplates] = useState<KanbanTemplate[]>([]);
  const [templateCategory, setTemplateCategory] = useState('Todos');
  const [templateSearch, setTemplateSearch] = useState('');
  const [creatingFromTemplate, setCreatingFromTemplate] = useState<string | null>(null);
  const [view, setView] = useState<'sidebar' | 'gallery'>('sidebar');

  useEffect(() => {
    fetchBoards();
  }, []);

  useEffect(() => {
    if (boards.length > 0 && !currentBoard) {
      fetchBoard(boards[0].id);
    }
  }, [boards]);

  useEffect(() => {
    if (showTemplateGallery) {
      fetchTemplates().then(setTemplates).catch(() => {});
    }
  }, [showTemplateGallery]);

  const filteredTemplates = useMemo(() => {
    return templates.filter(t => {
      const matchCategory = templateCategory === 'Todos' || t.categoria === templateCategory;
      const matchSearch = !templateSearch || t.nome.toLowerCase().includes(templateSearch.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [templates, templateCategory, templateSearch]);

  const handleCreateBoard = async () => {
    if (!newBoardForm.nome.trim()) return;
    const board = await createBoard(newBoardForm);
    setShowNewBoard(false);
    setNewBoardForm({ nome: '', descricao: '', cor: '#3b82f6', icone: '📋' });
    fetchBoards();
    if (board?.id) fetchBoard(board.id);
  };

  const handleCreateFromTemplate = async (templateId: string) => {
    setCreatingFromTemplate(templateId);
    try {
      const board = await createBoardFromTemplate(templateId);
      if (board?.id) fetchBoard(board.id);
      fetchBoards();
      setShowTemplateGallery(false);
    } catch { /* ignore */ }
    setCreatingFromTemplate(null);
  };

  const handleSelectBoard = (board: KanbanBoardType) => {
    fetchBoard(board.id);
  };

  const handleDeleteBoard = async (board: KanbanBoardType) => {
    if (!confirm(`Deletar o quadro "${board.nome}"? Todos os dados serão removidos.`)) return;
    await deleteBoard(board.id);
    if (currentBoard?.id === board.id) setCurrentBoard(null);
    fetchBoards();
  };

  const handleRefresh = () => {
    if (currentBoard) fetchBoard(currentBoard.id);
    fetchBoards();
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'gerente';

  if (loading && !currentBoard) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="animate-spin text-codemed-500" size={32} />
      </div>
    );
  }

  // ── Gallery View (when no board is selected or user clicks "Trocar Quadro") ──
  if (!currentBoard || view === 'gallery') {
    return (
      <div className="h-full flex flex-col bg-gray-50 dark:bg-slate-900">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Kanban</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">Gestão visual de demandas e projetos</p>
          </div>
          {currentBoard && (
            <button onClick={() => setView('sidebar')} className="btn-secondary text-sm flex items-center gap-2">
              <LayoutGrid size={16} /> Voltar ao Quadro
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Create Options */}
          <div className="max-w-4xl mx-auto mb-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {isAdmin && (
                <button
                  onClick={() => setShowNewBoard(true)}
                  className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-slate-600 hover:border-codemed-500 dark:hover:border-codemed-500 transition-colors group"
                >
                  <Layout size={32} className="text-gray-400 dark:text-slate-500 group-hover:text-codemed-500 mb-3 transition-colors" />
                  <span className="font-semibold text-gray-700 dark:text-slate-200">Criar Novo Quadro</span>
                  <span className="text-xs text-gray-400 dark:text-slate-500 mt-1">Quadro único e personalizado</span>
                </button>
              )}
              <button
                onClick={() => setShowTemplateGallery(true)}
                className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-slate-600 hover:border-codemed-500 dark:hover:border-codemed-500 transition-colors group"
              >
                <Copy size={32} className="text-gray-400 dark:text-slate-500 group-hover:text-codemed-500 mb-3 transition-colors" />
                <span className="font-semibold text-gray-700 dark:text-slate-200">Criar Novo Template</span>
                <span className="text-xs text-gray-400 dark:text-slate-500 mt-1">Reutilize sempre que precisar</span>
              </button>
            </div>

            {/* Search */}
            <div className="relative max-w-md mx-auto mb-8">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Pesquisar quadro pelo nome..."
                className="input w-full pl-10"
                onChange={e => {
                  const term = e.target.value.toLowerCase();
                  if (!term) { fetchBoards(); return; }
                }}
              />
            </div>
          </div>

          {/* Nossos Quadros */}
          <div className="max-w-6xl mx-auto mb-8">
            <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-4">Nossos Quadros</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {boards.map(board => (
                <div
                  key={board.id}
                  onClick={() => { fetchBoard(board.id); setView('sidebar'); }}
                  className={`relative group flex flex-col items-center p-4 bg-white dark:bg-slate-800 rounded-xl border cursor-pointer transition-all hover:shadow-md ${currentBoard?.id === board.id ? 'border-codemed-500 ring-2 ring-codemed-200 dark:ring-codemed-800' : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'}`}
                >
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl mb-2" style={{ backgroundColor: `${board.cor || '#3b82f6'}20` }}>
                    {board.icone || '📋'}
                  </div>
                  <span className="text-xs text-gray-400 dark:text-slate-500 mb-1">{board.criador?.name || 'Você'}</span>
                  <span className="text-sm font-medium text-gray-700 dark:text-slate-200 text-center truncate w-full">{board.nome}</span>
                  {isAdmin && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteBoard(board); }}
                      className="absolute top-2 right-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
              {boards.length === 0 && (
                <div className="col-span-full text-center py-12 text-gray-400 dark:text-slate-500">
                  <Layout size={48} className="mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Nenhum quadro encontrado. Crie um novo ou importe um template.</p>
                </div>
              )}
            </div>
          </div>

          {/* Importar Template */}
          <div className="max-w-6xl mx-auto">
            <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-4">Importar um Template</h2>
            <div className="flex flex-wrap gap-2 mb-4">
              {TEMPLATE_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setTemplateCategory(cat)}
                  className={`text-xs px-3 py-1.5 rounded-full transition-colors ${templateCategory === cat ? 'bg-codemed-500 text-white' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-400 border border-gray-200 dark:border-slate-700 hover:border-codemed-400'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {filteredTemplates.map(tpl => (
                <div
                  key={tpl.id}
                  onClick={() => handleCreateFromTemplate(tpl.id)}
                  className={`relative group flex flex-col items-center p-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 cursor-pointer transition-all hover:shadow-md hover:border-codemed-400 ${creatingFromTemplate === tpl.id ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl mb-2 bg-gray-100 dark:bg-slate-700">
                    {tpl.icone || '📋'}
                  </div>
                  <span className="text-xs text-gray-400 dark:text-slate-500 mb-1">{tpl.categoria || 'Geral'}</span>
                  <span className="text-sm font-medium text-gray-700 dark:text-slate-200 text-center truncate w-full">{tpl.nome}</span>
                  {creatingFromTemplate === tpl.id && (
                    <Loader2 size={16} className="absolute top-2 right-2 animate-spin text-codemed-500" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* New Board Modal */}
        {showNewBoard && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowNewBoard(false)}>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-lg text-gray-900 dark:text-slate-100">Novo Quadro</h3>
                <button onClick={() => setShowNewBoard(false)}><X size={20} className="text-gray-400" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1 block">Nome do Quadro *</label>
                  <input type="text" placeholder="Ex: Atualizações AGIL" value={newBoardForm.nome} onChange={e => setNewBoardForm({ ...newBoardForm, nome: e.target.value })} className="input w-full" autoFocus />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1 block">Descrição</label>
                  <textarea placeholder="Descrição do quadro (opcional)" value={newBoardForm.descricao} onChange={e => setNewBoardForm({ ...newBoardForm, descricao: e.target.value })} className="input w-full" rows={2} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-2 block">Ícone</label>
                  <div className="flex gap-2 flex-wrap">
                    {BOARD_ICONS.map(icon => (
                      <button key={icon} onClick={() => setNewBoardForm({ ...newBoardForm, icone: icon })} className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all ${newBoardForm.icone === icon ? 'bg-codemed-100 dark:bg-codemed-900/30 ring-2 ring-codemed-500 scale-110' : 'bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600'}`}>
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-2 block">Cor</label>
                  <div className="flex gap-2 flex-wrap">
                    {BOARD_COLORS.map(c => (
                      <button key={c} onClick={() => setNewBoardForm({ ...newBoardForm, cor: c })} className={`w-7 h-7 rounded-full border-2 transition-all ${newBoardForm.cor === c ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
                <button onClick={handleCreateBoard} className="btn-primary w-full" disabled={!newBoardForm.nome.trim()}>Criar Quadro</button>
              </div>
            </div>
          </div>
        )}

        {/* Template Gallery Modal */}
        {showTemplateGallery && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowTemplateGallery(false)}>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
                <h3 className="font-bold text-lg text-gray-900 dark:text-slate-100">Selecionar Template</h3>
                <button onClick={() => setShowTemplateGallery(false)}><X size={20} className="text-gray-400" /></button>
              </div>
              <div className="px-6 py-3 border-b border-gray-200 dark:border-slate-700">
                <div className="flex flex-wrap gap-2">
                  {TEMPLATE_CATEGORIES.map(cat => (
                    <button key={cat} onClick={() => setTemplateCategory(cat)} className={`text-xs px-3 py-1.5 rounded-full transition-colors ${templateCategory === cat ? 'bg-codemed-500 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-600'}`}>{cat}</button>
                  ))}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {filteredTemplates.map(tpl => (
                    <button
                      key={tpl.id}
                      onClick={() => handleCreateFromTemplate(tpl.id)}
                      disabled={creatingFromTemplate === tpl.id}
                      className="flex flex-col items-center p-4 bg-gray-50 dark:bg-slate-900/50 rounded-xl border border-gray-200 dark:border-slate-700 hover:border-codemed-400 hover:shadow-md transition-all disabled:opacity-50"
                    >
                      <div className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl mb-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
                        {tpl.icone || '📋'}
                      </div>
                      <span className="text-[10px] text-gray-400 dark:text-slate-500 mb-0.5">{tpl.categoria || 'Geral'}</span>
                      <span className="text-sm font-medium text-gray-700 dark:text-slate-200 text-center">{tpl.nome}</span>
                      {creatingFromTemplate === tpl.id && <Loader2 size={14} className="animate-spin text-codemed-500 mt-2" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Board View ──
  return (
    <div className="h-full flex flex-col">
      <KanbanBoard board={currentBoard} onRefresh={handleRefresh} onBackToGallery={() => setView('gallery')} />
    </div>
  );
}
