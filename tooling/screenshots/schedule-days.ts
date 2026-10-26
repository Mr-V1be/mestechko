/**
 * The demo clock moves on, and a phone shows one specialist at a time: the visit a
 * scenario needs may be on another day or in a column off screen. These helpers find a
 * day that has it on screen.
 */
import type { Locator, Page } from 'playwright';

/** How far ahead to look for a day with what a scenario needs. */
const MAX_DAYS_AHEAD = 4;

/**
 * Indexes of the matches within the screen's width. A narrow board pages through its
 * columns: the visits of other pages are in the document but cannot be clicked.
 */
async function indexesOnScreen(target: Locator): Promise<number[]> {
  return target.evaluateAll((elements) =>
    elements.flatMap((element, index) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.left >= 0 && rect.right <= window.innerWidth ? [index] : [];
    }),
  );
}

/** Steps the schedule forward until `target` has a match on screen, a few days at most. */
export async function stepToDayWith(page: Page, target: Locator): Promise<void> {
  await page.waitForLoadState('networkidle');
  for (let day = 0; day < MAX_DAYS_AHEAD; day += 1) {
    if ((await indexesOnScreen(target)).length > 0) {
      return;
    }
    await page.getByRole('button', { name: 'Вперёд' }).click();
    await page.waitForLoadState('networkidle');
  }
}

/** The first match of `target` on screen, on this day or the nearest one ahead. */
export async function firstOnScreen(page: Page, target: Locator): Promise<Locator> {
  await stepToDayWith(page, target);
  const [index] = await indexesOnScreen(target);
  if (index === undefined) {
    throw new Error(`Nothing to show within ${String(MAX_DAYS_AHEAD)} days`);
  }
  return target.nth(index);
}
