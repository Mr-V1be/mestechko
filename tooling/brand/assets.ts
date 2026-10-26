/**
 * Draws every picture of the brand from its artwork (packages/ui/src/components/brand):
 *
 *   pnpm brand:assets
 *
 * the tab icon and home screen icon of each web app, the product site's link previews in
 * each language (from the site's current media, so run it after `pnpm media:landing`) and
 * the bot's avatar and Mini App picture for BotFather in docs/brand.
 */
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { browserLaunchOptions } from '../screenshots/browser.ts';
import { faviconSvg, iconPictures, type Picture } from './icons.ts';
import { shareImage } from './share-image.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
/** The apps a person opens in a browser tab or keeps on a home screen. */
const WEB_APPS = ['landing', 'cabinet', 'miniapp'] as const;
/** The site's languages: one link preview each, named after its locale file. */
const siteLocales = readdirSync(`${root}apps/landing/src/locales`)
  .filter((file) => file.endsWith('.json'))
  .map((file) => file.replace(/\.json$/, ''));

const write = (file: string, content: string | Buffer) => {
  mkdirSync(dirname(`${root}${file}`), { recursive: true });
  writeFileSync(`${root}${file}`, content);
  console.log(`✓ ${file}`);
};

for (const app of WEB_APPS) {
  write(`apps/${app}/public/favicon.svg`, `${faviconSvg()}\n`);
}

const pictures: Picture[] = [...iconPictures(WEB_APPS), ...siteLocales.map(shareImage)];
const browser = await chromium.launch(browserLaunchOptions);
try {
  for (const picture of pictures) {
    const page = await browser.newPage({
      viewport: { width: picture.width, height: picture.height },
      deviceScaleFactor: 1,
    });
    await page.setContent(picture.html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    write(picture.file, await page.screenshot({ type: 'png' }));
    await page.close();
  }
} finally {
  await browser.close();
}
