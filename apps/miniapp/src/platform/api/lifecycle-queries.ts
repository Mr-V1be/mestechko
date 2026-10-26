import type { BookingContact, ClientBooking, WaitlistEntry } from '@slotwise/contracts/client';
import type { DayPart } from '@slotwise/domain';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useApi } from './api-context';
import { queryKeys } from './queries';

export const lifecycleKeys = {
  rescheduleDays: (slug: string, bookingId: string, from: string, to: string) =>
    ['reschedule-days', slug, bookingId, from, to] as const,
  waitlist: (slug: string) => ['waitlist', slug] as const,
  notifications: ['notifications'] as const,
};

/** A changed booking replaces the cached one; lists and free time are reloaded. */
function storeBooking(queryClient: QueryClient, slug: string, booking: ClientBooking): void {
  queryClient.setQueryData(queryKeys.booking(slug, booking.id), booking);
  void queryClient.invalidateQueries({ queryKey: ['bookings', slug] });
  void queryClient.invalidateQueries({ queryKey: ['availability', slug] });
  void queryClient.invalidateQueries({ queryKey: ['reschedule-days', slug] });
}

export function useCancelBooking(slug: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bookingId: string) =>
      api.request('cancelMiniAppBooking', { params: { slug, bookingId } }),
    onSuccess: (booking) => {
      storeBooking(queryClient, slug, booking);
    },
  });
}

export function useConfirmAttendance(slug: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bookingId: string) =>
      api.request('confirmMiniAppAttendance', { params: { slug, bookingId } }),
    onSuccess: (booking) => {
      storeBooking(queryClient, slug, booking);
    },
  });
}

export function useRescheduleBooking(slug: string, bookingId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (start: string) =>
      api.request('rescheduleMiniAppBooking', { params: { slug, bookingId }, body: { start } }),
    onSuccess: (booking) => {
      storeBooking(queryClient, slug, booking);
    },
  });
}

/** Free starts to move a booking to: same services and staff member, its own time free. */
export function useRescheduleDays(slug: string, bookingId: string, from: string, to: string) {
  const api = useApi();
  return useQuery({
    queryKey: lifecycleKeys.rescheduleDays(slug, bookingId, from, to),
    queryFn: ({ signal }) =>
      api.request(
        'getRescheduleOptions',
        { params: { slug, bookingId }, query: { from, to } },
        { signal },
      ),
    placeholderData: (previous) => previous,
  });
}

export function useWaitlist(slug: string) {
  const api = useApi();
  return useQuery({
    queryKey: lifecycleKeys.waitlist(slug),
    queryFn: ({ signal }) => api.request('listMiniAppWaitlist', { params: { slug } }, { signal }),
  });
}

export interface WaitlistWishInput {
  readonly locationId: string;
  readonly serviceIds: readonly string[];
  readonly staffId: string | null;
  readonly date: string;
  readonly dayPart: DayPart | null;
  readonly contact: BookingContact;
}

export function useJoinWaitlist(slug: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: WaitlistWishInput): Promise<WaitlistEntry> =>
      api.request('joinMiniAppWaitlist', {
        params: { slug },
        body: { ...input, serviceIds: [...input.serviceIds] },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: lifecycleKeys.waitlist(slug) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile(slug) });
    },
  });
}

export function useLeaveWaitlist(slug: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) =>
      api.request('leaveMiniAppWaitlist', { params: { slug, entryId } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: lifecycleKeys.waitlist(slug) });
    },
  });
}

/** Whether the bot may message the client; checked again whenever the app regains focus. */
export function useNotificationStatus() {
  const api = useApi();
  return useQuery({
    queryKey: lifecycleKeys.notifications,
    queryFn: ({ signal }) => api.request('getMiniAppNotifications', {}, { signal }),
    refetchOnWindowFocus: true,
  });
}

/** Answers to a time offered from the waitlist, from the held booking it made. */
export function useOfferAnswers(slug: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  const accept = useMutation({
    mutationFn: (bookingId: string) =>
      api.request('acceptMiniAppOffer', { params: { slug, bookingId } }),
    onSuccess: (booking) => {
      storeBooking(queryClient, slug, booking);
      void queryClient.invalidateQueries({ queryKey: lifecycleKeys.waitlist(slug) });
    },
  });
  const decline = useMutation({
    mutationFn: (bookingId: string) =>
      api.request('declineMiniAppOffer', { params: { slug, bookingId } }),
    onSuccess: (_result, bookingId) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.booking(slug, bookingId) });
      void queryClient.invalidateQueries({ queryKey: ['bookings', slug] });
      void queryClient.invalidateQueries({ queryKey: lifecycleKeys.waitlist(slug) });
    },
  });
  return { accept, decline };
}
