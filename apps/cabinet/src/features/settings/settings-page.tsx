import { useVocabulary } from '@mestechko/booking-ui';
import { Skeleton } from '@mestechko/ui';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { useOverview } from '../../platform/api/queries';
import { useBusinessSettings } from '../../platform/api/settings-queries';
import { canOpen, useActiveMembership } from '../../platform/session/active-business';
import { useSession } from '../../platform/session/session-context';
import { PageContainer, PageHeader } from '../common/page-header';
import { NoAccessState, QueryErrorState } from '../common/states';
import { ruleSections } from './rule-fields';
import { SettingsForm } from './settings-form';
import { WidgetEmbed } from './widget-embed';
import styles from './settings.module.css';

/** Sections and fields in their places while the settings load. */
function SettingsSkeleton() {
  return (
    <div className={styles.form} aria-busy="true">
      {[{ id: 'name', fields: [null] }, ...ruleSections].map((section) => (
        <div key={section.id} className={styles.section}>
          <Skeleton shape="text" width="var(--size-illustration)" />
          <div className={styles.sectionFields}>
            {section.fields.map((_, index) => (
              <div key={index} className={styles.rule}>
                <Skeleton shape="text" width="50%" />
                <Skeleton height="var(--size-control-md)" />
                <Skeleton shape="text" width="35%" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function SettingsPage() {
  const { t } = useTranslation();
  const { businessId = '' } = useParams();
  const me = useSession();
  const membership = useActiveMembership(me);
  const allowed = membership ? canOpen(membership, 'settings') : false;
  const settings = useBusinessSettings(businessId, allowed);
  const overview = useOverview(businessId);
  const vocabulary = useVocabulary(overview.data?.business.vertical);

  if (membership && !allowed) {
    return (
      <PageContainer>
        <NoAccessState />
      </PageContainer>
    );
  }
  return (
    <PageContainer>
      <PageHeader title={t('settings:title')} />
      {settings.data ? (
        <>
          <SettingsForm
            key={businessId}
            businessId={businessId}
            settings={settings.data}
            staffAny={vocabulary.staffAny}
          />
          {overview.data ? <WidgetEmbed slug={overview.data.business.slug} /> : null}
        </>
      ) : settings.isError ? (
        <QueryErrorState error={settings.error} onRetry={() => void settings.refetch()} />
      ) : (
        <SettingsSkeleton />
      )}
    </PageContainer>
  );
}
