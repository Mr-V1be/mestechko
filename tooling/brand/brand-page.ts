/**
 * What a still drawn in HTML needs to look like the product: its typeface, embedded so the
 * page renders offline and at once, and its color tokens for both themes.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const FONT_DIR = `${root}packages/ui/node_modules/@fontsource-variable/nunito/files`;
const fontRanges = {
  cyrillic: 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116',
  latin:
    'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2212',
} as const;

/** `@font-face` rules of the product's typeface, as `'Nunito Variable'`. */
export const productFontFaces = Object.entries(fontRanges)
  .map(([subset, range]) => {
    const font = readFileSync(`${FONT_DIR}/nunito-${subset}-wght-normal.woff2`).toString('base64');
    return `@font-face{font-family:'Nunito Variable';font-weight:200 1000;src:url(data:font/woff2;base64,${font}) format('woff2');unicode-range:${range};}`;
  })
  .join('');

/** The design system's color tokens; `data-theme` on the root picks light or dark. */
export const colorTokens = readFileSync(`${root}packages/ui/src/styles/tokens/color.css`, 'utf8');

/** A color token's value in the light palette, for files that cannot carry CSS variables. */
export function lightColor(token: string): string {
  const light = colorTokens.slice(0, colorTokens.indexOf("[data-theme='dark']"));
  const value = new RegExp(`--${token}:\\s*([^;]+);`).exec(light)?.[1];
  if (!value) {
    throw new Error(`No light value for --${token}`);
  }
  return value.trim();
}

/** A page of the given size in the light theme, with the product's typeface and tokens. */
export function brandPage(width: number, height: number, style: string, body: string): string {
  return `<!doctype html><html data-theme="light"><head><meta charset="utf-8"><style>${productFontFaces}${colorTokens}
*{box-sizing:border-box;margin:0}
body{width:${String(width)}px;height:${String(height)}px;overflow:hidden;font-family:'Nunito Variable',sans-serif;color:var(--color-text)}
${style}</style></head><body>${body}</body></html>`;
}
