import { useEffect } from 'react';

/** Marks messages from the widget among everything else the embedding page receives. */
export const WIDGET_MESSAGE_SOURCE = 'mestechko-widget';

export type WidgetMessage =
  | { readonly source: typeof WIDGET_MESSAGE_SOURCE; readonly type: 'height'; readonly height: number }
  | {
      readonly source: typeof WIDGET_MESSAGE_SOURCE;
      readonly type: 'booked';
      readonly status: 'confirmed' | 'held';
    };

type Payload = WidgetMessage extends infer M ? (M extends WidgetMessage ? Omit<M, 'source'> : never) : never;

/**
 * Tells the embedding page about the widget. Messages carry no personal data, so they
 * go to whichever page embeds the widget.
 */
export function postToHost(message: Payload): void {
  if (window.parent !== window) {
    window.parent.postMessage({ source: WIDGET_MESSAGE_SOURCE, ...message }, '*');
  }
}

/** Keeps an inline frame as tall as its content, so the page scrolls, not the widget. */
export function useAutoHeight(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    const root = document.documentElement;
    let last = 0;
    const report = () => {
      const height = Math.ceil(root.getBoundingClientRect().height);
      if (height !== last) {
        last = height;
        postToHost({ type: 'height', height });
      }
    };
    const observer = new ResizeObserver(report);
    observer.observe(root);
    report();
    return () => {
      observer.disconnect();
    };
  }, [enabled]);
}
