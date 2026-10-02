export interface AppConfig {
  /** Prefix of API requests; same-origin `/api` behind the proxy. */
  readonly apiBaseUrl: string;
  /** Demo mode: launch emulator outside Telegram and the "demo" mark. */
  readonly demoMode: boolean;
}

export const appConfig: AppConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api',
  demoMode: import.meta.env.VITE_DEMO_MODE === 'true',
};

export const THEME_STORAGE_KEY = 'mst-miniapp-theme';
