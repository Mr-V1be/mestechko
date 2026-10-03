/** Marks messages from the widget among everything else the embedding page receives. */
export const WIDGET_MESSAGE_SOURCE = 'mestechko-widget';

/** What the widget tells the embedding page; never personal data. */
export type WidgetMessage =
  | { readonly type: 'height'; readonly height: number }
  | { readonly type: 'booked'; readonly status: 'confirmed' | 'held' };
