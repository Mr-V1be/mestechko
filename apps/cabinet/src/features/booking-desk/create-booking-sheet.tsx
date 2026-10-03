import { useFormat } from '@mestechko/booking-ui';
import {
  ApiError,
  normalizePhone,
  type getCabinetOverview,
  type RouteResult,
} from '@mestechko/contracts/client';
import { Button, Sheet, Skeleton, TextField, useToast } from '@mestechko/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { appConfig } from '../../app/config';
import { useBookableServices, useCreateBooking } from '../../platform/api/desk-queries';
import { errorMessage } from '../common/error-message';
import { QueryErrorState } from '../common/states';
import { instantAt, parseWallTime } from '../schedule/timeline-model';
import { ClientField, deskClientOf, emptyClient, type ClientDraft } from './client-field';
import { ServicesField } from './services-field';
import { WhenFields, type WhenValue } from './when-fields';
import styles from './desk.module.css';

type Overview = RouteResult<typeof getCabinetOverview>;

export interface NewBookingStart {
  readonly locationId: string;
  readonly staffId: string | null;
  readonly date: string;
  /** `HH:MM`, when the desk clicked a time in the schedule. */
  readonly time: string | null;
}

export interface CreateBookingSheetProps {
  readonly businessId: string;
  readonly overview: Overview;
  /** Where the booking starts; `null` keeps the sheet closed. */
  readonly start: NewBookingStart | null;
  readonly canSearchClients: boolean;
  readonly onClose: () => void;
  readonly onCreated: (bookingId: string) => void;
}

/** A booking made at the front desk: client, services, who and when. */
export function CreateBookingSheet(props: CreateBookingSheetProps) {
  const { t } = useTranslation('desk');
  return (
    <Sheet
      open={props.start !== null}
      onOpenChange={(open) => {
        if (!open) {
          props.onClose();
        }
      }}
      title={t('create.title')}
      closeLabel={t('common:actions.close')}
    >
      {props.start ? (
        <CreateBookingForm
          key={`${props.start.date}-${props.start.time ?? ''}-${props.start.staffId ?? ''}`}
          {...props}
          start={props.start}
        />
      ) : null}
    </Sheet>
  );
}

function CreateBookingForm({
  businessId,
  overview,
  start,
  canSearchClients,
  onCreated,
}: CreateBookingSheetProps & { readonly start: NewBookingStart }) {
  const { t } = useTranslation('desk');
  const format = useFormat();
  const toast = useToast();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [client, setClient] = useState<ClientDraft>(() => emptyClient(canSearchClients));
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [when, setWhen] = useState<WhenValue>({
    staffId: start.staffId ?? '',
    date: start.date,
    time: start.time ?? '',
  });
  const [comment, setComment] = useState('');
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const location =
    overview.locations.find((candidate) => candidate.id === start.locationId) ??
    overview.locations[0];
  const services = useBookableServices(overview.business.slug, location?.id ?? '');
  const create = useCreateBooking(businessId);
  const categories = services.data?.categories ?? [];
  const chosen = categories
    .flatMap((category) => category.services)
    .filter((service) => serviceIds.includes(service.id));
  const providers = overview.staff.filter((member) =>
    chosen.every((service) => service.providerIds.includes(member.id)),
  );
  const staffId = providers.some((member) => member.id === when.staffId)
    ? when.staffId
    : (providers[0]?.id ?? '');

  const submit = () => {
    const next: Record<string, string | null> = {};
    const resolved = deskClientOf(client, (phone) =>
      normalizePhone(phone, overview.business.countryCode, { allowDemo: appConfig.demoMode }),
    );
    if ('error' in resolved) {
      next[resolved.error === 'phoneInvalid' ? 'phone' : 'name'] = t(`client.${resolved.error}`);
    }
    if (serviceIds.length === 0) {
      next.services = t('services.required');
    }
    const minute = parseWallTime(when.time);
    if (minute === null) {
      next.time = t('when.timeRequired');
    }
    setErrors(next);
    if ('error' in resolved || minute === null || serviceIds.length === 0 || !location) {
      return;
    }
    create.mutate(
      {
        locationId: location.id,
        staffId,
        serviceIds,
        start: instantAt(when.date, minute, location.timeZone),
        client: resolved.client,
        comment: comment.trim() === '' ? null : comment.trim(),
        idempotencyKey,
      },
      {
        onSuccess: (details) => {
          toast.show({
            title: t('create.created'),
            description: t('create.createdDescription', {
              client: details.client.displayName,
              when: `${format.instant(details.start, details.timeZone, 'weekdayDayMonth')}, ${format.instant(details.start, details.timeZone, 'time')}`,
            }),
          });
          onCreated(details.id);
        },
        onError: (error) => {
          const message = errorMessage(t, error);
          if (error instanceof ApiError && error.code === 'slot_unavailable') {
            setErrors({ time: message });
          } else {
            toast.show({ title: message, tone: 'error' });
          }
        },
      },
    );
  };

  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>{t('client.title')}</h3>
        <ClientField
          businessId={businessId}
          canSearch={canSearchClients}
          value={client}
          onChange={setClient}
          errors={{ name: errors.name ?? null, phone: errors.phone ?? null }}
        />
      </section>
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>{t('services.title')}</h3>
        {services.isPending ? <Skeleton height="var(--size-control-lg)" /> : null}
        {services.isError ? (
          <QueryErrorState error={services.error} onRetry={() => void services.refetch()} />
        ) : null}
        <ServicesField
          categories={categories}
          incompatible={services.data?.incompatible ?? []}
          value={serviceIds}
          onChange={setServiceIds}
        />
        {errors.services ? <p className={styles.error}>{errors.services}</p> : null}
      </section>
      <section className={styles.section}>
        <WhenFields
          slug={overview.business.slug}
          locationId={location?.id ?? ''}
          timeZone={location?.timeZone ?? ''}
          serviceIds={serviceIds}
          staff={providers}
          value={{ ...when, staffId }}
          onChange={(value) => {
            setWhen(value);
            setErrors((current) => ({ ...current, time: null }));
          }}
          timeError={errors.time ?? null}
        />
        <TextField
          label={t('comment')}
          multiline
          value={comment}
          maxLength={500}
          onChange={(event) => {
            setComment(event.currentTarget.value);
          }}
        />
      </section>
      <Button type="submit" block loading={create.isPending}>
        {t('create.submit')}
      </Button>
    </form>
  );
}
