import type { DemoLinkTargets } from '@mestechko/booking-ui';

export const appConfig = {
  /** Prefix of API requests; same-origin `/api` behind the proxy keeps cookies first-party. */
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api',
  demoMode: import.meta.env.VITE_DEMO_MODE === 'true',
  /** Where the website widget is served from: its embed script and booking form. */
  widgetBaseUrl: import.meta.env.VITE_WIDGET_BASE_URL ?? 'http://127.0.0.1:46240',
  /** Other parts of the demo a visitor can move to from the cabinet. */
  demoLinks: {
    ...(import.meta.env.VITE_LANDING_URL ? { landing: import.meta.env.VITE_LANDING_URL } : {}),
    ...(import.meta.env.VITE_MINIAPP_URL ? { miniapp: import.meta.env.VITE_MINIAPP_URL } : {}),
    ...(import.meta.env.VITE_BOT_URL ? { bot: import.meta.env.VITE_BOT_URL } : {}),
  } satisfies DemoLinkTargets,
} as const;

export { THEME_STORAGE_KEY } from './theme-storage';
