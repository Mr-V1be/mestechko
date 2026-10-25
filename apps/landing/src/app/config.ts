/** Where the visitor goes from the product site: the live demo of each part. */
export const siteConfig = {
  /** The site's own public address, for the links between its language pages. */
  siteUrl: import.meta.env.VITE_LANDING_URL ?? 'http://127.0.0.1:46250',
  cabinetUrl: import.meta.env.VITE_CABINET_URL ?? 'http://127.0.0.1:46220',
  miniappUrl: import.meta.env.VITE_MINIAPP_URL ?? 'http://127.0.0.1:46230',
  widgetUrl: import.meta.env.VITE_WIDGET_BASE_URL ?? 'http://127.0.0.1:46240',
  botUrl: import.meta.env.VITE_BOT_URL ?? 'https://t.me/mestechko_zapis_bot',
} as const;

export { THEME_STORAGE_KEY } from './theme-storage';
