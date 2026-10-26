import { clsx } from 'clsx';
import { markArtwork, wordmarkArtwork } from './artwork';
import styles from './logo.module.css';

const tones = { brand: undefined, inverse: styles.inverse } as const;

export type LogoTone = keyof typeof tones;

interface ArtworkProps {
  readonly className?: string | undefined;
  readonly tone?: LogoTone;
}

/** The brand mark alone: a picked slot. Decorative; the surrounding control names it. */
export function LogoMark({ className, tone = 'brand' }: ArtworkProps) {
  const { slot, dot } = markArtwork;
  return (
    <svg
      viewBox={markArtwork.viewBox}
      className={clsx(className ?? styles.mark, tones[tone])}
      aria-hidden="true"
    >
      <rect className={styles.slot} {...slot} />
      <circle className={styles.dot} {...dot} />
    </svg>
  );
}

/** The wordmark alone, as tall as text of its font size. Decorative. */
export function Wordmark({ className, tone = 'brand' }: ArtworkProps) {
  return (
    <svg
      viewBox={wordmarkArtwork.viewBox}
      className={clsx(className ?? styles.wordmark, tones[tone])}
      aria-hidden="true"
    >
      <path className={styles.letters} d={wordmarkArtwork.letters} />
      <circle className={styles.tittle} {...wordmarkArtwork.tittle} />
    </svg>
  );
}

/**
 * The mark and the wordmark together. `name` is the product's name as assistive technology
 * reads it; `inverse` is for accent-colored backgrounds.
 */
export function Logo({
  name,
  tone = 'brand',
}: {
  readonly name: string;
  readonly tone?: LogoTone;
}) {
  return (
    <span className={clsx(styles.logo, tones[tone])} role="img" aria-label={name}>
      <LogoMark tone={tone} />
      <Wordmark tone={tone} />
    </span>
  );
}
