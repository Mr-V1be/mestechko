import { createFrame, shadowHost } from './embed-frame';
import { loaderScript, readLoaderConfig } from './loader-config';
import { initialLoaderLocale } from './loader-texts';
import { mountPopup, type Popup } from './popup';

/**
 * The booking widget's embed script. A site adds it with its business:
 *
 *   <div data-slotwise-widget></div>
 *   <script src="https://…/widget.js" data-slotwise data-business="siren" async></script>
 *
 * Inline (default) renders the form in place; `data-mode="popup"` opens it in a dialog
 * from a floating button or any element with `data-slotwise-open`. `data-theme` is
 * `auto`, `light` or `dark`. The form lives in a frame, so the site's styles and the
 * widget's never mix.
 */
interface SlotwiseApi {
  readonly open: () => void;
  readonly close: () => void;
}

declare global {
  interface Window {
    Slotwise?: SlotwiseApi;
  }
}

function inlineTargets(target: string | null, script: HTMLScriptElement): HTMLElement[] {
  const marked = [...document.querySelectorAll<HTMLElement>(target ?? '[data-slotwise-widget]')];
  if (marked.length > 0) {
    return marked;
  }
  const placeholder = document.createElement('div');
  script.after(placeholder);
  return [placeholder];
}

function start(script: HTMLScriptElement): void {
  const config = readLoaderConfig(script);
  if (!config) {
    console.error('Slotwise widget: set data-business on the widget script tag.');
    return;
  }
  let popup: Popup | null = null;
  const ensurePopup = (): Popup => {
    popup ??= mountPopup({ ...config, launcher: config.mode === 'popup' && config.launcher });
    return popup;
  };
  if (config.mode === 'inline') {
    for (const target of inlineTargets(config.target, script)) {
      const { host, root } = shadowHost(config);
      root.append(createFrame(config, 'inline', initialLoaderLocale()));
      target.replaceChildren(host);
    }
  }
  // Popup buttons work in both modes; the dialog is created on the first press.
  if (config.mode === 'popup' || document.querySelector('[data-slotwise-open]')) {
    ensurePopup();
  }
  window.Slotwise = {
    open: () => {
      ensurePopup().open();
    },
    close: () => {
      popup?.close();
    },
  };
}

const script = loaderScript();
if (script) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      start(script);
    });
  } else {
    start(script);
  }
}
