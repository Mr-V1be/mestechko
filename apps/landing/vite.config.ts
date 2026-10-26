import react from '@vitejs/plugin-react';
import { appBasePath } from '@slotwise/ui/app-base';
import { localeBootScript } from '@slotwise/ui/locale-boot';
import { themeBootScript } from '@slotwise/ui/theme-boot';
import { defaultClientConditions, defineConfig, loadEnv, type Plugin } from 'vite';
// The language registry itself, read at build time: the boot script runs before any module.
import { fallbackLocale } from '../../packages/domain/src/locales/locales.ts';
import { pagePaths } from './src/app/page-locale.ts';
import { THEME_STORAGE_KEY } from './src/app/theme-storage.ts';

/** Applies the stored or system theme and opens the visitor's language before the first paint. */
function headBoot(base: string): Plugin {
  return {
    name: 'mestechko-head-boot',
    transformIndexHtml: (html) =>
      html
        .replace(
          '<!--locale-boot-->',
          `<script>${localeBootScript({ base, paths: pagePaths, fallback: fallbackLocale })}</script>`,
        )
        .replace('<!--theme-boot-->', `<script>${themeBootScript(THEME_STORAGE_KEY)}</script>`),
  };
}

/** The repository's `.env` and build arguments both reach the config through here. */
const ENV_DIR = '../../';

export default defineConfig(({ mode }) => {
  // Served under the path of its public address (VITE_LANDING_URL): `/` on a name of its own.
  const base = appBasePath(loadEnv(mode, ENV_DIR, 'VITE_').VITE_LANDING_URL);
  return {
    envDir: ENV_DIR,
    base,
    plugins: [react(), headBoot(base)],
    resolve: { conditions: ['@slotwise/source', ...defaultClientConditions] },
    ssr: { noExternal: true, resolve: { conditions: ['@slotwise/source'] } },
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
  };
});
