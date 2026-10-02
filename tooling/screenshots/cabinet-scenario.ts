import type { Session } from './browser.ts';
import { fail, stall } from './browser.ts';

const MAX_DAYS_AHEAD = 4;
const SCROLL_SETTLE_MS = 600;

/** Front-desk paths of the cabinet: sign-in, schedule and bookings, plus their states. */
export async function captureCabinet(session: Session, base: string): Promise<void> {
  const { page, shot } = session;
  await page.goto(`${base}/sign-in`);
  await page.getByRole('button', { name: 'Войти в демо' }).waitFor();
  await shot('01-sign-in');

  const releaseSchedule = await stall(page, /\/api\/v1\/cabinet\/businesses\/[^/]+\/schedule/);
  await page.getByRole('button', { name: 'Войти в демо' }).click();
  await page.waitForURL(/\/schedule/);
  await shot('02-schedule-loading', { settle: false });
  await releaseSchedule();
  await page
    .getByRole('button', { name: /^\d\d:\d\d/ })
    .first()
    .waitFor();
  await shot('03-schedule-day');
  const nextColumns = page.getByRole('button', { name: 'Следующие колонки' });
  if (await nextColumns.isVisible()) {
    await nextColumns.click();
    await page.waitForTimeout(SCROLL_SETTLE_MS);
    await shot('03-schedule-day-next-columns');
  }

  await page.getByRole('button', { name: 'Рабочие места' }).click();
  await shot('04-schedule-resources');
  await page.getByRole('button', { name: 'Мастера' }).click();

  await page.getByRole('button', { name: 'Неделя' }).click();
  await shot('05-schedule-week');
  await page.getByRole('button', { name: 'День' }).click();

  await page
    .getByRole('button', { name: /^\d\d:\d\d/ })
    .first()
    .click();
  await page.getByRole('dialog').waitFor();
  await shot('06-booking-details');
  await page.keyboard.press('Escape');

  await page.getByRole('link', { name: 'Записи' }).first().click();
  await page.waitForURL(/\/bookings/);
  await shot('07-bookings');

  await page.getByLabel('Поиск').fill('Несуществующий клиент');
  await page.getByText('Записей не нашлось').waitFor();
  await shot('08-bookings-empty');

  const url = page.url();
  await fail(page, /\/api\/v1\/cabinet\/businesses\/[^/]+\/bookings/, 500, 'internal');
  await page.goto(url);
  await page.getByRole('button', { name: 'Повторить' }).waitFor();
  await shot('09-error');

  await fail(page, /\/api\/v1\/cabinet\/businesses\/[^/]+\/schedule/, 403, 'forbidden');
  await page.goto(url.replace('/bookings', '/schedule'));
  await page.getByText('Нет доступа к разделу').waitFor();
  await shot('10-no-access');
  await page.unrouteAll();

  await page.goto(url.replace('/bookings', '/schedule'));
  await page.getByRole('button', { name: 'Аккаунт' }).filter({ visible: true }).first().click();
  await page.getByRole('dialog').waitFor();
  await shot('11-account');

  await page.getByRole('button', { name: 'Выйти' }).click();
  await page.waitForURL(/\/sign-in/);
  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: /Эмаль/ }).click();
  await page.getByRole('button', { name: 'Войти в демо' }).click();
  await page.waitForURL(/\/schedule/);
  await page.waitForLoadState('networkidle');
  // The demo clock moves on: step to the nearest day with visits.
  const visits = page.getByRole('button', { name: /^\d\d:\d\d/ });
  for (let day = 0; day < MAX_DAYS_AHEAD && (await visits.count()) === 0; day += 1) {
    await page.getByRole('button', { name: 'Вперёд' }).click();
    await page.waitForLoadState('networkidle');
  }
  await shot('12-schedule-dental');
}
