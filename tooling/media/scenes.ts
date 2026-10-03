/**
 * Moments of the product played on the demo, shared by the site's loops and the film.
 * Each scene leaves the app where a viewer would want to see it.
 */
import type { Page } from 'playwright';

const MAX_WEEKS_AHEAD = 4;
/** A pause long enough to read what just changed. */
export const beat = (page: Page, ms = 900) => page.waitForTimeout(ms);

export async function signInCabinet(page: Page, base: string): Promise<string> {
  await page.goto(`${base}/sign-in`);
  await page.getByRole('button', { name: 'Войти в демо' }).click();
  await page.waitForURL(/\/schedule/);
  await page.waitForLoadState('networkidle');
  return page.url().replace(/(\/b\/[^/]+)\/.*$/, '$1');
}

/** The demo launcher opens the salon's Mini App as Telegram would. */
export async function openSalonMiniApp(page: Page, base: string): Promise<void> {
  await page.goto(`${base}/`);
  await page.getByText('Сирень', { exact: true }).click();
  await page.waitForURL(/\/b\/siren$/);
  await page.getByText('Сирень на Пятницкой').click();
  await page.waitForURL(/\/services/);
  await page.waitForLoadState('networkidle');
}

/** From the services to the time step, with the free starts of the week on screen. */
export async function chooseUpToTime(page: Page, service: string): Promise<void> {
  await page.getByText(service, { exact: true }).click();
  await beat(page, 500);
  await page.getByRole('button', { name: 'Выбрать мастера' }).click();
  await page.waitForURL(/\/staff/);
  await page.waitForLoadState('networkidle');
  await beat(page, 600);
  await page.getByText('Любой мастер').click();
  await page.waitForURL(/\/time/);
  const slots = page.getByRole('radio').filter({ hasText: /^\d\d:\d\d$/ });
  for (let week = 0; week < MAX_WEEKS_AHEAD; week += 1) {
    await slots.first().or(page.getByText('На этой неделе мест нет')).waitFor();
    if ((await slots.count()) > 0) {
      break;
    }
    await page.getByRole('button', { name: 'Следующая неделя' }).first().click();
  }
  await page.waitForLoadState('networkidle');
}

const scheduleDate = (daysAhead: number) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow' }).format(
    Date.now() + daysAhead * 86_400_000,
  );

/**
 * The busiest of the next few days in the schedule: a full day shows the product best,
 * and the drag scene still finds free time between its visits.
 */
export async function openBusyDayAhead(page: Page, business: string, days = 3): Promise<void> {
  const visits = page.locator('[data-column-key] button');
  let busiest = { date: scheduleDate(1), count: -1 };
  for (let ahead = 1; ahead <= days; ahead += 1) {
    const date = scheduleDate(ahead);
    await page.goto(`${business}/schedule?date=${date}`);
    await visits.first().waitFor();
    await page.waitForLoadState('networkidle');
    const count = await visits.count();
    if (count > busiest.count) {
      busiest = { date, count };
    }
  }
  await page.goto(`${business}/schedule?date=${busiest.date}`);
  await visits.first().waitFor();
  await page.waitForLoadState('networkidle');
}

/** The client books the first free start and lands on the celebration. */
export async function bookFirstStart(page: Page): Promise<void> {
  const slots = page.getByRole('radio').filter({ hasText: /^\d\d:\d\d$/ });
  await beat(page, 600);
  await slots.first().click();
  await beat(page, 600);
  await page.getByRole('button', { name: 'Продолжить' }).click();
  await page.waitForURL(/\/confirm/);
  await page.waitForFunction(() =>
    document.querySelector<HTMLInputElement>('input[type="tel"]')?.value.startsWith('+7 0'),
  );
  await beat(page, 900);
  await page.getByRole('button', { name: 'Записаться' }).click();
  await page.waitForURL(/created=1/);
  await page.waitForLoadState('networkidle');
}

/**
 * A booking moved to free time later in the same column: the gap is measured on the
 * screen from the working hours and the occupied time, buffers included.
 */
