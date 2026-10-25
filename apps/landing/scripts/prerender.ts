/**
 * Puts each language's rendered page into the build, so the site shows its content
 * before any script runs; the browser then hydrates it. One page per language, each
 * with its own head and the links between them.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

interface RenderedPage {
  readonly locale: string;
  readonly file: string;
  readonly markup: string;
  readonly head: string;
}

const app = fileURLToPath(new URL('../', import.meta.url));
const { render } = (await import(`${app}dist-ssr/prerender.js`)) as {
  render: () => Promise<RenderedPage[]>;
};
const template = readFileSync(`${app}dist/index.html`, 'utf8');
for (const placeholder of ['<html>', '<!--page-head-->', '<!--app-->']) {
  if (!template.includes(placeholder)) {
    throw new Error(`index.html has no ${placeholder} placeholder`);
  }
}
for (const page of await render()) {
  const target = `${app}dist/${page.file}`;
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(
    target,
    template
      .replace('<html>', `<html lang="${page.locale}">`)
      .replace('<!--page-head-->', page.head)
      .replace('<!--app-->', page.markup),
  );
  console.log(`Prerendered dist/${page.file}`);
}
rmSync(`${app}dist-ssr`, { recursive: true, force: true });
