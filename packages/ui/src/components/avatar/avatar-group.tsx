import { Avatar } from './avatar';
import { Tooltip } from '../overlay/tooltip';
import styles from './avatar.module.css';

export interface AvatarGroupPerson {
  readonly id: string;
  readonly name: string;
  readonly src?: string | null;
}

export interface AvatarGroupProps {
  readonly people: readonly AvatarGroupPerson[];
  /** Faces shown before the rest are counted as «+N». */
  readonly max?: number;
  /** What the group stands for, e.g. «Выполняют: Анна, Мария»; also the hover hint. */
  readonly label: string;
}

const DEFAULT_MAX = 4;

/** A few people at a glance: overlapping small avatars and a count of the rest. */
export function AvatarGroup({ people, max = DEFAULT_MAX, label }: AvatarGroupProps) {
  const shown = people.length > max ? people.slice(0, max - 1) : people;
  const rest = people.length - shown.length;
  return (
    <Tooltip label={label}>
      <span className={styles.group} role="img" aria-label={label}>
        {shown.map((person) => (
          <span key={person.id} className={styles.groupMember} aria-hidden="true">
            <Avatar name={person.name} src={person.src ?? null} size="sm" />
          </span>
        ))}
        {rest > 0 ? (
          <span className={styles.groupRest} aria-hidden="true">
            +{rest}
          </span>
        ) : null}
      </span>
    </Tooltip>
  );
}
