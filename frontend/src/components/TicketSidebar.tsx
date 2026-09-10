import { useState } from 'react';
import { User, Phone, Mail, MapPin, AlertTriangle, Bot, Tag, History, X, Plus, ExternalLink, Building2 } from 'lucide-react';
import api from '../services/api';
import TicketHistoricoModal from './TicketHistoricoModal';

const TAG_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#6366f1'];

interface TicketSidebarProps {
  ticket: any;
  cliente?: any;
  lastEvents?: any[];
  historicoContato?: any[];
  onTagsChange?: (tags: string[]) => void;
  onOpenLinkModal?: () => void;
}

export default function TicketSidebar({ ticket, cliente, lastEvents = [], historicoContato = [], onTagsChange, onOpenLinkModal }: TicketSidebarProps) {
  const [ticketTags, setTicketTags] = useState<string[]>(ticket?.tags ? ticket.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : []);
  const [showTagInput, setShowTagInput] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [savingTag, setSavingTag] = useState(false);
  const [historicoTicketId, setHistoricoTicketId] = useState<string | null>(null);
  const [historicoProtocolo, setHistoricoProtocolo] = useState<string>('');

  const builtInTags = [];
  if (ticket?.categoria) builtInTags.push({ label: ticket.categoria.replace(/_/g, ' '), color: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800' });
  if (ticket?.prioridade === 'urgente') builtInTags.push({ label: 'Cr\u00EDtico', color: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800' });
  if (ticket?.prioridade === 'alta') builtInTags.push({ label: 'Alta Prioridade', color: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' });
  if (ticket?.resolvidoPorIa) builtInTags.push({ label: 'Resolvido por IA', color: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-800' });

  const handleAddTag = async () => {
    if (!newTag.trim() || !ticket?.id) return;
    setSavingTag(true);
    try {
      const { data } = await api.post(`/helpdesk/tickets/${ticket.id}/tags`, { tag: newTag.trim() });
      setTicketTags(data);
      setNewTag('');
      setShowTagInput(false);
      onTagsChange?.(data);
    } catch (err) {
      console.error('Erro ao adicionar tag:', err);
    } finally {
      setSavingTag(false);
    }
  };

  const handleRemoveTag = async (tag: string) => {
    if (!ticket?.id) return;
    try {
      const { data } = await api.delete(`/helpdesk/tickets/${ticket.id}/tags/${encodeURIComponent(tag)}`);
      setTicketTags(data);
      onTagsChange?.(data);
    } catch (err) {
      console.error('Erro ao remover tag:', err);
    }
  };

  const recentInteractions = lastEvents.slice(0, 5).map((ev: any) => {
    const time = ev.createdAt ? new Date(ev.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
    return `${time} - ${ev.descricao || ev.tipo}`;
  });

  const statusColor: Record<string, string> = {
    aberto: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    em_andamento: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    resolvido: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    fechado: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
    cancelado: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  };

  const etapaLabel: Record<string, string> = {
    fila: 'Fila',
    triagem: 'Triagem',
    em_atendimento: 'Em Atendimento',
    aguardando_cliente: 'Aguardando Cliente',
    aguardando_os: 'Aguardando OS',
    concluido: 'Conclu\u00EDdo',
    descartado: 'Descartado',
  };

  const showLinkButton = !cliente && !ticket?.clientId && onOpenLinkModal;

  return (
    <div className="space-y-4 text-sm">
      {/* Info do Cliente */}
      <div>
        <h4 className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold mb-2">{'\uD83D\uDC64'} Cliente</h4>
        <div className="space-y-2">
          <div className="font-medium text-slate-800 dark:text-slate-100">{cliente?.razaoSocial || ticket?.contactName || 'Sem nome'}</div>
          {cliente?.email && (
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
              <Mail className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              {cliente.email}
            </div>
          )}
          {(cliente?.telefone || ticket?.contactPhone) && (
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
              <Phone className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              {cliente?.telefone || ticket?.contactPhone}
            </div>
          )}
          {cliente?.nomeFantasia && (
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
              {'\uD83C\uDFE2'} {cliente.nomeFantasia}
            </div>
          )}
        </div>

        {/* Laboratório não vinculado */}
        {showLinkButton && (
          <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-xs font-medium mb-1.5">
              <AlertTriangle className="w-4 h-4" />
              Laboratório não vinculado
            </div>
            <p className="text-[11px] text-amber-600 dark:text-amber-500 mb-2">
              Este ticket não possui laboratório associado.
            </p>
            <button
              onClick={onOpenLinkModal}
              className="w-full text-xs bg-amber-600 text-white py-1.5 rounded-lg hover:bg-amber-700 transition-colors flex items-center justify-center gap-1.5"
            >
              <Building2 className="w-3.5 h-3.5" /> Vincular Laboratório
            </button>
          </div>
        )}
      </div>

      {/* Tickets Stats */}
      <div>
        <h4 className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold mb-2">{'\uD83D\uDCCA'} Tickets</h4>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Total:</span><span className="font-semibold text-slate-700 dark:text-slate-300">{cliente?._count?.tickets || 0}</span></div>
          <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Abertos:</span><span className="font-semibold text-amber-600 dark:text-amber-400">{cliente?._count?.ticketsAbertos || 0}</span></div>
          <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Resolvidos:</span><span className="font-semibold text-emerald-600 dark:text-emerald-400">{cliente?._count?.ticketsResolvidos || 0}</span></div>
          {cliente?.inadimplente && (
            <div className="flex justify-between items-center">
              <span className="text-red-500 dark:text-red-400">Inadimplente:</span>
              <span className="font-semibold text-red-600 dark:text-red-400 flex items-center gap-1">
                Sim <span className="text-[10px] bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-1.5 py-0.5 rounded-full">{'\u26A0\uFE0F'}</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Tags do Ticket */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold">{'\uD83C\uDFF7\uFE0F'} Tags</h4>
          <button
            onClick={() => setShowTagInput(!showTagInput)}
            className="text-[11px] text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium flex items-center gap-0.5"
          >
            <Plus className="w-3 h-3" /> {showTagInput ? 'Cancelar' : 'Adicionar'}
          </button>
        </div>

        {showTagInput && (
          <div className="flex items-center gap-1.5 mb-2 p-2 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
            <input
              type="text"
              value={newTag}
              onChange={e => setNewTag(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddTag()}
              placeholder="Nova tag..."
              className="flex-1 text-xs px-2 py-1 border border-slate-200 dark:border-slate-700 rounded outline-none focus:border-blue-400 dark:focus:border-blue-500"
              autoFocus
            />
            <button
              onClick={handleAddTag}
              disabled={!newTag.trim() || savingTag}
              className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {savingTag ? '...' : '+'}
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {ticketTags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800">
              {tag}
              <button onClick={() => handleRemoveTag(tag)} className="hover:text-blue-900 dark:hover:text-blue-200">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {builtInTags.map((tag, i) => (
            <span key={`builtin-${i}`} className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full border ${tag.color}`}>
              {tag.label}
            </span>
          ))}
          {ticketTags.length === 0 && builtInTags.length === 0 && (
            <span className="text-[11px] text-slate-400 dark:text-slate-500">Nenhuma tag</span>
          )}
        </div>
      </div>

      {/* Histórico de Tickets do Contato */}
      {historicoContato.length > 0 && (
        <div>
          <h4 className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold mb-2 flex items-center gap-1">
            <History className="w-3.5 h-3.5" /> Histórico do Contato
          </h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {historicoContato.map((h) => (
              <div
                key={h.id}
                onClick={() => { setHistoricoTicketId(h.id); setHistoricoProtocolo(h.protocolo || ''); }}
                className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-700 text-[11px] cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 transition-colors group"
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  {h.protocolo && <span className="font-mono text-slate-500 dark:text-slate-400">#{h.protocolo}</span>}
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${statusColor[h.status] || 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'}`}>
                    {h.status}
                  </span>
                </div>
                <div className="text-slate-700 dark:text-slate-300 font-medium truncate">{h.assunto || 'Sem assunto'}</div>
                <div className="flex items-center justify-between mt-1 text-slate-400 dark:text-slate-500">
                  <span>{etapaLabel[h.etapa] || h.etapa}</span>
                  <span>{new Date(h.createdAt).toLocaleDateString('pt-BR')}</span>
                </div>
                {h.assignee?.name && (
                  <div className="text-slate-400 dark:text-slate-500 mt-0.5">Atendente: {h.assignee.name}</div>
                )}
                <div className="flex items-center gap-1 mt-1 text-blue-500 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ExternalLink className="w-3 h-3" /> Ver conversa
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Últimas Interações */}
      {recentInteractions.length > 0 && (
        <div>
          <h4 className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold mb-2">{'\uD83D\uDCDD'} {'\u00DAl'}timas Intera{'\u00E7'}{'\u00F5'}es</h4>
          <div className="space-y-1 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            {recentInteractions.map((interaction, i) => (
              <div key={i}>{'\u2022'} {interaction}</div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de Histórico */}
      <TicketHistoricoModal
        open={!!historicoTicketId}
        onClose={() => setHistoricoTicketId(null)}
        ticketId={historicoTicketId || ''}
        protocolo={historicoProtocolo}
      />
    </div>
  );
}
