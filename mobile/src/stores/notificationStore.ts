import { create } from 'zustand';
import api from '../services/api';
import type { Notificacao } from '../types';

interface NotificationState {
  items: Notificacao[];
  total: number;
  naoLidas: number;
  loading: boolean;

  loadNotifications: (params?: { page?: number; limit?: number }) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  items: [],
  total: 0,
  naoLidas: 0,
  loading: false,

  loadNotifications: async (params) => {
    set({ loading: true });
    try {
      const { data } = await api.get('/notificacoes', {
        params: { page: params?.page || 1, limit: params?.limit || 30 },
      });
      set({
        items: data.items || [],
        total: data.total || 0,
        naoLidas: data.naoLidas || 0,
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  markAsRead: async (id) => {
    try {
      await api.post(`/notificacoes/${id}/lida`);
      set((state) => ({
        items: state.items.map((n) => (n.id === id ? { ...n, lida: true } : n)),
        naoLidas: Math.max(0, state.naoLidas - 1),
      }));
    } catch { }
  },

  markAllAsRead: async () => {
    try {
      await api.post('/notificacoes/marcar-todas');
      set((state) => ({
        items: state.items.map((n) => ({ ...n, lida: true })),
        naoLidas: 0,
      }));
    } catch { }
  },
}));
