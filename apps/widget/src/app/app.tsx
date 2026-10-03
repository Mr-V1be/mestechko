import type { i18n } from 'i18next';
import { EmptyIllustration, StatePanel } from '@mestechko/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { rememberBooking, storedBooking, type StoredBooking } from '../embed/booking-tokens';
import { attemptPath, freshFormPath, type EmbedParams } from '../embed/embed-params';
import { postToHost, useAutoHeight } from '../embed/host-bridge';
import { BookingFlow, type BookedResult } from '../features/flow/booking-flow';
import { BookingResult } from '../features/result/booking-result';
import { useBusiness } from '../platform/api/queries';
import { AppProviders } from './providers';
import styles from './app.module.css';

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
  readonly paymentReturn: boolean;
}

function Widget({ slug, params }: { readonly slug: string; readonly params: EmbedParams }) {
  const { t } = useTranslation();
  const business = useBusiness(slug);
  const [attempt, setAttempt] = useState<Attempt | null>(() =>
    params.attemptId
      ? {
          id: params.attemptId,
          stored: storedBooking(params.attemptId),
          paymentReturn: params.paymentReturn,
        }
      : null,
  );

  const booked = (result: BookedResult) => {
    const stored = {
      bookingId: result.booking.id,
      token: result.token,
      checkoutUrl: result.checkoutUrl,
    };
    rememberBooking(result.attemptId, stored);
    postToHost({ type: 'booked', status: result.checkoutUrl ? 'held' : 'confirmed' });
    if (result.checkoutUrl) {
      // The payment page brings the visitor back to this frame, to the same attempt.
      window.location.assign(result.checkoutUrl);
      return;
    }
    // A reload shows the result too.
    window.history.replaceState(
      null,
      '',
      attemptPath(params, result.attemptId, { paymentReturn: false }),
    );
    setAttempt({ id: result.attemptId, stored, paymentReturn: false });
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
        <BookingResult
          slug={slug}
          stored={attempt.stored}
          paymentReturn={attempt.paymentReturn}
          onAgain={() => {
            window.history.replaceState(null, '', freshFormPath(params));
            setAttempt(null);
          }}
        />
      </div>
    );
  }
  return <BookingFlow business={business.data} params={params} onBooked={booked} />;
}
