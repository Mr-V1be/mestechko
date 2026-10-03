import type { Page } from 'playwright';
import type { Session } from './browser.ts';

const SETTLE_MS = 600;
/** Visits to look through for one the desk can close (it began, nobody marked it yet). */
const MAX_VISITS_TO_TRY = 10;

async function signInAsOwner(page: Page, base: string): Promise<string> {
  // The front-desk scenario ends signed in as a staff member.
  await page.context().clearCookies();
  await page.goto(`${base}/sign-in`);
  await page.getByRole('button', { name: 'Войти в демо' }).click();
  await page.waitForURL(/\/schedule/);
  return page.url().replace(/(\/b\/[^/]+)\/.*$/, '$1');
}

const visitBlocks = (page: Page) => page.locator('[data-column-key] button');

/** A visit that already began and waits for the desk: today's first, else yesterday's. */
async function openVisitToClose(page: Page, business: string): Promise<boolean> {
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  for (const query of ['', `?date=${yesterday}`]) {
    await page.goto(`${business}/schedule${query}`);
    await page.waitForLoadState('networkidle');
    const count = Math.min(await visitBlocks(page).count(), MAX_VISITS_TO_TRY);
    for (let index = 0; index < count; index += 1) {
      await visitBlocks(page).nth(index).click();
      const dialog = page.getByRole('dialog');
      await dialog.waitFor();
      await page.waitForLoadState('networkidle');
      if (await dialog.getByRole('button', { name: 'Визит состоялся' }).isVisible()) {
        return true;
      }
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'detached' });
    }
  }
  return false;
}

/** The front desk at work and the business areas of milestone 3. */
export async function captureCabinetManagement(session: Session, base: string): Promise<void> {
  const { page, shot } = session;
  const business = await signInAsOwner(page, base);
  const wide = (page.viewportSize()?.width ?? 0) >= 768;

  // Front desk: a new booking from the schedule.
  await page.getByRole('button', { name: 'Новая запись' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.waitFor();
  await shot('21-desk-new-booking');
  await sheet.getByText('Укладка', { exact: true }).click();
  await page.waitForLoadState('networkidle');
  await shot('22-desk-new-booking-services');
  await page.keyboard.press('Escape');
  await sheet.waitFor({ state: 'detached' });

  // Moving through the form, and what cancelling will cause: a visit still ahead.
  await page.locator('[data-column-key] button[class*="draggable"]').first().click();
  await page.getByRole('dialog').waitFor();
  await page.getByRole('button', { name: 'Перенести', exact: true }).click();
  await page.getByRole('dialog', { name: 'Перенести запись' }).waitFor();
  await page.waitForLoadState('networkidle');
  await shot('23-desk-move-form');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Действия' }).click();
  await page.getByRole('menuitem', { name: 'Отменить запись' }).click();
  await page.getByRole('dialog', { name: 'Отменить запись?' }).waitFor();
  await shot('24-desk-cancel-consequences');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');

  // Dragging a visit onto another one: refused where it was dropped, the screen rolls back.
  if (wide) {
    await page.goto(`${business}/schedule`);
    await page.waitForLoadState('networkidle');
    const draggable = page.locator('[data-column-key] button[class*="draggable"]');
    if ((await draggable.count()) >= 2) {
      const from = await draggable.nth(0).boundingBox();
      const onto = await draggable.nth(1).boundingBox();
      if (from && onto) {
        await page.mouse.move(from.x + from.width / 2, from.y + 6);
        await page.mouse.down();
        await page.mouse.move(onto.x + onto.width / 2, onto.y + 6, { steps: 8 });
        await shot('25-desk-dragging', { settle: false });
        await page.mouse.up();
        await page.getByRole('alert').first().waitFor();
        await shot('26-desk-drop-refused', { settle: false });
      }
    }
  }

  // Closing a visit: pass, points and money, settled like the server will.
  if (await openVisitToClose(page, business)) {
    await page.getByRole('button', { name: 'Визит состоялся' }).click();
    await page.getByRole('dialog', { name: 'Закрыть визит' }).waitFor();
    await page.waitForLoadState('networkidle');
    await shot('27-desk-complete-visit');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
  }

  // Team: schedules, templates and what a change does to booked visits.
  await page.goto(`${business}/team`);
  await page.getByRole('button', { name: 'Добавить сотрудника' }).waitFor();
  await shot('28-team');
  await page.getByText('Анна Ковалёва', { exact: true }).first().click();
  await page.getByRole('button', { name: 'Изменить график' }).waitFor();
  await page.waitForLoadState('networkidle');
  await shot('29-team-member');
  await page.getByRole('button', { name: 'Изменить график' }).click();
  await page.getByLabel('График', { exact: true }).click();
  await page.getByRole('option', { name: '2/2 — два через два' }).click();
  await shot('30-team-schedule-template');
  await page.getByRole('button', { name: 'Сохранить график' }).last().click();
  await page.getByText(/^Затронет \d+ запис/).waitFor();
  await shot('31-team-schedule-impact');
  await page.getByRole('button', { name: 'Отмена' }).click();
  await page.keyboard.press('Escape');

  // Services: categories, personal prices and durations, incompatible pairs.
  await page.goto(`${business}/services`);
  await page.getByRole('button', { name: 'Категория' }).waitFor();
  await shot('32-services');
  await page.getByRole('button', { name: 'Действия с услугой «Окрашивание в один тон»' }).click();
  await page.getByRole('menuitem', { name: 'Изменить' }).click();
  await page.getByRole('dialog').waitFor();
  await page.waitForLoadState('networkidle');
  await shot('33-service-editor');
  await page.keyboard.press('Escape');

  await page.goto(`${business}/loyalty`);
  await page.getByRole('button', { name: 'Абонемент', exact: true }).waitFor();
  await shot('34-loyalty');

  // Clients: the list, a card with history, notes, loyalty and the import.
  await page.goto(`${business}/clients`);
  await page.getByLabel('Поиск').waitFor();
  await page.waitForLoadState('networkidle');
  await shot('35-clients');
  await page.getByRole('button', { name: 'Импорт и экспорт' }).click();
  await page.getByRole('menuitem', { name: 'Импорт из файла' }).click();
  await page.getByRole('dialog', { name: 'Импорт клиентов' }).waitFor();
  await shot('36-clients-import');
  await page.keyboard.press('Escape');
  // A regular: the client with the most visits, so the card has history and points.
  const regular = await page.evaluate(
    async (path: string) => {
      const response = await fetch(path, { credentials: 'include' });
      const body = (await response.json()) as { items: { id: string; visits: number }[] };
      return [...body.items].sort((a, b) => b.visits - a.visits)[0]?.id ?? null;
    },
    `/api/v1/cabinet/businesses/${business.split('/b/')[1] ?? ''}/clients?limit=100`,
  );
  await page.goto(`${business}/clients/${regular ?? ''}`);
  await page.getByText('История визитов').waitFor();
  await page.waitForLoadState('networkidle');
  await shot('37-client-card');

  await page.goto(`${business}/reports`);
  await page.getByText('Загрузка').first().waitFor();
  await page.waitForLoadState('networkidle');
  await shot('38-reports');
  await page.getByRole('button', { name: 'Таблица' }).first().click();
  await shot('39-reports-table');

  await page.goto(`${business}/settings`);
  await page.getByText('Онлайн-запись').first().waitFor();
  await shot('40-settings');
  await page.getByText('Виджет для сайта').scrollIntoViewIfNeeded();
  await page.waitForTimeout(SETTLE_MS);
  await shot('41-settings-widget');
}
