import type { DemoLinkTargets } from '@slotwise/booking-ui';

export interface AppConfig {
  /** Prefix of API requests; same-origin `/api` behind the proxy. */
  readonly apiBaseUrl: string;
  /** Demo mode: launch emulator outside Telegram and the "demo" mark. */
  readonly demoMode: boolean;
  /** Other parts of the demo a visitor can move to from the Mini App. */
  readonly demoLinks: DemoLinkTargets;
}

export const appConfig: AppConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api',
  demoMode: import.meta.env.VITE_DEMO_MODE === 'true',
  demoLinks: {
    ...(import.meta.env.VITE_LANDING_URL ? { landing: import.meta.env.VITE_LANDING_URL } : {}),
    ...(import.meta.env.VITE_CABINET_URL ? { cabinet: import.meta.env.VITE_CABINET_URL } : {}),
    ...(import.meta.env.VITE_BOT_URL ? { bot: import.meta.env.VITE_BOT_URL } : {}),
  },
};

export { THEME_STORAGE_KEY } from './theme-storage';
