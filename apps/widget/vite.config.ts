import react from '@vitejs/plugin-react';
import { appBasePath } from '@slotwise/ui/app-base';
import {
  defaultClientConditions,
  defineConfig,
  loadEnv,
  type Plugin,
  type ProxyOptions,
} from 'vite';

/** The API the dev and preview servers proxy to; the screenshot pipeline runs its own. */
const API_TARGET = process.env.MESTECHKO_API_URL ?? 'http://127.0.0.1:46210';

const apiProxy: Record<string, ProxyOptions> = {
  '/api': { target: API_TARGET, rewrite: (path) => path.replace(/^\/api/, '') },
  // The test payment provider's hosted page; it sends the payer back to the widget.
  '/test-pay': { target: API_TARGET },
};

/**
 * The embedding page picks the theme (`?theme=light|dark|auto`); it is applied before
 * the first paint so the frame never flashes the other palette.
 */
const THEME_BOOT = `(function(){var t=new URLSearchParams(location.search).get('theme');var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';})();`;

function themeBoot(): Plugin {
  return {
    name: 'mestechko-widget-theme-boot',
    transformIndexHtml: (html) =>
      html.replace('<!--theme-boot-->', `<script>${THEME_BOOT}</script>`),
  };
}

/**
 * The built embed script is a classic `widget.js`. In development it is served as a
 * stand-in that loads the loader's source as a module. A module has no current script,
 * so the loader finds the site's own tag by its `data-mestechko` mark and reads its
 * attributes and address from there, as on any real site.
 */
const DEV_LOADER = `(function(){var m=document.createElement('script');m.type='module';m.src='/src/loader/widget.ts';document.head.appendChild(m);})();`;

function devLoader(): Plugin {
  return {
    name: 'mestechko-widget-dev-loader',
    apply: 'serve',
    configureServer: (server) => {
      server.middlewares.use('/widget.js', (_request, response) => {
        response.setHeader('content-type', 'text/javascript; charset=utf-8');
        response.end(DEV_LOADER);
      });
    },
  };
}

/** The repository's `.env` and build arguments both reach the config through here. */
const ENV_DIR = '../../';

export default defineConfig(({ mode }) => ({
  envDir: ENV_DIR,
  // Served under the path of its public address (VITE_WIDGET_BASE_URL): `/` on a name of its own.
  base: appBasePath(loadEnv(mode, ENV_DIR, 'VITE_').VITE_WIDGET_BASE_URL),
  plugins: [react(), themeBoot(), devLoader()],
  resolve: { conditions: ['@slotwise/source', ...defaultClientConditions] },
  server: { host: '127.0.0.1', port: 46240, strictPort: true, proxy: apiProxy },
  preview: { host: '127.0.0.1', port: 46241, strictPort: true, proxy: apiProxy },
  build: {
    target: 'es2022',
    sourcemap: true,
    rolldownOptions: {
      input: { embed: 'embed.html', siren: 'demo/siren.html', marigold: 'demo/marigold.html' },
      output: {
        // Libraries change rarely: they get their own chunks and stay cached across releases.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'ui-kit', test: /node_modules[\\/](@base-ui|@floating-ui|lucide-react)/ },
            {
              name: 'data',
              test: /node_modules[\\/](@tanstack|i18next|react-i18next|libphonenumber-js)/,
            },
          ],
        },
      },
    },
  },
}));
