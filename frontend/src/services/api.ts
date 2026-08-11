import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

let refreshTimeout: ReturnType<typeof setTimeout> | null = null;
let isRefreshing = false;
let failedQueue: Array<{ resolve: (value: any) => void; reject: (reason?: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// ── Helpers: Ler/escrever tokens em cookies ──────────────────────────
function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name: string, value: string, maxAge: number) {
  document.cookie = `${name}=${value}; path=/; max-age=${maxAge}; SameSite=Strict`;
}

function removeCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0`;
}

function clearAllTokens() {
  removeCookie('accessToken');
  removeCookie('refreshToken');
  removeCookie('sessionToken');
  localStorage.removeItem('user');
}

const scheduleTokenRefresh = () => {
  if (refreshTimeout) clearTimeout(refreshTimeout);

  const token = getCookie('accessToken');
  if (!token) return;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expiresIn = payload.exp * 1000 - Date.now();

    if (expiresIn < 10 * 1000) return;

    const refreshIn = Math.max(expiresIn - 2 * 60 * 1000, 30 * 1000);

    refreshTimeout = setTimeout(async () => {
      if (isRefreshing) {
        scheduleTokenRefresh();
        return;
      }

      const refreshToken = getCookie('refreshToken');
      const sessionToken = getCookie('sessionToken');
      if (!refreshToken) return;

      try {
        isRefreshing = true;
        const { data } = await axios.post('/api/auth/refresh', { refreshToken, sessionToken });
        setCookie('accessToken', data.accessToken, 900);
        setCookie('refreshToken', data.refreshToken, 604800);
        if (data.sessionToken) setCookie('sessionToken', data.sessionToken, 604800);
        isRefreshing = false;
        processQueue(null, data.accessToken);
        scheduleTokenRefresh();
      } catch {
        isRefreshing = false;
        processQueue(new Error('Refresh failed'), null);
        clearAllTokens();
        window.location.href = '/login';
      }
    }, refreshIn);
  } catch {
    clearAllTokens();
    window.location.href = '/login';
  }
};

// ── Request interceptor: enviar token do cookie ─────────────────────
api.interceptors.request.use((config) => {
  const token = getCookie('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response interceptor: refresh automatico ────────────────────────
api.interceptors.response.use(
  (response) => {
    scheduleTokenRefresh();
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = getCookie('refreshToken');
      const sessionToken = getCookie('sessionToken');

      if (refreshToken && originalRequest.url !== '/auth/refresh') {
        try {
          const { data } = await axios.post('/api/auth/refresh', { refreshToken, sessionToken });
          setCookie('accessToken', data.accessToken, 900);
          setCookie('refreshToken', data.refreshToken, 604800);
          if (data.sessionToken) setCookie('sessionToken', data.sessionToken, 604800);
          processQueue(null, data.accessToken);
          scheduleTokenRefresh();
          originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
          return api(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError, null);
          clearAllTokens();
          window.location.href = '/login';
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      } else {
        isRefreshing = false;
        clearAllTokens();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

const initAuth = () => {
  const token = getCookie('accessToken');
  if (token) {
    scheduleTokenRefresh();
  }
};

initAuth();

export default api;