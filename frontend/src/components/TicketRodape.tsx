import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useKanban } from '../hooks/useKanban';

interface TicketRodapeProps {
  ticket: any;
  ticketId: string;
  onFinalizar?: () => void;
  onMover?: (novaEtapa: string) => void;
}

const ETAPAS_LABELS: Record<string, string> = {
  triagem: 'Triagem',
  fila: 'Fila de Espera',
  em_atendimento: 'Em Atendimento',
  aguardando_cliente: 'Aguardando Cliente',
  aguardando_os: 'Aguardando OS',
  concluido: 'Conclu\u00EDdo',
  descartado: 'Descartado',
};

const ETAPAS_CORES: Record<string, string> = {
  triagem: 'bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-700',
  fila: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700',
  em_atendimento: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700',
  aguardando_cliente: 'bg-sky-100 text-sky-700 border-sky-300 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-700',
  aguardando_os: 'bg-pink-100 text-pink-700 border-pink-300 dark:bg-pink-900/30 dark:text-pink-400 dark:border-pink-700',
  concluido: 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600',
  descartado: 'bg-red-100 text-red-600 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700',
};

const PRIORIDADE_LABELS: Record<string, string> = {
  urgente: 'Urgente',
  alta: 'Alta',
  media: 'M\u00E9dia',
  baixa: 'Baixa',
};

export default function TicketRodape({ ticket, ticketId, onFinalizar, onMover }: TicketRodapeProps) {
  const navigate = useNavigate();
  const { boards, fetchBoards, createTaskFromTicket } = useKanban();
  const [showMoverMenu, setShowMoverMenu] = useState(false);
  const [movendo, setMovendo] = useState(false);
  const [showKanbanModal, setShowKanbanModal] = useState(false);
  const [selectedBoardId, setSelectedBoardId] = useState('');
  const [kanbanTitulo, setKanbanTitulo] = useState('');
  const [kanbanPrioridade, setKanbanPrioridade] = useState(ticket?.prioridade || 'media');
  const [criandoTarefa, setCriandoTarefa] = useState(false);

  useEffect(() => {
    if (showKanbanModal) fetchBoards();
  }, [showKanbanModal]);

  const finalizarTicket = async () => {
    try {
      await api.post(`/helpdesk/tickets/${ticketId}/move`, { etapa: 'concluido' });
      if (onFinalizar) onFinalizar();
      if (onMover) onMover('concluido');
    } catch (err) {
      console.error('Erro ao finalizar:', err);
    }
  };

  const moverEtapa = async (novaEtapa: string) => {
    if (novaEtapa === ticket?.etapa) {
      setShowMoverMenu(false);
      return;
    }
    try {
      setMovendo(true);
      await api.post(`/helpdesk/tickets/${ticketId}/move`, { etapa: novaEtapa });
      setShowMoverMenu(false);
      if (onMover) onMover(novaEtapa);
    } catch (err) {
      console.error('Erro ao mover etapa:', err);
    } finally {
      setMovendo(false);
    }
  };

  // Fechar menu ao clicar fora
  useEffect(() => {
    if (!showMoverMenu) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-mover-menu]')) {
        setShowMoverMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMoverMenu]);

  const etapasDisponiveis = Object.entries(ETAPAS_LABELS).filter(
    ([slug]) => slug !== ticket?.etapa && slug !== 'descartado'
  );

  const handleCriarTarefaKanban = async () => {
    if (!selectedBoardId) return;
    setCriandoTarefa(true);
    try {
      const titulo = kanbanTitulo.trim() || ticket?.assunto || `Ticket #${ticket?.protocolo || ticketId.slice(0, 8)}`;
      await createTaskFromTicket(selectedBoardId, ticketId, {
        titulo,
        prioridade: kanbanPrioridade,
        descricao: ticket?.observacoes || ticket?.resumoFinal || null,
      });
      setShowKanbanModal(false);
      setSelectedBoardId('');
      setKanbanTitulo('');
    } catch (err) {
      console.error('Erro ao criar tarefa kanban:', err);
    } finally {
      setCriandoTarefa(false);
    }
  };

  return (
    <div className="flex gap-3 px-5 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 border-t-0 rounded-b-xl items-center">
      {ticket?.status !== 'fechado' && ticket?.status !== 'resolvido' && (
        <button
          onClick={finalizarTicket}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
        >
          {'\u2705'} Finalizar
        </button>
      )}

      {/* Botão Mover Etapa */}
      {ticket?.status !== 'fechado' && ticket?.status !== 'resolvido' && (
        <div className="relative" data-mover-menu>
          <button
            onClick={() => setShowMoverMenu(!showMoverMenu)}
            disabled={movendo}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            {'\uD83D\uDCCD'} Mover para...
          </button>

          {showMoverMenu && (
            <div className="absolute bottom-full left-0 mb-2 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 py-1.5">
              <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Mover para etapa
              </div>
              {etapasDisponiveis.map(([slug, label]) => (
                <button
                  key={slug}
                  onClick={() => moverEtapa(slug)}
                  className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors"
                >
                  <span className={`inline-block w-2.5 h-2.5 rounded-full border ${ETAPAS_CORES[slug]}`} />
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => navigate(`/app/helpdesk/relatorio/${ticketId}`)}
        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        {'\uD83D\uDCC4'} Gerar Relatório
      </button>

      {/* Botão Criar Tarefa Kanban */}
      <button
        onClick={() => setShowKanbanModal(true)}
        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
      >
        {'\uD83D\uDCCB'} Criar Tarefa Kanban
      </button>

      <span className="flex-1" />
      <span className="text-xs text-slate-400 dark:text-slate-500">
        Ticket #{ticket?.protocolo || ticketId.slice(0, 8)} {'\u00B7'} Prioridade: {PRIORIDADE_LABELS[ticket?.prioridade] || 'M\u00E9dia'}
      </span>

      {/* Modal Criar Tarefa Kanban */}
      {showKanbanModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowKanbanModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">Criar Tarefa no Kanban</h3>
              <button onClick={() => setShowKanbanModal(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">X</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">Quadro *</label>
                <select value={selectedBoardId} onChange={e => setSelectedBoardId(e.target.value)} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 dark:text-slate-200">
                  <option value="">Selecione um quadro</option>
                  {boards.map(b => (
                    <option key={b.id} value={b.id}>{b.icone} {b.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">Título</label>
                <input type="text" value={kanbanTitulo} onChange={e => setKanbanTitulo(e.target.value)} placeholder={ticket?.assunto || `Ticket #${ticket?.protocolo || ticketId.slice(0, 8)}`} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 dark:text-slate-200" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">Prioridade</label>
                <select value={kanbanPrioridade} onChange={e => setKanbanPrioridade(e.target.value)} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 dark:text-slate-200">
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </div>
              <button onClick={handleCriarTarefaKanban} disabled={!selectedBoardId || criandoTarefa} className="w-full py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed">
                {criandoTarefa ? 'Criando...' : 'Criar Tarefa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
