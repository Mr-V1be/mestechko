/**
 * Screenshots on a clean demo (see `scratch-stack.ts`).
 *
 *   pnpm screenshots [--out docs/screenshots/m4] [--only cabinet,widget] [--viewport 390]
 */
import { parseArgs } from 'node:util';
import { scratchUrls, step, withScratchStack } from './scratch-stack.ts';

const { values } = parseArgs({
  options: {
    out: { type: 'string', default: 'docs/screenshots/m4' },
    only: { type: 'string' },
    viewport: { type: 'string' },
    'skip-build': { type: 'boolean', default: false },
  },
});

await withScratchStack(
  { apps: ['cabinet', 'miniapp', 'widget', 'landing'], build: !values['skip-build'] },
  () => {
    step(
      'Screenshots',
      process.execPath,
      [
        'tooling/screenshots/capture.ts',
        '--out',
        values.out,
        '--cabinet',
        scratchUrls.cabinet,
        '--miniapp',
        scratchUrls.miniapp,
        '--widget',
        scratchUrls.widget,
        '--landing',
        scratchUrls.landing,
        ...(values.only ? ['--only', values.only] : []),
        ...(values.viewport ? ['--viewport', values.viewport] : []),
      ],
      process.env,
    );
    return Promise.resolve();
  },
);
