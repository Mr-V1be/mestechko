import { useToast } from '@mestechko/ui';
import { useTranslation } from 'react-i18next';
import { useStartPayment } from '../../platform/api/payment-queries';
import { haptics } from '../../platform/telegram/telegram-host';
import { errorMessage } from '../../shared/error-message';

/**
 * Sends the client to the provider's payment page; the page brings them back to the
 * booking. A refusal (the hold ran out, the payment closed) is said where they are.
 */
export function useCheckout(slug: string) {
  const { t } = useTranslation();
  const toast = useToast();
  const start = useStartPayment(slug);
  const open = (bookingId: string, onRefused?: () => void) => {
    start.mutate(bookingId, {
      onSuccess: ({ checkoutUrl }) => {
        window.location.assign(checkoutUrl);
      },
      onError: (error) => {
        haptics.error();
        toast.show({ title: errorMessage(t, error), tone: 'error' });
        onRefused?.();
      },
    });
  };
  // The page stays busy until the browser leaves for the payment page.
  return { open, pending: start.isPending || start.isSuccess };
}
