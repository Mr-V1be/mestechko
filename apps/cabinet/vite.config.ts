import react from '@vitejs/plugin-react';
import { themeBootScript } from '@mestechko/ui/theme-boot';
import { defaultClientConditions, defineConfig, type Plugin, type ProxyOptions } from 'vite';
import { THEME_STORAGE_KEY } from './src/app/theme-storage.ts';

/** The API the dev and preview servers proxy to; the screenshot pipeline runs its own. */
const API_TARGET = process.env.MESTECHKO_API_URL ?? 'http://127.0.0.1:46210';

const apiProxy: Record<string, ProxyOptions> = {
  '/api': { target: API_TARGET, rewrite: (path) => path.replace(/^\/api/, '') },
};

/** Applies the stored theme before the first paint. */
function themeBoot(): Plugin {
  return {
    name: 'mestechko-theme-boot',
    transformIndexHtml: (html) =>
      html.replace('<!--theme-boot-->', `<script>${themeBootScript(THEME_STORAGE_KEY)}</script>`),
  };
}

export default defineConfig({
  envDir: '../../',
  plugins: [react(), themeBoot()],
  resolve: { conditions: ['@mestechko/source', ...defaultClientConditions] },
  server: { host: '127.0.0.1', port: 46220, strictPort: true, proxy: apiProxy },
  preview: { host: '127.0.0.1', port: 46221, strictPort: true, proxy: apiProxy },
  build: { target: 'es2022', sourcemap: true },
});
