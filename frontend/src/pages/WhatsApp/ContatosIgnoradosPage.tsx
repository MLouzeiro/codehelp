import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import Modal, { ConfirmModal } from '../../components/Modal';
import ReportKpiCard from '../../components/reports/ReportKpiCard';
import {
  Ban, Phone, Users, Search, Plus, RotateCcw, Trash2, Pencil, ChevronDown,
  ChevronRight, ShieldCheck, History, RefreshCw, MessageSquare, AlertTriangle, ListChecks,
} from 'lucide-react';

interface HistoricoEvento {
  data: string;
  usuario: string;
  acao: string;
  motivo?: string;
}

interface ItemIgnorado {
  id: string;
  tipo: 'contato' | 'grupo';
  chave: string;
  nome: string;
  motivo: string | null;
  regra: string;
  ignorado: boolean;
  criadoPorId?: string | null;
  reativadoPorId?: string | null;
  criadoEm: string;
  reativadoEm?: string | null;
  criadoPor?: { id: string; name: string } | null;
  reativadoPor?: { id: string; name: string } | null;
  historico: HistoricoEvento[];
}

interface Resumo {
  contatosIgnorados: number;
  gruposIgnorados: number;
  ativos: number;
  ignoradosMes: number;
  reativadosMes: number;
  principaisMotivos: Array<{ motivo: string; quantidade: number }>;
}

const TABS = [
  { valor: 'todos', label: 'Todos' },
  { valor: 'contato', label: 'Contatos', icon: Phone },
  { valor: 'grupo', label: 'Grupos', icon: Users },
  { valor: 'ignorado', label: 'Ignorados' },
  { valor: 'ativo', label: 'Ativos' },
];

const inputCls = 'w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500/40';

