import react from '@vitejs/plugin-react';
import { appBasePath } from '@mestechko/ui/app-base';
import { themeBootScript } from '@mestechko/ui/theme-boot';
import { defaultClientConditions, defineConfig, loadEnv, type Plugin } from 'vite';
import { THEME_STORAGE_KEY } from './src/app/theme-storage.ts';

/** Applies the stored or system theme before the first paint. */
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
  // Served under the path of its public address (VITE_LANDING_URL): `/` on a name of its own.
  base: appBasePath(loadEnv(mode, ENV_DIR, 'VITE_').VITE_LANDING_URL),
  plugins: [react(), themeBoot()],
  resolve: { conditions: ['@mestechko/source', ...defaultClientConditions] },
  ssr: { noExternal: true, resolve: { conditions: ['@mestechko/source'] } },
  server: { host: '127.0.0.1', port: 46250, strictPort: true },
  preview: { host: '127.0.0.1', port: 46251, strictPort: true },
  build: {
    target: 'es2022',
    sourcemap: true,
    rolldownOptions: {
      output: {
        // Libraries change rarely: they get their own chunks and stay cached across releases.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'ui-kit', test: /node_modules[\\/](@base-ui|@floating-ui|lucide-react)/ },
            {
              name: 'data',
              test: /node_modules[\\/](@tanstack|i18next|react-i18next|libphonenumber-js|zod)/,
            },
          ],
        },
      },
    },
  },
}));
