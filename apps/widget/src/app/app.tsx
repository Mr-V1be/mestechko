import type { i18n } from 'i18next';
import { EmptyIllustration, StatePanel } from '@mestechko/ui';
import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { rememberBooking, storedBooking, type StoredBooking } from '../embed/booking-tokens';
import { attemptPath, freshFormPath, type EmbedParams } from '../embed/embed-params';
import { postToHost, useAutoHeight, useLocaleToHost } from '../embed/host-bridge';
import { BookingFlow, type BookedResult } from '../features/flow/booking-flow';
import type { PaymentStage } from '../features/result/booking-result';
import { openCheckout, paysOutside } from '../embed/checkout-openers';
import { useBusiness } from '../platform/api/queries';
import { AppProviders } from './providers';
import styles from './app.module.css';

const BookingResult = lazy(async () => ({
  default: (await import('../features/result/booking-result')).BookingResult,
}));

export function App({ i18n, params }: { readonly i18n: i18n; readonly params: EmbedParams }) {
  return (
    <AppProviders i18n={i18n} theme={params.theme}>
      <WidgetFrame params={params} />
    </AppProviders>
  );
}

function WidgetFrame({ params }: { readonly params: EmbedParams }) {
  const { t } = useTranslation();
  useAutoHeight(params.mode === 'inline');
  useLocaleToHost();
  return (
    <div className={params.mode === 'popup' ? styles.popup : styles.card}>
      {params.business ? (
        <Widget slug={params.business} params={params} />
      ) : (
        <StatePanel
          illustration={<EmptyIllustration />}
          title={t('notFoundTitle')}
          description={t('notFoundDescription')}
        />
      )}
      <p className={styles.powered}>{t('poweredBy')}</p>
    </div>
  );
}

interface Attempt {
  readonly id: string;
  readonly stored: StoredBooking | null;
  readonly stage: PaymentStage | null;
}

function Widget({ slug, params }: { readonly slug: string; readonly params: EmbedParams }) {
  const { t } = useTranslation();
  const business = useBusiness(slug);
  const [attempt, setAttempt] = useState<Attempt | null>(() =>
    params.attemptId
      ? {
          id: params.attemptId,
          stored: storedBooking(params.attemptId),
          stage: params.paymentReturn ? 'returned' : null,
        }
      : null,
  );

  const booked = (result: BookedResult) => {
    const stored: StoredBooking = {
      bookingId: result.booking.id,
      token: result.token,
      checkoutUrl: result.checkoutUrl,
      checkoutPresentation: result.checkoutPresentation,
    };
    rememberBooking(result.attemptId, stored);
    postToHost({ type: 'booked', status: result.checkoutUrl ? 'held' : 'confirmed' });
    // A reload shows the result too.
    const show = (stage: PaymentStage | null) => {
      window.history.replaceState(
        null,
        '',
        attemptPath(params, result.attemptId, { paymentReturn: false }),
      );
      setAttempt({ id: result.attemptId, stored, stage });
    };
    if (result.checkoutUrl && result.checkoutPresentation) {
      // In place of the form the page brings the visitor back to this attempt; in a
      // new window the visitor waits here while the payment goes through.
      openCheckout(result.checkoutUrl, result.checkoutPresentation);
      if (paysOutside(result.checkoutPresentation)) {
        show('outside');
      }
      return;
    }
    show(null);
  };

  if (business.isError) {
    return (
      <StatePanel
        illustration={<EmptyIllustration />}
        title={t('notFoundTitle')}
        description={t('notFoundDescription')}
      />
    );
  }
  if (!business.data) {
    return <div className={styles.loading} aria-busy="true" />;
  }
  if (attempt) {
    return (
      <div className={styles.resultBody}>
        <Suspense fallback={<div className={styles.loading} aria-busy="true" />}>
          <BookingResult
            slug={slug}
            stored={attempt.stored}
            stage={attempt.stage}
            onAgain={() => {
              window.history.replaceState(null, '', freshFormPath(params));
              setAttempt(null);
            }}
          />
        </Suspense>
      </div>
    );
  }
  return <BookingFlow business={business.data} params={params} onBooked={booked} />;
}
