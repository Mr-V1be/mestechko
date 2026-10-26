import type { Session } from './browser.ts';
import { fail, stall } from './browser.ts';
import { firstOnScreen, stepToDayWith } from './schedule-days.ts';

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
  const visits = page.getByRole('button', { name: /^\d\d:\d\d/ });
  await stepToDayWith(page, visits);
  await visits.first().waitFor();
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

  await (await firstOnScreen(page, visits)).click();
  await page.getByRole('dialog').waitFor();
  await shot('06-booking-details');
  await page.keyboard.press('Escape');

  await page.getByRole('link', { name: 'Записи' }).first().click();
  await page.waitForURL(/\/bookings/);
  await shot('07-bookings');

  await page.getByLabel('Поиск').fill('Несуществующий клиент');
  await page.getByText('Записей не нашлось').waitFor();
  await shot('08-bookings-empty');

  // Bookings the demo client changed in the Mini App carry their history.
  await page.getByLabel('Период').click();
  await page.getByRole('option', { name: 'Ближайшие 60 дней' }).click();
  await page.getByLabel('Поиск').fill('Гость');
  await page.waitForTimeout(SCROLL_SETTLE_MS);
  await page.waitForLoadState('networkidle');
  // A cancelled booking: rows on wide screens, cards on phones.
  await page
    .getByRole('row')
    .filter({ hasText: 'Отменена' })
    .or(page.getByRole('button').filter({ hasText: 'Отменена' }))
    .first()
    .click();
  await page.getByRole('dialog').getByText('Изменения').waitFor();
  await shot('16-booking-history');
  await page.keyboard.press('Escape');

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
  await stepToDayWith(page, visits);
  await shot('12-schedule-dental');

  // The MAX emulator: a client's chat with the bot, buttons pressed as the client.
  // Phones keep this section under «Ещё»; it opens by its address on every screen.
  await page.goto(page.url().replace(/\/schedule.*$/, '/max-emulator'));
  await page.waitForURL(/\/max-emulator/);
  await page.getByText('Клиенты в MAX').waitFor();
  await shot('17-max-chats');
  await page.getByText('Клиенты в MAX').locator('xpath=..').getByRole('button').first().click();
  await page.waitForURL(/\/max-emulator\/\d+/);
  const cancelButton = page.getByRole('button', { name: 'Отменить', exact: true }).last();
  await cancelButton.waitFor();
  await shot('18-max-chat');
  await cancelButton.click();
  await page.getByText('Отменить запись?').last().waitFor({ timeout: 15_000 });
  await shot('19-max-cancel-question');
  await page.getByRole('button', { name: 'Не отменять' }).last().click();
  await page.getByRole('button', { name: 'Да, отменить' }).waitFor({ state: 'detached' });
  const answers = page.getByText('Ваши записи');
  const answered = await answers.count();
  await page.getByLabel('Сообщение боту').fill('/bookings');
  await page.getByRole('button', { name: 'Отправить' }).click();
  await answers.nth(answered).waitFor({ timeout: 15_000 });
  await shot('20-max-bookings-command');

  // A staff member sees only their own column and visits.
  await page.getByRole('button', { name: 'Аккаунт' }).filter({ visible: true }).first().click();
  await page.getByRole('button', { name: 'Выйти' }).click();
  await page.waitForURL(/\/sign-in/);
  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: /Сирень/ }).click();
  await page.getByRole('button', { name: 'Мастер', exact: true }).click();
  await shot('13-sign-in-staff');
  await page.getByRole('button', { name: 'Войти в демо' }).click();
  await page.waitForURL(/\/schedule/);
  await stepToDayWith(page, visits);
  await shot('14-staff-schedule');
  await page.getByRole('link', { name: 'Записи' }).first().click();
  await page.waitForURL(/\/bookings/);
  await shot('15-staff-bookings');
}
