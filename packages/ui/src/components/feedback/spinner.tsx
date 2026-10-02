import styles from './feedback.module.css';

/** Inline progress for short waits inside controls; larger areas use skeletons. */
export function Spinner() {
  return <span className={styles.spinner} aria-hidden="true" />;
}
