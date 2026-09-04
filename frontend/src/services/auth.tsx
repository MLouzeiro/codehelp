import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from './api';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>(null!);

// ── Helper: Salvar tokens via cookies (httpOnly no backend) ──────────
// O backend Define httpOnly cookies — o frontend so armazena o user object
function setAuthCookies(accessToken: string, refreshToken: string, sessionToken: string) {
  // Salvar em cookies simples (nao httpOnly, mas o httpOnly ja esta no backend)
  // Estes sao para o frontend usar no Authorization header
  document.cookie = `accessToken=${accessToken}; path=/; max-age=900; SameSite=Strict`;
  document.cookie = `refreshToken=${refreshToken}; path=/; max-age=604800; SameSite=Strict`;
  document.cookie = `sessionToken=${sessionToken}; path=/; max-age=604800; SameSite=Strict`;
}

function clearAuthCookies() {
  document.cookie = 'accessToken=; path=/; max-age=0';
  document.cookie = 'refreshToken=; path=/; max-age=0';
  document.cookie = 'sessionToken=; path=/; max-age=0';
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Verificar se existe cookie de sessao e user no localStorage
    const stored = localStorage.getItem('user');
    const token = getCookie('accessToken');
    if (stored && token) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    setError(null);
    try {
      const { data } = await api.post('/auth/login', { email, password });

      // Salvar tokens em cookies
      setAuthCookies(data.accessToken, data.refreshToken, data.sessionToken);

      // Salvar user no localStorage (nao sensive)
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
    } catch (err: any) {
      const mensagem = err?.response?.data?.error || 'Erro ao fazer login';
      setError(mensagem);
      throw err;
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignora erro — logout local sempre acontece
    }
    clearAuthCookies();
    localStorage.removeItem('user');
    setUser(null);
    setError(null);
  };

  const refreshTokenFn = async () => {
    const refresh = getCookie('refreshToken');
    const session = getCookie('sessionToken');
    if (!refresh) throw new Error('Sem refresh token');

    const { data } = await api.post('/auth/refresh', { refreshToken: refresh, sessionToken: session });

    // Atualizar cookies
    setAuthCookies(data.accessToken, data.refreshToken, data.sessionToken || session || '');
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, login, logout, refreshToken: refreshTokenFn }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
