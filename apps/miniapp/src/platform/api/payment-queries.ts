import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from './api-context';
import { queryKeys } from './queries';

/** The query parameter the payment page returns with. */
export const PAYMENT_RETURN_PARAM = 'payment';

/** Where the payment page sends the client back: the booking, marked as a return. */
export function paymentReturnPath(slug: string, bookingId: string): string {
  return `/b/${encodeURIComponent(slug)}/bookings/${bookingId}?${PAYMENT_RETURN_PARAM}=return`;
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
