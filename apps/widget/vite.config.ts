import react from '@vitejs/plugin-react';
import { defaultClientConditions, defineConfig, type Plugin, type ProxyOptions } from 'vite';

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
 * stand-in that loads the loader's source as a module with the same attributes.
 */
const DEV_LOADER = `(function(){var s=document.currentScript;var m=document.createElement('script');m.type='module';m.src='/src/loader/widget.ts';Array.prototype.forEach.call(s.attributes,function(a){if(a.name.indexOf('data-')===0){m.setAttribute(a.name,a.value);}});document.head.appendChild(m);})();`;

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

export default defineConfig({
  envDir: '../../',
  plugins: [react(), themeBoot(), devLoader()],
  resolve: { conditions: ['@mestechko/source', ...defaultClientConditions] },
  server: { host: '127.0.0.1', port: 46240, strictPort: true, proxy: apiProxy },
  preview: { host: '127.0.0.1', port: 46241, strictPort: true, proxy: apiProxy },
  build: {
    target: 'es2022',
    sourcemap: true,
    rolldownOptions: {
      input: { embed: 'embed.html', siren: 'demo/siren.html' },
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
});
