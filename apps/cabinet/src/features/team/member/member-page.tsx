import { Button, EmptyIllustration, Skeleton, StatePanel } from '@mestechko/ui';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import { useOverview } from '../../../platform/api/queries';
import { useTeamMember } from '../../../platform/api/team-queries';
import { canOpen, useActiveMembership } from '../../../platform/session/active-business';
import { useSession } from '../../../platform/session/session-context';
import { isNotFound } from '../../common/error-message';
import { PageContainer } from '../../common/page-header';
import { NoAccessState, QueryErrorState } from '../../common/states';
import { todayIn } from '../../schedule/timeline-model';
import { AbsencesSection } from '../schedule/absences-section';
import { ExceptionsSection } from '../schedule/exceptions-section';
import { draftFrom } from '../schedule/pattern-model';
import { PatternSheet } from '../schedule/pattern-sheet';
import { ScheduleSection } from '../schedule/schedule-section';
import { useFormSheet } from '../use-form-sheet';
import { BackLink, MemberHeader } from './member-header';
import { ServicesSection } from './services-section';
import styles from './member.module.css';

function MemberSkeleton() {
  return (
    <div className={styles.skeletonPage} aria-busy="true">
      <div className={styles.identity}>
        <Skeleton shape="circle" width="var(--size-avatar-xl)" height="var(--size-avatar-xl)" />
        <div className={styles.identityText}>
          <Skeleton shape="text" width="60%" height="var(--font-size-2xl)" />
          <Skeleton shape="text" width="40%" />
        </div>
      </div>
      <div className={styles.layout}>
        <div className={styles.main}>
          {[3, 1, 1].map((rows, index) => (
            <div key={index} className={styles.section}>
              <Skeleton shape="text" width="var(--size-illustration-sm)" />
              <Skeleton height={`calc(var(--size-day-min) * ${String(rows + 1)})`} />
            </div>
          ))}
        </div>
        <div className={styles.aside}>
          <div className={styles.section}>
            <Skeleton shape="text" width="var(--size-illustration-sm)" />
            <Skeleton height="calc(var(--size-control-lg) * 3)" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** One person: profile, services and working time, every change checked against bookings. */
export function MemberPage() {
  const { t } = useTranslation('team');
  const { businessId = '', staffId = '' } = useParams();
  const navigate = useNavigate();
  const membership = useActiveMembership(useSession());
  const allowed = membership !== null && canOpen(membership, 'team');
  const member = useTeamMember(businessId, staffId, allowed);
  const overview = useOverview(businessId);
  const editor = useFormSheet();

  if (!allowed) {
    return (
      <PageContainer>
        <NoAccessState />
      </PageContainer>
    );
  }
  if (member.isError && isNotFound(member.error)) {
    return (
      <PageContainer>
        <BackLink businessId={businessId} />
        <StatePanel
          illustration={<EmptyIllustration />}
          title={t('member.notFoundTitle')}
          description={t('member.notFoundDescription')}
          action={
            <Button
              variant="secondary"
              onClick={() => {
                void navigate(`/b/${businessId}/team`);
              }}
            >
              {t('member.toTeam')}
            </Button>
          }
        />
      </PageContainer>
    );
  }
  const failed = member.isError ? member.error : overview.isError ? overview.error : null;
  if (failed) {
    return (
      <PageContainer>
        <BackLink businessId={businessId} />
        <QueryErrorState
          error={failed}
          onRetry={() => {
            void member.refetch();
            void overview.refetch();
          }}
        />
      </PageContainer>
    );
  }
  if (!member.data || !overview.data) {
    return (
      <PageContainer>
        <BackLink businessId={businessId} />
        <MemberSkeleton />
      </PageContainer>
    );
  }

  const person = member.data;
  const { locations } = overview.data;
  const today = todayIn(locations[0]?.timeZone ?? 'UTC');
  const latest = person.assignments.at(-1);
  const homeLocationId = latest?.locationId ?? locations[0]?.id ?? '';

  return (
    <PageContainer>
      <div className={styles.page}>
        <MemberHeader businessId={businessId} member={person} today={today} />
        <div className={styles.layout}>
          <div className={styles.main}>
            <ScheduleSection
              assignments={person.assignments}
              locations={locations}
              today={today}
              onEdit={editor.show}
            />
            <ExceptionsSection
              businessId={businessId}
              staffId={person.id}
              exceptions={person.exceptions}
              locations={locations}
              defaultLocationId={homeLocationId}
              defaultHours={latest?.pattern.days.find((day) => day !== null) ?? null}
              today={today}
            />
            <AbsencesSection
              businessId={businessId}
              staffId={person.id}
              absences={person.absences}
              today={today}
            />
          </div>
          <div className={styles.aside}>
            <ServicesSection businessId={businessId} member={person} />
          </div>
        </div>
      </div>
      <PatternSheet
        key={editor.key}
        businessId={businessId}
        staffId={person.id}
        open={editor.open}
        onOpenChange={editor.setOpen}
        initialDraft={draftFrom(latest, today, homeLocationId)}
        first={latest === undefined}
        locations={locations}
        today={today}
        onSaved={editor.done}
      />
    </PageContainer>
  );
}
