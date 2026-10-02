import { clsx } from 'clsx';
import type { ReactNode } from 'react';
import styles from './list.module.css';

export interface ListGroupProps {
  readonly title?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string | undefined;
}

/** A titled group of rows on one surface, like grouped lists in messengers. */
export function ListGroup({ title, children, className }: ListGroupProps) {
  return (
    <section className={clsx(styles.group, className)}>
      {title ? <h2 className={styles.groupTitle}>{title}</h2> : null}
      <ul className={styles.list}>{children}</ul>
    </section>
  );
}

interface RowContent {
  readonly leading?: ReactNode;
  readonly title: ReactNode;
  readonly description?: ReactNode;
  /** Short value aligned to the end, e.g. a price. */
  readonly meta?: ReactNode;
  readonly trailing?: ReactNode;
}

export interface ListItemProps extends RowContent {
  readonly onClick?: () => void;
  /** Wraps the row in a label for this control id, e.g. a checkbox in `trailing`. */
  readonly controlId?: string;
  readonly selected?: boolean;
  readonly disabled?: boolean;
}

function Content({ leading, title, description, meta, trailing }: RowContent) {
  return (
    <>
      {leading ? <span className={styles.leading}>{leading}</span> : null}
      <span className={styles.body}>
        <span className={styles.title}>{title}</span>
        {description ? <span className={styles.description}>{description}</span> : null}
      </span>
      {meta ? <span className={styles.meta}>{meta}</span> : null}
      {trailing ? <span className={styles.trailing}>{trailing}</span> : null}
    </>
  );
}

export function ListItem({
  onClick,
  controlId,
  selected = false,
  disabled = false,
  ...content
}: ListItemProps) {
  const rowClass = clsx(
    styles.row,
    (onClick ?? controlId) && !disabled && styles.interactive,
    selected && styles.selected,
    disabled && styles.disabled,
  );
  return (
    <li className={styles.item}>
      {onClick ? (
        <button
          type="button"
          className={rowClass}
          onClick={onClick}
          disabled={disabled}
          aria-current={selected || undefined}
        >
          <Content {...content} />
        </button>
      ) : controlId ? (
        <label htmlFor={controlId} className={rowClass}>
          <Content {...content} />
        </label>
      ) : (
        <div className={rowClass}>
          <Content {...content} />
        </div>
      )}
    </li>
  );
}
