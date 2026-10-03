import { useFormat } from '@mestechko/booking-ui';
import type { TeamMember } from '@mestechko/contracts/client';
import { Button, ListGroup, ListItem, Skeleton, StatePanel } from '@mestechko/ui';
import { Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useServiceCatalog } from '../../../platform/api/team-queries';
import { QueryErrorState } from '../../common/states';
import { useFormSheet } from '../use-form-sheet';
import { Section } from './section';
import { ServicesSheet } from './services-sheet';
import styles from './member.module.css';

const SKELETON_ROWS = 3;

/** What the person does, at the service's terms or their own. */
export function ServicesSection({
  businessId,
  member,
}: {
  readonly businessId: string;
  readonly member: TeamMember;
}) {
  const { t } = useTranslation('team');
  const format = useFormat();
  const catalog = useServiceCatalog(businessId);
  const sheet = useFormSheet();
  const services = catalog.data?.categories.flatMap((category) => category.services) ?? [];
  const provided = services.flatMap((service) => {
    const terms = member.services.find((candidate) => candidate.serviceId === service.id);
    return terms ? [{ service, terms }] : [];
  });
  const edit = (
    <Button variant="secondary" size="sm" icon={<Pencil />} onClick={sheet.show}>
      {t('services.edit')}
    </Button>
  );

  return (
    <Section title={t('services.title')} action={provided.length > 0 ? edit : undefined}>
      {catalog.isPending ? (
        <div className={styles.skeleton} aria-busy="true">
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <Skeleton key={index} height="var(--size-control-lg)" />
          ))}
        </div>
      ) : null}
      {catalog.isError ? (
        <QueryErrorState error={catalog.error} onRetry={() => void catalog.refetch()} />
      ) : null}
      {catalog.data && provided.length > 0 ? (
        <ListGroup>
          {provided.map(({ service, terms }) => {
            const own =
              terms.price !== null
                ? terms.durationMinutes !== null
                  ? 'ownTerms'
                  : 'ownPrice'
                : terms.durationMinutes !== null
                  ? 'ownDuration'
                  : null;
            return (
              <ListItem
                key={service.id}
                title={service.name}
                description={[
                  format.duration(terms.durationMinutes ?? service.durationMinutes),
                  own ? t(`services.${own}`) : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                meta={format.money(terms.price ?? service.price)}
              />
            );
          })}
        </ListGroup>
      ) : null}
      {catalog.data && provided.length === 0 ? (
        <div className={styles.panel}>
          <StatePanel
            compact
            title={services.length > 0 ? t('services.emptyTitle') : t('services.catalogEmptyTitle')}
            description={
              services.length > 0
                ? t('services.emptyDescription')
                : t('services.catalogEmptyDescription')
            }
            action={
              services.length > 0 ? (
                <Button variant="secondary" onClick={sheet.show}>
                  {t('services.choose')}
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : null}
      {catalog.data ? (
        <ServicesSheet
          key={sheet.key}
          businessId={businessId}
          member={member}
          catalog={catalog.data}
          open={sheet.open}
          onOpenChange={sheet.setOpen}
          onSaved={sheet.done}
        />
      ) : null}
    </Section>
  );
}
