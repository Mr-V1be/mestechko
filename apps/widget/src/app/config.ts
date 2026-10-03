export interface AppConfig {
  /** Prefix of API requests; same-origin `/api` behind the proxy. */
  readonly apiBaseUrl: string;
  /** Demo mode: visitors may book with demo numbers (`+7 0XX …`). */
  readonly demoMode: boolean;
}

export const appConfig: AppConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api',
  demoMode: import.meta.env.VITE_DEMO_MODE === 'true',
};
