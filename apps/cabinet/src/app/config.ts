export const appConfig = {
  /** Prefix of API requests; same-origin `/api` behind the proxy keeps cookies first-party. */
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api',
  demoMode: import.meta.env.VITE_DEMO_MODE === 'true',
} as const;

export const THEME_STORAGE_KEY = 'mst-cabinet-theme';
