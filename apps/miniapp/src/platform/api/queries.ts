import {
  type BookingContact,
  type BookingScope,
  type ClientBooking,
} from '@mestechko/contracts/client';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from './api-context';

const MINUTE_MS = 60_000;

export const queryKeys = {
  demoBusinesses: ['demo-businesses'] as const,
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
  profile: (slug: string) => ['profile', slug] as const,
  bookings: (slug: string, scope: BookingScope) => ['bookings', slug, scope] as const,
  booking: (slug: string, id: string) => ['booking', slug, id] as const,
};

export interface AvailabilityInput {
  readonly locationId: string;
  readonly serviceIds: readonly string[];
  readonly staffId: string | null;
  readonly from: string;
  readonly to: string;
}

export function useDemoBusinesses() {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.demoBusinesses,
    queryFn: ({ signal }) => api.request('listDemoBusinesses', {}, { signal }),
  });
}

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

export function useProfile(slug: string) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.profile(slug),
    queryFn: ({ signal }) => api.request('getMiniAppProfile', { params: { slug } }, { signal }),
  });
}

export interface CreateBookingInput {
  readonly idempotencyKey: string;
  readonly locationId: string;
  readonly serviceIds: readonly string[];
  readonly staffId: string | null;
  readonly start: string;
  readonly contact: BookingContact;
  readonly comment: string | null;
}

export function useCreateBooking(slug: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBookingInput): Promise<ClientBooking> =>
      api.request('createMiniAppBooking', {
        params: { slug },
        headers: { 'idempotency-key': input.idempotencyKey },
        body: {
          locationId: input.locationId,
          serviceIds: [...input.serviceIds],
          staffId: input.staffId,
          start: input.start,
          contact: input.contact,
          comment: input.comment,
        },
      }),
    onSuccess: (booking) => {
      queryClient.setQueryData(queryKeys.booking(slug, booking.id), booking);
      void queryClient.invalidateQueries({ queryKey: ['bookings', slug] });
      void queryClient.invalidateQueries({ queryKey: ['availability', slug] });
      void queryClient.invalidateQueries({ queryKey: ['staff', slug] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile(slug) });
    },
  });
}

export function useMyBookings(slug: string, scope: BookingScope) {
  const api = useApi();
  return useInfiniteQuery({
    queryKey: queryKeys.bookings(slug, scope),
    queryFn: ({ signal, pageParam }) =>
      api.request(
        'listMiniAppBookings',
        { params: { slug }, query: { scope, ...(pageParam ? { cursor: pageParam } : {}) } },
        { signal },
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
}

export function useClientBooking(slug: string, bookingId: string) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.booking(slug, bookingId),
    queryFn: ({ signal }) =>
      api.request('getMiniAppBooking', { params: { slug, bookingId } }, { signal }),
  });
}

export function useTelegramLaunch() {
  const api = useApi();
  return useMutation({
    mutationFn: (input: { businessSlug: string; demoUserId: string | null }) =>
      api.request('createTelegramLaunch', { body: input }),
  });
}
