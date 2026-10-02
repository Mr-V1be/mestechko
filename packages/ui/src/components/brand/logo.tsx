import { clsx } from 'clsx';
import styles from './logo.module.css';

/** The brand mark: a soft seat with someone in it — "есть местечко". */
const tones = { brand: undefined, inverse: styles.inverse } as const;

export type LogoTone = keyof typeof tones;

export function LogoMark({
  className,
  tone = 'brand',
}: {
  readonly className?: string | undefined;
  readonly tone?: LogoTone;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={clsx(className ?? styles.mark, tones[tone])}
      aria-hidden="true"
    >
      <rect className={styles.seat} x="2" y="4" width="28" height="24" rx="10" />
      <circle className={styles.dot} cx="22.5" cy="11" r="3.5" />
    </svg>
  );
}

/** `inverse` is for accent-colored backgrounds. */
export function Logo({
  name,
  tone = 'brand',
}: {
  readonly name: string;
  readonly tone?: LogoTone;
}) {
  return (
    <span className={clsx(styles.logo, tones[tone])}>
      <LogoMark tone={tone} />
      <span className={styles.wordmark}>{name}</span>
    </span>
  );
}
