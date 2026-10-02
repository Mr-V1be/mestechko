import styles from './illustration.module.css';

/*
 * Line illustrations of the brand: a calendar of soft "seats". Colors come from tokens,
 * so they follow the light, dark and messenger themes.
 */

const SEATS = [
  [38, 64],
  [70, 64],
  [102, 64],
  [38, 94],
  [70, 94],
  [102, 94],
] as const;

function CalendarSheet() {
  return (
    <>
      <rect className={styles.paper} x="22" y="30" width="116" height="104" rx="22" />
      <path className={styles.line} d="M22 52h116" />
      <path className={styles.line} d="M52 22v16M108 22v16" />
    </>
  );
}

/** A calendar with one taken seat: the brand moment, used for welcome screens. */
export function SpotIllustration() {
  return (
    <svg viewBox="0 0 160 160" className={styles.svg} aria-hidden="true">
      <CalendarSheet />
      {SEATS.map(([x, y], index) =>
        index === 4 ? (
          <g key={`${String(x)}-${String(y)}`}>
            <rect className={styles.accent} x={x - 2} y={y - 2} width="24" height="20" rx="8" />
            <circle className={styles.inkOnAccent} cx={x + 10} cy={y + 6} r="3.5" />
          </g>
        ) : (
          <rect
            key={`${String(x)}-${String(y)}`}
            className={styles.muted}
            x={x}
            y={y}
            width="20"
            height="16"
            rx="7"
          />
        ),
      )}
    </svg>
  );
}

/** Nothing here yet: every seat is free and outlined. */
export function EmptyIllustration() {
  return (
    <svg viewBox="0 0 160 160" className={styles.svg} aria-hidden="true">
      <CalendarSheet />
      {SEATS.map(([x, y]) => (
        <rect
          key={`${String(x)}-${String(y)}`}
          className={styles.dashed}
          x={x}
          y={y}
          width="20"
          height="16"
          rx="7"
        />
      ))}
    </svg>
  );
}

/** Lost connection: an unplugged cable. */
export function ErrorIllustration() {
  return (
    <svg viewBox="0 0 160 160" className={styles.svg} aria-hidden="true">
      <path className={styles.line} d="M14 112c18 0 22-14 36-14" />
      <rect className={styles.paper} x="50" y="86" width="26" height="24" rx="8" />
      <path className={styles.line} d="M76 92h8M76 104h8" />
      <rect className={styles.accent} x="94" y="62" width="28" height="26" rx="9" />
      <path className={styles.line} d="M122 75c14 0 16-12 28-12" />
      <path className={styles.line} d="M88 50l-6-10M100 46l2-12M76 58l-11-5" />
    </svg>
  );
}

/** No access: a locked seat. */
export function LockedIllustration() {
  return (
    <svg viewBox="0 0 160 160" className={styles.svg} aria-hidden="true">
      <path className={styles.line} d="M58 70V54a22 22 0 0 1 44 0v16" />
      <rect className={styles.accent} x="42" y="68" width="76" height="62" rx="20" />
      <circle className={styles.inkOnAccent} cx="80" cy="94" r="7" />
      <rect className={styles.inkOnAccent} x="77" y="96" width="6" height="16" rx="3" />
    </svg>
  );
}

const CONFETTI = [
  { x: 26, y: 40, r: 5 },
  { x: 132, y: 34, r: 4 },
  { x: 140, y: 96, r: 6 },
  { x: 18, y: 100, r: 4 },
  { x: 48, y: 18, r: 3 },
  { x: 112, y: 14, r: 3 },
] as const;

/** Booking confirmed: the dot hops into its seat. */
export function CelebrationIllustration() {
  return (
    <svg viewBox="0 0 160 160" className={styles.svg} aria-hidden="true">
      <g>
        {CONFETTI.map(({ x, y, r }, index) => (
          <circle
            key={`${String(x)}-${String(y)}`}
            className={
              index % 2 === 0 ? `${styles.accent} ${styles.burst}` : `${styles.ink} ${styles.burst}`
            }
            cx={x}
            cy={y}
            r={r}
          />
        ))}
        <path
          className={`${styles.line} ${styles.burst}`}
          d="M30 70l-12-4M130 66l13-6M44 130l-9 9M118 130l10 8"
        />
      </g>
      <rect className={styles.accent} x="36" y="62" width="88" height="70" rx="28" />
      <g className={styles.hop}>
        <circle className={styles.inkOnAccent} cx="102" cy="84" r="10" />
      </g>
    </svg>
  );
}
