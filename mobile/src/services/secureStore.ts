import * as SecureStore from 'expo-secure-store';

const KEYS = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
  SESSION_TOKEN: 'sessionToken',
  USER: 'user',
  BIOMETRICS_ENABLED: 'biometricsEnabled',
  THEME: 'theme',
  BG_MODE: 'bgMode',
};

export const tokenStorage = {
  async getAccessToken(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.ACCESS_TOKEN);
  },

  async setAccessToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(KEYS.ACCESS_TOKEN, token);
  },

  async getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.REFRESH_TOKEN);
  },

  async setRefreshToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, token);
  },

  async getSessionToken(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.SESSION_TOKEN);
  },

  async setSessionToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(KEYS.SESSION_TOKEN, token);
  },

  async getUser(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.USER);
  },

  async setUser(user: string): Promise<void> {
    await SecureStore.setItemAsync(KEYS.USER, user);
  },

  async clearAll(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(KEYS.ACCESS_TOKEN),
      SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN),
      SecureStore.deleteItemAsync(KEYS.SESSION_TOKEN),
      SecureStore.deleteItemAsync(KEYS.USER),
    ]);
  },
};

export const settingsStorage = {
  async getBiometricsEnabled(): Promise<boolean> {
    const val = await SecureStore.getItemAsync(KEYS.BIOMETRICS_ENABLED);
    return val === 'true';
  },

  async setBiometricsEnabled(enabled: boolean): Promise<void> {
    await SecureStore.setItemAsync(KEYS.BIOMETRICS_ENABLED, String(enabled));
  },

  async getTheme(): Promise<'light' | 'dark' | 'system'> {
    const val = await SecureStore.getItemAsync(KEYS.THEME);
    return (val as 'light' | 'dark' | 'system') || 'system';
  },

  async setTheme(theme: 'light' | 'dark' | 'system'): Promise<void> {
    await SecureStore.setItemAsync(KEYS.THEME, theme);
  },

  async getBgMode(): Promise<string> {
    return (await SecureStore.getItemAsync(KEYS.BG_MODE)) || 'white';
  },

  async setBgMode(mode: string): Promise<void> {
    await SecureStore.setItemAsync(KEYS.BG_MODE, mode);
  },
};
