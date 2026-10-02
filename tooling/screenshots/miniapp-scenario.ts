import type { Session } from './browser.ts';
import { fail, stall } from './browser.ts';

const MAX_WEEKS_AHEAD = 3;

/** The client path from the demo launcher to a confirmed booking, plus its states. */
export async function captureMiniApp(session: Session, base: string): Promise<void> {
  const { page, shot } = session;
  await page.goto(`${base}/`);
  await page.getByText('Сирень', { exact: true }).waitFor();
  await shot('01-launcher');

  await page.getByText('Сирень', { exact: true }).click();
  await page.waitForURL(/\/b\/siren$/);
  await shot('02-locations');

  const release = await stall(page, /\/api\/v1\/public\/businesses\/siren\/services/);
  await page.getByText('Сирень на Пятницкой').click();
  await page.waitForURL(/\/services/);
  await shot('03-services-loading', { settle: false });
  await release();

  await page.getByText('Женская стрижка').click();
  await page.getByText('Укладка', { exact: true }).click();
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
  await shot('04-services-selected');

  await page.getByRole('button', { name: 'Выбрать мастера' }).click();
  await page.waitForURL(/\/staff/);
  await shot('05-staff');

  await page.getByText('Любой мастер').click();
  await page.waitForURL(/\/time/);
  await page.waitForLoadState('networkidle');
  const slots = page.getByRole('radio').filter({ hasText: /^\d\d:\d\d$/ });
  const weekFull = page.getByText('На этой неделе мест нет');
  for (let week = 0; week < MAX_WEEKS_AHEAD; week += 1) {
    await slots.first().or(weekFull).waitFor();
    if ((await slots.count()) > 0) {
      break;
    }
    await page.getByRole('button', { name: 'Следующая неделя' }).first().click();
  }
  await shot('06-time');
  await slots.first().click();
  await shot('07-time-selected');

  await page.getByRole('button', { name: 'Продолжить' }).click();
  await page.waitForURL(/\/confirm/);
  await shot('08-confirm');
  await page.getByLabel('Телефон').fill('+7 916 123-45-67');
  await page.getByRole('button', { name: 'Записаться' }).click();
  await page.waitForURL(/created=1/);
  await shot('09-success');

  await page.getByRole('button', { name: 'Готово' }).click();
  await page.waitForURL(/\/bookings$/);
  await shot('10-my-bookings');

  await page.getByRole('button', { name: 'Прошедшие' }).click();
  await shot('11-my-bookings-empty');

  await page.getByRole('button', { name: 'Предстоящие' }).click();
  await page
    .getByRole('button', { name: /Женская стрижка/ })
    .first()
    .click();
  await page.waitForURL(/\/bookings\/[0-9a-f-]+$/);
  await shot('12-booking-details');

  await page.goto(`${base}/b/no-such-business`);
  await shot('13-business-not-found');

  await fail(page, /\/api\/v1\/public\/businesses\/emal\/services/, 500, 'internal');
  await page.goto(`${base}/b/emal`);
  await page.getByRole('button', { name: 'Повторить' }).waitFor();
  await shot('14-error');
}
