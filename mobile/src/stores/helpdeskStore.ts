import { create } from 'zustand';
import api from '../services/api';
import type { HelpdeskKanbanData, HelpdeskTicket, TicketDetail, EtapaSlug } from '../types';

interface HelpdeskState {
  kanbanData: HelpdeskKanbanData | null;
  selectedTicket: TicketDetail | null;
  selectedTicketId: string | null;
  loading: boolean;
  detailLoading: boolean;
  orderBy: string;

  loadKanban: () => Promise<void>;
  selectTicket: (id: string | null) => void;
  loadTicketDetail: (id: string) => Promise<void>;
  moveTicket: (ticketId: string, toStage: EtapaSlug) => Promise<void>;
  assignTicket: (ticketId: string, userId: string) => Promise<void>;
  assumeTicket: (ticketId: string) => Promise<void>;
  resolveTicket: (ticketId: string) => Promise<void>;
  triageTicket: (ticketId: string, data: any) => Promise<void>;
  sendMessage: (ticketId: string, content: string) => Promise<void>;
  setOrderBy: (order: string) => void;
}

export const useHelpdeskStore = create<HelpdeskState>((set, get) => ({
  kanbanData: null,
  selectedTicket: null,
  selectedTicketId: null,
  loading: false,
  detailLoading: false,
  orderBy: 'updatedAt_desc',

  loadKanban: async () => {
    set({ loading: true });
    try {
      const { data } = await api.get('/helpdesk/kanban', {
        params: { orderBy: get().orderBy },
      });
      set({ kanbanData: data, loading: false });
    } catch (err) {
      console.error('Erro ao carregar kanban:', err);
      set({ loading: false });
    }
  },

  selectTicket: (id) => {
    set({ selectedTicketId: id, selectedTicket: null });
    if (id) {
      get().loadTicketDetail(id);
    }
  },

  loadTicketDetail: async (id) => {
    set({ detailLoading: true });
    try {
      const { data } = await api.get(`/helpdesk/tickets/${id}/history`);
      set({ selectedTicket: data, detailLoading: false });
    } catch (err) {
      console.error('Erro ao carregar detalhe:', err);
      set({ detailLoading: false });
    }
  },

  moveTicket: async (ticketId, toStage) => {
    try {
      await api.post(`/helpdesk/tickets/${ticketId}/move`, { etapaDestino: toStage });
      await get().loadKanban();
      if (get().selectedTicketId === ticketId) {
        await get().loadTicketDetail(ticketId);
      }
    } catch (err: any) {
      throw new Error(err.response?.data?.error || 'Erro ao mover ticket');
    }
  },

  assignTicket: async (ticketId, userId) => {
    try {
      await api.patch(`/helpdesk/tickets/${ticketId}/atribuir`, { assigneeId: userId });
      await get().loadKanban();
      if (get().selectedTicketId === ticketId) {
        await get().loadTicketDetail(ticketId);
      }
    } catch (err: any) {
      throw new Error(err.response?.data?.error || 'Erro ao atribuir ticket');
    }
  },

  assumeTicket: async (ticketId) => {
    try {
      await api.post(`/helpdesk/tickets/${ticketId}/assume`);
      await get().loadKanban();
      if (get().selectedTicketId === ticketId) {
        await get().loadTicketDetail(ticketId);
      }
    } catch (err: any) {
      throw new Error(err.response?.data?.error || 'Erro ao assumir ticket');
    }
  },

  resolveTicket: async (ticketId) => {
    try {
      await api.post(`/helpdesk/tickets/${ticketId}/resolver`);
      await get().loadKanban();
      if (get().selectedTicketId === ticketId) {
        await get().loadTicketDetail(ticketId);
      }
    } catch (err: any) {
      throw new Error(err.response?.data?.error || 'Erro ao resolver ticket');
    }
  },

  triageTicket: async (ticketId, triageData) => {
    try {
      await api.post(`/helpdesk/tickets/${ticketId}/triage`, triageData);
      await get().loadKanban();
    } catch (err: any) {
      throw new Error(err.response?.data?.error || 'Erro ao triar ticket');
    }
  },

  sendMessage: async (ticketId, content) => {
    try {
      await api.post('/whatsapp/send', { ticketId, message: content });
      await get().loadTicketDetail(ticketId);
    } catch (err: any) {
      throw new Error(err.response?.data?.error || 'Erro ao enviar mensagem');
    }
  },

  setOrderBy: (order) => {
    set({ orderBy: order });
    get().loadKanban();
  },
}));
