import {
  apiAssetUrl,
  errorMessage,
  hasCode,
  useFormat,
  useVocabulary,
} from '@mestechko/booking-ui';
import {
  Avatar,
  Button,
  EmptyIllustration,
  ListGroup,
  ListItem,
  Skeleton,
  StatePanel,
  TextField,
  useToast,
} from '@mestechko/ui';
import { Users, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router';
import { appConfig } from '../../app/config';
import { paymentOutsidePath } from '../../platform/api/payment-queries';
import { useCreateBooking, useQuote } from '../../platform/api/queries';
import { awaitsPayment } from '../payment/payment-state';
import { useCheckout } from '../payment/use-checkout';
import { haptics } from '../../platform/telegram/telegram-host';
import { useMainButton } from '../../platform/telegram/sdk-buttons';
import { useCurrentBusiness, useLocation } from '../business/business-context';
import { Page } from '../layout/page';
import { useBookingDraft } from './booking-details';
import { BookingSummary } from './booking-summary';
import {
  checkContact,
  ContactFields,
  useClientContact,
  useDemoContacts,
  type ContactErrors,
} from './client-contact';
import { idempotencyKeyFor } from './contact-draft';
import { ANY_STAFF, useBookingSelection } from './selection';
import styles from './booking.module.css';

export function ConfirmPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const format = useFormat();
  const business = useCurrentBusiness();
  const vocabulary = useVocabulary(business.vertical);
  const { selection, pathTo } = useBookingSelection();
  const location = useLocation(selection.locationId);
  const draftBooking = useBookingDraft(selection);
  const quoteQuery = useQuote(
    selection.slug,
    selection.start && selection.staff
      ? {
          locationId: selection.locationId,
          serviceIds: selection.serviceIds,
          staffId: selection.staff === ANY_STAFF ? null : selection.staff,
          start: selection.start,
        }
      : null,
  );
  const createBooking = useCreateBooking(selection.slug);
  const checkout = useCheckout(selection.slug);
  const [errors, setErrors] = useState<ContactErrors>({});
  const [contact, setContact] = useClientContact(selection.slug);
  const demoContacts = useDemoContacts();
  const selectionKey = `${selection.slug}:${selection.serviceIds.join(',')}:${selection.staff ?? ''}:${selection.start ?? ''}`;
  const idempotencyKey = useMemo(() => idempotencyKeyFor(selectionKey), [selectionKey]);

  const submit = () => {
    const checked = checkContact(t, contact, business.countryCode, { allowDemo: demoContacts });
    setErrors(checked.errors);
    const agreedTotal = draftBooking.quote?.assigned?.total;
    if (!checked.contact || !selection.start || !agreedTotal) {
      haptics.error();
      return;
    }
    createBooking.mutate(
      {
        idempotencyKey,
        locationId: selection.locationId,
        serviceIds: selection.serviceIds,
        staffId: selection.staff === ANY_STAFF ? null : selection.staff,
        start: selection.start,
        agreedTotal,
        contact: checked.contact,
        comment: contact.comment.trim() || null,
      },
      {
        onSuccess: (booking) => {
          haptics.success();
          const bookingPath = `/b/${encodeURIComponent(selection.slug)}/bookings/${booking.id}?created=1`;
          if (awaitsPayment(booking)) {
            // Straight on to paying; if the page cannot open, the booking offers it again.
            checkout.open(booking.id, {
              onOutside: (id) => {
                void navigate(paymentOutsidePath(selection.slug, id), { replace: true });
              },
              onRefused: () => {
                void navigate(bookingPath, { replace: true });
              },
            });
            return;
          }
          void navigate(bookingPath, { replace: true });
        },
        onError: (error) => {
          haptics.error();
          if (hasCode(error, 'price_changed')) {
            // The new price is shown at once; booking at it takes another explicit press.
            toast.show({
              title: t('confirm.priceChangedTitle'),
              description: t('confirm.priceChangedDescription'),
              tone: 'error',
            });
            void quoteQuery.refetch();
            return;
          }
          if (hasCode(error, 'slot_unavailable')) {
            toast.show({
              title: t('confirm.slotTakenTitle'),
              description: t('confirm.slotTakenDescription'),
              tone: 'error',
            });
            void navigate(pathTo('time', { start: null }), { replace: true });
            return;
          }
          toast.show({ title: errorMessage(t, error), tone: 'error' });
        },
      },
    );
  };

  const quote = draftBooking.quote;
  const assigned = quote?.assigned ?? null;
  const deposit = quote?.deposit && quote.deposit.amountMinor > 0 ? quote.deposit : null;
  useMainButton({
    text: deposit
      ? t('confirm.submitAndPay', { amount: format.money(deposit) })
      : t('confirm.submit'),
    visible: quote?.available !== false,
    enabled: assigned !== null,
    loading: createBooking.isPending || checkout.pending || draftBooking.quoteLoading,
    onClick: submit,
  });

  if (!selection.start || selection.serviceIds.length === 0) {
    return <Navigate to={pathTo('time')} replace />;
  }
  const timeZone = location?.timeZone ?? 'UTC';
  return (
    <Page
      title={t('confirm.title')}
      backTo={pathTo('time')}
      aside={<BookingSummary selection={selection} />}
    >
      <section className={styles.when} aria-label={t('summary.when')}>
        <span className={styles.whenDate}>
          {format.instant(selection.start, timeZone, 'weekdayDayMonth')}
        </span>
        <span className={styles.whenTime}>{format.instant(selection.start, timeZone, 'time')}</span>
      </section>
      {quote?.available === false ? (
        <StatePanel
          compact
          role="alert"
          illustration={<EmptyIllustration />}
          title={t('confirm.goneTitle')}
          description={t('confirm.goneDescription')}
          action={
            <Button
              variant="secondary"
              onClick={() => void navigate(pathTo('time', { start: null }), { replace: true })}
            >
              {t('confirm.chooseAnother')}
            </Button>
          }
        />
      ) : null}
      <ListGroup>
        <ListItem
          leading={
            assigned ? (
              <Avatar
                name={assigned.staff.displayName}
                src={apiAssetUrl(appConfig.apiBaseUrl, assigned.staff.avatarUrl)}
              />
            ) : (
              <span className={styles.anyIcon}>
                <Users aria-hidden="true" />
              </span>
            )
          }
          title={assigned?.staff.displayName ?? vocabulary.staffAny}
          description={
            draftBooking.anyStaff && assigned ? (
              <span className={styles.staffLines}>
                <span className={styles.nearest}>{t('confirm.assignedTitle')}</span>
                {quote?.assignmentRule ? (
                  <span>{t(`confirm.rule.${quote.assignmentRule}`)}</span>
                ) : null}
                {quote?.priceRange &&
                quote.priceRange.min.amountMinor !== quote.priceRange.max.amountMinor ? (
                  <span>
                    {t('confirm.priceRange', {
                      range: format.moneyRange(quote.priceRange.min, quote.priceRange.max),
                    })}
                  </span>
                ) : null}
                <span>{t('confirm.assignedFallback')}</span>
              </span>
            ) : (
              (assigned?.staff.title ?? undefined)
            )
          }
        />
        {draftBooking.services.map((service) => (
          <ListItem
            key={service.id}
            title={service.name}
            description={format.duration(service.durationMinutes)}
          />
        ))}
        {location ? <ListItem title={location.name} description={location.address} /> : null}
        <ListItem
          title={t('summary.total')}
          meta={
            assigned ? (
              format.money(assigned.total)
            ) : (
              <Skeleton shape="text" width="var(--size-control-lg)" />
            )
          }
        />
        {deposit && assigned ? (
          <ListItem
            leading={<Wallet aria-hidden="true" />}
            title={t('confirm.deposit')}
            description={t('confirm.depositHint', {
              rest: format.money({
                amountMinor: Math.max(0, assigned.total.amountMinor - deposit.amountMinor),
                currency: deposit.currency,
              }),
            })}
            meta={format.money(deposit)}
          />
        ) : null}
      </ListGroup>
      <form
        className={styles.form}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <h2 className={styles.formTitle}>{t('confirm.contactTitle')}</h2>
        <ContactFields
          contact={contact}
          errors={errors}
          countryCode={business.countryCode}
          onChange={setContact}
        />
        <TextField
          label={t('confirm.comment')}
          multiline
          placeholder={t('confirm.commentPlaceholder')}
          value={contact.comment}
          onChange={(event) => {
            setContact({ ...contact, comment: event.target.value });
          }}
        />
      </form>
    </Page>
  );
}
