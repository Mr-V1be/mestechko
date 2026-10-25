/**
 * Screens and short loops of the real apps for the product site, both themes, in one
 * language of the site: its demo business, its words and its clock.
 *
 *   node tooling/media/landing-media.ts --cabinet URL --miniapp URL --widget URL \
 *     --database mestechko_screenshots [--locale ru|en] [--out apps/landing/public/media/<locale>]
 */
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { sceneScripts, type SceneLocale } from './scene-scripts.ts';
import { cursorScript } from './cursor.ts';
import { posterOf, toLoop, toWebp } from './ffmpeg.ts';
import { prepareReminder } from './reminder.ts';
import {
  answerReminder,
  beat,
  bookFirstStart,
  chooseUpToTime,
  dragToFreeTime,
  focusChat,
  openBusyDayAhead,
  openDemoMiniApp,
  openMaxChat,
  openMyBookings,
  openWaitlist,
  rehearseDrag,
  rescheduleInMiniApp,
  signInCabinet,
} from './scenes.ts';

const { values } = parseArgs({
  options: {
    cabinet: { type: 'string' },
    miniapp: { type: 'string' },
    widget: { type: 'string' },
    database: { type: 'string', default: 'mestechko_screenshots' },
    locale: { type: 'string', default: 'ru' },
    out: { type: 'string' },
    only: { type: 'string' },
  },
});
if (!Object.hasOwn(sceneScripts, values.locale)) {
  throw new Error(`No scenes for the language ${values.locale}`);
}
const script = sceneScripts[values.locale as SceneLocale];
const out = values.out ?? `apps/landing/public/media/${script.locale}`;
const cabinet = values.cabinet ?? 'http://127.0.0.1:46220';
const miniapp = values.miniapp ?? 'http://127.0.0.1:46230';
const widget = values.widget ?? 'http://127.0.0.1:46240';
const themes = ['light', 'dark'] as const;
type Theme = (typeof themes)[number];
const PHONE = { width: 390, height: 844 };
const LAPTOP = { width: 1280, height: 800 };
const scratch = mkdtempSync(join(tmpdir(), 'mestechko-media-'));
mkdirSync(out, { recursive: true });

const storageFor = (theme: Theme) => ({
  'mst-cabinet-theme': theme,
  'mst-miniapp-theme': theme,
});

async function context(
  browser: Browser,
  theme: Theme,
  size: { width: number; height: number },
  record: boolean,
): Promise<BrowserContext> {
  const created = await browser.newContext({
    viewport: size,
    deviceScaleFactor: record ? 1 : 2,
    colorScheme: theme,
    locale: script.browserLocale,
    timezoneId: script.timeZone,
    ...(record ? { recordVideo: { dir: scratch, size } } : {}),
  });
  await created.addInitScript((entries: Record<string, string>) => {
    for (const [key, value] of Object.entries(entries)) {
      window.localStorage.setItem(key, value);
    }
  }, storageFor(theme));
  if (record) {
    await created.addInitScript(cursorScript);
  }
  return created;
}

async function shot(page: Page, name: string, theme: Theme): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  const png = join(scratch, `${name}-${theme}.png`);
  await page.screenshot({ path: png });
  toWebp(png, join(out, `${name}-${theme}.webp`));
}

/** Records `scene`, keeps the part after `ready` and saves it as a loop with a poster. */
async function loop(
  browser: Browser,
  name: string,
  theme: Theme,
  size: { width: number; height: number },
  ready: (page: Page) => Promise<void>,
  scene: (page: Page) => Promise<void>,
): Promise<void> {
  const recording = await context(browser, theme, size, true);
  const page = await recording.newPage();
  const startedAt = Date.now();
  await ready(page);
  const sceneAt = (Date.now() - startedAt) / 1000;
  await scene(page);
  const length = (Date.now() - startedAt) / 1000 - sceneAt;
  const video = page.video();
  await recording.close();
  const webm = await video?.path();
  if (!webm) {
    throw new Error(`No recording for ${name}`);
  }
  const mp4 = join(out, `${name}-${theme}.mp4`);
  toLoop(webm, mp4, sceneAt, length);
  posterOf(mp4, join(out, `${name}-${theme}.webp`));
}

const wanted = (name: string) => !values.only || values.only.split(',').includes(name);

