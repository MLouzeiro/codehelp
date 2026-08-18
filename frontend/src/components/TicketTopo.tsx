import { Clock, MessageSquare, Bot, Wifi, Mail, Instagram, Facebook, Send, Globe, Phone, ShieldCheck, ShieldAlert, UserCheck } from 'lucide-react';

interface TicketTopoProps {
  ticket: any;
  slaLabel?: string;
  slaStatus?: 'no_prazo' | 'violado';
}

const STATUS_LABELS: Record<string, string> = {
  aberto: 'Aberto', em_andamento: 'Em andamento', pendente: 'Pendente',
  escalonado: 'Escalonado', resolvido: 'Resolvido', fechado: 'Fechado', cancelado: 'Cancelado',
};

const ETAPA_LABELS: Record<string, string> = {
  fila: 'Fila', triagem: 'Triagem', em_atendimento: 'Em Atendimento',
  aguardando_cliente: 'Aguardando Cliente', aguardando_os: 'Aguardando OS',
  concluido: 'Concluído', descartado: 'Descartado',
};

export default function TicketTopo({ ticket, slaLabel, slaStatus }: TicketTopoProps) {
  const getPrioridadeBadge = () => {
    const map: Record<string, { color: string; label: string }> = {
      urgente: { color: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800', label: '\u{1F534} Urgente' },
      alta: { color: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800', label: '\uD83D\uDFE0 Alta' },
      media: { color: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800', label: '\uD83D\uDFE1 M\u00E9dia' },
      baixa: { color: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800', label: '\uD83D\uDFE2 Baixa' },
    };
    return map[ticket?.prioridade] || map.media;
  };

  const tempoDecorrido = (data?: string) => {
    if (!data) return '\u2014';
    const diff = Date.now() - new Date(data).getTime();
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
    if (h === 0) return `${m}min`;
    return `${h}h ${m}min`;
  };

  const prio = getPrioridadeBadge();
  const statusLabel = STATUS_LABELS[ticket?.status] || ticket?.status;
  const etapaLabel = ETAPA_LABELS[ticket?.etapa] || ticket?.etapa;

  return (
    <div className="px-5 py-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
      {/* Linha 1 — identificação + badges */}
      <div className="flex items-center gap-2 flex-wrap">
        {ticket?.protocolo && (
          <span className="font-mono text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-900 rounded-md px-2 py-0.5">
            #{ticket.protocolo}
          </span>
        )}
        <span className="font-bold text-sm text-slate-800 dark:text-slate-100">{ticket?.contactName || 'Cliente'}</span>
        {statusLabel && (
          <span className={`inline-flex items-center px-2.5 py-0.5 text-[11px] font-semibold rounded-full border ${
            ticket?.status === 'fechado' || ticket?.status === 'resolvido'
              ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800'
              : ticket?.status === 'cancelado'
                ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'
                : 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800'
          }`}>
            {statusLabel}
          </span>
        )}
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full border ${prio.color}`}>
          {prio.label}
        </span>
        {ticket?.departamento?.nome && (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full border bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-800">
            {ticket.departamento.nome}
          </span>
        )}
        {ticket?.etapa && ticket?.etapa !== 'concluido' && ticket?.etapa !== 'descartado' && (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full border bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
            {etapaLabel}
          </span>
        )}
        {slaLabel && (
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
            slaStatus === 'violado'
              ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'
              : 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800'
          }`}>
            {slaStatus === 'violado' ? <ShieldAlert className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
            {slaLabel}
          </span>
        )}
        <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 ml-auto">
          {'\u23F1'} <strong className="text-slate-700 dark:text-slate-300">{tempoDecorrido(ticket?.dataAbertura)}</strong> em aberto
        </span>
      </div>

      {/* Linha 2 — assunto */}
      {ticket?.assunto && (
        <div className="mt-1.5 flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300 min-w-0">
          <MessageSquare size={13} className="text-slate-400 dark:text-slate-500 flex-shrink-0" />
          <span className="truncate">{ticket.assunto}</span>
        </div>
      )}

      {/* Linha 3 — metadados */}
      <div className="mt-1.5 flex items-center gap-x-4 gap-y-1 flex-wrap text-xs text-slate-500 dark:text-slate-400">
        {ticket?.assignee?.name && (
          <span className="flex items-center gap-1">
            <UserCheck size={12} className="text-emerald-500" />
            <strong className="text-slate-700 dark:text-slate-300">{ticket.assignee.name}</strong> analista
          </span>
        )}
        {ticket?.categoria && (
          <span className="flex items-center gap-1">
            {'\uD83D\uDD27'} {ticket.categoria.replace(/_/g, ' ')}
          </span>
        )}
        {ticket?.resolvidoPorIa && (
          <span className="flex items-center gap-1">
            <Bot className="w-3 h-3 text-violet-500" /> Resolvido por IA
          </span>
        )}
        {ticket?.channel && (
          <span className="flex items-center gap-1">
            {ticket.channel.tipo === 'whatsapp' && <Wifi className="w-3 h-3" />}
            {ticket.channel.tipo === 'email' && <Mail className="w-3 h-3" />}
            {ticket.channel.tipo === 'instagram' && <Instagram className="w-3 h-3" />}
            {ticket.channel.tipo === 'facebook' && <Facebook className="w-3 h-3" />}
            {ticket.channel.tipo === 'web' && <Globe className="w-3 h-3" />}
            {ticket.channel.tipo === 'telefone' && <Phone className="w-3 h-3" />}
            {ticket.channel.tipo === 'send' && <Send className="w-3 h-3" />}
            {ticket.channel.nome}
          </span>
        )}
        {ticket?.dataPrimeiraResposta && (
          <span className="flex items-center gap-1">
            {'\uD83D\uDCE8'} <strong className="text-slate-700 dark:text-slate-300">{tempoDecorrido(ticket.dataAbertura)}</strong> at\u00E9 1\u00AA resposta
          </span>
        )}
        {ticket?.ultimaEsperaCliente && (
          <span className="flex items-center gap-1">
            {'\u23F3'} <strong className="text-slate-700 dark:text-slate-300">{ticket.ultimaEsperaCliente}</strong> espera do cliente
          </span>
        )}
        <span className="flex items-center gap-1">
          <Clock size={12} className="text-slate-400" />
          {new Date(ticket?.dataAbertura).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}
