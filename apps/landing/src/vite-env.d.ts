/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LANDING_URL?: string;
  readonly VITE_CABINET_URL?: string;
  readonly VITE_MINIAPP_URL?: string;
  readonly VITE_WIDGET_BASE_URL?: string;
  readonly VITE_BOT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
