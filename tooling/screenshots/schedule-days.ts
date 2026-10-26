/**
 * The demo clock moves on, and a phone shows one specialist at a time: the visit a
 * scenario needs may be on another day or in a column off screen. These helpers find a
 * day that has it on screen.
 */
import type { Locator, Page } from 'playwright';

/** How far ahead to look for a day with what a scenario needs. */
const MAX_DAYS_AHEAD = 4;
/**
 * How long a day gets to show its visits. The schedule loads them after the click, and the
 * page's load state says nothing about requests made after it loaded.
 */
const DAY_SETTLE_MS = 5_000;
const POLL_MS = 250;

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

/** Whether `target` shows a match on screen while the day settles. */
async function appearsOnScreen(target: Locator): Promise<boolean> {
  const deadline = Date.now() + DAY_SETTLE_MS;
  do {
    if ((await indexesOnScreen(target)).length > 0) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  } while (Date.now() < deadline);
  return false;
}

/** Steps the schedule forward until `target` has a match on screen, a few days at most. */
export async function stepToDayWith(page: Page, target: Locator): Promise<void> {
  for (let day = 0; !(await appearsOnScreen(target)) && day < MAX_DAYS_AHEAD; day += 1) {
    await page.getByRole('button', { name: 'Вперёд' }).click();
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
