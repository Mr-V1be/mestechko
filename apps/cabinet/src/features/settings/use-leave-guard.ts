import { useEffect } from 'react';
import { useBlocker } from 'react-router';

/**
 * Keeps unsaved changes from being lost on the way out: moving to another screen waits
 * for the person's answer, closing or reloading the tab asks through the browser.
 */
export function useLeaveGuard(active: boolean) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      active && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (!active) {
      return undefined;
    }
    const ask = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', ask);
    return () => {
      window.removeEventListener('beforeunload', ask);
    };
  }, [active]);
  return blocker;
}
