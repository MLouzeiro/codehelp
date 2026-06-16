import { create } from 'zustand';
import api from '../services/api';
import type { CrmClient, Opportunity, PipelineStage } from '../types';

interface CrmState {
  clients: CrmClient[];
  clientsTotal: number;
  clientsPage: number;
  clientsLoading: boolean;
  selectedClient: CrmClient | null;

  pipeline: PipelineStage[];
  pipelineLoading: boolean;

  loadClients: (params?: { search?: string; page?: number; limit?: number }) => Promise<void>;
  loadClient: (id: string) => Promise<void>;
  createClient: (data: Partial<CrmClient>) => Promise<CrmClient>;
  updateClient: (id: string, data: Partial<CrmClient>) => Promise<void>;

  loadPipeline: () => Promise<void>;
  createOpportunity: (data: Partial<Opportunity>) => Promise<void>;
  updateOpportunity: (id: string, data: Partial<Opportunity>) => Promise<void>;
}

export const useCrmStore = create<CrmState>((set, get) => ({
  clients: [],
  clientsTotal: 0,
  clientsPage: 1,
  clientsLoading: false,
  selectedClient: null,

  pipeline: [],
  pipelineLoading: false,

  loadClients: async (params) => {
    set({ clientsLoading: true });
    try {
      const { data } = await api.get('/crm/clients', {
        params: { page: params?.page || 1, limit: params?.limit || 20, search: params?.search },
      });
      const list = Array.isArray(data) ? data : data?.clients || data?.items || [];
      set({ clients: list, clientsTotal: data?.total || list.length, clientsLoading: false });
    } catch {
      set({ clientsLoading: false });
    }
  },

  loadClient: async (id) => {
    try {
      const { data } = await api.get(`/crm/clients/${id}`);
      set({ selectedClient: data });
    } catch (err) {
      console.error('Erro ao carregar cliente:', err);
    }
  },

  createClient: async (clientData) => {
    const { data } = await api.post('/crm/clients', clientData);
    return data;
  },

  updateClient: async (id, clientData) => {
    await api.put(`/crm/clients/${id}`, clientData);
    await get().loadClient(id);
  },

  loadPipeline: async () => {
    set({ pipelineLoading: true });
    try {
      const { data } = await api.get('/crm/pipeline');
      set({ pipeline: data, pipelineLoading: false });
    } catch {
      set({ pipelineLoading: false });
    }
  },

  createOpportunity: async (oppData) => {
    await api.post('/crm/opportunities', oppData);
    await get().loadPipeline();
  },

  updateOpportunity: async (id, oppData) => {
    await api.put(`/crm/opportunities/${id}`, oppData);
    await get().loadPipeline();
  },
}));
