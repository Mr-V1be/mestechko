/**
 * Development look at cabinet screens: signs in to the demo, opens a section of the
 * business and saves it at 390, 768 and 1280 px in both themes, reporting horizontal
 * page scroll and console errors. For checking a screen while building it; the
 * milestone screenshots come from `pnpm screenshots`.
 *   node tooling/screenshots/look.ts --path team [--out /tmp/look] [--cabinet http://127.0.0.1:46220]
 *     [--business Чуб] [--role owner] [--click "Добавить"] [--viewport 390]
 */
import { mkdirSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';
import { browserLaunchOptions, openSession, viewports, type Problem } from './browser.ts';

const { values } = parseArgs({
  options: {
    path: { type: 'string', default: 'schedule' },
    out: { type: 'string', default: 'tmp/look' },
    cabinet: { type: 'string', default: 'http://127.0.0.1:46220' },
    business: { type: 'string' },
    role: { type: 'string', default: 'Владелец' },
    click: { type: 'string', multiple: true },
    viewport: { type: 'string' },
    theme: { type: 'string' },
  },
});

const themes = {
  light: { colorScheme: 'light', storage: { 'mst-cabinet-theme': 'light' } },
  dark: { colorScheme: 'dark', storage: { 'mst-cabinet-theme': 'dark' } },
} as const;

const problems: Problem[] = [];
const browser = await chromium.launch(browserLaunchOptions);
try {
  for (const viewport of viewports.filter((v) => !values.viewport || v.name === values.viewport)) {
    for (const [name, theme] of Object.entries(themes).filter(
      ([themeName]) => !values.theme || themeName === values.theme,
    )) {
      const directory = `${values.out}/${viewport.name}-${name}`;
      mkdirSync(directory, { recursive: true });
      const session = await openSession({
        browser,
        viewport,
        colorScheme: theme.colorScheme,
        storage: theme.storage,
        directory,
        problems,
      });
      try {
        const { page } = session;
        await page.goto(`${values.cabinet}/sign-in`);
        await page.getByRole('button', { name: 'Войти в демо' }).waitFor();
        // The demo picker preselects the first business; another one is chosen by name.
        if (values.business) {
          await page.getByRole('combobox').first().click();
          await page.getByRole('option', { name: new RegExp(values.business) }).click();
        }
        await page.getByRole('button', { name: 'Войти в демо' }).click();
        await page.waitForURL(/\/b\/[^/]+\//);
        const base = page.url().replace(/(\/b\/[^/]+)\/.*$/, '$1');
        await page.goto(`${base}/${values.path}`);
        await session.shot('01');
        for (const [index, label] of (values.click ?? []).entries()) {
          await page.getByRole('button', { name: label, exact: true }).first().click();
          await session.shot(String(index + 2).padStart(2, '0'));
        }
        console.log(`✓ ${viewport.name} ${name}`);
      } finally {
        await session.close();
      }
    }
  }
} finally {
  await browser.close();
}
for (const problem of problems) {
  console.log(`✗ ${problem.shot}: ${problem.issue}`);
}
