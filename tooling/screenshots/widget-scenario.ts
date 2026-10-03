import type { Frame, Page } from 'playwright';
import type { Session } from './browser.ts';

/** Prepaid colouring is popular: its free time may be weeks ahead. */
const MAX_WEEKS_AHEAD = 8;
const SETTLE_MS = 800;

function inlineFrame(page: Page): Frame {
  const frame = page.frames().find((candidate) => candidate.url().includes('mode=inline'));
  if (!frame) {
    throw new Error('The inline widget frame is missing');
  }
  return frame;
}

async function pickFirstFreeStart(frame: Frame): Promise<void> {
  const slots = frame.getByRole('radio').filter({ hasText: /^\d\d:\d\d$/ });
  for (let week = 0; week < MAX_WEEKS_AHEAD; week += 1) {
    await slots.first().or(frame.getByText('На этой неделе мест нет')).waitFor();
    if ((await slots.count()) > 0) {
      break;
    }
    await frame.getByRole('button', { name: 'Следующая неделя' }).first().click();
  }
  await slots.first().click();
}

/** Books through the inline widget up to the contact step. */
async function bookUpToContacts(page: Page, frame: Frame, service: string): Promise<void> {
  await frame.getByText(service, { exact: true }).click();
  await frame.getByRole('button', { name: 'Дальше' }).click();
  await frame.getByText('Любой мастер').click();
  await pickFirstFreeStart(frame);
  await frame.getByRole('button', { name: 'Дальше' }).click();
  await frame.getByLabel('Имя').fill('Анна Демо');
  await frame.getByLabel('Телефон').fill('+7 000 123-45-67');
  await frame.getByText('Согласен на обработку персональных данных для записи').click();
  await page.locator('#booking').scrollIntoViewIfNeeded();
}

/** The demo salon's website with the booking widget, inline and as a popup. */
export async function captureWidget(session: Session, base: string): Promise<void> {
  const { page, shot } = session;
  await page.goto(`${base}/demo/siren.html`);
  await page.waitForLoadState('networkidle');
  await shot('01-salon-site');

  let frame = inlineFrame(page);
  await frame.getByText('Укладка', { exact: true }).waitFor();
  await page.locator('#booking').scrollIntoViewIfNeeded();
  await shot('02-widget-services');
  await frame.getByText('Укладка', { exact: true }).click();
  await frame.getByRole('button', { name: 'Дальше' }).click();
  await frame.getByText('Любой мастер').waitFor();
  await page.locator('#booking').scrollIntoViewIfNeeded();
  await shot('03-widget-staff');
  await frame.getByText('Любой мастер').click();
  await pickFirstFreeStart(frame);
  await page.locator('#booking').scrollIntoViewIfNeeded();
  await shot('04-widget-time');
  await frame.getByRole('button', { name: 'Дальше' }).click();
  await frame.getByLabel('Имя').fill('Анна Демо');
  await frame.getByLabel('Телефон').fill('+7 000 123-45-67');
  await frame.getByText('Согласен на обработку персональных данных для записи').click();
  await page.locator('#booking').scrollIntoViewIfNeeded();
  await shot('05-widget-contacts');
  await frame.getByRole('button', { name: /^Записаться/ }).click();
  await frame.getByText('Вы записаны!').waitFor();
  await page.locator('#booking').scrollIntoViewIfNeeded();
  await shot('06-widget-booked');

  // A service with a prepayment: the provider's page in the frame, then back.
  await frame.getByRole('button', { name: 'Записаться ещё' }).click();
  await bookUpToContacts(page, frame, 'Окрашивание в один тон');
  await shot('07-widget-deposit');
  await frame.getByRole('button', { name: /^Записаться и оплатить/ }).click();
  await frame.waitForURL(/\/test-pay\/checkout\//);
  await frame.getByRole('button', { name: /^Оплатить/ }).waitFor();
  await page.locator('#booking').scrollIntoViewIfNeeded();
  await shot('08-widget-payment-page');
  await frame.getByRole('button', { name: /^Оплатить/ }).click();
  await frame.waitForURL(/payment=return/);
  frame = inlineFrame(page);
  await frame.getByText('Оплата прошла — вы записаны!').waitFor();
  await page.locator('#booking').scrollIntoViewIfNeeded();
  await page.waitForTimeout(SETTLE_MS);
  await shot('09-widget-paid');

  // The same form from the site's own buttons, in a dialog over the page.
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
  await page.getByRole('button', { name: 'Записаться онлайн' }).first().click();
  await page.getByRole('dialog', { name: 'Онлайн-запись' }).waitFor();
  const popup = page.frames().find((candidate) => candidate.url().includes('mode=popup'));
  await popup?.getByText('Укладка', { exact: true }).waitFor();
  await shot('10-widget-popup');
}
