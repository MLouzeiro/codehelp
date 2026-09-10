import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import {
  FileText, Upload, Plus, Edit3, Copy, Trash2, Star, Eye,
  Loader2, X, ChevronDown, Settings, Palette, Layout, Image,
} from 'lucide-react';

interface OSLayout {
  id: string;
  nome: string;
  descricao?: string | null;
  tipo: string;
  ativo: boolean;
  padrao: boolean;
  configuracao: string;
  timbradoPath?: string | null;
  hasTimbrado?: boolean;
  hasLogo?: boolean;
  timbradoApply: string;
  margemTopo: number;
  margemBaixo: number;
  margemEsquerda: number;
  margemDireita: number;
  createdAt: string;
  updatedAt: string;
  _count?: { orders: number };
}

interface LayoutConfig {
  cores?: { primaria?: string; primariaClara?: string; texto?: string; textoClaro?: string; borda?: string };
  cabecalho?: { mostrarLogo?: boolean; logoLargura?: number; logoAltura?: number; tituloOs?: string; mostrarCnpj?: boolean; mostrarTelefone?: boolean; mostrarEmail?: boolean; mostrarWebsite?: boolean };
  rodape?: { mostrarEmpresa?: boolean; mostrarContato?: boolean; textoPersonalizado?: string; mostrarPagina?: boolean; mostrarDisclaimer?: boolean };
  secoes?: { cliente?: { visivel?: boolean }; servico?: { visivel?: boolean }; itens?: { visivel?: boolean }; tecnicoValor?: { visivel?: boolean }; observacoes?: { visivel?: boolean }; assinatura?: { visivel?: boolean } };
  logo?: { base64?: string; mimeType?: string; nome?: string };
}

const DEFAULT_CONFIG: LayoutConfig = {
  cores: { primaria: '#1a56db', primariaClara: '#e8eefb', texto: '#1f2937', textoClaro: '#6b7280', borda: '#d1d5db' },
  cabecalho: { mostrarLogo: true, logoLargura: 140, logoAltura: 70, tituloOs: 'ORDEM DE SERVIÇO', mostrarCnpj: true, mostrarTelefone: true, mostrarEmail: true, mostrarWebsite: true },
  rodape: { mostrarEmpresa: true, mostrarContato: true, mostrarPagina: true, mostrarDisclaimer: true },
  secoes: { cliente: { visivel: true }, servico: { visivel: true }, itens: { visivel: true }, tecnicoValor: { visivel: true }, observacoes: { visivel: true }, assinatura: { visivel: true } },
};