export default function ContatosIgnoradosPage() {
  const [items, setItems] = useState<ItemIgnorado[]>([]);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [tab, setTab] = useState('todos');
  const [busca, setBusca] = useState('');
  const [debouncedBusca, setDebouncedBusca] = useState('');

  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<ItemIgnorado | null>(null);
  const [form, setForm] = useState({ tipo: 'contato', chave: '', nome: '', motivo: '', regra: 'ignorar_helpdesk' });
  const [salvando, setSalvando] = useState(false);
  const [formErro, setFormErro] = useState('');

  const [reativarItem, setReativarItem] = useState<ItemIgnorado | null>(null);
  const [deletarItem, setDeletarItem] = useState<ItemIgnorado | null>(null);
  const [expandHist, setExpandHist] = useState<string | null>(null);

  const [alerta, setAlerta] = useState('');

  const loadResumo = useCallback(async () => {
    try {
      const { data } = await api.get('/whatsapp/ignorados/resumo');
      setResumo(data);
    } catch {
      /* não bloqueia a lista */
    }
  }, []);

  const loadLista = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: any = {
        tipo: tab === 'contato' || tab === 'grupo' ? tab : 'todos',
        status: tab === 'ignorado' || tab === 'ativo' ? tab : 'todos',
        page,
        limit: 50,
      };
      if (debouncedBusca.trim()) params.search = debouncedBusca.trim();
      const { data } = await api.get('/whatsapp/ignorados', { params });
      setItems(data.items);
      setTotal(data.total);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao carregar contatos ignorados');
    } finally {
      setLoading(false);
    }
  }, [tab, page, debouncedBusca]);

  useEffect(() => { loadLista(); }, [loadLista]);
  useEffect(() => { loadResumo(); }, [loadResumo]);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedBusca(busca); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [busca]);

  const abrirNovo = () => {
    setEditando(null);
    setForm({ tipo: 'contato', chave: '', nome: '', motivo: '', regra: 'ignorar_helpdesk' });
    setFormErro('');
    setModalAberto(true);
  };

  const abrirEditar = (item: ItemIgnorado) => {
    setEditando(item);
    setForm({ tipo: item.tipo, chave: item.chave, nome: item.nome, motivo: item.motivo || '', regra: item.regra });
    setFormErro('');
    setModalAberto(true);
  };

  const salvar = async () => {
    setSalvando(true);
    setFormErro('');
    try {
      if (editando) {
        await api.patch(`/whatsapp/ignorados/${editando.id}`, {
          nome: form.nome,
          motivo: form.motivo,
          regra: form.regra,
        });
      } else {
        await api.post('/whatsapp/ignorados', {
          tipo: form.tipo,
          chave: form.chave,
          nome: form.nome,
          motivo: form.motivo,
          regra: form.regra,
        });
      }
      setModalAberto(false);
      await Promise.all([loadLista(), loadResumo()]);
    } catch (err: any) {
      setFormErro(err.response?.data?.error || 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  };

  const reativar = async () => {
    if (!reativarItem) return;
    try {
      await api.post(`/whatsapp/ignorados/${reativarItem.id}/reativar`);
      setReativarItem(null);
      await Promise.all([loadLista(), loadResumo()]);
      setAlerta('Contato/grupo reativado. A partir da próxima mensagem ele volta ao fluxo normal do Helpdesk.');
      setTimeout(() => setAlerta(''), 5000);
    } catch (err: any) {
      setAlerta(err.response?.data?.error || 'Erro ao reativar');
    }
  };

  const alternar = async (item: ItemIgnorado) => {
    try {
      await api.post(`/whatsapp/ignorados/${item.id}/toggle`);
      await Promise.all([loadLista(), loadResumo()]);
    } catch (err: any) {
      setAlerta(err.response?.data?.error || 'Erro ao alternar status');
    }
  };

  const excluir = async () => {
    if (!deletarItem) return;
    try {
      await api.delete(`/whatsapp/ignorados/${deletarItem.id}`);
      setDeletarItem(null);
      await Promise.all([loadLista(), loadResumo()]);
    } catch (err: any) {
      setAlerta(err.response?.data?.error || 'Erro ao excluir');
    }
  };

  const formatarChave = (item: ItemIgnorado) =>
    item.tipo === 'grupo' ? item.chave : `+${item.chave}`;

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>
            Contatos ignorados do Helpdesk
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
            Números e grupos que não iniciam atendimento automático no Helpdesk (WhatsApp permanece conectado)
          </p>
        </div>
        <button
          onClick={abrirNovo}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl"
          style={{ fontFamily: 'Lexend, sans-serif' }}
        >
          <Plus size={16} /> Adicionar
        </button>
      </div>

      {alerta && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-sm text-blue-700 dark:text-blue-300" style={{ fontFamily: 'Lexend, sans-serif' }}>
          <ShieldCheck size={16} /> {alerta}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300" style={{ fontFamily: 'Lexend, sans-serif' }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* Indicadores */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <ReportKpiCard label="Contatos ignorados" valor={resumo?.contatosIgnorados ?? '—'} icon={Phone} cor="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" />
        <ReportKpiCard label="Grupos ignorados" valor={resumo?.gruposIgnorados ?? '—'} icon={Users} cor="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400" />
        <ReportKpiCard label="Ativos (reativados)" valor={resumo?.ativos ?? '—'} icon={ShieldCheck} cor="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" />
        <ReportKpiCard label="Ignorados este mês" valor={resumo?.ignoradosMes ?? '—'} icon={Ban} cor="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" />
        <ReportKpiCard label="Reativados este mês" valor={resumo?.reativadosMes ?? '—'} icon={RotateCcw} cor="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" />
      </div>

      {/* Principais motivos */}
      {resumo && resumo.principaisMotivos.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-3">
            <ListChecks size={16} className="text-slate-400" />
            <h3 className="font-bold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>Principais motivos</h3>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {resumo.principaisMotivos.map((m, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-slate-100 dark:border-slate-700 px-3 py-2 text-sm" style={{ fontFamily: 'Lexend, sans-serif' }}>
                <span className="text-slate-700 dark:text-slate-200">{m.motivo}</span>
                <span className="font-semibold text-slate-500 dark:text-slate-400">{m.quantidade}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {TABS.map((t) => {
            const Icon = t.icon;
            const ativo = tab === t.valor;
            return (
              <button
                key={t.valor}
                onClick={() => { setTab(t.valor); setPage(1); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${ativo ? 'bg-red-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
                style={{ fontFamily: 'Lexend, sans-serif' }}
              >
                {Icon && <Icon size={14} />} {t.label}
              </button>
            );
          })}
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Pesquisar contato, número ou grupo..."
            className={`${inputCls} pl-9`}
          />
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-slate-400"><RefreshCw className="animate-spin" size={24} /></div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-400">
            <ShieldCheck size={28} />
            <p className="text-sm" style={{ fontFamily: 'Lexend, sans-serif' }}>Nenhum contato/grupo encontrado para estes filtros.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 text-left text-xs uppercase text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
                  <th className="px-4 py-3">Contato</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Motivo</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <FragmentRow key={item.id} item={item} expandHist={expandHist} setExpandHist={setExpandHist} alternar={alternar} abrirEditar={abrirEditar} setDeletarItem={setDeletarItem} formatarChave={formatarChave} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && total > 50 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
            <span>{total} registro(s)</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 disabled:opacity-40">Anterior</button>
              <span>Página {page}</span>
              <button onClick={() => setPage((p) => p + 1)} disabled={page * 50 >= total} className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 disabled:opacity-40">Próxima</button>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400 dark:text-slate-500" style={{ fontFamily: 'Lexend, sans-serif' }}>
        <MessageSquare size={12} className="inline mr-1" />
        O WhatsApp permanece conectado. Apenas o fluxo automático do Helpdesk (ticket, fila, saudação, menu e IA) é interrompido para esses contatos/grupos.
      </p>

      {/* Modal adicionar/editar */}
      <Modal open={modalAberto} onClose={() => setModalAberto(false)} title={editando ? 'Editar contato ignorado' : 'Adicionar contato ignorado'} size="md">
        <div className="space-y-4">
          {formErro && (
            <div className="px-3 py-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-xs text-red-700 dark:text-red-300" style={{ fontFamily: 'Lexend, sans-serif' }}>{formErro}</div>
          )}

          {!editando && (
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2" style={{ fontFamily: 'Lexend, sans-serif' }}>Tipo</label>
              <div className="flex gap-3">
                <label className={`flex items-center gap-2 flex-1 px-3 py-2 rounded-lg border text-sm cursor-pointer ${form.tipo === 'contato' ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-slate-200 dark:border-slate-600'}`} style={{ fontFamily: 'Lexend, sans-serif' }}>
                  <input type="radio" name="tipo" checked={form.tipo === 'contato'} onChange={() => setForm({ ...form, tipo: 'contato' })} className="accent-red-600" />
                  <span className="text-slate-700 dark:text-slate-200">Numero</span>
                </label>
                <label className={`flex items-center gap-2 flex-1 px-3 py-2 rounded-lg border text-sm cursor-pointer ${form.tipo === 'grupo' ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-slate-200 dark:border-slate-600'}`} style={{ fontFamily: 'Lexend, sans-serif' }}>
                  <input type="radio" name="tipo" checked={form.tipo === 'grupo'} onChange={() => setForm({ ...form, tipo: 'grupo' })} className="accent-red-600" />
                  <span className="text-slate-700 dark:text-slate-200">Grupo</span>
                </label>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1" style={{ fontFamily: 'Lexend, sans-serif' }}>
              {form.tipo === 'grupo' ? 'ID do grupo (jid)' : 'Número de WhatsApp'}
            </label>
            <input
              type="text"
              value={form.chave}
              onChange={(e) => setForm({ ...form, chave: e.target.value })}
              disabled={!!editando}
              placeholder={form.tipo === 'grupo' ? '1203630XXXXXXXX@g.us' : '+55 98 99999-9999'}
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1" style={{ fontFamily: 'Lexend, sans-serif' }}>Nome/identificação</label>
            <input type="text" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Teste Márcio" className={inputCls} />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1" style={{ fontFamily: 'Lexend, sans-serif' }}>Motivo</label>
            <input type="text" value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} placeholder="Ex: Número interno, fornecedor, teste..." className={inputCls} />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2" style={{ fontFamily: 'Lexend, sans-serif' }}>Regra</label>
            <div className="flex gap-3">
              <label className={`flex items-center gap-2 flex-1 px-3 py-2 rounded-lg border text-sm cursor-pointer ${form.regra === 'ignorar_helpdesk' ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-slate-200 dark:border-slate-600'}`} style={{ fontFamily: 'Lexend, sans-serif' }}>
                <input type="radio" name="regra" checked={form.regra === 'ignorar_helpdesk'} onChange={() => setForm({ ...form, regra: 'ignorar_helpdesk' })} className="accent-red-600" />
                <span className="text-slate-700 dark:text-slate-200">Não iniciar Helpdesk</span>
              </label>
              <label className={`flex items-center gap-2 flex-1 px-3 py-2 rounded-lg border text-sm cursor-pointer ${form.regra === 'bloquear' ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-slate-200 dark:border-slate-600'}`} style={{ fontFamily: 'Lexend, sans-serif' }}>
                <input type="radio" name="regra" checked={form.regra === 'bloquear'} onChange={() => setForm({ ...form, regra: 'bloquear' })} className="accent-red-600" />
                <span className="text-slate-700 dark:text-slate-200">Bloqueado completamente</span>
              </label>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={() => setModalAberto(false)} className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-medium rounded-xl transition-colors" style={{ fontFamily: 'Lexend, sans-serif' }}>
              Cancelar
            </button>
            <button onClick={salvar} disabled={salvando} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50" style={{ fontFamily: 'Lexend, sans-serif' }}>
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirmação reativar */}
      <ConfirmModal
        open={!!reativarItem}
        onClose={() => setReativarItem(null)}
        onConfirm={reativar}
        title="Reativar contato"
        message={`Deseja permitir novamente que "${reativarItem?.nome}" entre no Helpdesk?`}
        confirmLabel="Sim, reativar"
        cancelLabel="Cancelar"
      />

      {/* Confirmação excluir */}
      <ConfirmModal
        open={!!deletarItem}
        onClose={() => setDeletarItem(null)}
        onConfirm={excluir}
        title="Excluir registro"
        message={`Excluir "${deletarItem?.nome}" da lista de ignorados?`}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        danger
      />
    </div>
  );
}

function FragmentRow({ item, expandHist, setExpandHist, alternar, abrirEditar, setDeletarItem, formatarChave }: any) {
  const expandido = expandHist === item.id;
  return (
    <>
      <tr className="border-b border-slate-100 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-700/30">
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setExpandHist(expandido ? null : item.id)}
              className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              aria-label="Histórico"
            >
              {expandido ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            </button>
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
              {item.tipo === 'grupo' ? <Users size={15} /> : <Phone size={15} />}
            </div>
            <div>
              <p className="font-medium text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Lexend, sans-serif' }}>{item.nome}</p>
              <p className="text-xs text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>{formatarChave(item)}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${item.tipo === 'grupo' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`} style={{ fontFamily: 'Lexend, sans-serif' }}>
            {item.tipo === 'grupo' ? 'Grupo' : 'Contato'}
          </span>
        </td>
        <td className="px-4 py-3 text-slate-600 dark:text-slate-300" style={{ fontFamily: 'Lexend, sans-serif' }}>{item.motivo || '—'}</td>
        <td className="px-4 py-3">
          {item.ignorado ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
              Ignorado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
              Ativo
            </span>
          )}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => alternar(item)}
              title={item.ignorado ? 'Desativar (reativar)' : 'Ativar'}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${item.ignorado ? 'bg-red-500' : 'bg-emerald-500'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${item.ignorado ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
            <button onClick={() => abrirEditar(item)} title="Editar" className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><Pencil size={15} /></button>
            <button onClick={() => setDeletarItem(item)} title="Excluir" className="p-1.5 text-slate-400 hover:text-red-500"><Trash2 size={15} /></button>
          </div>
        </td>
      </tr>
      {expandido && (
        <tr>
          <td colSpan={5} className="px-4 py-3 bg-slate-50 dark:bg-slate-900/40">
            <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
              <History size={13} /> Histórico de alterações
            </div>
            {item.historico.length === 0 ? (
              <p className="text-xs text-slate-400" style={{ fontFamily: 'Lexend, sans-serif' }}>Sem histórico registrado.</p>
            ) : (
              <div className="space-y-2">
                {item.historico.map((h: HistoricoEvento, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-xs" style={{ fontFamily: 'Lexend, sans-serif' }}>
                    <div className="w-2 h-2 mt-1 rounded-full bg-red-400 shrink-0" />
                    <div className="text-slate-600 dark:text-slate-300">
                      <span className="font-medium text-slate-700 dark:text-slate-200">{h.acao === 'adicionado' ? 'Adicionado à lista de ignorados' : h.acao === 'reativado' ? 'Reativado' : 'Editado'}</span>
                      <span className="text-slate-400"> — {h.usuario} em {new Date(h.data).toLocaleString('pt-BR')}</span>
                      {h.motivo && <div className="text-slate-500 dark:text-slate-400">Motivo: {h.motivo}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
