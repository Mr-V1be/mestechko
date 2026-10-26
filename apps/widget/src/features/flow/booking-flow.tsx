import { errorMessage, hasCode, useFormat } from '@slotwise/booking-ui';
import { ApiError, type PublicBusiness, type WidgetBooking } from '@slotwise/contracts/client';
import type { CheckoutPresentation } from '@slotwise/domain';
import { Button, Skeleton, StatePanel, useToast } from '@slotwise/ui';
import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { attemptPath, type EmbedParams } from '../../embed/embed-params';
import {
  useCreateWidgetBooking,
  useQuote,
  useServices,
  useStaffOptions,
} from '../../platform/api/queries';
import { checkContact, emptyContact, type ContactErrors } from './contact-check';
import { FlowFooter } from './flow-footer';
import { FlowHeader } from './flow-header';
import {
  canLeave,
  draftPrice,
  initialFlow,
  staffIdOf,
  stepAfter,
  stepBefore,
  type FlowState,
} from './flow-state';
import { ServicesStep } from './services-step';
import styles from './widget.module.css';

// The first step comes with the frame; the next ones load while the visitor chooses.
const StaffStep = lazy(async () => ({ default: (await import('./staff-step')).StaffStep }));
const TimeStep = lazy(async () => ({ default: (await import('./time-step')).TimeStep }));
const ContactStep = lazy(async () => ({ default: (await import('./contact-step')).ContactStep }));

export interface BookedResult {
  readonly attemptId: string;
  readonly booking: WidgetBooking;
  readonly token: string;
  readonly checkoutUrl: string | null;
  readonly checkoutPresentation: CheckoutPresentation | null;
}

export interface BookingFlowProps {
  readonly business: PublicBusiness;
  readonly params: EmbedParams;
  readonly onBooked: (result: BookedResult) => void;
}

