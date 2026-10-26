/**
 * The brand's icons: the browser tab icon (vector, so it is a file of its own), the home
 * screen icon and the pictures BotFather asks for. Each is the mark, on the accent where
 * the platform shows a full-bleed square or circle.
 */
import { brandPage, lightColor } from './brand-page.ts';
import { markSvg, wordmarkAsText } from './brand-svg.ts';

export interface Picture {
  /** Where it goes, relative to the repository. */
  readonly file: string;
  readonly width: number;
  readonly height: number;
  readonly html: string;
}

/** The mark on the accent, as an app icon shows it: ink slot, accent dot. */
const inverseMark = { slot: 'var(--color-on-accent)', dot: 'var(--color-accent)' } as const;
const inverseWordmark = { letters: 'var(--color-on-accent)', tittle: 'var(--color-on-accent)' };

const onAccent = (width: number, height: number, body: string) =>
  brandPage(
    width,
    height,
    'body{display:grid;place-items:center;background:var(--color-accent)}',
    body,
  );

/** The tab icon of every web app: the mark itself, in the light palette's colors. */
export function faviconSvg(): string {
  return markSvg(32, {
    slot: lightColor('color-accent'),
    dot: lightColor('color-on-accent'),
  })
    .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')
    .replace(' width="32" height="32"', '')
    .replace(' aria-hidden="true"', '');
}

/** Raster pictures of the brand: `apps` get a home screen icon, `docs/brand` the bot's. */
export function iconPictures(apps: readonly string[]): Picture[] {
  const touch = (app: string): Picture => ({
    file: `apps/${app}/public/apple-touch-icon.png`,
    width: 180,
    height: 180,
    html: onAccent(180, 180, markSvg(112, inverseMark)),
  });
  return [
    ...apps.map(touch),
    {
      // Telegram crops the avatar to a circle: the mark keeps clear of the edge.
      file: 'docs/brand/telegram-bot-avatar.png',
      width: 640,
      height: 640,
      html: onAccent(640, 640, markSvg(352, inverseMark)),
    },
    {
      // BotFather's picture of the Mini App, shown when the app is shared.
      file: 'docs/brand/telegram-miniapp-cover.png',
      width: 640,
      height: 360,
      html: onAccent(
        640,
        360,
        `<span style="display:inline-flex;align-items:center;gap:22px">${markSvg(96, inverseMark)}${wordmarkAsText(76, inverseWordmark)}</span>`,
      ),
    },
  ];
}