export async function dragToFreeTime(page: Page): Promise<boolean> {
  const plan = await page.evaluate(() => {
    const SNAP_PX = 16;
    const blocks = [...document.querySelectorAll<HTMLElement>('[data-column-key] button')].filter(
      (block) => block.className.includes('draggable'),
    );
    for (const block of blocks) {
      const column = block.closest<HTMLElement>('[data-column-key]');
      if (!column) {
        continue;
      }
      const own = block.getBoundingClientRect();
      const occupied = [...column.querySelectorAll<HTMLElement>('div')]
        .filter((element) => element.className.includes('occupied'))
        .map((element) => element.getBoundingClientRect());
      const mine = occupied.find(
        (rect) => rect.top <= own.top + 1 && rect.bottom >= own.bottom - 1,
      );
      if (!mine) {
        continue;
      }
      const busy = occupied.filter((rect) => rect !== mine);
      const needed = mine.height + SNAP_PX;
      const bands = [...column.querySelectorAll<HTMLElement>('[data-free-time]')].map((band) =>
        band.getBoundingClientRect(),
      );
      // Free stretches of working time on screen: earlier or later than the visit itself.
      for (const band of bands) {
        let top = Math.max(band.top, SNAP_PX * 4);
        const cuts = [...busy, mine]
          .filter((rect) => rect.bottom > top && rect.top < band.bottom)
          .sort((a, b) => a.top - b.top);
        for (const cut of [...cuts, { top: band.bottom, bottom: band.bottom }]) {
          const bottom = Math.min(cut.top, window.innerHeight - SNAP_PX);
          if (bottom - top >= needed) {
            return {
              x: own.left + own.width / 2,
              grabY: own.top + 6,
              dropY: top + SNAP_PX / 2 + (own.top - mine.top) + 6,
            };
          }
          top = Math.max(top, cut.bottom + SNAP_PX / 2);
        }
      }
    }
    return null;
  });
  if (!plan) {
    return false;
  }
  await page.mouse.move(plan.x - 120, plan.grabY + 80);
  await page.mouse.move(plan.x, plan.grabY, { steps: 12 });
  await beat(page, 400);
  await page.mouse.down();
  await page.mouse.move(plan.x, plan.dropY, { steps: 24 });
  await beat(page, 500);
  await page.mouse.up();
  await page.getByText('Запись перенесена').first().waitFor();
  return true;
}

/** The chat's newest message: the bot edits it in place as the client taps its buttons. */
const newestMessage = (page: Page) =>
  page.locator('section:has(> header) > header + div > div').last();

/**
 * The client answers the reminder: «Приду» two hours ahead; the day before, the visit
 * moves to another day with the bot's buttons, down to «Запись перенесена».
 */
export async function answerReminder(page: Page, kind: string): Promise<void> {
  const newest = newestMessage(page);
  if (kind === 'reminder_2h') {
    await newest.getByRole('button', { name: 'Приду', exact: true }).click();
    await newest.getByText(/Вы подтвердили визит/).waitFor();
    return;
  }
  await newest.getByRole('button', { name: 'Перенести', exact: true }).click();
  await newest.getByText('Выберите новый день').waitFor();
  await beat(page, 1200);
  await newest
    .getByRole('button')
    .filter({ hasText: /^(понедельник|вторник|среда|четверг|пятница|суббота|воскресенье)/ })
    .nth(1)
    .click();
  await newest.getByText(/^Свободное время/).waitFor();
  await beat(page, 1200);
  await newest
    .getByRole('button')
    .filter({ hasText: /^\d\d:\d\d$/ })
    .first()
    .click();
  await newest.getByText(/^Перенести на /).waitFor();
  await beat(page, 1200);
  await newest.getByRole('button', { name: 'Перенести', exact: true }).click();
  await newest.getByText('Запись перенесена').waitFor();
}

/** A MAX client's chat in the cabinet's emulator, as the client sees it. */
export async function openMaxChat(
  page: Page,
  business: string,
  clientName: string,
  /** The message to wait for, e.g. the reminder's first line. */
  message: string,
): Promise<void> {
  await page.goto(`${business}/max-emulator`);
  await page.getByText('Клиенты в MAX').waitFor();
  await page.getByRole('button').filter({ hasText: clientName }).first().click();
  await page.waitForURL(/\/max-emulator\/\d+/);
  await page.getByText(message).last().waitFor();
  await page.waitForLoadState('networkidle');
}

/**
 * The chat alone on a phone, as the client's MAX app shows it: the cabinet around the
 * emulator is left out of the frame, the way a screenshot would be cropped.
 */
export async function focusChat(page: Page, clientName: string): Promise<void> {
  const panel = `section[aria-label="${clientName}"]`;
  await page.addStyleTag({
    content: `${panel} { position: fixed !important; inset: 0 !important; z-index: 2147483000 !important;
      height: auto !important; max-height: none !important; margin: 0 !important;
      border: 0 !important; border-radius: 0 !important; }`,
  });
  await page.locator(panel).evaluate((section) => {
    const stream = section.querySelector('header')?.nextElementSibling;
    if (stream) {
      stream.scrollTop = stream.scrollHeight;
    }
  });
  await beat(page, 300);
}

/** The waitlist sheet over the time step: the client asks to hear about a freed time. */
export async function openWaitlist(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Встать в лист ожидания' }).first().click();
  await page.getByRole('dialog').getByText('Лист ожидания').first().waitFor();
  await beat(page, 600);
}
