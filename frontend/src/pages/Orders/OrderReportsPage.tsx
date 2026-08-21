import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Loader2, Download, BarChart3, CheckCircle2, XCircle, Clock, TrendingUp } from 'lucide-react';
import api from '../../services/api';

const STATUS_LABELS: Record<string, string> = {
  rascunho: 'Rascunho', aguardando_assinatura: 'Aguardando Assinatura', assinada: 'Assinada',
  em_execucao: 'Em Execução', concluida: 'Concluída', cancelada: 'Cancelada',
};

const STATUS_BADGE: Record<string, string> = {
  rascunho: 'bg-gray-100 text-gray-700 dark:bg-slate-700/60 dark:text-slate-300',
  aguardando_assinatura: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  assinada: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  em_execucao: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  concluida: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  cancelada: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

export default function OrderReportsPage() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [filtros, setFiltros] = useState({ status: '', tipoServico: '', dataDe: '', dataAte: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtros.status) params.set('status', filtros.status);
      if (filtros.tipoServico) params.set('tipoServico', filtros.tipoServico);
      if (filtros.dataDe) params.set('dataDe', new Date(filtros.dataDe).toISOString());
      if (filtros.dataAte) params.set('dataAte', new Date(filtros.dataAte).toISOString());
      const qs = params.toString();
      const { data } = await api.get(`/orders/report/dashboard${qs ? `?${qs}` : ''}`);
      setDashboard(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filtros]);

  useEffect(() => { load(); }, [load]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (filtros.status) params.set('status', filtros.status);
      if (filtros.tipoServico) params.set('tipoServico', filtros.tipoServico);
      if (filtros.dataDe) params.set('dataDe', new Date(filtros.dataDe).toISOString());
      if (filtros.dataAte) params.set('dataAte', new Date(filtros.dataAte).toISOString());
      const qs = params.toString();
      const res = await api.get(`/orders/report/export${qs ? `?${qs}` : ''}`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: String(res.headers['content-type']) || 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ordens-servico-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      console.error(err);
    } finally {
      setExporting(false);
    }
  };

  const cards = dashboard ? [
    { label: 'Total de OS', value: String(dashboard.total ?? 0), icon: FileText, color: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
    { label: 'Em Execução', value: String(dashboard.emExecucao ?? 0), icon: TrendingUp, color: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' },
    { label: 'Concluídas', value: String(dashboard.concluida ?? 0), icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' },
    { label: 'Canceladas', value: String(dashboard.cancelada ?? 0), icon: XCircle, color: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
    { label: 'Taxa de Conclusão', value: `${dashboard.taxaConclusao ?? 0}%`, icon: BarChart3, color: 'bg-teal-50 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400' },
    { label: 'Tempo Médio (dias)', value: String(dashboard.mediaDiasConclusao ?? 0), icon: Clock, color: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' },
    { label: 'Valor Total', value: (dashboard.valorTotal ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), icon: BarChart3, color: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Relatório de Ordens de Serviço</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">Indicadores, distribuição por status/técnico e exportação.</p>
        </div>
        <button
          onClick={exportCsv}
          disabled={exporting}
          className="btn-primary flex items-center gap-2"
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download size={16} />}
          Exportar CSV
        </button>
      </div>

      <div className="card">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Status</label>
            <select
              value={filtros.status}
              onChange={(e) => setFiltros({ ...filtros, status: e.target.value })}
              className="w-full input"
            >
              <option value="">Todos</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Tipo de Serviço</label>
            <select
              value={filtros.tipoServico}
              onChange={(e) => setFiltros({ ...filtros, tipoServico: e.target.value })}
              className="w-full input"
            >
              <option value="">Todos</option>
              <option value="suporte">Suporte</option>
              <option value="desenvolvimento">Desenvolvimento</option>
              <option value="implantacao">Implantação</option>
              <option value="treinamento">Treinamento</option>
              <option value="outro">Outro</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Data de</label>
            <input
              type="date"
              value={filtros.dataDe}
              onChange={(e) => setFiltros({ ...filtros, dataDe: e.target.value })}
              className="w-full input"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Data até</label>
            <input
              type="date"
              value={filtros.dataAte}
              onChange={(e) => setFiltros({ ...filtros, dataAte: e.target.value })}
              className="w-full input"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      ) : dashboard ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4">
            {cards.map((c) => (
              <div key={c.label} className="card p-4">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${c.color}`}>
                  <c.icon size={18} />
                </div>
                <p className="text-xl font-bold text-gray-900 dark:text-slate-100">{c.value}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400">{c.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card">
              <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-3">Por Status</h3>
              {dashboard.porStatus.length === 0 ? (
                <p className="text-sm text-gray-400">Sem dados.</p>
              ) : (
                <div className="space-y-2">
                  {dashboard.porStatus.map((s: any) => (
                    <div key={s.status} className="flex items-center justify-between gap-2 text-sm">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[s.status] || 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-300'}`}>
                        {STATUS_LABELS[s.status] || s.status}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-gray-600 dark:text-slate-300 font-medium">{s.total}</span>
                        <span className="text-xs text-gray-400 w-20 text-right">
                          {s.valor ? s.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-3">Por Tipo de Serviço</h3>
              {dashboard.porTipo.length === 0 ? (
                <p className="text-sm text-gray-400">Sem dados.</p>
              ) : (
                <div className="space-y-2">
                  {dashboard.porTipo.map((t: any) => (
                    <div key={t.tipo} className="flex items-center justify-between text-sm">
                      <span className="capitalize text-gray-700 dark:text-slate-300">{t.tipo || 'sem tipo'}</span>
                      <span className="text-gray-600 dark:text-slate-300 font-medium">{t.total}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-3">Por Técnico Responsável</h3>
            {dashboard.porTecnico.length === 0 ? (
              <p className="text-sm text-gray-400">Sem dados.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 border-b border-gray-100 dark:border-slate-700">
                      <th className="py-2">Técnico</th>
                      <th className="py-2 text-right">OS</th>
                      <th className="py-2 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.porTecnico.map((t: any, i: number) => (
                      <tr key={i} className="border-b border-gray-50 dark:border-slate-800">
                        <td className="py-2 text-gray-700 dark:text-slate-300">{t.tecnico}</td>
                        <td className="py-2 text-right text-gray-600 dark:text-slate-300 font-medium">{t.total}</td>
                        <td className="py-2 text-right text-gray-600 dark:text-slate-300">
                          {t.valor ? t.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card">
            <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-3">Últimas Ordens de Serviço</h3>
            <button
              onClick={() => navigate('/app/orders')}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-3 inline-block"
            >
              Ver todas as OS →
            </button>
          </div>
        </>
      ) : (
        <p className="text-center py-12 text-gray-400">Falha ao carregar o relatório.</p>
      )}
    </div>
  );
}