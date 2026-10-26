/**
 * Visual check of milestone screens: every screen at 390, 768 and 1280 px in every theme.
 * Run against built apps (vite preview) with the API and demo data up.
 *   node tooling/screenshots/capture.ts [--only landing,miniapp,cabinet,widget] [--out docs/screenshots/m4]
 */
import { mkdirSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';
import { browserLaunchOptions, openSession, viewports, type Problem } from './browser.ts';
import { captureCabinetManagement } from './cabinet-manage-scenario.ts';
import { captureCabinet } from './cabinet-scenario.ts';
import { captureLanding } from './landing-scenario.ts';
import { captureMiniApp } from './miniapp-scenario.ts';
import { captureWidget } from './widget-scenario.ts';
import type { Session } from './browser.ts';

const { values } = parseArgs({
  options: {
    out: { type: 'string', default: 'docs/screenshots/m4' },
    miniapp: { type: 'string', default: 'http://127.0.0.1:46231' },
    cabinet: { type: 'string', default: 'http://127.0.0.1:46221' },
    widget: { type: 'string', default: 'http://127.0.0.1:46241' },
    landing: { type: 'string', default: 'http://127.0.0.1:46251' },
    only: { type: 'string' },
    viewport: { type: 'string' },
  },
});

interface ThemeSetup {
  readonly colorScheme: 'light' | 'dark';
  readonly storage: Readonly<Record<string, string>>;
}

const miniAppThemes: Readonly<Record<string, ThemeSetup>> = {
  light: { colorScheme: 'light', storage: { 'slotwise-miniapp-theme': 'light' } },
  dark: { colorScheme: 'dark', storage: { 'slotwise-miniapp-theme': 'dark' } },
  'telegram-dark': { colorScheme: 'dark', storage: { 'slotwise-demo-telegram-theme': 'dark' } },
};

const cabinetThemes: Readonly<Record<string, ThemeSetup>> = {
  light: { colorScheme: 'light', storage: { 'slotwise-cabinet-theme': 'light' } },
  dark: { colorScheme: 'dark', storage: { 'slotwise-cabinet-theme': 'dark' } },
};

/** The website follows the visitor's system theme, and so does the widget on it. */
const widgetThemes: Readonly<Record<string, ThemeSetup>> = {
  light: { colorScheme: 'light', storage: {} },
  dark: { colorScheme: 'dark', storage: {} },
};

/** The site and the demos a guest walks into from it keep one theme. */
const landingThemes: Readonly<Record<string, ThemeSetup>> = Object.fromEntries(
  (['light', 'dark'] as const).map((theme) => [
    theme,
    {
      colorScheme: theme,
      storage: {
        'slotwise-landing-theme': theme,
        'slotwise-cabinet-theme': theme,
        'slotwise-miniapp-theme': theme,
      },
    },
  ]),
);

interface App {
  readonly name: string;
  /** Where its screenshots go; parts of one app share a folder. */
  readonly folder: string;
  readonly themes: Readonly<Record<string, ThemeSetup>>;
  readonly base: string;
  readonly capture: (session: Session, base: string) => Promise<void>;
}

// The cabinet runs in two parts, each in a fresh browser context, so one long session
// never carries the memory of forty screens.
const apps: readonly App[] = [
  {
    name: 'landing',
    folder: 'landing',
    themes: landingThemes,
    base: values.landing,
    capture: captureLanding,
  },
  {
    name: 'miniapp',
    folder: 'miniapp',
    themes: miniAppThemes,
    base: values.miniapp,
    capture: captureMiniApp,
  },
  {
    name: 'cabinet',
    folder: 'cabinet',
    themes: cabinetThemes,
    base: values.cabinet,
    capture: captureCabinet,
  },
  {
    name: 'cabinet',
    folder: 'cabinet',
    themes: cabinetThemes,
    base: values.cabinet,
    capture: captureCabinetManagement,
  },
  {
    name: 'widget',
    folder: 'widget',
    themes: widgetThemes,
    base: values.widget,
    capture: captureWidget,
  },
];

const problems: Problem[] = [];
const browser = await chromium.launch(browserLaunchOptions);
try {
  const only = values.only?.split(',');
  for (const app of apps.filter((candidate) => !only || only.includes(candidate.name))) {
    for (const viewport of viewports.filter(
      (candidate) => !values.viewport || candidate.name === values.viewport,
    )) {
      for (const [themeName, theme] of Object.entries(app.themes)) {
        const directory = `${values.out}/${app.folder}/${viewport.name}-${themeName}`;
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
          await app.capture(session, app.base);
          console.log(`✓ ${app.name} ${viewport.name} ${themeName}`);
        } catch (error) {
          problems.push({
            shot: directory,
            issue: `scenario failed: ${String(error).split('\n')[0] ?? ''}`,
          });
          // A crashed page cannot be captured; the problem above already says what failed.
          await session.page
            .screenshot({ path: `${directory}/zz-failure.png` })
            .catch(() => undefined);
        } finally {
          await session.close();
        }
      }
    }
  }
} finally {
  await browser.close();
}

if (problems.length > 0) {
  console.error(`✗ ${String(problems.length)} problem(s):`);
  for (const problem of problems) {
    console.error(`  ${problem.shot}: ${problem.issue}`);
  }
  process.exit(1);
}
console.log('✓ No horizontal scroll or console errors on any screen.');
