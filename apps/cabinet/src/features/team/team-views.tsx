import { apiAssetUrl } from '@mestechko/booking-ui';
import type { TeamMemberSummary } from '@mestechko/contracts/client';
import { Avatar, Badge, ListGroup, ListItem, Skeleton } from '@mestechko/ui';
import { clsx } from 'clsx';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { appConfig } from '../../app/config';
import { useAbsenceLabel } from './absence-label';
import styles from './team.module.css';

interface TeamViewProps {
  readonly title: ReactNode;
  readonly members: readonly TeamMemberSummary[];
  readonly today: string;
  readonly dimmed?: boolean;
}

function useMemberTexts(today: string) {
  const { t } = useTranslation('team');
  const absenceLabel = useAbsenceLabel();
  return (member: TeamMemberSummary) => ({
    avatar: apiAssetUrl(appConfig.apiBaseUrl, member.avatarUrl),
    services:
      member.serviceCount > 0 ? t('services', { count: member.serviceCount }) : t('noServices'),
    absence: member.nextAbsence ? absenceLabel(member.nextAbsence, today) : null,
  });
}

/** Tablets and desktops: a grid of people to scan by face and name. */
export function TeamCards({ title, members, today, dimmed = false }: TeamViewProps) {
  const texts = useMemberTexts(today);
  return (
    <section className={styles.group}>
      <h2 className={styles.groupTitle}>{title}</h2>
      <ul className={styles.cards}>
        {members.map((member) => {
          const text = texts(member);
          return (
            <li key={member.id}>
              <Link to={member.id} className={clsx(styles.card, dimmed && styles.dimmed)}>
                <span className={styles.cardAvatar}>
                  <Avatar name={member.displayName} src={text.avatar} size="lg" />
                </span>
                <span className={styles.cardText}>
                  <span className={styles.cardName}>{member.displayName}</span>
                  {member.title ? <span className={styles.cardTitle}>{member.title}</span> : null}
                  <span className={styles.cardMeta}>
                    <span>{text.services}</span>
                    {text.absence ? <Badge tone="accent">{text.absence}</Badge> : null}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Phones: one row per person. */
export function TeamRows({ title, members, today, dimmed = false }: TeamViewProps) {
  const texts = useMemberTexts(today);
  return (
    <ListGroup title={title}>
      {members.map((member) => {
        const text = texts(member);
        return (
          <ListItem
            key={member.id}
            render={<Link to={member.id} />}
            leading={
              <span className={clsx(dimmed && styles.faded)}>
                <Avatar name={member.displayName} src={text.avatar} />
              </span>
            }
            title={member.displayName}
            description={
              <>
                {[member.title, text.services].filter(Boolean).join(' · ')}
                {text.absence ? (
                  <span className={styles.rowBadge}>
                    <Badge tone="accent">{text.absence}</Badge>
                  </span>
                ) : null}
              </>
            }
            trailing={<ChevronRight />}
          />
        );
      })}
    </ListGroup>
  );
}

const SKELETON_PEOPLE = 6;

export function TeamSkeleton({ wide }: { readonly wide: boolean }) {
  return (
    <div className={styles.group} aria-busy="true">
      <Skeleton shape="text" width="var(--space-20)" />
      <div className={wide ? styles.cards : styles.skeletonRows}>
        {Array.from({ length: SKELETON_PEOPLE }, (_, index) => (
          <div key={index} className={wide ? styles.cardSkeleton : styles.rowSkeleton}>
            <Skeleton
              shape="circle"
              width={wide ? 'var(--size-avatar-lg)' : 'var(--size-avatar-md)'}
              height={wide ? 'var(--size-avatar-lg)' : 'var(--size-avatar-md)'}
            />
            <div className={styles.skeletonText}>
              <Skeleton shape="text" width="60%" />
              <Skeleton shape="text" width="40%" />
              {wide ? <Skeleton shape="text" width="30%" /> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
