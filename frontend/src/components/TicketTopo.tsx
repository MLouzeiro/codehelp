import { Clock, MessageSquare, Bot, Wifi, Mail, Instagram, Facebook, Send, Globe, Phone } from 'lucide-react';

interface TicketTopoProps {
  ticket: any;
}

export default function TicketTopo({ ticket }: TicketTopoProps) {
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

  return (
    <div className="flex items-center gap-4 flex-wrap px-5 py-4 bg-white dark:bg-slate-800 rounded-t-xl border border-slate-200 dark:border-slate-700 border-b-0">
      <span className="font-bold text-base text-slate-800 dark:text-slate-100">{ticket?.contactName || 'Cliente'}</span>
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full border ${prio.color}`}>
        {prio.label}
      </span>
      {ticket?.categoria && (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full border border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800">
          {'\uD83D\uDD27'} {ticket.categoria.replace(/_/g, ' ')}
        </span>
      )}
      {ticket?.resolvidoPorIa && (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium bg-violet-100 text-violet-700 rounded-full border border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-800">
          <Bot className="w-3 h-3" /> IA
        </span>
      )}
      {ticket?.channel && (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full border shadow-sm" style={{ backgroundColor: ticket.channel.cor || '#64748b', color: '#fff', borderColor: ticket.channel.cor || '#64748b' }}>
          {ticket.channel.tipo === 'whatsapp' && <Wifi className="w-3 h-3" />}
          {ticket.channel.tipo === 'email' && <Mail className="w-3 h-3" />}
          {ticket.channel.tipo === 'instagram' && <Instagram className="w-3 h-3" />}
          {ticket.channel.tipo === 'facebook' && <Facebook className="w-3 h-3" />}
          {ticket.channel.tipo === 'telegram' && <Send className="w-3 h-3" />}
          {ticket.channel.tipo === 'web' && <Globe className="w-3 h-3" />}
          {ticket.channel.tipo === 'telefone' && <Phone className="w-3 h-3" />}
          {ticket.channel.nome}
        </span>
      )}
      <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
        {'\u23F1'} <strong className="text-slate-700 dark:text-slate-300">{tempoDecorrido(ticket?.dataAbertura)}</strong> em aberto
      </span>
      <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
        {'\uD83D\uDCE8'} <strong className="text-slate-700 dark:text-slate-300">
          {ticket?.dataPrimeiraResposta ? tempoDecorrido(ticket.dataAbertura) : '\u2014'}
        </strong> at\u00E9 1\u00AA resposta
      </span>
      <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
        {'\u23F3'} <strong className="text-slate-700 dark:text-slate-300">{ticket?.ultimaEsperaCliente || '\u2014'}</strong> espera do cliente
      </span>
      {ticket?.protocolo && (
        <span className="text-xs text-slate-400 dark:text-slate-500 ml-auto">#{ticket.protocolo}</span>
      )}
    </div>
  );
}
