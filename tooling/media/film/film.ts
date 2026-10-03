/**
 * The product film, silent, in 1920×1080 and 1080×1920: the client books in the Mini
 * App, the booking appears in the cabinet's schedule, the bot reminds, the front desk
 * moves a visit by dragging. Every moment is recorded from the real apps on a clean demo.
 *
 *   pnpm media:film [--skip-build]   (brings the clean demo up, see ../run.ts)
 */
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';
import { browserLaunchOptions } from '../../screenshots/browser.ts';
import { ffmpeg } from '../ffmpeg.ts';
import { renderCards } from './film-cards.ts';
import { filmFormatIds, filmFormats } from './film-layout.ts';
import { montage } from './film-montage.ts';
import {
  clipKey,
  filmSceneIds,
  recordFilmClips,
  type ClipKey,
  type FilmClip,
} from './film-recording.ts';

const { values } = parseArgs({
  options: {
    cabinet: { type: 'string', default: 'http://127.0.0.1:46220' },
    miniapp: { type: 'string', default: 'http://127.0.0.1:46230' },
    database: { type: 'string', default: 'mestechko_screenshots' },
    out: { type: 'string', default: 'docs/case/video' },
    keep: { type: 'boolean', default: false },
  },
});
const MIN_SECONDS = 45;
const MAX_SECONDS = 75;
/** The poster shows the first moment, past the opening card. */
const POSTER_AT_SECONDS = 9;

mkdirSync(values.out, { recursive: true });
const work = mkdtempSync(join(tmpdir(), 'mestechko-film-'));
const browser = await chromium.launch(browserLaunchOptions);
try {
  const wanted = new Set<ClipKey>(
    filmFormatIds.flatMap((format) =>
      filmSceneIds.map((scene) => clipKey(scene, filmFormats[format].scenes[scene])),
    ),
  );
  const recorded = await recordFilmClips(
    {
      browser,
      cabinet: values.cabinet,
      miniapp: values.miniapp,
      database: values.database,
      directory: work,
    },
    wanted,
  );
  for (const format of filmFormatIds) {
    const { width, height, scenes } = filmFormats[format];
    const clips = filmSceneIds.map((scene): FilmClip => {
      const clip = recorded.get(clipKey(scene, scenes[scene]));
      if (!clip) {
        throw new Error(`No recording of ${scene} for the ${format} film`);
      }
      return clip;
    });
    const cards = await renderCards(browser, format, clips, work);
    const film = join(values.out, `mestechko-${String(width)}x${String(height)}.mp4`);
    const seconds = montage(format, cards, clips, film);
    if (seconds < MIN_SECONDS || seconds > MAX_SECONDS) {
      throw new Error(
        `The film runs ${seconds.toFixed(1)} s, outside ${String(MIN_SECONDS)}–${String(MAX_SECONDS)} s`,
      );
    }
    ffmpeg([
      '-ss',
      String(POSTER_AT_SECONDS),
      '-i',
      film,
      '-frames:v',
      '1',
      '-c:v',
      'libwebp',
      '-quality',
      '85',
      film.replace(/\.mp4$/, '-poster.webp'),
    ]);
    console.log(`Film ${format}: ${film} (${seconds.toFixed(1)} s)`);
  }
} finally {
  await browser.close();
  if (!values.keep) {
    rmSync(work, { recursive: true, force: true });
  } else {
    console.log(`Recordings kept in ${work}`);
  }
}
