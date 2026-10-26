import { useVocabulary } from '@slotwise/booking-ui';
import { Button, EmptyIllustration, StatePanel, breakpoints, useMediaQuery } from '@slotwise/ui';
import { UserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import { useOverview } from '../../platform/api/queries';
import { useTeam } from '../../platform/api/team-queries';
import { canOpen, useActiveMembership } from '../../platform/session/active-business';
import { useSession } from '../../platform/session/session-context';
import { PageContainer, PageHeader } from '../common/page-header';
import { NoAccessState, QueryErrorState } from '../common/states';
import { todayIn } from '../schedule/timeline-model';
import { AddMemberDialog } from './profile-dialog';
import { TeamCards, TeamRows, TeamSkeleton } from './team-views';
import { useFormSheet } from './use-form-sheet';
import styles from './team.module.css';

/** Everyone who works in the business: who takes bookings, what they do, who is away. */
export function TeamPage() {
  const { t } = useTranslation('team');
  const { businessId = '' } = useParams();
  const navigate = useNavigate();
  const membership = useActiveMembership(useSession());
  const allowed = membership !== null && canOpen(membership, 'team');
  const wide = useMediaQuery(breakpoints.tablet);
  const team = useTeam(businessId, allowed);
  const overview = useOverview(businessId);
  const vocabulary = useVocabulary(overview.data?.business.vertical);
  const adding = useFormSheet();

  if (!allowed) {
    return (
      <PageContainer>
        <NoAccessState />
      </PageContainer>
    );
  }
  const today = todayIn(overview.data?.locations[0]?.timeZone ?? 'UTC');
  const members = team.data?.members ?? [];
  const active = members.filter((member) => member.isActive);
  const inactive = members.filter((member) => !member.isActive);
  const View = wide ? TeamCards : TeamRows;
  const addButton = (
    <Button icon={<UserPlus />} onClick={adding.show}>
      {t('add')}
    </Button>
  );

  return (
    <PageContainer>
      <PageHeader
        title={t('title')}
        actions={team.isPending || members.length > 0 ? addButton : undefined}
      />
      {team.isError ? (
        <QueryErrorState error={team.error} onRetry={() => void team.refetch()} />
      ) : null}
      {team.isPending ? <TeamSkeleton wide={wide} /> : null}
      {team.data && members.length === 0 ? (
        <StatePanel
          illustration={<EmptyIllustration />}
          title={t('empty.title')}
          description={t('empty.description')}
          action={addButton}
        />
      ) : null}
      {members.length > 0 ? (
        <div className={styles.groups}>
          {active.length > 0 ? (
            <View title={vocabulary.staffMany} members={active} today={today} />
          ) : null}
          {inactive.length > 0 ? (
            <View title={t('inactiveGroup')} members={inactive} today={today} dimmed />
          ) : null}
        </div>
      ) : null}
      <AddMemberDialog
        key={adding.key}
        businessId={businessId}
        open={adding.open}
        onOpenChange={adding.setOpen}
        onCreated={(member) => {
          adding.done();
          void navigate(member.id);
        }}
      />
    </PageContainer>
  );
}
