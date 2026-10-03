import type { Page } from 'playwright';
import type { Session } from './browser.ts';

/** Sections of the product site, in reading order (see the site's header). */
const sections = ['how', 'surfaces', 'verticals', 'pricing'] as const;

/** Brings a section to the top of the screen and lets its lazy media load. */
async function showSection(page: Page, id: string): Promise<void> {
  await page.locator(`#${id}`).evaluate((section) => {
    section.scrollIntoView({ block: 'start' });
  });
  await page.waitForTimeout(300);
}

/**
 * The product site, then the guest's way through the demo: the site's demo choice,
 * the cabinet's demo sign-in and, from the cabinet, the client's Mini App.
 */
export async function captureLanding(session: Session, base: string): Promise<void> {
  const { page, shot } = session;
  await page.goto(base);
  await page.waitForLoadState('networkidle');
  await shot('01-hero');
  for (const [index, id] of sections.entries()) {
    await showSection(page, id);
    await shot(`${String(index + 2).padStart(2, '0')}-${id}`);
  }
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });
  await shot('06-closing');
  await shot('07-full-page', { fullPage: true });

  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
  await page.getByRole('banner').getByRole('button', { name: 'Попробовать демо' }).click();
  await page.getByRole('dialog').waitFor();
  await shot('08-demo-choice');

  await page.getByRole('link', { name: /Кабинет заведения/ }).click();
  await page.waitForURL(/\/sign-in/);
  await page.getByRole('button', { name: 'Войти в демо' }).click();
  await page.waitForURL(/\/schedule/);
  await page.getByRole('button', { name: 'Аккаунт' }).filter({ visible: true }).first().click();
  await page.getByText('Ещё в демо').waitFor();
  await shot('09-cabinet-demo-links');

  const [miniApp] = await Promise.all([
    page.context().waitForEvent('page'),
    page.getByRole('link', { name: /Mini App клиента/ }).click(),
  ]);
  await miniApp.waitForLoadState('networkidle');
  await miniApp.getByText('Сирень', { exact: true }).waitFor();
  await page.close();
  await session.adopt(miniApp);
  await shot('10-miniapp-from-cabinet');
}
