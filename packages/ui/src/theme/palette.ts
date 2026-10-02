/** Color tokens an external host (e.g. a messenger) may override at runtime. */
export const overridableColorTokens = [
  'canvas',
  'surface',
  'surface-sunken',
  'surface-hover',
  'border',
  'text',
  'text-secondary',
  'danger',
] as const;

export type OverridableColorToken = (typeof overridableColorTokens)[number];
export type ExternalPalette = Partial<Record<OverridableColorToken, string>>;

const HEX_COLOR = /^#([0-9a-f]{6})$/i;
const WCAG_TEXT_CONTRAST = 4.5;
const MIX_STEPS = 20;

function channels(hex: string): [number, number, number] | null {
  const match = HEX_COLOR.exec(hex);
  if (!match?.[1]) {
    return null;
  }
  const value = Number.parseInt(match[1], 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

function toHex([red, green, blue]: [number, number, number]): string {
  return `#${[red, green, blue].map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;
}

function luminance(rgb: [number, number, number]): number {
  const [red, green, blue] = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrastRatio(foreground: string, background: string): number | null {
  const fg = channels(foreground);
  const bg = channels(background);
  if (!fg || !bg) {
    return null;
  }
  const [light, dark] = [luminance(fg), luminance(bg)].sort((a, b) => b - a) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

export function isDarkColor(hex: string): boolean {
  const rgb = channels(hex);
  return rgb !== null && luminance(rgb) < 0.2;
}

/**
 * Moves a text color towards white or black until it reads on the background with
 * the WCAG AA ratio. Host palettes keep their hue but never become illegible.
 */
export function ensureContrast(
  foreground: string,
  background: string,
  ratio = WCAG_TEXT_CONTRAST,
): string {
  const fg = channels(foreground);
  const bg = channels(background);
  if (!fg || !bg) {
    return foreground;
  }
  const target: [number, number, number] = luminance(bg) < 0.5 ? [255, 255, 255] : [0, 0, 0];
  for (let step = 0; step <= MIX_STEPS; step += 1) {
    const share = step / MIX_STEPS;
    const mixed = fg.map(
      (channel, index) => channel + ((target[index] ?? channel) - channel) * share,
    ) as [number, number, number];
    const candidate = toHex(mixed);
    if ((contrastRatio(candidate, background) ?? 0) >= ratio) {
      return candidate;
    }
  }
  return toHex(target);
}

/** Applies host colors as CSS custom properties; tokens missing from the palette are reset. */
export function applyPalette(
  palette: ExternalPalette,
  root: HTMLElement = document.documentElement,
): void {
  for (const token of overridableColorTokens) {
    const value = palette[token];
    if (value) {
      root.style.setProperty(`--color-${token}`, value);
    } else {
      root.style.removeProperty(`--color-${token}`);
    }
  }
}
