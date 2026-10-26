import react from '@vitejs/plugin-react';
import { appBasePath } from '@slotwise/ui/app-base';
import { themeBootScript } from '@slotwise/ui/theme-boot';
import {
  defaultClientConditions,
  defineConfig,
  loadEnv,
  type Plugin,
  type ProxyOptions,
} from 'vite';
import { THEME_STORAGE_KEY } from './src/app/theme-storage.ts';

/** The API the dev and preview servers proxy to; the screenshot pipeline runs its own. */
const API_TARGET = process.env.MESTECHKO_API_URL ?? 'http://127.0.0.1:46210';

const apiProxy: Record<string, ProxyOptions> = {
  '/api': { target: API_TARGET, rewrite: (path) => path.replace(/^\/api/, '') },
  // The test payment provider's hosted page; it sends the payer back to this app.
  '/test-pay': { target: API_TARGET },
};

/** Applies the stored theme before the first paint. */
function themeBoot(): Plugin {
  return {
    name: 'mestechko-theme-boot',
    transformIndexHtml: (html) =>
      html.replace('<!--theme-boot-->', `<script>${themeBootScript(THEME_STORAGE_KEY)}</script>`),
  };
}

/** The repository's `.env` and build arguments both reach the config through here. */
const ENV_DIR = '../../';

export default defineConfig(({ mode }) => ({
  envDir: ENV_DIR,
  // Served under the path of its public address (VITE_MINIAPP_URL): `/` on a name of its own.
  base: appBasePath(loadEnv(mode, ENV_DIR, 'VITE_').VITE_MINIAPP_URL),
  plugins: [react(), themeBoot()],
  resolve: { conditions: ['@slotwise/source', ...defaultClientConditions] },
  server: { host: '127.0.0.1', port: 46230, strictPort: true, proxy: apiProxy },
  preview: { host: '127.0.0.1', port: 46231, strictPort: true, proxy: apiProxy },
  build: { target: 'es2022', sourcemap: true },
}));
