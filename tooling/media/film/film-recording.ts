/**
 * The four moments of the film, recorded sharp (2x) from the real apps on the clean
 * demo: the client books in the Mini App, the booking opens in the cabinet's schedule,
 * the bot's reminder is answered in MAX, the front desk drags a visit to other time.
 */
import { join } from 'node:path';
import type { Browser, BrowserContext, Page } from 'playwright';
import { cursorScript } from '../cursor.ts';
import { psql } from '../demo-db.ts';
import { prepareReminder } from '../reminder.ts';
import {
  answerReminder,
  beat,
  bookFirstStart,
  chooseUpToTime,
  dragToFreeTime,
  focusChat,
  openBusyDayAhead,
  openMaxChat,
  openDemoMiniApp,
  rehearseDrag,
  signInCabinet,
  tap,
} from '../scenes.ts';
import { sceneScripts } from '../scene-scripts.ts';

/** The film shows the Russian demo, as its cards and voice are written for it. */
const script = sceneScripts.ru;
import { Screencast } from './screencast.ts';

export const filmDevices = {
  phone: { width: 390, height: 844 },
  tablet: { width: 820, height: 1180 },
  laptop: { width: 1280, height: 800 },
} as const;
export type FilmDevice = keyof typeof filmDevices;
const filmDeviceIds = Object.keys(filmDevices) as FilmDevice[];

export const filmSceneIds = ['booking', 'schedule', 'remind', 'drag'] as const;
export type FilmSceneId = (typeof filmSceneIds)[number];

export interface FilmClip {
  readonly id: FilmSceneId;
  readonly device: FilmDevice;
  readonly file: string;
}

/** A moment as recorded on one device. */
export type ClipKey = `${FilmSceneId}:${FilmDevice}`;
export const clipKey = (scene: FilmSceneId, device: FilmDevice): ClipKey => `${scene}:${device}`;

export interface FilmSources {
  readonly browser: Browser;
  readonly cabinet: string;
  readonly miniapp: string;
  readonly database: string;
  readonly directory: string;
}

/** The film's client, typed in on the confirmation step and found by it in the cabinet. */
const CLIENT_NAME = 'Алина Морозова';
const VISIT_BLOCKS = '[data-column-key] button';

async function deviceContext(browser: Browser, device: FilmDevice): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: filmDevices[device],
    deviceScaleFactor: 2,
    colorScheme: 'light',
    locale: script.browserLocale,
    timezoneId: script.timeZone,
  });
  await context.addInitScript(() => {
    window.localStorage.setItem('slotwise-cabinet-theme', 'light');
    window.localStorage.setItem('slotwise-miniapp-theme', 'light');
  });
  await context.addInitScript(cursorScript);
  return context;
}

/** Records what `scene` does on `page` and keeps exactly that as a clip. */
async function capture(
  page: Page,
  sources: FilmSources,
  key: ClipKey,
  scene: () => Promise<void>,
): Promise<string> {
  const name = key.replace(':', '-');
  const recording = await Screencast.start(page, join(sources.directory, name));
  await beat(page, 400);
  const from = Screencast.now();
  await scene();
  const to = Screencast.now();
  await recording.stop();
  const file = join(sources.directory, `${name}.mp4`);
  recording.toClip(file, from, to);
  return file;
}

async function recordBooking(sources: FilmSources, device: FilmDevice): Promise<string> {
  const phone = await deviceContext(sources.browser, device);
  const page = await phone.newPage();
  await openDemoMiniApp(page, sources.miniapp, script);
  const file = await capture(page, sources, clipKey('booking', device), async () => {
    await beat(page, 900);
    await chooseUpToTime(page, script.services.loop, script);
    await bookFirstStart(page, script, CLIENT_NAME);
    await beat(page, 2400);
  });
  await phone.close();
  return file;
}

/** The new booking in the schedule of its day, opened to show where it came from. */
async function recordSchedule(sources: FilmSources, device: FilmDevice): Promise<string> {
  const date = psql(
    sources.database,
    `SELECT to_char(b.starts_at AT TIME ZONE 'Europe/Moscow', 'YYYY-MM-DD')
     FROM bookings b JOIN clients c ON c.id = b.client_id
     WHERE c.display_name = '${CLIENT_NAME}' ORDER BY b.created_at DESC LIMIT 1`,
  );
  if (!date) {
    throw new Error(`The booking of ${CLIENT_NAME} is not in the database`);
  }
  const screen = await deviceContext(sources.browser, device);
  const page = await screen.newPage();
  const business = await signInCabinet(page, sources.cabinet, script);
  await page.goto(`${business}/schedule?date=${date}`);
  await page.locator(VISIT_BLOCKS).first().waitFor();
  await page.waitForLoadState('networkidle');
  const visit = page.locator(VISIT_BLOCKS).filter({ hasText: CLIENT_NAME }).first();
  await visit.scrollIntoViewIfNeeded();
  const file = await capture(page, sources, clipKey('schedule', device), async () => {
    await beat(page, 1400);
    await tap(page, visit);
    await page.getByRole('dialog', { name: CLIENT_NAME }).waitFor();
    await page.waitForLoadState('networkidle');
    await beat(page, 3200);
  });
  await screen.close();
  return file;
}

async function recordReminder(sources: FilmSources, device: FilmDevice): Promise<string> {
  const desk = await deviceContext(sources.browser, 'laptop');
  const deskPage = await desk.newPage();
  const reminder = await prepareReminder(
    deskPage,
    await signInCabinet(deskPage, sources.cabinet, script),
    sources.database,
  );
  await desk.close();
  const phone = await deviceContext(sources.browser, device);
  const page = await phone.newPage();
  await openMaxChat(
    page,
    await signInCabinet(page, sources.cabinet, script),
    reminder.clientName,
    reminder.title,
  );
  await focusChat(page, reminder.clientName);
  const file = await capture(page, sources, clipKey('remind', device), async () => {
    await beat(page, 1800);
    await answerReminder(page, reminder.kind);
    await beat(page, 2400);
  });
  await phone.close();
  return file;
}

async function recordDrag(sources: FilmSources, device: FilmDevice): Promise<string> {
  const screen = await deviceContext(sources.browser, device);
  const page = await screen.newPage();
  await openBusyDayAhead(page, await signInCabinet(page, sources.cabinet, script), script);
  const rehearsed = await rehearseDrag(page, script);
  if (rehearsed === null) {
    throw new Error('No visit on screen can be dragged to free time');
  }
  const file = await capture(page, sources, clipKey('drag', device), async () => {
    await beat(page, 1200);
    await dragToFreeTime(page, rehearsed, script);
    await beat(page, 3000);
  });
  await screen.close();
  return file;
}

const recorders: Readonly<
  Record<FilmSceneId, (sources: FilmSources, device: FilmDevice) => Promise<string>>
> = {
  booking: recordBooking,
  schedule: recordSchedule,
  remind: recordReminder,
  drag: recordDrag,
};

/**
 * Records each moment on every device a format asks for, in the film's order: the
 * schedule scene needs the booking made just before it.
 */
export async function recordFilmClips(
  sources: FilmSources,
  wanted: ReadonlySet<ClipKey>,
): Promise<Map<ClipKey, FilmClip>> {
  const clips = new Map<ClipKey, FilmClip>();
  for (const id of filmSceneIds) {
    for (const device of filmDeviceIds) {
      const key = clipKey(id, device);
      if (wanted.has(key)) {
        clips.set(key, { id, device, file: await recorders[id](sources, device) });
      }
    }
  }
  return clips;
}
