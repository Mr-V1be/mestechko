import type { Browser, BrowserContext, Page, Route } from 'playwright';

export const viewports = [
  { name: '390', width: 390, height: 844 },
  { name: '768', width: 768, height: 1024 },
  { name: '1280', width: 1280, height: 800 },
] as const;

export type Viewport = (typeof viewports)[number];

/**
 * Launch options of the screenshot browser: Russian like the product's audience, so
 * native date and time fields read «03.10.2026» and «10:00», not the US format.
 */
export const browserLaunchOptions = {
  args: ['--mute-audio', '--lang=ru-RU'],
  env: { ...process.env, LANG: 'ru_RU.UTF-8', LANGUAGE: 'ru' },
};

export interface Problem {
  readonly shot: string;
  readonly issue: string;
}

/** Network errors the browser logs for expected responses (e.g. 401 before sign-in). */
const EXPECTED_CONSOLE = [
  /status of 401/,
  /status of 403/,
  /status of 404/,
  // A refused change (the time was taken meanwhile) is shown where it happened.
  /status of 409/,
  /status of 500/,
];

export interface ShotOptions {
  /** `false` captures while requests are deliberately held (loading states). */
  readonly settle?: boolean;
  /** The whole scrolled page instead of the screen. */
  readonly fullPage?: boolean;
}

export interface Session {
  /** The page being captured; a scenario that follows a link into a new tab adopts it. */
  readonly page: Page;
  readonly shot: (name: string, options?: ShotOptions) => Promise<void>;
  /** Watches and captures `next` from now on, e.g. a tab the app opened. */
  readonly adopt: (next: Page) => Promise<void>;
  readonly close: () => Promise<void>;
}

/**
 * A browser context for one viewport and theme. Every screenshot is checked for
 * horizontal page scroll and unexpected console errors.
 */
export async function openSession(input: {
  readonly browser: Browser;
  readonly viewport: Viewport;
  readonly colorScheme: 'light' | 'dark';
  readonly storage: Readonly<Record<string, string>>;
  readonly directory: string;
  readonly problems: Problem[];
}): Promise<Session> {
  const context: BrowserContext = await input.browser.newContext({
    viewport: { width: input.viewport.width, height: input.viewport.height },
    colorScheme: input.colorScheme,
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
    reducedMotion: 'reduce',
  });
  await context.addInitScript((entries: Record<string, string>) => {
    for (const [key, value] of Object.entries(entries)) {
      window.localStorage.setItem(key, value);
    }
  }, input.storage);
  let consoleErrors: string[] = [];
  const watch = (watched: Page) => {
    watched.on('console', (message) => {
      if (
        message.type() === 'error' &&
        !EXPECTED_CONSOLE.some((pattern) => pattern.test(message.text()))
      ) {
        consoleErrors.push(message.text());
      }
    });
    watched.on('pageerror', (error) => consoleErrors.push(String(error)));
  };
  let page = await context.newPage();
  watch(page);
  return {
    get page() {
      return page;
    },
    adopt: async (next) => {
      page = next;
      watch(next);
      await next.bringToFront();
    },
    shot: async (name, options = {}) => {
      if (options.settle !== false) {
        await page.waitForLoadState('networkidle');
      }
      await page.waitForTimeout(400);
      const path = `${input.directory}/${name}.png`;
      await page.screenshot({ path, fullPage: options.fullPage === true });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      if (overflow) {
        input.problems.push({ shot: path, issue: 'horizontal page scroll' });
      }
      for (const error of consoleErrors) {
        input.problems.push({ shot: path, issue: `console: ${error}` });
      }
      consoleErrors = [];
    },
    close: () => context.close(),
  };
}

/** Holds matching API requests until released, to capture loading skeletons. */
export async function stall(page: Page, pattern: RegExp): Promise<() => Promise<void>> {
  const held: Route[] = [];
  await page.route(pattern, (route) => {
    held.push(route);
  });
  return async () => {
    // Requests the app abandoned meanwhile are already settled; only live ones continue.
    await Promise.all(held.map((route) => route.continue().catch(() => undefined)));
    await page.unroute(pattern);
  };
}

/** Answers matching API requests with an error envelope. */
export async function fail(
  page: Page,
  pattern: RegExp,
  status: number,
  code: string,
): Promise<void> {
  await page.route(pattern, (route) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code, message: code } }),
    }),
  );
}