const browser = await chromium.launch({
  args: ['--mute-audio', `--lang=${script.browserLocale}`],
  env: { ...process.env, LANGUAGE: script.locale },
});
const reminded: string[] = [];
try {
  for (const theme of themes) {
    const laptop = await context(browser, theme, LAPTOP, false);
    const page = await laptop.newPage();
    const business = await signInCabinet(page, cabinet, script);
    if (wanted('screens')) {
      await shot(page, 'cabinet-schedule', theme);
      await page.goto(`${business}/reports`);
      await page.getByText(script.words.occupancy).first().waitFor();
      await shot(page, 'cabinet-reports', theme);
      await page.goto(`${widget}${script.business.site}`);
      await page.locator('#booking').evaluate((element) => {
        element.scrollIntoView({ block: 'start' });
      });
      await shot(page, 'widget-site', theme);
    }
    await laptop.close();

    if (wanted('screens')) {
      const phone = await context(browser, theme, PHONE, false);
      const mini = await phone.newPage();
      await openDemoMiniApp(mini, miniapp, script);
      await chooseUpToTime(mini, script.services.screen, script);
      await shot(mini, 'miniapp-time', theme);
      await openWaitlist(mini, script);
      await shot(mini, 'miniapp-waitlist', theme);
      await phone.close();
    }

    if (wanted('booking')) {
      await loop(
        browser,
        'loop-booking',
        theme,
        PHONE,
        (page) => openDemoMiniApp(page, miniapp, script),
        async (page) => {
          await beat(page, 700);
          await chooseUpToTime(page, script.services.loop, script);
          await bookFirstStart(page, script);
          await beat(page, 1800);
        },
      );
    }

    if (wanted('drag')) {
      let rehearsed = 0;
      await loop(
        browser,
        'loop-drag',
        theme,
        LAPTOP,
        async (page) => {
          await openBusyDayAhead(page, await signInCabinet(page, cabinet, script), script);
          const found = await rehearseDrag(page, script);
          if (found === null) {
            throw new Error('No visit on screen can be dragged to free time');
          }
          rehearsed = found;
        },
        async (page) => {
          await beat(page, 600);
          await dragToFreeTime(page, rehearsed, script);
          await beat(page, 2200);
        },
      );
    }

    if (wanted('remind') && script.reminder === 'miniapp') {
      // Where MAX is not offered, the client answers in the Mini App a reminder opens.
      await loop(
        browser,
        'loop-remind',
        theme,
        PHONE,
        async (page) => {
          await openDemoMiniApp(page, miniapp, script);
          await chooseUpToTime(page, script.services.screen, script);
          await bookFirstStart(page, script);
          await openMyBookings(page, script, script.services.screen);
        },
        async (page) => {
          await beat(page, 1200);
          await rescheduleInMiniApp(page, script, script.services.screen);
          await beat(page, 2200);
        },
      );
    }

    if (wanted('remind') && script.reminder === 'max') {
      const setup = await context(browser, theme, LAPTOP, false);
      const desk = await setup.newPage();
      const business = await signInCabinet(desk, cabinet, script);
      // Each theme answers a reminder of its own visit: an answered one is final.
      const reminder = await prepareReminder(desk, business, values.database, reminded);
      reminded.push(reminder.bookingId);
      await setup.close();
      if (wanted('screens')) {
        const desk = await context(browser, theme, LAPTOP, false);
        const emulator = await desk.newPage();
        await openMaxChat(
          emulator,
          await signInCabinet(emulator, cabinet, script),
          reminder.clientName,
          reminder.title,
        );
        await shot(emulator, 'max-emulator', theme);
        await desk.close();
      }
      await loop(
        browser,
        'loop-remind',
        theme,
        PHONE,
        async (page) => {
          await openMaxChat(
            page,
            await signInCabinet(page, cabinet, script),
            reminder.clientName,
            reminder.title,
          );
          await focusChat(page, reminder.clientName);
        },
        async (page) => {
          await beat(page, 1500);
          await answerReminder(page, reminder.kind);
          await beat(page, 2400);
        },
      );
    }
  }
} finally {
  await browser.close();
  rmSync(scratch, { recursive: true, force: true });
}
console.log(`Media saved to ${out}`);
