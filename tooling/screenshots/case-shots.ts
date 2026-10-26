/**
 * The case's screens (docs/case/screenshots), picked from the full set that
 * `pnpm screenshots` takes, as WebP:
 *
 *   pnpm screenshots:case [--from docs/screenshots/m4]
 */
import { existsSync, mkdirSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { toWebp } from '../media/ffmpeg.ts';

const { values } = parseArgs({
  options: { from: { type: 'string', default: 'docs/screenshots/m4' } },
});
const OUT = 'docs/case/screenshots';

/** Each case screen and the screenshot it is made from. */
const caseShots: Readonly<Record<string, string>> = {
  'landing-hero': 'landing/1280-light/01-hero.png',
  'miniapp-time': 'miniapp/390-light/06-time.png',
  'miniapp-success': 'miniapp/390-telegram-dark/09-success.png',
  'cabinet-schedule': 'cabinet/1280-light/03-schedule-day.png',
  'cabinet-reports-dark': 'cabinet/1280-dark/38-reports.png',
  'cabinet-max': 'cabinet/1280-light/18-max-chat.png',
  'cabinet-client': 'cabinet/1280-light/37-client-card.png',
  'widget-site': 'widget/1280-light/02-widget-services.png',
};

mkdirSync(OUT, { recursive: true });
for (const [name, source] of Object.entries(caseShots)) {
  const input = `${values.from}/${source}`;
  if (!existsSync(input)) {
    throw new Error(`${input} is missing: run \`pnpm screenshots\` first`);
  }
  toWebp(input, `${OUT}/${name}.webp`);
  console.log(`✓ ${OUT}/${name}.webp`);
}