/** The website booking form: services, who, when, and how to reach the visitor. */
export function BookingFlow({ business, params, onBooked }: BookingFlowProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const toast = useToast();
  const [flow, setFlow] = useState<FlowState>(() => initialFlow(business.locations[0]?.id ?? ''));
  const [contact, setContact] = useState(emptyContact);
  const [errors, setErrors] = useState<ContactErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const update = (patch: Partial<FlowState>) => {
    setFlow((current) => ({ ...current, ...patch }));
  };
  const location = business.locations.find((candidate) => candidate.id === flow.locationId);
  const timeZone = location?.timeZone ?? 'UTC';
  const services = useServices(business.slug, flow.locationId);
  const staffOptions = useStaffOptions(business.slug, flow.locationId, flow.serviceIds);
  const staffId = staffIdOf(flow);
  const quote = useQuote(
    business.slug,
    flow.start && flow.staff
      ? { locationId: flow.locationId, serviceIds: flow.serviceIds, staffId, start: flow.start }
      : null,
  );
  const create = useCreateWidgetBooking(business.slug);

  const catalog = services.data?.categories.flatMap((category) => category.services) ?? [];
  const chosen = catalog.filter((service) => flow.serviceIds.includes(service.id));
  const staff = staffOptions.data?.staff.find((option) => option.id === flow.staff) ?? null;
  const price = draftPrice(chosen, staff, quote.data?.assigned?.total ?? null);
  const deposit =
    quote.data?.deposit && quote.data.deposit.amountMinor > 0 ? quote.data.deposit : null;

  const submit = () => {
    const checked = checkContact(t, contact, business.countryCode);
    setErrors(checked.errors);
    const agreedTotal = quote.data?.assigned?.total;
    if (!checked.contact || !flow.start || !agreedTotal) {
      return;
    }
    create.mutate(
      {
        idempotencyKey: flow.attemptId,
        locationId: flow.locationId,
        serviceIds: flow.serviceIds,
        staffId,
        start: flow.start,
        agreedTotal,
        contact: checked.contact,
        comment: contact.comment.trim() || null,
        returnPath: attemptPath(params, flow.attemptId, { paymentReturn: true }),
      },
      {
        onSuccess: (result) => {
          onBooked({ attemptId: flow.attemptId, ...result });
        },
        onError: (error) => {
          if (hasCode(error, 'slot_unavailable')) {
            setNotice(t('contact.slotTakenDescription'));
            update({ step: 'time', start: null, attemptId: crypto.randomUUID() });
            return;
          }
          if (hasCode(error, 'price_changed')) {
            setNotice(t('contact.priceChanged'));
            void quote.refetch();
            return;
          }
          if (rejectedField(error) === 'phone') {
            setErrors({ ...checked.errors, phone: t('contact.phoneInvalid') });
            return;
          }
          toast.show({ title: errorMessage(t, error), tone: 'error' });
        },
      },
    );
  };

  const next = () => {
    setNotice(null);
    const after = stepAfter(flow.step);
    if (after) {
      update({ step: after });
      return;
    }
    submit();
  };
  const before = stepBefore(flow.step);

  return (
    <div className={styles.flow}>
      <FlowHeader
        business={business}
        step={flow.step}
        locationId={flow.locationId}
        onLocationChange={(locationId) => {
          setFlow(initialFlow(locationId));
        }}
        onBack={
          before
            ? () => {
                setNotice(null);
                update({ step: before });
              }
            : null
        }
      />
      <main className={styles.body}>
        <Suspense fallback={<RowsSkeleton rows={4} />}>
          {notice ? (
            <p className={styles.notice} role="alert">
              {notice}
            </p>
          ) : null}
          {flow.step === 'services' ? (
            services.data ? (
              <ServicesStep
                categories={services.data.categories}
                incompatible={services.data.incompatible}
                limit={business.booking.maxServicesPerBooking}
                chosen={flow.serviceIds}
                onChange={(serviceIds) => {
                  update({ serviceIds, staff: null, date: null, start: null });
                }}
              />
            ) : services.isError ? (
              <LoadFailed onRetry={() => void services.refetch()} />
            ) : (
              <RowsSkeleton rows={5} />
            )
          ) : null}
          {flow.step === 'staff' ? (
            staffOptions.data ? (
              <StaffStep
                vertical={business.vertical}
                timeZone={timeZone}
                staff={staffOptions.data.staff}
                anyNextSlot={staffOptions.data.anyNextSlot}
                value={flow.staff}
                onChoose={(choice) => {
                  update({ staff: choice, date: null, start: null, step: 'time' });
                }}
              />
            ) : staffOptions.isError ? (
              <LoadFailed onRetry={() => void staffOptions.refetch()} />
            ) : (
              <RowsSkeleton rows={4} />
            )
          ) : null}
          {flow.step === 'time' ? (
            <TimeStep
              slug={business.slug}
              locationId={flow.locationId}
              serviceIds={flow.serviceIds}
              staffId={staffId}
              timeZone={timeZone}
              horizonDays={business.booking.horizonDays}
              weekStart={flow.weekStart}
              date={flow.date}
              start={flow.start}
              onChange={(patch) => {
                setNotice(null);
                update({
                  ...patch,
                  ...(patch.start ? { attemptId: crypto.randomUUID() } : {}),
                });
              }}
            />
          ) : null}
          {flow.step === 'contact' && flow.start ? (
            <ContactStep
              start={flow.start}
              timeZone={timeZone}
              serviceNames={chosen.map((service) => service.name)}
              quote={quote.data ?? null}
              countryCode={business.countryCode}
              draft={contact}
              errors={errors}
              onChange={setContact}
            />
          ) : null}
        </Suspense>
      </main>
      <FlowFooter
        price={price}
        servicesCount={chosen.length}
        durationMinutes={chosen.reduce((sum, service) => sum + service.durationMinutes, 0)}
        label={
          flow.step !== 'contact'
            ? t('summary.next')
            : deposit
              ? t('summary.bookAndPay', { amount: format.money(deposit) })
              : t('summary.book')
        }
        enabled={canLeave(flow) && (flow.step !== 'contact' || Boolean(quote.data?.assigned))}
        loading={create.isPending || (flow.step === 'contact' && quote.isFetching)}
        onNext={next}
      />
    </div>
  );
}

/** The field the API refused, from a validation failure. */
function rejectedField(error: unknown): string | null {
  if (!(error instanceof ApiError) || typeof error.details !== 'object' || error.details === null) {
    return null;
  }
  const fields: unknown = (error.details as Record<string, unknown>).fields;
  return typeof fields === 'object' && fields !== null ? (Object.keys(fields)[0] ?? null) : null;
}

function RowsSkeleton({ rows }: { readonly rows: number }) {
  return (
    <div className={styles.skeleton} aria-busy="true">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} height="var(--size-control-lg)" />
      ))}
    </div>
  );
}

function LoadFailed({ onRetry }: { readonly onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <StatePanel
      compact
      role="alert"
      title={t('common:states.errorTitle')}
      action={
        <Button variant="secondary" onClick={onRetry}>
          {t('common:actions.retry')}
        </Button>
      }
    />
  );
}
