import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from './api-context';
import { queryKeys } from './queries';

/** The query parameter the payment page returns with. */
export const PAYMENT_RETURN_PARAM = 'payment';

/** How the client came to the booking: back from the payment page, or paying in the browser. */
export const paymentStages = { returned: 'return', outside: 'outside' } as const;

function bookingPath(slug: string, bookingId: string, stage: string): string {
  return `/b/${encodeURIComponent(slug)}/bookings/${bookingId}?${PAYMENT_RETURN_PARAM}=${stage}`;
}

/** Where the payment page sends the client back: the booking, marked as a return. */
export function paymentReturnPath(slug: string, bookingId: string): string {
  return bookingPath(slug, bookingId, paymentStages.returned);
}

/** The booking while its payment page is open in the browser outside the app. */
export function paymentOutsidePath(slug: string, bookingId: string): string {
  return bookingPath(slug, bookingId, paymentStages.outside);
}

/** Opens the provider's payment page for a booking that waits for its prepayment. */
export function useStartPayment(slug: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bookingId: string) =>
      api.request('startMiniAppPayment', {
        params: { slug, bookingId },
        body: { returnPath: paymentReturnPath(slug, bookingId) },
      }),
    onSuccess: ({ booking }) => {
      queryClient.setQueryData(queryKeys.booking(slug, booking.id), booking);
    },
  });
}
