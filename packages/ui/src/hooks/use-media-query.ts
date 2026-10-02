import { useSyncExternalStore } from 'react';

/** Breakpoints of the layout grid, matching the media queries in component styles. */
export const breakpoints = {
  tablet: '(min-width: 768px)',
  desktop: '(min-width: 1024px)',
} as const;

/** Whether a media query matches, kept in sync as the window changes. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => {
        list.removeEventListener('change', onChange);
      };
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
