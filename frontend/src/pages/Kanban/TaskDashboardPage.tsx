import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2, Clock, AlertTriangle, ListTodo, FileDown, FileSpreadsheet,
  Loader2, Search, BarChart3, FolderKanban, Layers, User, Building2, Ticket,
  RefreshCw,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts';
import { useKanban } from '../../hooks/useKanban';
import api from '../../services/api';
import type { TaskDashboardData } from '../../types/kanban';

const PRIO_COLORS: Record<string, string> = {
  baixa: '#6b7280', media: '#3b82f6', alta: '#f59e0b', urgente: '#ef4444',
};
const PRAZO_COLORS: Record<string, string> = {
  no_prazo: '#22c55e', proxima: '#eab308', atencao: '#f97316', atrasada: '#ef4444', concluida: '#3b82f6',
};

function downloadBlob(data: Blob, filename: string) {
  const url = window.URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export default function TaskDashboardPage() {
  const { getTaskDashboard, getTaskReport, listTeams, loading } = useKanban();
  const [data, setData] = useState<TaskDashboardData | null>(null);
  const [teams, setTeams] = useState<{ id: string; nome: string }[]>([]);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [exporting, setExporting] = useState<string | null>(null);

  const load = useCallback(async () => {
    const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    const result = await getTaskDashboard(clean);
    setData(result);
  }, [filters, getTaskDashboard]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    listTeams().then((t: any) => setTeams(Array.isArray(t) ? t : t?.teams || [])).catch(() => {});
  }, [listTeams]);

  const handleExport = async (formato: 'csv' | 'xlsx') => {
    setExporting(formato);
    try {
      const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      const res = await api.get('/kanban/report/export', {
        params: { ...clean, formato },
        responseType: 'blob',
      });
      const ct = String(res.headers['content-type'] || '');
      const ext = ct.includes('spreadsheetml') ? 'xlsx' : 'csv';
      downloadBlob(res.data, `tarefas-${new Date().toISOString().slice(0, 10)}.${ext}`);
    } catch {
      alert('Erro ao exportar relatório');
    } finally {
      setExporting(null);
    }
  };

  const cards = [
    { label: 'Tarefas ativas', value: data?.totalTarefas ?? 0, icon: ListTodo, color: '#3b82f6' },
    { label: 'Concluídas', value: data?.concluidas ?? 0, icon: CheckCircle2, color: '#22c55e' },
    { label: 'Atrasadas', value: data?.atrasadas ?? 0, icon: AlertTriangle, color: '#ef4444' },
    { label: 'Prazo próximo', value: data?.comPrazoProximo ?? 0, icon: Clock, color: '#f97316' },
    { label: 'Taxa de conclusão', value: `${data?.taxaConclusao ?? 0}%`, icon: BarChart3, color: '#8b5cf6' },
    { label: 'Trabalhado', value: `${data?.trabalhadoHoras ?? 0}h`, icon: Clock, color: '#06b6d4' },
  ];

  const prioData = (data?.porPrioridade || []).map((p) => ({ name: p.prioridade, value: p.total }));
  const prazoData = (data?.porStatusPrazo || []).map((p) => ({ name: p.status, value: p.total }));

  const renderTopList = (
    title: string,
    icon: any,
    items: { label: string; total: number; horas?: number }[]
  ) => (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="p-1.5 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-300">{icon}</span>
        <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-200">{title}</h3>
      </div>
      <div className="space-y-2">
        {items.slice(0, 10).map((item, i) => (
          <div key={i} className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-slate-300 truncate pr-2">{item.label}</span>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="text-xs text-gray-400">{item.horas !== undefined ? `${item.horas}h` : ''}</span>
              <span className="text-sm font-medium text-gray-800 dark:text-slate-100">{item.total}</span>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-gray-400">Sem dados</p>}
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-slate-900">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Dashboard de Tarefas</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">Indicadores, prazos e produtividade das tarefas internas</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => load()} className="btn-secondary text-xs flex items-center gap-1">
            <RefreshCw size={14} /> Atualizar
          </button>
          <button onClick={() => handleExport('csv')} disabled={!!exporting} className="btn-secondary text-xs flex items-center gap-1">
            {exporting === 'csv' ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />} CSV
          </button>
          <button onClick={() => handleExport('xlsx')} disabled={!!exporting} className="btn-primary text-xs flex items-center gap-1">
            {exporting === 'xlsx' ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />} Excel
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="px-6 py-3 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            placeholder="Buscar responsável / ticket"
            className="input pl-8 text-sm"
            value={filters.responsavelId || ''}
            onChange={(e) => setFilters((f) => ({ ...f, responsavelId: e.target.value }))}
          />
        </div>
        <select
          className="input text-sm"
          value={filters.statusPrazo || ''}
          onChange={(e) => setFilters((f) => ({ ...f, statusPrazo: e.target.value }))}
        >
          <option value="">Status de prazo</option>
          <option value="no_prazo">No prazo</option>
          <option value="proxima">Próxima</option>
          <option value="atencao">Atenção</option>
          <option value="atrasada">Atrasada</option>
          <option value="concluida">Concluída</option>
        </select>
        <select
          className="input text-sm"
          value={filters.tipoTarefa || ''}
          onChange={(e) => setFilters((f) => ({ ...f, tipoTarefa: e.target.value }))}
        >
          <option value="">Tipo de tarefa</option>
          <option value="dev">Desenvolvimento</option>
          <option value="implantacao">Implantação</option>
          <option value="atendimento">Atendimento</option>
          <option value="outro">Outro</option>
        </select>
        <select
          className="input text-sm"
          value={filters.equipeId || ''}
          onChange={(e) => setFilters((f) => ({ ...f, equipeId: e.target.value }))}
        >
          <option value="">Equipe</option>
          {teams.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
        {(Object.keys(filters).some((k) => filters[k])) && (
          <button onClick={() => setFilters({})} className="text-xs text-gray-500 dark:text-slate-400 hover:text-red-500">Limpar filtros</button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading && !data ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="animate-spin text-codemed-500" size={32} />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
              {cards.map((card) => (
                <div key={card.label} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="p-1.5 rounded-lg" style={{ backgroundColor: card.color + '20', color: card.color }}>
                      <card.icon size={16} />
                    </span>
                    <span className="text-xs text-gray-500 dark:text-slate-400">{card.label}</span>
                  </div>
                  <span className="text-2xl font-bold text-gray-900 dark:text-slate-100">{card.value}</span>
                </div>
              ))}
            </div>

            {/* Gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-200 mb-3">Tarefas por prioridade</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={prioData}>
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="value" name="Tarefas" radius={[6, 6, 0, 0]}>
                      {prioData.map((entry) => (
                        <Cell key={entry.name} fill={PRIO_COLORS[entry.name] || '#3b82f6'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-200 mb-3">Status de prazo</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={prazoData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80} paddingAngle={2}>
                      {prazoData.map((entry) => (
                        <Cell key={entry.name} fill={PRAZO_COLORS[entry.name] || '#94a3b8'} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top listas */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {renderTopList('Por responsável', <User size={16} />, (data?.porResponsavel || []).map((r) => ({ label: r.usuario, total: r.total, horas: r.horas })))}
              {renderTopList('Por equipe', <Layers size={16} />, (data?.porEquipe || []).map((e) => ({ label: e.equipe, total: e.total, horas: e.horas })))}
              {renderTopList('Por cliente', <Building2 size={16} />, (data?.porCliente || []).map((c) => ({ label: c.cliente, total: c.total, horas: c.horas })))}
              {renderTopList('Por ticket', <Ticket size={16} />, (data?.porTicket || []).map((t) => ({ label: t.ticket, total: t.total, horas: t.horas })))}
              {renderTopList('Por tipo', <FolderKanban size={16} />, (data?.porTipo || []).map((t) => ({ label: t.tipo || 'outro', total: t.total })))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}