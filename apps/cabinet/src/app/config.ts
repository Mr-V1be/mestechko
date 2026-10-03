export const appConfig = {
  /** Prefix of API requests; same-origin `/api` behind the proxy keeps cookies first-party. */
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api',
  demoMode: import.meta.env.VITE_DEMO_MODE === 'true',
  /** Where the website widget is served from: its embed script and booking form. */
  widgetBaseUrl: import.meta.env.VITE_WIDGET_BASE_URL ?? 'http://127.0.0.1:46240',
} as const;

export const THEME_STORAGE_KEY = 'mst-cabinet-theme';
