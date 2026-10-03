/**
 * Media recorded from the real apps on a clean demo (see
 * `../screenshots/scratch-stack.ts`):
 *
 *   pnpm media:landing [--only screens,booking,drag,remind] [--skip-build]
 *     screens and loops of the product site, saved next to the site's files;
 *   pnpm media:film [--skip-build]
 *     the silent product film in two formats, saved to docs/case/video.
 */
import { parseArgs } from 'node:util';
import {
  SCRATCH_DATABASE,
  scratchUrls,
  step,
  withScratchStack,
} from '../screenshots/scratch-stack.ts';

const jobs = {
  landing: {
    title: 'Site media',
    script: 'tooling/media/landing-media.ts',
    apps: ['cabinet', 'miniapp', 'widget'],
  },
  film: {
    title: 'Product film',
    script: 'tooling/media/film/film.ts',
    apps: ['cabinet', 'miniapp'],
  },
} as const;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: 'string' },
    only: { type: 'string' },
    'skip-build': { type: 'boolean', default: false },
  },
});
const name = positionals[0];
if (name !== 'landing' && name !== 'film') {
  throw new Error('Pass the job: landing or film');
}
const job = jobs[name];

await withScratchStack({ apps: job.apps, build: !values['skip-build'] }, () => {
  step(
    job.title,
    process.execPath,
    [
      job.script,
      '--cabinet',
      scratchUrls.cabinet,
      '--miniapp',
      scratchUrls.miniapp,
      '--database',
      SCRATCH_DATABASE,
      ...(name === 'landing' ? ['--widget', scratchUrls.widget] : []),
      ...(values.out ? ['--out', values.out] : []),
      ...(values.only && name === 'landing' ? ['--only', values.only] : []),
    ],
    process.env,
  );
  return Promise.resolve();
});
