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
  // A visit today may already be too close to change online; on the next open day the
  // reschedule and cancel paths below stay open whatever the hour.
  const openDays = page.getByRole('radiogroup').first().getByRole('radio', { disabled: false });
  if ((await openDays.count()) > 1) {
    await openDays.nth(1).click();
    await slots.first().waitFor();
  }
  await shot('06-time');
  await slots.first().click();
  await shot('07-time-selected');

  await page.getByRole('button', { name: 'Продолжить' }).click();
  await page.waitForURL(/\/confirm/);
  await shot('08-confirm');
  // The demo visitor's number is a demo one (+7 0XX …), filled in by the app.
  await page.waitForFunction(() =>
    document.querySelector<HTMLInputElement>('input[type="tel"]')?.value.startsWith('+7 0'),
  );
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

  // Moving the booking: same services and staff member, another free start.
  await page.getByRole('button', { name: 'Перенести' }).click();
  await page.waitForURL(/\/reschedule$/);
  // Another start than the current one, looking a few weeks ahead if needed.
  const moveSlots = page.getByRole('radio', { checked: false }).filter({ hasText: /^\d\d:\d\d$/ });
  await page
    .getByRole('radio')
    .filter({ hasText: /^\d\d:\d\d$/ })
    .first()
    .waitFor();
  await shot('15-reschedule');
  for (let week = 0; week < MAX_WEEKS_AHEAD && (await moveSlots.count()) === 0; week += 1) {
    await page.getByRole('button', { name: 'Следующая неделя' }).first().click();
    await page.waitForLoadState('networkidle');
  }
  await moveSlots.last().click();
  await shot('16-reschedule-selected');
  await page.getByRole('button', { name: /^Перенести на/ }).click();
  await page.waitForURL(/\/bookings\/[0-9a-f-]+$/);
  await page.getByText('Запись перенесена').first().waitFor();
  await shot('17-rescheduled');

  await page.getByRole('button', { name: 'Отменить', exact: true }).click();
  const cancelSheet = page.getByRole('dialog', { name: 'Отменить запись?' });
  await cancelSheet.waitFor();
  await shot('18-cancel-sheet');
  await cancelSheet.getByRole('button', { name: 'Отменить запись' }).click();
  await page.getByText('Запись отменена').first().waitFor();
  await cancelSheet.waitFor({ state: 'detached' });
  await shot('19-cancelled');

  // Waiting for a full day: the waitlist sheet on the time step.
  await page.goto(`${base}/b/siren`);
  await page.getByText('Сирень на Пятницкой').click();
  await page.getByText('Женская стрижка').click();
  await page.getByRole('button', { name: 'Выбрать мастера' }).click();
  await page.getByText('Любой мастер').click();
  await page.waitForURL(/\/time/);
  await page.getByRole('button', { name: 'Встать в лист ожидания' }).click();
  const waitlistSheet = page.getByRole('dialog', { name: 'Лист ожидания' });
  await waitlistSheet.waitFor();
  await shot('20-waitlist-sheet');
  await waitlistSheet.getByRole('button', { name: 'Встать в лист ожидания' }).click();
  await waitlistSheet.waitFor({ state: 'detached' });
  await page.goto(`${base}/b/siren/bookings`);
  await page.getByText('Лист ожидания').waitFor();
  await shot('21-my-bookings-waitlist');

  // Services the business never books together: the other one is greyed out with why.
  await page.goto(`${base}/b/emal`);
  await page.waitForURL(/\/services/);
  await page.getByText('Отбеливание', { exact: true }).click();
  // Into the middle of the screen: the bottom bar would cover it at the edge.
  await page
    .getByText('Не делается вместе с выбранными')
    .first()
    .evaluate((element) => {
      element.scrollIntoView({ block: 'center' });
    });
  await shot('22-services-not-together');

  // A prepaid service: the deposit on the confirmation, the payment page and the return.
  await page.goto(`${base}/b/siren`);
  await page.getByText('Сирень на Пятницкой').click();
  await page.getByText('Окрашивание в один тон').click();
  await page.getByRole('button', { name: 'Выбрать мастера' }).click();
  await page.getByText('Любой мастер').click();
  await page.waitForURL(/\/time/);
  for (let week = 0; week < MAX_WEEKS_AHEAD; week += 1) {
    await slots.first().or(weekFull).waitFor();
    if ((await slots.count()) > 0) {
      break;
    }
    await page.getByRole('button', { name: 'Следующая неделя' }).first().click();
  }
  await slots.first().click();
  await page.getByRole('button', { name: 'Продолжить' }).click();
  await page.waitForURL(/\/confirm/);
  await page.getByRole('button', { name: /^Записаться и оплатить/ }).waitFor();
  await shot('23-confirm-deposit');
  await page.getByRole('button', { name: /^Записаться и оплатить/ }).click();
  await page.waitForURL(/\/test-pay\/checkout\//);
  await shot('24-payment-page');
  await page.getByRole('button', { name: /^Оплатить/ }).click();
  await page.waitForURL(/payment=return/);
  await page.getByText('Оплата прошла — вы записаны!').waitFor();
  await shot('25-paid');

  await page.goto(`${base}/b/no-such-business`);
  await shot('13-business-not-found');

  await fail(page, /\/api\/v1\/public\/businesses\/emal\/services/, 500, 'internal');
  await page.goto(`${base}/b/emal`);
  await page.getByRole('button', { name: 'Повторить' }).waitFor();
  await shot('14-error');
}
