/**
 * Visual check of milestone screens: every screen at 390, 768 and 1280 px in every theme.
 * Run against built apps (vite preview) with the API and demo data up.
 *   node tooling/screenshots/capture.ts [--only miniapp|cabinet|widget] [--out docs/screenshots/m3]
 */
import { mkdirSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';
import { browserLaunchOptions, openSession, viewports, type Problem } from './browser.ts';
import { captureCabinetManagement } from './cabinet-manage-scenario.ts';
import { captureCabinet } from './cabinet-scenario.ts';
import { captureMiniApp } from './miniapp-scenario.ts';
import { captureWidget } from './widget-scenario.ts';
import type { Session } from './browser.ts';

const { values } = parseArgs({
  options: {
    out: { type: 'string', default: 'docs/screenshots/m1' },
    miniapp: { type: 'string', default: 'http://127.0.0.1:46231' },
    cabinet: { type: 'string', default: 'http://127.0.0.1:46221' },
    widget: { type: 'string', default: 'http://127.0.0.1:46241' },
    only: { type: 'string' },
    viewport: { type: 'string' },
  },
});

interface ThemeSetup {
  readonly colorScheme: 'light' | 'dark';
  readonly storage: Readonly<Record<string, string>>;
}

const miniAppThemes: Readonly<Record<string, ThemeSetup>> = {
  light: { colorScheme: 'light', storage: { 'mst-miniapp-theme': 'light' } },
  dark: { colorScheme: 'dark', storage: { 'mst-miniapp-theme': 'dark' } },
  'telegram-dark': { colorScheme: 'dark', storage: { 'mst-demo-telegram-theme': 'dark' } },
};

const cabinetThemes: Readonly<Record<string, ThemeSetup>> = {
  light: { colorScheme: 'light', storage: { 'mst-cabinet-theme': 'light' } },
  dark: { colorScheme: 'dark', storage: { 'mst-cabinet-theme': 'dark' } },
};

/** The website follows the visitor's system theme, and so does the widget on it. */
const widgetThemes: Readonly<Record<string, ThemeSetup>> = {
  light: { colorScheme: 'light', storage: {} },
  dark: { colorScheme: 'dark', storage: {} },
};

async function captureWholeCabinet(session: Session, base: string): Promise<void> {
  await captureCabinet(session, base);
  await captureCabinetManagement(session, base);
}

const apps = [
  { name: 'miniapp', themes: miniAppThemes, base: values.miniapp, capture: captureMiniApp },
  { name: 'cabinet', themes: cabinetThemes, base: values.cabinet, capture: captureWholeCabinet },
  { name: 'widget', themes: widgetThemes, base: values.widget, capture: captureWidget },
] as const;

const problems: Problem[] = [];
const browser = await chromium.launch(browserLaunchOptions);
try {
  for (const app of apps.filter((candidate) => !values.only || candidate.name === values.only)) {
    for (const viewport of viewports.filter(
      (candidate) => !values.viewport || candidate.name === values.viewport,
    )) {
      for (const [themeName, theme] of Object.entries(app.themes)) {
        const directory = `${values.out}/${app.name}/${viewport.name}-${themeName}`;
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
          await session.page.screenshot({ path: `${directory}/zz-failure.png` });
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
