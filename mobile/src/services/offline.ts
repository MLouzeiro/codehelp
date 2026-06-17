import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const CACHE_PREFIX = '@cache:';
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface OfflineQueueItem {
  id: string;
  method: string;
  url: string;
  data?: any;
  timestamp: number;
}

class OfflineService {
  private isOnline = true;
  private listeners: Array<(online: boolean) => void> = [];
  private queue: OfflineQueueItem[] = [];

  constructor() {
    this.initNetworkListener();
    this.loadQueue();
  }

  private async initNetworkListener() {
    try {
      const NetInfoModule = await import('@react-native-community/netinfo');
      NetInfoModule.default.addEventListener((state) => {
        const wasOffline = !this.isOnline;
        this.isOnline = state.isConnected ?? true;

        if (wasOffline && this.isOnline) {
          this.processQueue();
        }

        this.listeners.forEach((cb) => cb(this.isOnline));
      });
    } catch {
      // NetInfo not available, assume online
    }
  }

  onNetworkChange(callback: (online: boolean) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  isNetworkOnline() {
    return this.isOnline;
  }

  // ─── Cache ────────────────────────────────────────────
  async cacheData<T>(key: string, data: T): Promise<void> {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() };
    await AsyncStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(entry));
  }

  async getCachedData<T>(key: string, maxAge = CACHE_EXPIRY): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
      if (!raw) return null;

      const entry: CacheEntry<T> = JSON.parse(raw);
      if (Date.now() - entry.timestamp > maxAge) {
        await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
        return null;
      }
      return entry.data;
    } catch {
      return null;
    }
  }

  async clearCache(pattern?: string): Promise<void> {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter((k) =>
      k.startsWith(CACHE_PREFIX) && (!pattern || k.includes(pattern))
    );
    await AsyncStorage.multiRemove(cacheKeys);
  }

  // ─── Offline Queue ────────────────────────────────────
  private async loadQueue() {
    try {
      const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}offline_queue`);
      if (raw) this.queue = JSON.parse(raw);
    } catch { }
  }

  private async saveQueue() {
    await AsyncStorage.setItem(`${CACHE_PREFIX}offline_queue`, JSON.stringify(this.queue));
  }

  async addToQueue(method: string, url: string, data?: any): Promise<string> {
    const id = `offline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.queue.push({ id, method, url, data, timestamp: Date.now() });
    await this.saveQueue();
    return id;
  }

  async removeFromQueue(id: string) {
    this.queue = this.queue.filter((item) => item.id !== id);
    await this.saveQueue();
  }

  async processQueue() {
    if (!this.isOnline || this.queue.length === 0) return;

    const api = (await import('./api')).default;
    const items = [...this.queue];

    for (const item of items) {
      try {
        await api({ method: item.method, url: item.url, data: item.data });
        await this.removeFromQueue(item.id);
      } catch {
        // Keep in queue for retry
      }
    }
  }

  getQueueLength() {
    return this.queue.length;
  }

  // ─── Cached API calls ─────────────────────────────────
  async cachedGet<T>(url: string, maxAge = CACHE_EXPIRY): Promise<T | null> {
    if (this.isOnline) {
      try {
        const api = (await import('./api')).default;
        const { data } = await api.get(url);
        await this.cacheData(url, data);
        return data;
      } catch {
        return this.getCachedData<T>(url);
      }
    } else {
      return this.getCachedData<T>(url);
    }
  }
}

export const offlineService = new OfflineService();
export default offlineService;
