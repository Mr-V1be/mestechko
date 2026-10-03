import { loader } from '../locales/ru.json';
import { WIDGET_MESSAGE_SOURCE } from '../embed/widget-messages';
import type { EmbedMode } from '../embed/embed-params';
import { frameUrl, type LoaderConfig } from './loader-config';
import { shadowStyles } from './shadow-styles';

const DARK_QUERY = '(prefers-color-scheme: dark)';

/** A host element with its own shadow root, styled and themed for the widget. */
export function shadowHost(config: LoaderConfig): { host: HTMLElement; root: ShadowRoot } {
  const host = document.createElement('div');
  host.className = 'mestechko-widget';
  const root = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = shadowStyles;
  root.append(style);
  const apply = () => {
    const dark =
      config.theme === 'dark' || (config.theme === 'auto' && window.matchMedia(DARK_QUERY).matches);
    host.dataset.theme = dark ? 'dark' : 'light';
  };
  apply();
  if (config.theme === 'auto') {
    window.matchMedia(DARK_QUERY).addEventListener('change', apply);
  }
  return { host, root };
}

function isWidgetMessage(data: unknown): data is Record<string, unknown> {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as Record<string, unknown>).source === WIDGET_MESSAGE_SOURCE
  );
}

/**
 * The widget's frame. An inline frame grows to its content; both kinds announce a
 * booking to the site as a `mestechko:booked` event on the document.
 */
export function createFrame(config: LoaderConfig, mode: EmbedMode): HTMLIFrameElement {
  const frame = document.createElement('iframe');
  frame.className = 'frame';
  frame.src = frameUrl(config, mode);
  frame.title = loader.title;
  frame.allow = 'payment';
  frame.referrerPolicy = 'strict-origin-when-cross-origin';
  window.addEventListener('message', (event: MessageEvent<unknown>) => {
    if (
      event.origin !== config.origin ||
      event.source !== frame.contentWindow ||
      !isWidgetMessage(event.data)
    ) {
      return;
    }
    const { type, height, status } = event.data;
    if (type === 'height' && mode === 'inline' && typeof height === 'number' && height > 0) {
      frame.style.height = `${String(Math.ceil(height))}px`;
    }
    if (type === 'booked') {
      document.dispatchEvent(
        new CustomEvent('mestechko:booked', { detail: { business: config.business, status } }),
      );
    }
  });
  return frame;
}
