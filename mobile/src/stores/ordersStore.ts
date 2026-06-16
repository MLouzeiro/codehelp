import { create } from 'zustand';
import api from '../services/api';
import type { ServiceOrder } from '../types';

interface OrdersState {
  orders: ServiceOrder[];
  total: number;
  loading: boolean;
  selectedOrder: ServiceOrder | null;

  loadOrders: (params?: { page?: number; limit?: number; status?: string }) => Promise<void>;
  loadOrder: (id: string) => Promise<void>;
  createOrder: (data: Partial<ServiceOrder>) => Promise<ServiceOrder>;
  updateOrder: (id: string, data: Partial<ServiceOrder>) => Promise<void>;
  updateStatus: (id: string, status: string) => Promise<void>;
}

export const useOrdersStore = create<OrdersState>((set, get) => ({
  orders: [],
  total: 0,
  loading: false,
  selectedOrder: null,

  loadOrders: async (params) => {
    set({ loading: true });
    try {
      const { data } = await api.get('/orders', {
        params: { page: params?.page || 1, limit: params?.limit || 20, status: params?.status },
      });
      set({
        orders: data.items || data || [],
        total: data.total || 0,
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  loadOrder: async (id) => {
    try {
      const { data } = await api.get(`/orders/${id}`);
      set({ selectedOrder: data });
    } catch (err) {
      console.error('Erro ao carregar OS:', err);
    }
  },

  createOrder: async (orderData) => {
    const { data } = await api.post('/orders', orderData);
    await get().loadOrders();
    return data;
  },

  updateOrder: async (id, orderData) => {
    await api.put(`/orders/${id}`, orderData);
    await get().loadOrder(id);
  },

  updateStatus: async (id, status) => {
    await api.patch(`/orders/${id}/status`, { status });
    await get().loadOrder(id);
  },
}));
