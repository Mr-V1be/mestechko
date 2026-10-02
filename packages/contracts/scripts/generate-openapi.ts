import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { apiRoutes, buildOpenApiDocument } from '../src/index.js';

const target = fileURLToPath(new URL('../openapi/openapi.json', import.meta.url));
const document = `${JSON.stringify(buildOpenApiDocument(apiRoutes), null, 2)}\n`;

if (process.argv.includes('--check')) {
  const current = await readFile(target, 'utf8').catch(() => '');
  if (current !== document) {
    console.error('openapi.json is outdated: run `pnpm contracts:openapi`.');
    process.exit(1);
  }
  console.log('openapi.json is up to date.');
} else {
  await writeFile(target, document);
  console.log(`Wrote ${target}`);
}
