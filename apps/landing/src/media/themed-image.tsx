import { clsx } from 'clsx';
import type { ThemedMedia } from './media';
import styles from './media.module.css';

export interface ThemedImageProps {
  readonly media: ThemedMedia;
  readonly alt: string;
  /** The first screen loads it at once; everything below waits until it is near. */
  readonly priority?: boolean;
  readonly className?: string | undefined;
}

/**
 * A product screen in the page's theme. Both variants are in the markup and the theme
 * hides one, so the page renders ahead of time and never swaps images after loading.
 */
export function ThemedImage({ media, alt, priority = false, className }: ThemedImageProps) {
  const shared = {
    width: media.width,
    height: media.height,
    loading: priority ? ('eager' as const) : ('lazy' as const),
    decoding: 'async' as const,
  };
  return (
    <>
      <img
        {...shared}
        src={media.light}
        alt={alt}
        className={clsx(styles.media, styles.lightOnly, className)}
        {...(priority ? { fetchPriority: 'high' as const } : {})}
      />
      <img
        {...shared}
        src={media.dark}
        alt={alt}
        className={clsx(styles.media, styles.darkOnly, className)}
      />
    </>
  );
}
