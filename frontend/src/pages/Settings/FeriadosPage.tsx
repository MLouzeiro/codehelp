import { useState, useEffect, FormEvent } from 'react';
import { Plus, Trash2, Edit2, X, CalendarOff, Sparkles, Check } from 'lucide-react';
import api from '../../services/api';

interface Feriado {
  id: string;
  data: string;
  nome: string;
  tipo: string;
  recorrente: boolean;
  ativo: boolean;
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

export default function FeriadosPage() {
  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ tipo: 'criar' | 'editar'; feriado?: Feriado } | null>(null);
  const [incluirInativos, setIncluirInativos] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);

  useEffect(() => { carregar(); }, [incluirInativos]);

  const carregar = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/feriados', { params: { incluirInativos } });
      setFeriados(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    setSeedMsg(null);
    try {
      const { data } = await api.post('/feriados/seed');
      setSeedMsg(data.inseridos === 0 ? 'Feriados nacionais já cadastrados.' : `${data.inseridos} feriados nacionais inseridos.`);
      await carregar();
    } catch (err: any) {
      setSeedMsg(err?.response?.data?.error || 'Erro ao semear feriados.');
    } finally {
      setSeeding(false);
    }
  };

  const handleDelete = async (f: Feriado) => {
    if (!confirm(`Remover "${f.nome}"?`)) return;
    try {
      await api.delete(`/feriados/${f.id}`);
      await carregar();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleAtivo = async (f: Feriado) => {
    try {
      await api.put(`/feriados/${f.id}`, { ativo: !f.ativo });
      await carregar();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-codemed-700 dark:text-neutral-100 flex items-center gap-2">
            <CalendarOff size={24} /> Feriados
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400">Cadastre feriados para bloquear o atendimento automático fora do horário comercial</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSeed} disabled={seeding} className="btn-secondary flex items-center gap-2">
            <Sparkles size={18} /> {seeding ? 'Semeando...' : 'Semear nacionais'}
          </button>
          <button onClick={() => setModal({ tipo: 'criar' })} className="btn-primary flex items-center gap-2">
            <Plus size={18} /> Novo feriado
          </button>
        </div>
      </div>

      {seedMsg && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-2 rounded flex items-center gap-2">
          <Check size={18} /> {seedMsg}
        </div>
      )}

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-200 cursor-pointer">
          <input
            type="checkbox"
            checked={incluirInativos}
            onChange={(e) => setIncluirInativos(e.target.checked)}
            className="rounded"
          />
          Mostrar também inativos
        </label>
      </div>

      <div className="bg-white dark:bg-[#1A2222] rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-neutral-700 dark:text-neutral-200">Data</th>
              <th className="text-left px-4 py-3 font-semibold text-neutral-700 dark:text-neutral-200">Nome</th>
              <th className="text-left px-4 py-3 font-semibold text-neutral-700 dark:text-neutral-200">Tipo</th>
              <th className="text-center px-4 py-3 font-semibold text-neutral-700 dark:text-neutral-200">Recorrente</th>
              <th className="text-center px-4 py-3 font-semibold text-neutral-700 dark:text-neutral-200">Ativo</th>
              <th className="text-right px-4 py-3 font-semibold text-neutral-700 dark:text-neutral-200">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-8 text-neutral-500 dark:text-neutral-400">Carregando...</td></tr>
            ) : feriados.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-neutral-500 dark:text-neutral-400">Nenhum feriado cadastrado</td></tr>
            ) : feriados.map((f) => (
              <tr key={f.id} className="border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:bg-neutral-900">
                <td className="px-4 py-3 font-mono text-neutral-700 dark:text-neutral-200">{formatarData(f.data)}</td>
                <td className="px-4 py-3 text-neutral-800 dark:text-neutral-100">{f.nome}</td>
                <td className="px-4 py-3"><span className="badge bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200">{f.tipo}</span></td>
                <td className="px-4 py-3 text-center">{f.recorrente ? <Check size={16} className="inline text-green-600" /> : <X size={16} className="inline text-neutral-400" />}</td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => handleToggleAtivo(f)}
                    className={`badge ${f.ativo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} cursor-pointer`}
                  >
                    {f.ativo ? 'Ativo' : 'Inativo'}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setModal({ tipo: 'editar', feriado: f })} className="text-blue-600 hover:text-blue-800 mr-2" title="Editar">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => handleDelete(f)} className="text-red-600 hover:text-red-800" title="Remover">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <FeriadoModal
          tipo={modal.tipo}
          feriado={modal.feriado}
          onClose={() => setModal(null)}
          onSaved={async () => { setModal(null); await carregar(); }}
        />
      )}
    </div>
  );
}

interface ModalProps {
  tipo: 'criar' | 'editar';
  feriado?: Feriado;
  onClose: () => void;
  onSaved: () => void;
}

function FeriadoModal({ tipo, feriado, onClose, onSaved }: ModalProps) {
  const [nome, setNome] = useState(feriado?.nome || '');
  const [data, setData] = useState(feriado ? feriado.data.slice(0, 10) : '');
  const [tipoF, setTipoF] = useState(feriado?.tipo || 'nacional');
  const [recorrente, setRecorrente] = useState(feriado?.recorrente || false);
  const [ativo, setAtivo] = useState(feriado?.ativo ?? true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      if (tipo === 'criar') {
        await api.post('/feriados', { nome, data, tipo: tipoF, recorrente, ativo });
      } else if (feriado) {
        await api.put(`/feriados/${feriado.id}`, { nome, data, tipo: tipoF, recorrente, ativo });
      }
      onSaved();
    } catch (err: any) {
      setErro(err?.response?.data?.error || 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#1A2222] rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">{tipo === 'criar' ? 'Novo feriado' : 'Editar feriado'}</h2>
          <button onClick={onClose} className="text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:text-neutral-100"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {erro && <div className="bg-red-50 text-red-700 px-3 py-2 rounded text-sm">{erro}</div>}
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-1">Nome *</label>
            <input
              required
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="input w-full"
              placeholder="Ex: Natal"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-1">Data *</label>
            <input
              required
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-1">Tipo</label>
            <select value={tipoF} onChange={(e) => setTipoF(e.target.value)} className="input w-full">
              <option value="nacional">Nacional</option>
              <option value="estadual">Estadual</option>
              <option value="municipal">Municipal</option>
              <option value="ponto_facultativo">Ponto facultativo</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-200 cursor-pointer">
            <input type="checkbox" checked={recorrente} onChange={(e) => setRecorrente(e.target.checked)} />
            Recorrente (anual)
          </label>
          <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-200 cursor-pointer">
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
            Ativo
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={salvando} className="btn-primary">
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
