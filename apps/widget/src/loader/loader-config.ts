import { embedModes, embedThemes, type EmbedMode, type EmbedTheme } from '../embed/embed-params';

/** What the site owner put on the script tag. */
export interface LoaderConfig {
  readonly business: string;
  readonly theme: EmbedTheme;
  readonly mode: EmbedMode;
  /** Where an inline widget goes: a CSS selector; by default next to the script. */
  readonly target: string | null;
  /** The floating button of a popup widget; `false` when the site has its own buttons. */
  readonly launcher: boolean;
  /** The widget's own origin, from the script's address. */
  readonly origin: string;
}

function oneOf<T extends string>(values: readonly T[], value: string | undefined, fallback: T): T {
  return values.find((candidate) => candidate === value) ?? fallback;
}

/** The script tag that loaded the widget: the running one, or the marked one. */
export function loaderScript(): HTMLScriptElement | null {
  const current = document.currentScript;
  return current instanceof HTMLScriptElement
    ? current
    : document.querySelector<HTMLScriptElement>('script[data-mestechko]');
}

export function readLoaderConfig(script: HTMLScriptElement): LoaderConfig | null {
  const business = script.dataset.business?.trim();
  if (!business) {
    return null;
  }
  return {
    business,
    theme: oneOf(embedThemes, script.dataset.theme, 'auto'),
    mode: oneOf(embedModes, script.dataset.mode, 'inline'),
    target: script.dataset.target ?? null,
    launcher: script.dataset.launcher !== 'none',
    origin: new URL(script.src, window.location.href).origin,
  };
}

/** The widget page for a frame of this config. */
export function frameUrl(config: LoaderConfig, mode: EmbedMode): string {
  const query = new URLSearchParams({ business: config.business, theme: config.theme, mode });
  return `${config.origin}/embed.html?${query.toString()}`;
}
