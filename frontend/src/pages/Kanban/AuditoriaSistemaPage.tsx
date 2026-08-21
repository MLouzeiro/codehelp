import { useState, useEffect, useCallback } from 'react';
import {
  FileSearch, Loader2, Search, ChevronLeft, ChevronRight, X, ShieldCheck,
  ShieldAlert, Shield, Activity, CalendarDays, User, Filter, ChevronDown,
  Download, Eye, AlertTriangle, Lock, Globe, Clock, Users, BarChart3,
  FileText, CheckCircle, XCircle, Ban, Key, Trash2, RefreshCw, Fingerprint,
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../services/auth';
import type { AuditLog, AuditDashboardStats, AuditSecurityStats, AuditAlert, AuditAnomalia } from '../../types/kanban';

const MODULOS = ['Tarefas','Kanban','Equipes','TimeEntry','Ticket','Client','User','Auth','Aprovacao','Auditoria','ServiceOrder','Billing','KB','HelpdeskConfig','SLAConfig'];
const SC: Record<string, string> = {
  baixa: 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300',
  media: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  alta: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  critica: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  suspeito: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
};
const SI: Record<string, string> = { baixa: '🟢', media: '🟡', alta: '🟠', critica: '🔴', suspeito: '🟠' };

function Delta({ v }: { v: number }) {
  if (v === 0) return <span className="text-xs text-gray-400">—</span>;
  return <span className={`text-xs font-medium ${v > 0 ? 'text-red-500' : 'text-green-500'}`}>{v > 0 ? '↑' : '↓'} {Math.abs(v)}%</span>;
}

function Card({ label, value, icon: I, color, delta, sub }: { label: string; value: number | string; icon: any; color: string; delta?: number; sub?: string }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
      <div className="flex items-center gap-3">
        <span className="p-2 rounded-lg" style={{ backgroundColor: color + '20', color }}><I size={18} /></span>
        <div className="flex-1 min-w-0">
          <div className="text-2xl font-bold text-gray-900 dark:text-slate-100">{value}</div>
          <div className="text-xs text-gray-500 dark:text-slate-400">{label}</div>
        </div>
      </div>
      {delta !== undefined && <div className="mt-2"><Delta v={delta} /></div>}
      {sub && <div className="text-xs text-gray-400 dark:text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

function acaoClass(a: string) {
  if (['excluir_definitivo','deletar','ajuste_manual_tempo'].includes(a)) return 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400';
  if (['alterar_prazo','alterar_responsavel','reabrir','arquivar','mover'].includes(a)) return 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400';
  return 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400';
}

const TABS = [
  { id: 'visao_geral', label: 'Visão Geral', icon: BarChart3 },
  { id: 'eventos', label: 'Eventos', icon: Activity },
  { id: 'seguranca', label: 'Segurança', icon: Shield },
  { id: 'alertas', label: 'Alertas', icon: AlertTriangle },
  { id: 'relatorios', label: 'Relatórios', icon: Download },
];

export default function AuditoriaSistemaPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('visao_geral');
  const [stats, setStats] = useState<AuditDashboardStats | null>(null);
  const [security, setSecurity] = useState<AuditSecurityStats | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [selUser, setSelUser] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState<AuditAlert[]>([]);
  const [alertStats, setAlertStats] = useState<any>(null);
  const [anomalias, setAnomalias] = useState<AuditAnomalia[]>([]);
  const [periodo, setPeriodo] = useState('30');

  const loadStats = useCallback(async () => {
    try {
      const dias = parseInt(periodo) || 30;
      const di = new Date(Date.now() - dias * 86400000).toISOString();
      const [s, sec] = await Promise.all([
        api.get('/audit/global/stats', { params: { dataInicio: di } }),
        api.get('/audit/security', { params: { dataInicio: di } }),
      ]);
      setStats(s.data); setSecurity(sec.data);
    } catch {}
  }, [periodo]);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const c = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      const url = selUser ? `/audit/global/usuario/${selUser}` : '/audit/global';
      const { data } = await api.get(url, { params: { ...c, limit, offset: (page - 1) * limit } });
      if (selUser && data?.timeline) { setLogs(data.timeline || []); setTotal(data.resumo?.totalAcoes || 0); }
      else { setLogs(data?.logs || []); setTotal(data?.total || 0); }
    } catch { setLogs([]); setTotal(0); }
    finally { setLoading(false); }
  }, [filters, page, selUser, limit]);

  const loadAlerts = useCallback(async () => {
    try {
      const [a, s] = await Promise.all([
        api.get('/audit/alerts', { params: { status: 'pendente', limit: 50 } }),
        api.get('/audit/alerts/stats'),
      ]);
      setAlerts(a.data?.alerts || []); setAlertStats(s.data);
    } catch {}
  }, []);

  const loadAnomalias = useCallback(async () => {
    try { const { data } = await api.get('/audit/anomalias'); setAnomalias(data?.anomalias || []); } catch {}
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { api.get('/users', { params: { active: 'true' } }).then(({ data }) => setUsers(data?.users || [])).catch(() => {}); }, []);
  useEffect(() => { setPage(1); }, [selUser, filters]);
  useEffect(() => { loadLogs(); }, [loadLogs]);
  useEffect(() => { if (tab === 'alertas') loadAlerts(); if (tab === 'seguranca') loadAnomalias(); }, [tab, loadAlerts, loadAnomalias]);

  const tp = Math.max(1, Math.ceil(total / limit));
  const pm = (l: AuditLog) => { try { return l.metadata ? JSON.parse(l.metadata) : null; } catch { return null; } };

  const exportCsv = async () => {
    try {
      const c = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      const p = new URLSearchParams(c as any);
      if (selUser) p.set('usuarioId', selUser);
      const { data } = await api.get(`/audit/export/csv?${p.toString()}`, { responseType: 'blob' });
      const u = URL.createObjectURL(data); const a = document.createElement('a');
      a.href = u; a.download = 'auditoria.csv'; a.click(); URL.revokeObjectURL(u);
    } catch {}
  };

  const markAnalyzed = async (id: string) => { try { await api.patch(`/audit/alerts/${id}/analyze`, { justificativa: 'Analisado' }); loadAlerts(); } catch {} };
  const archiveAlert = async (id: string) => { try { await api.patch(`/audit/alerts/${id}/archive`); loadAlerts(); } catch {} };

  const Filters = () => (
    <div className="px-6 py-3 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2">
        <Filter size={14} className="text-gray-400" />
        <select className="input text-sm" value={selUser} onChange={(e) => setSelUser(e.target.value)}>
          <option value="">Todos os usuários</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>
      <select className="input text-sm" value={filters.modulo || ''} onChange={(e) => setFilters((f) => ({ ...f, modulo: e.target.value }))}>
        <option value="">Todos os módulos</option>
        {MODULOS.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
      <select className="input text-sm" value={filters.severity || ''} onChange={(e) => setFilters((f) => ({ ...f, severity: e.target.value }))}>
        <option value="">Todas severidades</option>
        <option value="baixa">🟢 Baixa</option>
        <option value="media">🟡 Média</option>
        <option value="alta">🟠 Alta</option>
        <option value="critica">🔴 Crítica</option>
        <option value="suspeito">🟠 Suspeito</option>
      </select>
      <select className="input text-sm" value={filters.fonte || ''} onChange={(e) => setFilters((f) => ({ ...f, fonte: e.target.value }))}>
        <option value="">Todas fontes</option>
        <option value="manual">Manual</option>
        <option value="automatico">Automático</option>
        <option value="ia">IA</option>
        <option value="api">API</option>
        <option value="bot">Bot</option>
      </select>
      <input type="date" className="input text-sm" value={filters.dataInicio || ''} onChange={(e) => setFilters((f) => ({ ...f, dataInicio: e.target.value }))} title="De" />
      <input type="date" className="input text-sm" value={filters.dataFim || ''} onChange={(e) => setFilters((f) => ({ ...f, dataFim: e.target.value }))} title="Até" />
      <div className="relative flex-1 min-w-[200px]">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input placeholder="Buscar..." className="input pl-8 text-sm w-full" value={filters.search || ''} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} />
      </div>
      <button onClick={() => { setFilters({}); setSelUser(''); }} className="text-xs text-gray-500 hover:text-red-500 flex items-center gap-1"><X size={12} /> Limpar</button>
      <button onClick={exportCsv} className="text-xs px-3 py-1.5 rounded-lg bg-codemed-500 text-white hover:bg-codemed-600 flex items-center gap-1"><Download size={12} /> CSV</button>
    </div>
  );

  const LogList = () => (
    loading ? (
      <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-codemed-500" size={32} /></div>
    ) : logs.length === 0 ? (
      <div className="text-center py-16 text-gray-400"><FileSearch size={48} className="mx-auto mb-3 opacity-50" /><p className="text-sm">Nenhum evento encontrado</p></div>
    ) : (
      <div className="space-y-2">
        {logs.map((log) => {
          const m = pm(log); const ex = expanded === log.id;
          return (
            <div key={log.id} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
              <button onClick={() => setExpanded(ex ? null : log.id)} className="w-full flex items-start justify-between gap-3 p-3.5 text-left hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {log.severity && <span className={`text-[11px] px-2 py-0.5 rounded-full ${SC[log.severity] || SC.baixa}`}>{SI[log.severity] || '🟢'} {log.severity}</span>}
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-300">{log.modulo || '—'}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${acaoClass(log.acao)}`}>{log.acao}</span>
                    {log.fonte && <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">{log.fonte}</span>}
                    {log.success === false && <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600">falha</span>}
                  </div>
                  <p className="text-sm text-gray-700 dark:text-slate-300 mt-1">{log.detalhes || log.entidade}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400 flex-wrap">
                    <span className="flex items-center gap-1"><User size={11} /> {log.usuario?.name || 'Sistema'}</span>
                    <span>{new Date(log.createdAt).toLocaleString('pt-BR')}</span>
                    <span>{log.origem || 'web'}</span>
                    {log.entidade && <span className="font-mono">{log.entidade}</span>}
                  </div>
                </div>
                <ChevronDown size={16} className={`text-gray-400 mt-1 flex-shrink-0 transition-transform ${ex ? 'rotate-180' : ''}`} />
              </button>
              {ex && (
                <div className="px-4 py-3 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-gray-600 dark:text-slate-300">
                    {log.entidadeId && <div><span className="text-gray-400">ID:</span> <span className="font-mono">{log.entidadeId}</span></div>}
                    {log.valorAnterior && <div><span className="text-gray-400">Antes:</span> <span className="font-mono">{log.valorAnterior}</span></div>}
                    {log.novoValor && <div><span className="text-gray-400">Depois:</span> <span className="font-mono">{log.novoValor}</span></div>}
                    {log.ip && <div><span className="text-gray-400">IP:</span> {log.ip}</div>}
                    {log.success !== null && log.success !== undefined && <div><span className="text-gray-400">Sucesso:</span> {log.success ? 'Sim' : 'Não'}</div>}
                    {log.errorMessage && <div className="sm:col-span-2"><span className="text-gray-400">Erro:</span> {log.errorMessage}</div>}
                    {log.userAgent && <div className="sm:col-span-2"><span className="text-gray-400">User-Agent:</span> <span className="break-all">{log.userAgent}</span></div>}
                  </div>
                  {m && Object.keys(m).length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-700">
                      <span className="text-gray-400 block mb-1">Metadata:</span>
                      <pre className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-2 overflow-x-auto">{JSON.stringify(m, null, 2)}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {tp > 1 && (
          <div className="flex items-center justify-center gap-2 pt-3">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1 disabled:opacity-40"><ChevronLeft size={14} /> Anterior</button>
            <span className="text-xs text-gray-500">Página {page} de {tp} · {total} eventos</span>
            <button onClick={() => setPage((p) => Math.min(tp, p + 1))} disabled={page >= tp} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1 disabled:opacity-40">Próxima <ChevronRight size={14} /></button>
          </div>
        )}
      </div>
    )
  );

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-slate-900">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2"><ShieldCheck size={22} className="text-codemed-500" /> Auditoria do Sistema</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">Log imutável de todas as ações — rastreabilidade completa</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="input text-sm" value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
          </select>
        </div>
      </div>

      <div className="px-6 py-2 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg transition-colors whitespace-nowrap ${tab === t.id ? 'bg-codemed-500 text-white' : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'}`}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'visao_geral' && (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <Card label="Total de eventos" value={stats?.totalEventos ?? 0} icon={Activity} color="#3b82f6" delta={stats?.deltaTotal} />
              <Card label="Eventos hoje" value={stats?.eventosHoje ?? 0} icon={CalendarDays} color="#8b5cf6" />
              <Card label="Últimos 7 dias" value={stats?.eventos7dias ?? 0} icon={Activity} color="#06b6d4" />
              <Card label="Críticas" value={stats?.eventosCriticos ?? 0} icon={ShieldAlert} color="#ef4444" />
              <Card label="Suspeitos" value={stats?.eventosSuspeitos ?? 0} icon={AlertTriangle} color="#f97316" />
              <Card label="Via API" value={stats?.acoesViaApi ?? 0} icon={Globe} color="#10b981" delta={stats?.deltaApi} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card label="Logins" value={stats?.logins ?? 0} icon={Key} color="#3b82f6" delta={stats?.deltaLogins} />
              <Card label="Falhas auth" value={stats?.falhasAuth ?? 0} icon={XCircle} color="#ef4444" delta={stats?.deltaFalhasAuth} />
              <Card label="Bloqueadas" value={stats?.tentativasBloqueadas ?? 0} icon={Ban} color="#dc2626" delta={stats?.deltaBloqueadas} />
              <Card label="Permissões" value={stats?.alteracoesPermissao ?? 0} icon={Lock} color="#8b5cf6" delta={stats?.deltaPermissoes} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card label="Exclusões" value={stats?.exclusoes ?? 0} icon={Trash2} color="#ef4444" delta={stats?.deltaExclusoes} />
              <Card label="Automáticas" value={stats?.acoesAutomaticas ?? 0} icon={RefreshCw} color="#06b6d4" />
              <Card label="Pela IA" value={stats?.acoesIa ?? 0} icon={Fingerprint} color="#8b5cf6" />
              <Card label="Média" value={stats?.eventosMedios ?? 0} icon={Activity} color="#6b7280" />
            </div>
            {stats && stats.usuariosMaisAtivos.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-slate-200 mb-3">Usuários mais ativos</h4>
                <div className="space-y-2">
                  {stats.usuariosMaisAtivos.map((u, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm text-gray-700 dark:text-slate-300">{u.usuario}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-codemed-500 rounded-full" style={{ width: `${Math.min(100, (u.total / (stats.usuariosMaisAtivos[0]?.total || 1)) * 100)}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 w-16 text-right">{u.total}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {stats && stats.topAcoes.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-slate-200 mb-3">Top ações</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {stats.topAcoes.slice(0, 12).map((a, i) => (
                    <div key={i} className="flex items-center justify-between text-sm p-2 rounded-lg bg-gray-50 dark:bg-slate-900/40">
                      <span className="font-mono text-xs text-gray-600 dark:text-slate-400 truncate">{a.acao}</span>
                      <span className="text-xs text-gray-500 ml-2">{a.total}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'seguranca' && (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <Card label="Tentativas login" value={security?.tentativasLogin ?? 0} icon={Key} color="#3b82f6" delta={security?.deltaTentativas} />
              <Card label="Logins OK" value={security?.loginsSucesso ?? 0} icon={CheckCircle} color="#22c55e" delta={security?.deltaSucesso} />
              <Card label="Logins recusados" value={security?.loginsRecusados ?? 0} icon={XCircle} color="#ef4444" delta={security?.deltaRecusados} />
              <Card label="Acesso negado (módulos)" value={security?.acessoNegadoModulos ?? 0} icon={Ban} color="#dc2626" />
              <Card label="Acesso negado (registros)" value={security?.acessoNegadoRegistros ?? 0} icon={Ban} color="#dc2626" />
              <Card label="Bloqueadas" value={security?.tentativasBloqueadas ?? 0} icon={ShieldAlert} color="#dc2626" delta={security?.deltaBloqueadas} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card label="Alterações senha" value={security?.alteracoesSenha ?? 0} icon={Key} color="#8b5cf6" />
              <Card label="Alterações permissão" value={security?.alteracoesPermissoes ?? 0} icon={Lock} color="#f97316" delta={security?.deltaPermissoes} />
              <Card label="Criações usuário" value={security?.criacaoUsuarios ?? 0} icon={Users} color="#3b82f6" />
              <Card label="Exclusões usuário" value={security?.exclusaoUsuarios ?? 0} icon={Trash2} color="#ef4444" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card label="Desativados" value={security?.usuariosDesativados ?? 0} icon={User} color="#6b7280" />
              <Card label="Sessões encerradas" value={security?.sessoesEncerradas ?? 0} icon={Lock} color="#6b7280" />
              <Card label="IPs diferentes" value={security?.ipsMultiplos ?? 0} icon={Globe} color="#f97316" sub="Mesmo usuário, múltiplos IPs" />
              <Card label="Eventos críticos" value={security?.eventosCriticos ?? 0} icon={ShieldAlert} color="#dc2626" delta={security?.deltaCriticos} />
            </div>
            {anomalias.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-slate-200 mb-3 flex items-center gap-2"><AlertTriangle size={16} className="text-amber-500" /> Comportamento fora do padrão</h4>
                <div className="space-y-3">
                  {anomalias.map((a, i) => (
                    <div key={i} className="p-3 rounded-lg bg-gray-50 dark:bg-slate-900/40 border border-gray-200 dark:border-slate-700">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${SC[a.severidade] || SC.media}`}>{SI[a.severidade] || '🟡'} {a.severidade}</span>
                        <span className="text-sm font-medium text-gray-700 dark:text-slate-200">{a.titulo}</span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-slate-400">{a.descricao}</p>
                      <p className="text-xs text-gray-500 mt-1"><strong>Motivo:</strong> {a.motivo}</p>
                      <p className="text-xs text-codemed-600 dark:text-codemed-400 mt-1"><strong>Recomendação:</strong> {a.acaoRecomendada}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'eventos' && (
          <div className="p-6"><Filters /><div className="mt-4"><LogList /></div></div>
        )}

        {tab === 'alertas' && (
          <div className="p-6 space-y-4">
            {alertStats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card label="Pendentes" value={alertStats.pendentes ?? 0} icon={AlertTriangle} color="#f97316" />
                <Card label="Analisados" value={alertStats.analisados ?? 0} icon={CheckCircle} color="#22c55e" />
                <Card label="Arquivados" value={alertStats.arquivados ?? 0} icon={XCircle} color="#6b7280" />
                <Card label="Últimas 24h" value={alertStats.ultimas24h ?? 0} icon={Clock} color="#3b82f6" />
              </div>
            )}
            {alerts.length === 0 ? (
              <div className="text-center py-12 text-gray-400"><CheckCircle size={48} className="mx-auto mb-3 opacity-50" /><p className="text-sm">Nenhum alerta pendente</p></div>
            ) : (
              <div className="space-y-3">
                {alerts.map((al) => (
                  <div key={al.id} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${SC[al.severidade] || SC.media}`}>{SI[al.severidade] || '🟡'} {al.severidade}</span>
                          <span className="text-sm font-medium text-gray-700 dark:text-slate-200">{al.titulo}</span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-slate-400">{al.descricao}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                          <span>{new Date(al.createdAt).toLocaleString('pt-BR')}</span>
                          {al.modulo && <span className="font-mono">{al.modulo}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => markAnalyzed(al.id)} className="text-xs px-3 py-1.5 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100">Analisado</button>
                        <button onClick={() => archiveAlert(al.id)} className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-200">Arquivar</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'relatorios' && (
          <div className="p-6 space-y-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">Exportar Relatórios</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button onClick={exportCsv} className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                  <Download size={24} className="text-green-500" />
                  <div className="text-left"><div className="font-medium text-gray-700 dark:text-slate-200">CSV</div><div className="text-xs text-gray-500">Planilha simples</div></div>
                </button>
                <div className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 dark:border-slate-700 opacity-50">
                  <FileText size={24} className="text-blue-500" />
                  <div className="text-left"><div className="font-medium text-gray-700 dark:text-slate-200">PDF</div><div className="text-xs text-gray-500">Em breve</div></div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 dark:border-slate-700 opacity-50">
                  <BarChart3 size={24} className="text-purple-500" />
                  <div className="text-left"><div className="font-medium text-gray-700 dark:text-slate-200">Excel</div><div className="text-xs text-gray-500">Em breve</div></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
