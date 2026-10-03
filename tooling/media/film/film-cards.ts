/**
 * The film's still layers, drawn in HTML with the product's own colours and typeface:
 * the opening and closing cards, and for each moment a background (words, device
 * shadow) and a bezel that goes over the recording, transparent where the screen is.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Browser } from 'playwright';
import { root } from '../../screenshots/scratch-stack.ts';
import type { FilmClip } from './film-recording.ts';
import {
  deviceBox,
  deviceIn,
  filmFormats,
  type Box,
  type DeviceLayout,
  type FilmFormat,
} from './film-layout.ts';
import { filmScript } from './film-script.ts';

export interface SceneLayers {
  readonly background: string;
  readonly bezel: string;
}

export interface FilmCards {
  readonly intro: string;
  readonly outro: string;
  readonly scenes: readonly SceneLayers[];
}

const FONT_DIR = join(root, 'packages/ui/node_modules/@fontsource-variable/nunito/files');
const fontRanges = {
  cyrillic: 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116',
  latin:
    'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2212',
} as const;

const fontFaces = Object.entries(fontRanges)
  .map(([subset, range]) => {
    const font = readFileSync(join(FONT_DIR, `nunito-${subset}-wght-normal.woff2`)).toString(
      'base64',
    );
    return `@font-face{font-family:'Nunito Variable';font-weight:200 1000;src:url(data:font/woff2;base64,${font}) format('woff2');unicode-range:${range};}`;
  })
  .join('');
const colors = readFileSync(join(root, 'packages/ui/src/styles/tokens/color.css'), 'utf8');
const brandMark = (size: number) =>
  `<svg width="${String(size)}" height="${String(size)}" viewBox="0 0 32 32"><rect x="2" y="4" width="28" height="24" rx="10" fill="#ff6a13"/><circle cx="22.5" cy="11" r="3.5" fill="#22242a"/></svg>`;

const px = (value: number) => `${String(value)}px`;
const place = (box: Box) =>
  `left:${px(box.x)};top:${px(box.y)};width:${px(box.width)};height:${px(box.height)}`;

const styles = `${fontFaces}${colors}
*{box-sizing:border-box;margin:0}
body{position:relative;overflow:hidden;font-family:'Nunito Variable',sans-serif;color:var(--color-text);background:transparent}
.bg{position:absolute;inset:0;background:radial-gradient(ellipse at 88% 0%,var(--color-accent-soft),transparent 58%),var(--color-canvas)}
.brand{position:absolute;display:flex;align-items:center;gap:14px;font-size:30px;font-weight:800}
.copy{position:absolute;display:flex;flex-direction:column;justify-content:center;gap:26px}
.copy.center{align-items:center;text-align:center}
.steps{display:flex;gap:10px}.steps i{width:40px;height:6px;border-radius:3px;background:var(--color-border)}.steps i.on{background:var(--color-accent)}
.who{color:var(--color-accent-text);font-size:28px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
.title{font-size:60px;font-weight:900;line-height:1.08;letter-spacing:-.02em;text-wrap:balance}
.text{color:var(--color-text-secondary);font-size:32px;line-height:1.4;text-wrap:pretty}
.shadow{position:absolute;background:var(--color-device);box-shadow:0 48px 96px rgb(20 22 28/.24),0 14px 28px rgb(20 22 28/.14)}
.bezel{position:absolute;border:solid var(--color-device)}
.base{position:absolute;border-radius:0 0 26px 26px;background:linear-gradient(#e3e5e9,#9da1aa)}
.card{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:34px;padding:0 140px;text-align:center}
.card .title{font-size:112px}.card .text{max-width:1180px;font-size:40px}
.card .footnote{margin-top:12px;font-size:34px;font-weight:800}`;

function page(format: FilmFormat, body: string): string {
  const { width, height } = filmFormats[format];
  return `<!doctype html><html data-theme="light"><head><meta charset="utf-8"><style>${styles}
body{width:${px(width)};height:${px(height)}}</style></head><body>${body}</body></html>`;
}

function deviceShape(device: DeviceLayout): { box: Box; radius: string } {
  // A laptop's lid is rounded on top only; a phone all round.
  const radius = device.base
    ? `${px(device.radius)} ${px(device.radius)} 8px 8px`
    : px(device.radius);
  return { box: deviceBox(device), radius };
}

function sceneBackground(format: FilmFormat, clip: FilmClip, index: number, total: number): string {
  const layout = filmFormats[format];
  const copy = filmScript.scenes[clip.id];
  const device = deviceIn(layout, clip.device);
  const shape = deviceShape(device);
  const steps = Array.from(
    { length: total },
    (_, step) => `<i class="${step === index ? 'on' : ''}"></i>`,
  ).join('');
  const brandAt =
    layout.align === 'center'
      ? `left:50%;top:64px;transform:translateX(-50%)`
      : `left:120px;top:72px`;
  return page(
    format,
    `<div class="bg"></div>
     <div class="brand" style="${brandAt}">${brandMark(40)}Местечко</div>
     <div class="copy ${layout.align}" style="${place(layout.copy)}">
       <div class="steps">${steps}</div>
       <div class="who">${copy.who}</div>
       <div class="title">${copy.title}</div>
       <div class="text">${copy.text}</div>
     </div>
     <div class="shadow" style="${place(shape.box)};border-radius:${shape.radius}"></div>
     ${device.base ? `<div class="base" style="${place(device.base)}"></div>` : ''}`,
  );
}

function sceneBezel(format: FilmFormat, clip: FilmClip): string {
  const device = deviceIn(filmFormats[format], clip.device);
  const shape = deviceShape(device);
  return page(
    format,
    `<div class="bezel" style="${place(shape.box)};border-width:${px(device.bezel)};border-radius:${shape.radius}"></div>`,
  );
}

function card(format: FilmFormat, title: string, text: string, footnote?: string): string {
  return page(
    format,
    `<div class="bg"></div><div class="card">${brandMark(150)}<div class="title">${title}</div>
     <div class="text">${text}</div>${footnote ? `<div class="footnote">${footnote}</div>` : ''}</div>`,
  );
}

/** Draws every still of one format into `directory`. */
export async function renderCards(
  browser: Browser,
  format: FilmFormat,
  clips: readonly FilmClip[],
  directory: string,
): Promise<FilmCards> {
  const { width, height } = filmFormats[format];
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const tab = await context.newPage();
  const draw = async (html: string, name: string, transparent = false) => {
    await tab.setContent(html);
    await tab.evaluate(() => document.fonts.ready);
    const file = join(directory, `${format}-${name}.png`);
    await tab.screenshot({ path: file, omitBackground: transparent });
    return file;
  };
  const { intro, outro } = filmScript;
  const scenes: SceneLayers[] = [];
  for (const [index, clip] of clips.entries()) {
    scenes.push({
      background: await draw(sceneBackground(format, clip, index, clips.length), `${clip.id}-bg`),
      bezel: await draw(sceneBezel(format, clip), `${clip.id}-bezel`, true),
    });
  }
  const cards: FilmCards = {
    intro: await draw(card(format, intro.title, intro.text), 'intro'),
    outro: await draw(card(format, outro.title, outro.text, outro.footnote), 'outro'),
    scenes,
  };
  await context.close();
  return cards;
}
