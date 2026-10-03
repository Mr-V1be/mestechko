/**
 * Puts the rendered page into the built `index.html`, so the site shows its content
 * before any script runs; the browser then hydrates it.
 */
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const app = fileURLToPath(new URL('../', import.meta.url));
const { render } = (await import(`${app}dist-ssr/prerender.js`)) as {
  render: () => Promise<string>;
};
const page = `${app}dist/index.html`;
const html = readFileSync(page, 'utf8');
if (!html.includes('<!--app-->')) {
  throw new Error('index.html has no <!--app--> placeholder');
}
writeFileSync(page, html.replace('<!--app-->', await render()));
rmSync(`${app}dist-ssr`, { recursive: true, force: true });
console.log('Prerendered dist/index.html');
