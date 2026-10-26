import { isLocale, type Locale } from '@slotwise/domain';

/** Marks messages from the widget among everything else the embedding page receives. */
export const WIDGET_MESSAGE_SOURCE = 'mestechko-widget';

/** What the widget tells the embedding page; never personal data. */
export type WidgetMessage =
  | { readonly type: 'height'; readonly height: number }
  | { readonly type: 'booked'; readonly status: 'confirmed' | 'held' }
  /** The language the widget speaks, so the embed script's own words follow it. */
  | { readonly type: 'locale'; readonly locale: Locale };

/** A language named in a message from the frame, when it is one the widget speaks. */
export function messageLocale(value: unknown): Locale | null {
  return isLocale(value) ? value : null;
}
