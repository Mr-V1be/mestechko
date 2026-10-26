import type { Membership, ScheduleAxis } from '@slotwise/contracts/client';
import type { BookingStatus } from '@slotwise/domain';
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useApi } from './api-context';

const MINUTE_MS = 60_000;

export const queryKeys = {
  me: ['me'] as const,
  demoBusinesses: ['demo-businesses'] as const,
  overview: (businessId: string) => ['overview', businessId] as const,
  schedule: (businessId: string, input: ScheduleInput) =>
    ['schedule', businessId, input.locationId, input.from, input.to, input.axis] as const,
  bookings: (businessId: string, filter: BookingsFilter) =>
    ['bookings', businessId, filter] as const,
  booking: (businessId: string, bookingId: string) => ['booking', businessId, bookingId] as const,
};

export function useMe() {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: ({ signal }) => api.request('getMe', {}, { signal }),
    retry: false,
    staleTime: 5 * MINUTE_MS,
  });
}

export function useDemoBusinesses(enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.demoBusinesses,
    queryFn: ({ signal }) => api.request('listDemoBusinesses', {}, { signal }),
    enabled,
  });
}

export function useSignIn() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      api.request('createSession', { body: input }),
    onSuccess: (me) => {
      queryClient.setQueryData(queryKeys.me, me);
    },
  });
}

export function useDemoSignIn() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { businessSlug: string; role: Membership['role'] }) =>
      api.request('createDemoSession', { body }),
    onSuccess: (me) => {
      queryClient.setQueryData(queryKeys.me, me);
    },
  });
}

export function useSignOut() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.request('deleteCurrentSession', {}),
    onSettled: () => {
      queryClient.clear();
    },
  });
}

export function useOverview(businessId: string) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.overview(businessId),
    queryFn: ({ signal }) =>
      api.request('getCabinetOverview', { params: { businessId } }, { signal }),
    staleTime: 10 * MINUTE_MS,
  });
}

export interface ScheduleInput {
  readonly locationId: string;
  readonly from: string;
  readonly to: string;
  readonly axis: ScheduleAxis;
}

/** Refreshed every minute: the schedule is watched live at the front desk. */
export function useSchedule(businessId: string, input: ScheduleInput) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.schedule(businessId, input),
    queryFn: ({ signal }) =>
      api.request('getSchedule', { params: { businessId }, query: input }, { signal }),
    placeholderData: keepPreviousData,
    refetchInterval: MINUTE_MS,
  });
}

export interface BookingsFilter {
  readonly from: string;
  readonly to: string;
  readonly status: BookingStatus | null;
  readonly staffId: string | null;
  readonly locationId: string | null;
  readonly search: string;
}

export function useBookings(businessId: string, filter: BookingsFilter) {
  const api = useApi();
  return useInfiniteQuery({
    queryKey: queryKeys.bookings(businessId, filter),
    queryFn: ({ signal, pageParam }) =>
      api.request(
        'listCabinetBookings',
        {
          params: { businessId },
          query: {
            from: filter.from,
            to: filter.to,
            ...(filter.status ? { status: filter.status } : {}),
            ...(filter.staffId ? { staffId: filter.staffId } : {}),
            ...(filter.locationId ? { locationId: filter.locationId } : {}),
            ...(filter.search.trim().length >= 2 ? { search: filter.search.trim() } : {}),
            ...(pageParam ? { cursor: pageParam } : {}),
          },
        },
        { signal },
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
    placeholderData: keepPreviousData,
  });
}

export function useCabinetBooking(businessId: string, bookingId: string | null) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.booking(businessId, bookingId ?? ''),
    queryFn: ({ signal }) =>
      api.request(
        'getCabinetBooking',
        { params: { businessId, bookingId: bookingId ?? '' } },
        { signal },
      ),
    enabled: bookingId !== null,
  });
}
