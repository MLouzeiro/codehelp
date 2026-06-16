import { create } from 'zustand';
import { tokenStorage } from '../services/secureStore';
import api from '../services/api';
import type { User, AuthResponse } from '../types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.post<AuthResponse>('/auth/login', { email, password });

      await tokenStorage.setAccessToken(data.accessToken);
      await tokenStorage.setRefreshToken(data.refreshToken);
      await tokenStorage.setSessionToken(data.sessionToken);
      await tokenStorage.setUser(JSON.stringify(data.user));

      set({ user: data.user, isAuthenticated: true, isLoading: false });
    } catch (err: any) {
      const message = err.response?.data?.error || 'Erro ao fazer login';
      set({ error: message, isLoading: false });
      throw new Error(message);
    }
  },

  logout: async () => {
    await tokenStorage.clearAll();
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  loadUser: async () => {
    set({ isLoading: true });
    try {
      const userStr = await tokenStorage.getUser();
      const token = await tokenStorage.getAccessToken();

      if (!userStr || !token) {
        set({ isLoading: false, isAuthenticated: false });
        return;
      }

      const user = JSON.parse(userStr) as User;
      set({ user, isAuthenticated: true, isLoading: false });

      // Refresh user data from server in background
      try {
        const { data } = await api.get('/auth/me');
        const freshUser = data.user || data;
        await tokenStorage.setUser(JSON.stringify(freshUser));
        set({ user: freshUser });
      } catch {
        // Token might be expired, but we have the cached user
      }
    } catch {
      set({ isLoading: false, isAuthenticated: false });
    }
  },

  refreshUser: async () => {
    try {
      const { data } = await api.get('/auth/me');
      const freshUser = data.user || data;
      await tokenStorage.setUser(JSON.stringify(freshUser));
      set({ user: freshUser });
    } catch { }
  },

  clearError: () => set({ error: null }),
}));
