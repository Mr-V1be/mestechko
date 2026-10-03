import { useTheme } from '@mestechko/ui';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { Loop } from './media';
import { ThemedImage } from './themed-image';
import styles from './media.module.css';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
const noSubscription = () => () => undefined;

/** `true` once the page runs in the browser; the prerendered page shows posters. */
function useInBrowser(): boolean {
  return useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
}

/**
 * A short silent loop of the product, in the page's theme. It plays only while on
 * screen and never when the visitor asked for less motion: then the poster stays.
 */
export function LoopVideo({ loop, label }: { readonly loop: Loop; readonly label: string }) {
  const { theme } = useTheme();
  const inBrowser = useInBrowser();
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const element = video.current;
    if (!element || window.matchMedia(REDUCED_MOTION).matches) {
      return undefined;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        void element.play().catch(() => undefined);
      } else {
        element.pause();
      }
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [theme, inBrowser]);

  if (!inBrowser) {
    return <ThemedImage media={loop.poster} alt={label} />;
  }
  return (
    <video
      key={theme}
      ref={video}
      className={styles.media}
      src={loop.video[theme]}
      poster={loop.poster[theme]}
      width={loop.video.width}
      height={loop.video.height}
      muted
      loop
      playsInline
      preload="none"
      aria-label={label}
    />
  );
}
