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

const scheduleTokenRefresh = () => {
  if (refreshTimeout) clearTimeout(refreshTimeout);

  const token = localStorage.getItem('accessToken');
  if (!token) return;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expiresIn = payload.exp * 1000 - Date.now();
    const refreshIn = Math.max(expiresIn - 60 * 1000, 10 * 1000);

    refreshTimeout = setTimeout(async () => {
      const refreshToken = localStorage.getItem('refreshToken');
      const sessionToken = localStorage.getItem('sessionToken');
      if (!refreshToken) return;

      try {
        const { data } = await axios.post('/api/auth/refresh', { refreshToken, sessionToken });
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        if (data.sessionToken) localStorage.setItem('sessionToken', data.sessionToken);
        scheduleTokenRefresh();
      } catch {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('sessionToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }, refreshIn);
  } catch {}
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

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

      const refreshToken = localStorage.getItem('refreshToken');
      const sessionToken = localStorage.getItem('sessionToken');

      if (refreshToken && originalRequest.url !== '/auth/refresh') {
        try {
          const { data } = await axios.post('/api/auth/refresh', { refreshToken, sessionToken });
          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken);
          if (data.sessionToken) localStorage.setItem('sessionToken', data.sessionToken);
          processQueue(null, data.accessToken);
          scheduleTokenRefresh();
          originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
          return api(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError, null);
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('sessionToken');
          localStorage.removeItem('user');
          window.location.href = '/login';
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      } else {
        isRefreshing = false;
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('sessionToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

const initAuth = () => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    scheduleTokenRefresh();
  }
};

initAuth();

export default api;
