import { errorMessage } from '@slotwise/booking-ui';
import { checkoutPresentations, type CheckoutPresentation } from '@slotwise/domain';
import { useToast } from '@slotwise/ui';
import { openLink } from '@tma.js/sdk-react';
import { useTranslation } from 'react-i18next';
import { useStartPayment } from '../../platform/api/payment-queries';
import { haptics } from '../../platform/telegram/telegram-host';

/**
 * How each kind of payment page opens: in place of the app (it brings the client back),
 * or in the browser outside Telegram (the booking notices the payment by itself).
 */
const openers: Readonly<Record<CheckoutPresentation, (url: string) => void>> = {
  embedded: (url) => {
    window.location.assign(url);
  },
  // Telegram opens absolute addresses only; the test provider's page lives under our site.
  external: (url) => {
    openLink(new URL(url, window.location.href).href);
  },
};

export interface CheckoutHandlers {
  /** The page opened outside the app; the client stays here and waits. */
  readonly onOutside?: (bookingId: string) => void;
  /** The page could not open (the hold ran out, the payment closed). */
  readonly onRefused?: () => void;
}

/** Opens the provider's payment page for a booking that waits for its prepayment. */
export function useCheckout(slug: string) {
  const { t } = useTranslation();
  const toast = useToast();
  const start = useStartPayment(slug);
  const open = (bookingId: string, handlers: CheckoutHandlers = {}) => {
    start.mutate(bookingId, {
      onSuccess: ({ checkoutUrl, checkoutPresentation }) => {
        openers[checkoutPresentation](checkoutUrl);
        if (!checkoutPresentations[checkoutPresentation].returnsToApp) {
          handlers.onOutside?.(bookingId);
        }
      },
      onError: (error) => {
        haptics.error();
        toast.show({ title: errorMessage(t, error), tone: 'error' });
        handlers.onRefused?.();
      },
    });
  };
  // Busy until the browser leaves for an embedded page; an outside page leaves the app here.
  const leaving =
    start.isSuccess && checkoutPresentations[start.data.checkoutPresentation].returnsToApp;
  return { open, pending: start.isPending || leaving };
}
