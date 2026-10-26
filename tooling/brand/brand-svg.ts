/**
 * The brand's artwork as SVG markup, for stills drawn outside the apps: film cards, icons
 * and share images. The geometry is the design system's own; colors are CSS values, so a
 * page that carries the color tokens can pass `var(--color-accent)`.
 */
import { markArtwork, wordmarkArtwork } from '../../packages/ui/src/components/brand/artwork.ts';

export interface MarkColors {
  readonly slot: string;
  readonly dot: string;
}

export interface WordmarkColors {
  readonly letters: string;
  readonly tittle: string;
}

/** The brand's colors on a light or dark page, by token. */
export const brandColors = {
  mark: { slot: 'var(--color-accent)', dot: 'var(--color-on-accent)' },
  wordmark: { letters: 'var(--color-text)', tittle: 'var(--color-accent)' },
} as const satisfies { mark: MarkColors; wordmark: WordmarkColors };

/** CSS variables only work in a style; a plain color stays an attribute any viewer reads. */
const fill = (color: string) =>
  color.startsWith('var(') ? `style="fill:${color}"` : `fill="${color}"`;

/** The mark, `size` pixels square. */
export function markSvg(size: number, colors: MarkColors = brandColors.mark): string {
  const { slot, dot } = markArtwork;
  return `<svg width="${String(size)}" height="${String(size)}" viewBox="${markArtwork.viewBox}" aria-hidden="true"><rect x="${String(slot.x)}" y="${String(slot.y)}" width="${String(slot.width)}" height="${String(slot.height)}" rx="${String(slot.rx)}" ${fill(colors.slot)}/><circle cx="${String(dot.cx)}" cy="${String(dot.cy)}" r="${String(dot.r)}" ${fill(colors.dot)}/></svg>`;
}

/** The wordmark, `height` pixels tall. */
export function wordmarkSvg(height: number, colors: WordmarkColors = brandColors.wordmark): string {
  const { tittle } = wordmarkArtwork;
  const width = Math.round(height * wordmarkArtwork.aspectRatio);
  return `<svg width="${String(width)}" height="${String(height)}" viewBox="${wordmarkArtwork.viewBox}" aria-hidden="true"><path d="${wordmarkArtwork.letters}" ${fill(colors.letters)}/><circle cx="${String(tittle.cx)}" cy="${String(tittle.cy)}" r="${String(tittle.r)}" ${fill(colors.tittle)}/></svg>`;
}

/** The wordmark as tall as the letters of text `fontSize` pixels high. */
export function wordmarkAsText(
  fontSize: number,
  colors: WordmarkColors = brandColors.wordmark,
): string {
  return wordmarkSvg(Math.round(fontSize * wordmarkArtwork.emHeight), colors);
}

/**
 * The mark and the wordmark side by side, as the apps show them: the wordmark is as tall
 * as the letters of text `fontSize` pixels high, the mark a little taller than that text.
 */
export function lockupSvg(fontSize: number, gap = Math.round(fontSize * 0.45)): string {
  const markSize = Math.round(fontSize * 1.35);
  return `<span style="display:inline-flex;align-items:center;gap:${String(gap)}px">${markSvg(markSize)}${wordmarkAsText(fontSize)}</span>`;
}
