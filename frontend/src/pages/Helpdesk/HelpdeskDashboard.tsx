import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import {
  RefreshCw, MessageSquare, Clock, CheckCircle, Users,
  ArrowRight, Activity, UserCheck, AlertTriangle, TrendingUp,
  Inbox, Bot, Headphones, FileText, Stethoscope, Circle,
} from 'lucide-react';
import type { HelpdeskDashboardData, EtapaSlug } from '../../types';

const ETAPA_ICONES: Record<string, any> = {
  inbox: Inbox,
  bot: Bot,
  headphones: Headphones,
  clock: Clock,
  'file-text': FileText,
  'check-circle': CheckCircle,
};

function formatarTempo(minutos: number): string {
  if (minutos < 1) return 'agora';
  if (minutos < 60) return `${minutos}min`;
  const horas = Math.floor(minutos / 60);
  const mins = minutos % 60;
  if (horas < 24) return mins === 0 ? `${horas}h` : `${horas}h${mins}m`;
  return `${Math.floor(horas / 24)}d`;
}

export default function HelpdeskDashboard() {
  const [data, setData] = useState<HelpdeskDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date>(new Date());

  const load = useCallback(async () => {
    try {
      const { data: res } = await api.get('/helpdesk/dashboard');
      setData(res);
      setUltimaAtualizacao(new Date());
    } catch (err) {
      console.error('Erro dashboard helpdesk:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [autoRefresh, load]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="animate-spin text-emerald-600" size={32} />
      </div>
    );
  }

  const totalAtivos = data.totalAbertos;
  const slaEmRisco = data.emAtendimento.filter((t) => (t.tempoDecorridoMin || 0) > 30).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
            <Activity className="text-emerald-600" size={24} /> Painel do Helpdesk
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm flex items-center gap-2">
            <Circle size={8} className="text-emerald-500 fill-emerald-500 animate-pulse" />
            Tempo real • última atualização: {ultimaAtualizacao.toLocaleTimeString('pt-BR')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors ${
              autoRefresh ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'
            }`}
          >
            <Activity size={12} /> {autoRefresh ? 'Auto-refresh ON' : 'Pausado'}
          </button>
          <button onClick={load} className="btn-secondary text-sm flex items-center gap-1.5">
            <RefreshCw size={14} /> Atualizar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#1A2222] rounded-xl border border-neutral-200 dark:border-neutral-700 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
              <Inbox size={18} className="text-amber-600" />
            </div>
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Na fila</span>
          </div>
          <p className="text-3xl font-bold text-navy-900">{data.filaEspera}</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Aguardando triagem</p>
        </div>

        <div className="bg-white dark:bg-[#1A2222] rounded-xl border border-neutral-200 dark:border-neutral-700 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Headphones size={18} className="text-emerald-600" />
            </div>
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Em atendimento</span>
          </div>
          <p className="text-3xl font-bold text-navy-900">{data.emAtendimento.length}</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Sendo resolvidos agora</p>
        </div>

        <div className="bg-white dark:bg-[#1A2222] rounded-xl border border-neutral-200 dark:border-neutral-700 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
              <CheckCircle size={18} className="text-blue-600" />
            </div>
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Concluídos hoje</span>
          </div>
          <p className="text-3xl font-bold text-navy-900">{data.concluidosHoje}</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Finalizados nas últimas 24h</p>
        </div>

        <div className="bg-white dark:bg-[#1A2222] rounded-xl border border-neutral-200 dark:border-neutral-700 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center">
              <TrendingUp size={18} className="text-purple-600" />
            </div>
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">TMA</span>
          </div>
          <p className="text-3xl font-bold text-navy-900">
            {data.tempoMedioAtendimentoMin > 0 ? formatarTempo(data.tempoMedioAtendimentoMin) : '—'}
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Tempo médio de atendimento</p>
        </div>
      </div>

      {slaEmRisco > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <AlertTriangle className="text-amber-600 flex-shrink-0" size={20} />
          <div>
            <p className="text-sm font-bold text-amber-900">SLA em risco</p>
            <p className="text-xs text-amber-700">{slaEmRisco} atendimento(s) com mais de 30 minutos em curso</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white dark:bg-[#1A2222] rounded-xl border border-neutral-200 dark:border-neutral-700 p-4 shadow-sm">
          <h3 className="text-sm font-bold text-navy-900 mb-3 flex items-center gap-2">
            <Activity size={16} className="text-emerald-600" /> Chamados em Atendimento Agora
          </h3>
          {data.emAtendimento.length === 0 ? (
            <div className="text-center py-8 text-neutral-400 text-sm">Nenhum atendimento em curso no momento</div>
          ) : (
            <div className="space-y-2">
              {data.emAtendimento.map((t) => {
                const critico = (t.tempoDecorridoMin || 0) > 30;
                return (
                  <div key={t.id} className={`p-3 rounded-lg border ${critico ? 'border-amber-300 bg-amber-50/50' : 'border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/30'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${critico ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500 animate-pulse'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-navy-900 truncate">{t.cliente || t.contactName || 'Sem nome'}</p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">{t.protocolo}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`text-sm font-bold ${critico ? 'text-amber-700' : 'text-emerald-700'}`}>
                          {formatarTempo(t.tempoDecorridoMin || 0)}
                        </p>
                        {t.assignee && <p className="text-[10px] text-neutral-500 dark:text-neutral-400">{t.assignee.name}</p>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-[#1A2222] rounded-xl border border-neutral-200 dark:border-neutral-700 p-4 shadow-sm">
          <h3 className="text-sm font-bold text-navy-900 mb-3 flex items-center gap-2">
            <Users size={16} className="text-emerald-600" /> Equipe ({data.agentes.length})
          </h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {data.agentes.map((a) => (
              <div key={a.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
                <div className="relative">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-sm font-bold">
                    {a.name.charAt(0).toUpperCase()}
                  </div>
                  <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                    a.online ? 'bg-emerald-500' : 'bg-neutral-300'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-navy-900 truncate">{a.name}</p>
                  <p className="text-[10px] text-neutral-500 dark:text-neutral-400">{a.role}</p>
                </div>
                <div className="text-right">
                  <p className={`text-xs font-bold ${a.emAtendimento > 0 ? 'text-emerald-700' : 'text-neutral-400'}`}>
                    {a.emAtendimento}
                  </p>
                  <p className="text-[9px] text-neutral-400">atendendo</p>
                </div>
              </div>
            ))}
            {data.agentes.length === 0 && (
              <p className="text-center py-4 text-neutral-400 text-xs">Nenhum agente cadastrado</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1A2222] rounded-xl border border-neutral-200 dark:border-neutral-700 p-4 shadow-sm">
        <h3 className="text-sm font-bold text-navy-900 mb-3 flex items-center gap-2">
          <Stethoscope size={16} className="text-emerald-600" /> Distribuição por Etapa
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {data.etapas.map((etapa) => {
            const Icone = ETAPA_ICONES[etapa.icone] || Inbox;
            const total = etapa.total || 0;
            const maxTotal = Math.max(...data.etapas.map((e) => e.total || 0), 1);
            const percentual = Math.round((total / maxTotal) * 100);
            return (
              <div key={etapa.slug} className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-3 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-md flex items-center justify-center text-white" style={{ backgroundColor: etapa.cor }}>
                    <Icone size={14} />
                  </div>
                  <p className="text-xs font-bold text-navy-900 truncate flex-1">{etapa.nome}</p>
                </div>
                <p className="text-2xl font-bold text-navy-900">{total}</p>
                <div className="mt-1.5 w-full bg-neutral-100 dark:bg-neutral-800 rounded-full h-1.5 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${percentual}%`, backgroundColor: etapa.cor }} />
                </div>
                {etapa.enviarAuto && (
                  <p className="text-[9px] text-emerald-600 font-semibold mt-1.5">✦ Msg automática</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white dark:bg-[#1A2222] rounded-xl border border-neutral-200 dark:border-neutral-700 p-4 shadow-sm">
        <h3 className="text-sm font-bold text-navy-900 mb-3 flex items-center gap-2">
          <MessageSquare size={16} className="text-emerald-600" /> Linha do Tempo — Últimas Movimentações
        </h3>
        {data.ultimosMovimentos.length === 0 ? (
          <p className="text-center py-4 text-neutral-400 text-xs">Nenhuma movimentação registrada</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {data.ultimosMovimentos.map((ev) => (
              <div key={ev.id} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors border-b border-neutral-100 dark:border-neutral-800 last:border-0">
                <div className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-navy-900 truncate">
                      {ev.ticket.client?.razaoSocial || ev.ticket.contactName || ev.ticket.protocolo}
                    </span>
                    {ev.ticket.protocolo && (
                      <span className="text-[10px] text-neutral-400 font-mono">{ev.ticket.protocolo}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-neutral-600 dark:text-neutral-300 mt-0.5">
                    <span className="capitalize">{ev.etapaAnterior || 'novo'}</span>
                    <ArrowRight size={10} className="text-neutral-400" />
                    <span className="font-bold text-navy-900 capitalize">{ev.etapaNova}</span>
                    <span className="text-neutral-400">•</span>
                    <span className="text-neutral-500 dark:text-neutral-400">{ev.origem === 'manual' ? 'Manual' : 'Automático'}</span>
                    {ev.usuario && <><span className="text-neutral-400">•</span><span>por {ev.usuario.name}</span></>}
                  </div>
                </div>
                <span className="text-[10px] text-neutral-400 flex-shrink-0">
                  {new Date(ev.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="text-center">
        <p className="text-xs text-neutral-400">
          Atualização automática a cada 5 segundos • {totalAtivos} chamados ativos no sistema
        </p>
      </div>
    </div>
  );
}
