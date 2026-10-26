import type { BookingContact, Money, WidgetBooking } from '@slotwise/contracts/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from './api-context';

const MINUTE_MS = 60_000;
/** How often a booking is re-read while the visitor waits for a payment to settle. */
const POLL_MS = 2_000;

export const queryKeys = {
  business: (slug: string) => ['business', slug] as const,
  services: (slug: string, locationId: string) => ['services', slug, locationId] as const,
  staff: (slug: string, locationId: string, serviceIds: readonly string[]) =>
    ['staff', slug, locationId, ...serviceIds] as const,
  availability: (slug: string, input: AvailabilityInput) =>
    [
      'availability',
      slug,
      input.locationId,
      input.staffId ?? 'any',
      input.from,
      input.to,
      ...input.serviceIds,
    ] as const,
  quote: (slug: string, input: QuoteInput) =>
    [
      'quote',
      slug,
      input.locationId,
      input.staffId ?? 'any',
      input.start,
      ...input.serviceIds,
    ] as const,
  booking: (slug: string, id: string) => ['booking', slug, id] as const,
};

export function useBusiness(slug: string) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.business(slug),
    queryFn: ({ signal }) => api.request('getPublicBusiness', { params: { slug } }, { signal }),
    staleTime: 10 * MINUTE_MS,
  });
}

export function useServices(slug: string, locationId: string) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.services(slug, locationId),
    queryFn: ({ signal }) =>
      api.request('listPublicServices', { params: { slug }, query: { locationId } }, { signal }),
    staleTime: 5 * MINUTE_MS,
    enabled: locationId !== '',
  });
}

export function useStaffOptions(slug: string, locationId: string, serviceIds: readonly string[]) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.staff(slug, locationId, serviceIds),
    queryFn: ({ signal }) =>
      api.request(
        'listPublicStaff',
        { params: { slug }, query: { locationId, serviceIds: [...serviceIds] } },
        { signal },
      ),
    enabled: serviceIds.length > 0,
  });
}

export interface AvailabilityInput {
  readonly locationId: string;
  readonly serviceIds: readonly string[];
  readonly staffId: string | null;
  readonly from: string;
  readonly to: string;
}

export function useAvailability(slug: string, input: AvailabilityInput) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.availability(slug, input),
    queryFn: ({ signal }) =>
      api.request(
        'getAvailability',
        {
          params: { slug },
          query: {
            locationId: input.locationId,
            serviceIds: [...input.serviceIds],
            ...(input.staffId ? { staffId: input.staffId } : {}),
            from: input.from,
            to: input.to,
          },
        },
        { signal },
      ),
    enabled: input.serviceIds.length > 0,
    placeholderData: (previous) => previous,
  });
}

export interface QuoteInput {
  readonly locationId: string;
  readonly serviceIds: readonly string[];
  readonly staffId: string | null;
  readonly start: string;
}

/** Exact price, deposit and assignee for the chosen start. */
export function useQuote(slug: string, input: QuoteInput | null) {
  const api = useApi();
  return useQuery({
    queryKey: input ? queryKeys.quote(slug, input) : ['quote', slug, 'none'],
    queryFn: ({ signal }) =>
      api.request(
        'getBookingQuote',
        {
          params: { slug },
          query: {
            locationId: input?.locationId ?? '',
            serviceIds: [...(input?.serviceIds ?? [])],
            ...(input?.staffId ? { staffId: input.staffId } : {}),
            start: input?.start ?? '',
          },
        },
        { signal },
      ),
    enabled: input !== null,
    staleTime: 0,
  });
}

export interface CreateWidgetBookingInput {
  readonly idempotencyKey: string;
  readonly locationId: string;
  readonly serviceIds: readonly string[];
  readonly staffId: string | null;
  readonly start: string;
  readonly agreedTotal: Money;
  readonly contact: BookingContact;
  readonly comment: string | null;
  readonly returnPath: string;
}

export function useCreateWidgetBooking(slug: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ idempotencyKey, ...body }: CreateWidgetBookingInput) =>
      api.request('createWidgetBooking', {
        params: { slug },
        headers: { 'idempotency-key': idempotencyKey },
        body: { ...body, serviceIds: [...body.serviceIds], consent: true },
      }),
    onSuccess: ({ booking }) => {
      queryClient.setQueryData(queryKeys.booking(slug, booking.id), booking);
      void queryClient.invalidateQueries({ queryKey: ['availability', slug] });
      void queryClient.invalidateQueries({ queryKey: ['staff', slug] });
    },
  });
}

/** A booking made in this tab; re-read while `pollWhile` holds (e.g. a payment settles). */
export function useWidgetBooking(
  slug: string,
  bookingId: string,
  token: string | null,
  pollWhile: (booking: WidgetBooking) => boolean,
) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.booking(slug, bookingId),
    queryFn: ({ signal }) =>
      api.request(
        'getWidgetBooking',
        { params: { slug, bookingId }, headers: { 'x-booking-token': token ?? '' } },
        { signal },
      ),
    enabled: token !== null,
    refetchInterval: (query) => (query.state.data && pollWhile(query.state.data) ? POLL_MS : false),
  });
}
