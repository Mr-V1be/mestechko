/**
 * Screens and loops for the product site, recorded on a clean demo (see
 * `../screenshots/scratch-stack.ts`) and saved next to the site's own files.
 *
 *   pnpm media:landing [--only screens,booking,drag,remind] [--skip-build]
 */
import { parseArgs } from 'node:util';
import {
  SCRATCH_DATABASE,
  scratchUrls,
  step,
  withScratchStack,
} from '../screenshots/scratch-stack.ts';

const { values } = parseArgs({
  options: {
    out: { type: 'string', default: 'apps/landing/public/media' },
    only: { type: 'string' },
    'skip-build': { type: 'boolean', default: false },
  },
});

await withScratchStack(
  { apps: ['cabinet', 'miniapp', 'widget'], build: !values['skip-build'] },
  () => {
    step(
      'Site media',
      process.execPath,
      [
        'tooling/media/landing-media.ts',
        '--out',
        values.out,
        '--cabinet',
        scratchUrls.cabinet,
        '--miniapp',
        scratchUrls.miniapp,
        '--widget',
        scratchUrls.widget,
        '--database',
        SCRATCH_DATABASE,
        ...(values.only ? ['--only', values.only] : []),
      ],
      process.env,
    );
    return Promise.resolve();
  },
);