export default function OSLayoutsPage() {
  const navigate = useNavigate();
  const [layouts, setLayouts] = useState<OSLayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingLayout, setEditingLayout] = useState<OSLayout | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadNome, setUploadNome] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<LayoutConfig>(DEFAULT_CONFIG);
  const [form, setForm] = useState({ nome: '', descricao: '', tipo: 'personalizado', margemTopo: 0, margemBaixo: 0, margemEsquerda: 0, margemDireita: 0, timbradoApply: 'primeira_pagina' });
  const [uploadType, setUploadType] = useState<'logo' | 'timbrado'>('logo');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadLayouts(); }, []);

  const loadLayouts = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/orders/layouts');
      setLayouts(data);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleCreate = () => {
    setEditingLayout(null);
    setForm({ nome: '', descricao: '', tipo: 'personalizado', margemTopo: 0, margemBaixo: 0, margemEsquerda: 0, margemDireita: 0, timbradoApply: 'primeira_pagina' });
    setConfig(DEFAULT_CONFIG);
    setLogoPreview(null);
    setShowEditor(true);
  };

  const handleEdit = (layout: OSLayout) => {
    setEditingLayout(layout);
    setForm({
      nome: layout.nome,
      descricao: layout.descricao || '',
      tipo: layout.tipo,
      margemTopo: layout.margemTopo,
      margemBaixo: layout.margemBaixo,
      margemEsquerda: layout.margemEsquerda,
      margemDireita: layout.margemDireita,
      timbradoApply: layout.timbradoApply,
    });
    try {
      const parsedConfig = JSON.parse(layout.configuracao || '{}');
      setConfig(parsedConfig);
      if (parsedConfig.logo?.base64) {
        setLogoPreview(`data:${parsedConfig.logo.mimeType};base64,${parsedConfig.logo.base64}`);
      } else {
        setLogoPreview(null);
      }
    } catch { setConfig(DEFAULT_CONFIG); setLogoPreview(null); }
    setShowEditor(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) return alert('Nome é obrigatório');
    setSaving(true);
    try {
      const payload = { ...form, configuracao: config };
      if (editingLayout) {
        await api.put(`/orders/layouts/${editingLayout.id}`, payload);
      } else {
        await api.post('/orders/layouts', payload);
      }
      setShowEditor(false);
      loadLayouts();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao salvar layout');
    }
    setSaving(false);
  };

  const handleDuplicate = async (id: string) => {
    try {
      await api.post(`/orders/layouts/${id}/duplicate`);
      loadLayouts();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao duplicar');
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await api.post(`/orders/layouts/${id}/set-default`);
      loadLayouts();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao definir padrão');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este layout?')) return;
    try {
      await api.delete(`/orders/layouts/${id}`);
      loadLayouts();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao excluir');
    }
  };

  const handleUpload = async () => {
    if (!uploadFile || !uploadNome.trim()) return alert('Preencha o nome e selecione um arquivo');
    setUploading(true);
    try {
      const { data: newLayout } = await api.post('/orders/layouts', { nome: uploadNome, tipo: uploadType === 'logo' ? 'personalizado' : 'pdf_importado' });

      const endpoint = uploadType === 'logo' ? 'logo' : 'timbrado';
      const fd = new FormData();
      fd.append('file', uploadFile);
      try {
        await api.post(`/orders/layouts/${newLayout.id}/${endpoint}`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } catch (uploadErr: any) {
        await api.delete(`/orders/layouts/${newLayout.id}`).catch(() => {});
        throw uploadErr;
      }

      setShowUpload(false);
      setUploadFile(null);
      setUploadNome('');
      loadLayouts();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao fazer upload');
    }
    setUploading(false);
  };

  const handleImportTimbrado = async (layoutId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.type !== 'application/pdf') return alert('Selecione um PDF');
      if (file.size > 10 * 1024 * 1024) return alert('Arquivo muito grande (max 10MB)');
      const fd = new FormData();
      fd.append('file', file);
      try {
        await api.post(`/orders/layouts/${layoutId}/timbrado`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        alert('Timbrado importado com sucesso!');
        loadLayouts();
      } catch (err: any) {
        alert(err?.response?.data?.error || 'Erro ao importar timbrado');
      }
    };
    input.click();
  };

  const handleUploadLogo = async (layoutId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/jpg,image/webp';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) {
        return alert('Use PNG, JPEG ou WebP');
      }
      if (file.size > 5 * 1024 * 1024) return alert('Arquivo muito grande (max 5MB)');
      const fd = new FormData();
      fd.append('file', file);
      try {
        await api.post(`/orders/layouts/${layoutId}/logo`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        alert('Logo importado com sucesso!');
        loadLayouts();
      } catch (err: any) {
        alert(err?.response?.data?.error || 'Erro ao importar logo');
      }
    };
    input.click();
  };

  const handleDeleteLogo = async (layoutId: string) => {
    if (!confirm('Remover o logo deste layout?')) return;
    try {
      await api.delete(`/orders/layouts/${layoutId}/logo`);
      loadLayouts();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao remover logo');
    }
  };

  const updateConfig = (path: string, value: any) => {
    setConfig(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let obj: any = next;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!obj[keys[i]]) obj[keys[i]] = {};
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
      return next;
    });
  };

  const handleLogoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) {
      return alert('Use PNG, JPEG ou WebP');
    }
    if (file.size > 5 * 1024 * 1024) return alert('Arquivo muito grande (max 5MB)');

    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = (ev.target?.result as string).split(',')[1];
      updateConfig('logo', { base64, mimeType: file.type, nome: file.name });
      setLogoPreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    updateConfig('logo', null);
    setLogoPreview(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Layouts de Ordem de Serviço</h1>
          <p className="text-gray-500 dark:text-slate-400">Gerencie layouts e timbrados para as OS</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setUploadType('logo'); setShowUpload(true); }} className="btn-secondary flex items-center gap-2">
            <Image size={16} /> Importar Logo
          </button>
          <button onClick={() => { setUploadType('timbrado'); setShowUpload(true); }} className="btn-secondary flex items-center gap-2">
            <Upload size={16} /> Importar Timbrado
          </button>
          <button onClick={handleCreate} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Novo Layout
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-codemed-500" size={32} /></div>
      ) : layouts.length === 0 ? (
        <div className="card p-12 text-center">
          <Layout size={48} className="mx-auto text-gray-300 dark:text-slate-600 mb-4" />
          <p className="text-gray-500 dark:text-slate-400">Nenhum layout cadastrado</p>
          <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">Crie um layout ou importe um timbrado PDF</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {layouts.map(layout => (
            <div key={layout.id} className="card p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: layout.tipo === 'pdf_importado' ? '#fef3c7' : '#dbeafe' }}>
                {layout.tipo === 'pdf_importado' ? <FileText size={24} className="text-amber-600" /> : <Palette size={24} className="text-blue-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900 dark:text-slate-100">{layout.nome}</h3>
                  {layout.padrao && <span className="px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium">Padrão</span>}
                  {layout.tipo === 'pdf_importado' && layout.hasTimbrado && <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs">PDF</span>}
                  {layout.hasLogo && <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs">Logo</span>}
                  {!layout.ativo && <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 text-xs">Inativo</span>}
                </div>
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  {layout.tipo === 'pdf_importado'
                    ? (layout.hasTimbrado ? 'PDF importado' : 'PDF importado (sem arquivo)')
                    : (layout.hasLogo ? 'Layout com logo' : 'Layout personalizado')}
                  {layout._count?.orders ? ` · ${layout._count.orders} OS vinculada(s)` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => handleEdit(layout)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400" title="Editar">
                  <Edit3 size={16} />
                </button>
                {layout.tipo === 'pdf_importado' && (
                  <button onClick={() => handleImportTimbrado(layout.id)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400" title="Importar timbrado">
                    <Upload size={16} />
                  </button>
                )}
                {layout.tipo === 'personalizado' && (
                  <button onClick={() => handleUploadLogo(layout.id)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400" title="Importar logo">
                    <Image size={16} />
                  </button>
                )}
                <button onClick={() => handleDuplicate(layout.id)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400" title="Duplicar">
                  <Copy size={16} />
                </button>
                {!layout.padrao && (
                  <button onClick={() => handleSetDefault(layout.id)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400" title="Definir como padrão">
                    <Star size={16} />
                  </button>
                )}
                {!layout._count?.orders && (
                  <button onClick={() => handleDelete(layout.id)} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500" title="Excluir">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowUpload(false)} />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">
                {uploadType === 'logo' ? 'Importar Logo' : 'Importar Timbrado PDF'}
              </h2>
              <button onClick={() => setShowUpload(false)}><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Nome do layout</label>
                <input value={uploadNome} onChange={e => setUploadNome(e.target.value)} className="input w-full" placeholder={uploadType === 'logo' ? 'Ex: Logo Empresa' : 'Ex: Timbrado Empresa'} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  {uploadType === 'logo' ? 'Arquivo de imagem' : 'Arquivo PDF'}
                </label>
                <input ref={fileInputRef} type="file" accept={uploadType === 'logo' ? 'image/png,image/jpeg,image/jpg,image/webp' : '.pdf'} onChange={e => setUploadFile(e.target.files?.[0] || null)} className="input w-full" />
                <p className="text-xs text-gray-400 mt-1">
                  {uploadType === 'logo' ? 'Max 5MB. PNG, JPEG ou WebP.' : 'Max 10MB. Apenas PDF.'}
                </p>
              </div>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setShowUpload(false)} className="btn-secondary">Cancelar</button>
                <button onClick={handleUpload} disabled={!uploadFile || !uploadNome.trim() || uploading} className="btn-primary flex items-center gap-2">
                  {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  {uploading ? 'Enviando...' : 'Importar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowEditor(false)} />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">
                {editingLayout ? 'Editar Layout' : 'Novo Layout'}
              </h2>
              <button onClick={() => setShowEditor(false)}><X size={20} /></button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Nome *</label>
                  <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} className="input w-full" placeholder="Nome do layout" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Descrição</label>
                  <textarea value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} className="input w-full" rows={2} />
                </div>
              </div>

              {/* Radio buttons: Logo vs PDF Timbrado */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                  <Image size={16} /> Tipo de Identidade Visual
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${form.tipo === 'personalizado' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400' : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500'}`}>
                    <input
                      type="radio"
                      name="tipoLayout"
                      value="personalizado"
                      checked={form.tipo === 'personalizado'}
                      onChange={e => setForm({ ...form, tipo: e.target.value })}
                      className="w-4 h-4 text-blue-600"
                    />
                    <div className="flex items-center gap-2">
                      <Image size={20} className={form.tipo === 'personalizado' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-slate-500'} />
                      <div>
                        <span className="font-medium text-gray-900 dark:text-slate-100">Logo personalizado</span>
                        <p className="text-xs text-gray-500 dark:text-slate-400">Upload de imagem (PNG, JPEG)</p>
                      </div>
                    </div>
                  </label>
                  <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${form.tipo === 'pdf_importado' ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-400' : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500'}`}>
                    <input
                      type="radio"
                      name="tipoLayout"
                      value="pdf_importado"
                      checked={form.tipo === 'pdf_importado'}
                      onChange={e => setForm({ ...form, tipo: e.target.value })}
                      className="w-4 h-4 text-amber-600"
                    />
                    <div className="flex items-center gap-2">
                      <FileText size={20} className={form.tipo === 'pdf_importado' ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400 dark:text-slate-500'} />
                      <div>
                        <span className="font-medium text-gray-900 dark:text-slate-100">PDF Timbrado</span>
                        <p className="text-xs text-gray-500 dark:text-slate-400">Upload de PDF como fundo</p>
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Logo upload (apenas para tipo personalizado) */}
              {form.tipo === 'personalizado' && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Logo</h3>
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      {logoPreview ? (
                        <div className="relative inline-block">
                          <img src={logoPreview} alt="Logo" className="max-h-24 rounded-lg border border-gray-200 dark:border-slate-600" />
                          <button
                            onClick={handleRemoveLogo}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center w-48 h-24 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-xl cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
                          <Image size={24} className="text-gray-400 dark:text-slate-500 mb-2" />
                          <span className="text-xs text-gray-500 dark:text-slate-400">Clique para enviar logo</span>
                          <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" onChange={handleLogoFileSelect} className="hidden" />
                        </label>
                      )}
                    </div>
                    {logoPreview && (
                      <div className="text-xs text-gray-500 dark:text-slate-400">
                        <p>Logo configurado neste layout</p>
                        <p className="mt-1">Será usado no cabeçalho da OS</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                  <Palette size={16} /> Cores
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Primária', path: 'cores.primaria' },
                    { label: 'Primária Clara', path: 'cores.primariaClara' },
                    { label: 'Texto', path: 'cores.texto' },
                    { label: 'Texto Claro', path: 'cores.textoClaro' },
                    { label: 'Borda', path: 'cores.borda' },
                  ].map(({ label, path }) => (
                    <div key={path}>
                      <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">{label}</label>
                      <div className="flex gap-2 items-center">
                        <input type="color" value={config.cores?.[path.split('.')[1] as keyof typeof config.cores] || '#000000'} onChange={e => updateConfig(path, e.target.value)} className="w-8 h-8 rounded border-0 cursor-pointer" />
                        <input type="text" value={config.cores?.[path.split('.')[1] as keyof typeof config.cores] || ''} onChange={e => updateConfig(path, e.target.value)} className="input flex-1 text-xs" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                  <Settings size={16} /> Cabeçalho
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
                    <input type="checkbox" checked={config.cabecalho?.mostrarLogo !== false} onChange={e => updateConfig('cabecalho.mostrarLogo', e.target.checked)} className="rounded" />
                    Mostrar logo
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
                    <input type="checkbox" checked={config.cabecalho?.mostrarCnpj !== false} onChange={e => updateConfig('cabecalho.mostrarCnpj', e.target.checked)} className="rounded" />
                    Mostrar CNPJ
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
                    <input type="checkbox" checked={config.cabecalho?.mostrarTelefone !== false} onChange={e => updateConfig('cabecalho.mostrarTelefone', e.target.checked)} className="rounded" />
                    Mostrar telefone
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
                    <input type="checkbox" checked={config.cabecalho?.mostrarEmail !== false} onChange={e => updateConfig('cabecalho.mostrarEmail', e.target.checked)} className="rounded" />
                    Mostrar email
                  </label>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">Título da OS</label>
                    <input value={config.cabecalho?.tituloOs || ''} onChange={e => updateConfig('cabecalho.tituloOs', e.target.value)} className="input w-full text-sm" placeholder="ORDEM DE SERVIÇO" />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                  <FileText size={16} /> Rodapé
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
                    <input type="checkbox" checked={config.rodape?.mostrarEmpresa !== false} onChange={e => updateConfig('rodape.mostrarEmpresa', e.target.checked)} className="rounded" />
                    Mostrar empresa
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
                    <input type="checkbox" checked={config.rodape?.mostrarPagina !== false} onChange={e => updateConfig('rodape.mostrarPagina', e.target.checked)} className="rounded" />
                    Mostrar página
                  </label>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">Texto personalizado</label>
                    <input value={config.rodape?.textoPersonalizado || ''} onChange={e => updateConfig('rodape.textoPersonalizado', e.target.value)} className="input w-full text-sm" />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Seções visíveis</h3>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Cliente', path: 'secoes.cliente.visivel' },
                    { label: 'Serviço', path: 'secoes.servico.visivel' },
                    { label: 'Itens', path: 'secoes.itens.visivel' },
                    { label: 'Técnico/Valor', path: 'secoes.tecnicoValor.visivel' },
                    { label: 'Observações', path: 'secoes.observacoes.visivel' },
                    { label: 'Assinatura', path: 'secoes.assinatura.visivel' },
                  ].map(({ label, path }) => {
                    const keys = path.split('.');
                    const secKey = keys[1] as keyof typeof config.secoes;
                    const fieldKey = keys[2] as 'visivel';
                    const visible = config.secoes?.[secKey]?.[fieldKey] !== false;
                    return (
                      <label key={path} className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
                        <input type="checkbox" checked={visible} onChange={e => updateConfig(path, e.target.checked)} className="rounded" />
                        {label}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Margens (mm)</h3>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: 'Topo', key: 'margemTopo' },
                    { label: 'Baixo', key: 'margemBaixo' },
                    { label: 'Esquerda', key: 'margemEsquerda' },
                    { label: 'Direita', key: 'margemDireita' },
                  ].map(({ label, key }) => (
                    <div key={key}>
                      <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">{label}</label>
                      <input type="number" step="1" min="0" value={(form as any)[key]} onChange={e => setForm({ ...form, [key]: parseFloat(e.target.value) || 0 })} className="input w-full text-sm" />
                    </div>
                  ))}
                </div>
              </div>

              {form.tipo === 'pdf_importado' && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Timbrado PDF</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">Aplicar timbrado em</label>
                      <select value={form.timbradoApply} onChange={e => setForm({ ...form, timbradoApply: e.target.value })} className="input w-full text-sm">
                        <option value="primeira_pagina">Primeira página</option>
                        <option value="todas_paginas">Todas as páginas</option>
                      </select>
                    </div>
                    {editingLayout?.hasTimbrado && (
                      <div className="flex items-end">
                        <span className="text-xs text-green-600 dark:text-green-400">✓ Timbrado importado</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-3 justify-end border-t border-gray-200 dark:border-slate-700 pt-4">
                <button onClick={() => setShowEditor(false)} className="btn-secondary">Cancelar</button>
                <button onClick={handleSave} disabled={saving || !form.nome.trim()} className="btn-primary flex items-center gap-2">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
