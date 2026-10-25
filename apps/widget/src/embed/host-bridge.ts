import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { messageLocale } from './widget-messages';
import { WIDGET_MESSAGE_SOURCE, type WidgetMessage } from './widget-messages';

/**
 * Tells the embedding page about the widget. Messages carry no personal data, so they
 * go to whichever page embeds the widget.
 */
export function postToHost(message: WidgetMessage): void {
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

/** Tells the embedding page the widget's language, now and whenever the visitor switches. */
export function useLocaleToHost(): void {
  const { i18n } = useTranslation();
  const locale = messageLocale(i18n.language);
  useEffect(() => {
    if (locale) {
      postToHost({ type: 'locale', locale });
    }
  }, [locale]);
}
