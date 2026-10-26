import { apiAssetUrl } from '@slotwise/booking-ui';
import type { TeamMember } from '@slotwise/contracts/client';
import { Avatar, Badge, ConfirmDialog, IconButton, Switch, useToast } from '@slotwise/ui';
import { ChevronLeft, Pencil } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { appConfig } from '../../../app/config';
import { useUpdateTeamMember } from '../../../platform/api/team-queries';
import { errorMessage } from '../../common/error-message';
import { useAbsenceLabel } from '../absence-label';
import { EditProfileDialog } from '../profile-dialog';
import { useFormSheet } from '../use-form-sheet';
import styles from './member.module.css';

/**
 * Whether clients can book the person. Taking them off bookings is confirmed with
 * what happens to the visits they already have; it shows at once and rolls back on failure.
 */
function BookingSwitch({
  businessId,
  member,
}: {
  readonly businessId: string;
  readonly member: TeamMember;
}) {
  const { t } = useTranslation('team');
  const toast = useToast();
  const update = useUpdateTeamMember(businessId, member.id);
  const [confirming, setConfirming] = useState(false);
  const setActive = (isActive: boolean) => {
    update.mutate(
      { isActive },
      {
        onSuccess: () => {
          toast.show({
            title: t(isActive ? 'member.activated' : 'member.deactivated', {
              name: member.displayName,
            }),
          });
        },
        onError: (error) => {
          toast.show({ title: errorMessage(t, error), tone: 'error' });
        },
      },
    );
  };
  return (
    <>
      <Switch
        label={t('member.accepts')}
        description={member.isActive ? t('member.acceptsOn') : t('member.acceptsOff')}
        checked={member.isActive}
        disabled={update.isPending}
        onCheckedChange={(next) => {
          if (next) {
            setActive(true);
          } else {
            setConfirming(true);
          }
        }}
      />
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        tone="danger"
        title={t('deactivate.title')}
        consequence={
          member.upcomingVisits > 0
            ? t('deactivate.consequence', { count: member.upcomingVisits })
            : t('deactivate.consequenceNone')
        }
        confirmLabel={t('deactivate.confirm')}
        cancelLabel={t('common:actions.cancel')}
        closeLabel={t('common:actions.close')}
        onConfirm={() => {
          setConfirming(false);
          setActive(false);
        }}
      />
    </>
  );
}

/** Back to the whole team, from the person's page in any state. */
export function BackLink({ businessId }: { readonly businessId: string }) {
  const { t } = useTranslation('team');
  return (
    <Link to={`/b/${businessId}/team`} className={styles.back}>
      <ChevronLeft aria-hidden="true" />
      {t('member.back')}
    </Link>
  );
}

/** Who the person is, how busy they are ahead, and whether they take bookings. */
export function MemberHeader({
  businessId,
  member,
  today,
}: {
  readonly businessId: string;
  readonly member: TeamMember;
  readonly today: string;
}) {
  const { t } = useTranslation('team');
  const absenceLabel = useAbsenceLabel();
  const profile = useFormSheet();
  return (
    <header className={styles.header}>
      <BackLink businessId={businessId} />
      <div className={styles.headerBody}>
        <div className={styles.identity}>
          <span className={member.isActive ? styles.avatar : styles.avatarFaded}>
            <Avatar
              name={member.displayName}
              src={apiAssetUrl(appConfig.apiBaseUrl, member.avatarUrl)}
              size="xl"
            />
          </span>
          <div className={styles.identityText}>
            <div className={styles.nameRow}>
              <h1 className={styles.name}>{member.displayName}</h1>
              <IconButton
                label={t('member.editProfile')}
                icon={<Pencil />}
                soft
                onClick={profile.show}
              />
            </div>
            {member.title ? <p className={styles.jobTitle}>{member.title}</p> : null}
            <div className={styles.facts}>
              <span>
                {member.upcomingVisits > 0
                  ? t('member.upcoming', { count: member.upcomingVisits })
                  : t('member.noUpcoming')}
              </span>
              {member.nextAbsence ? (
                <Badge tone="accent">{absenceLabel(member.nextAbsence, today)}</Badge>
              ) : null}
              {member.isActive ? null : <Badge tone="danger">{t('member.inactive')}</Badge>}
            </div>
          </div>
        </div>
        <div className={styles.status}>
          <BookingSwitch businessId={businessId} member={member} />
        </div>
      </div>
      <EditProfileDialog
        key={profile.key}
        businessId={businessId}
        member={member}
        open={profile.open}
        onOpenChange={profile.setOpen}
        onSaved={profile.done}
      />
    </header>
  );
}
