import type { Locale } from '@slotwise/domain';
import { createFrame, shadowHost } from './embed-frame';
import type { LoaderConfig } from './loader-config';
import { initialLoaderLocale, loaderTextsOf } from './loader-texts';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Lucide's «x», drawn without a framework. */
function closeIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  for (const [name, value] of Object.entries({
    viewBox: '0 0 24 24',
    width: '20',
    height: '20',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '2',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
  })) {
    svg.setAttribute(name, value);
  }
  for (const d of ['M18 6 6 18', 'm6 6 12 12']) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}

export interface Popup {
  readonly open: () => void;
  readonly close: () => void;
}

/**
 * The widget in a dialog over the site: a floating button (unless the site has its own
 * buttons with `data-slotwise-open`), closed by the cross, Escape or the backdrop.
 */
export function mountPopup(config: LoaderConfig): Popup {
  const locale = initialLoaderLocale();
  const { host, root } = shadowHost(config);
  host.dataset.launcher = '';
  const backdrop = document.createElement('div');
  backdrop.className = 'backdrop';
  backdrop.hidden = true;
  const dialog = document.createElement('div');
  dialog.className = 'dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'close';
  closeButton.append(closeIcon());
  dialog.append(closeButton);
  backdrop.append(dialog);
  root.append(backdrop);

  const launcher = config.launcher ? document.createElement('button') : null;
  /** The script's own words, in the language the widget speaks. */
  const label = (current: Locale) => {
    const texts = loaderTextsOf(current);
    dialog.setAttribute('aria-label', texts.title);
    closeButton.setAttribute('aria-label', texts.close);
    if (launcher) {
      launcher.textContent = texts.open;
    }
  };
  label(locale);

  let frame: HTMLIFrameElement | null = null;
  let returnFocus: HTMLElement | null = null;
  const close = () => {
    backdrop.hidden = true;
    document.documentElement.style.removeProperty('overflow');
    returnFocus?.focus();
  };
  const open = () => {
    // The frame loads on first use, so a page with the widget stays light.
    if (!frame) {
      frame = createFrame(config, 'popup', locale, label);
      dialog.append(frame);
    }
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    backdrop.hidden = false;
    document.documentElement.style.setProperty('overflow', 'hidden');
    closeButton.focus();
  };
  closeButton.addEventListener('click', close);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) {
      close();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !backdrop.hidden) {
      close();
    }
  });
  if (launcher) {
    launcher.type = 'button';
    launcher.className = 'launcher';
    launcher.addEventListener('click', open);
    root.append(launcher);
  }
  document.addEventListener('click', (event) => {
    const trigger =
      event.target instanceof Element ? event.target.closest('[data-slotwise-open]') : null;
    if (trigger) {
      event.preventDefault();
      open();
    }
  });
  document.body.append(host);
  return { open, close };
}
