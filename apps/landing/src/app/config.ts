interface SiteConfig {
  /** The site's own public address, for the links between its language pages. */
  readonly siteUrl: string;
  readonly cabinetUrl: string;
  readonly miniappUrl: string;
  readonly widgetUrl: string;
  /** The Telegram bot, once one is configured: its username is a setting, never fixed here. */
  readonly botUrl?: string;
}

/** Where the visitor goes from the product site: the live demo of each part. */
export const siteConfig: SiteConfig = {
  siteUrl: import.meta.env.VITE_LANDING_URL ?? 'http://127.0.0.1:46250',
  cabinetUrl: import.meta.env.VITE_CABINET_URL ?? 'http://127.0.0.1:46220',
  miniappUrl: import.meta.env.VITE_MINIAPP_URL ?? 'http://127.0.0.1:46230',
  widgetUrl: import.meta.env.VITE_WIDGET_BASE_URL ?? 'http://127.0.0.1:46240',
  ...(import.meta.env.VITE_BOT_URL ? { botUrl: import.meta.env.VITE_BOT_URL } : {}),
};

export { THEME_STORAGE_KEY } from './theme-storage';
