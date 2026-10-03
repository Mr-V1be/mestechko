import type {
  CabinetBookingDetails,
  DeskClient,
  getSchedule,
  RouteResult,
} from '@mestechko/contracts/client';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useApi } from './api-context';
import { queryKeys } from './queries';

type Schedule = RouteResult<typeof getSchedule>;

const MS_PER_MINUTE = 60_000;

/** Every cached view of a business's bookings: schedules, lists and details. */
function refreshBookings(queryClient: QueryClient, businessId: string): Promise<void> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['schedule', businessId] }),
    queryClient.invalidateQueries({ queryKey: ['bookings', businessId] }),
    queryClient.invalidateQueries({ queryKey: ['booking', businessId] }),
    queryClient.invalidateQueries({ queryKey: ['client', businessId] }),
  ]).then(() => undefined);
}

export interface MoveInput {
  readonly bookingId: string;
  readonly staffId: string;
  readonly start: string;
  readonly expectedVersion: number;
}

/** Shifts the booking in every cached schedule; returns how to put it back. */
function moveInSchedules(
  queryClient: QueryClient,
  businessId: string,
  input: MoveInput,
): () => void {
  const snapshots = queryClient.getQueriesData<Schedule>({ queryKey: ['schedule', businessId] });
  for (const [key, schedule] of snapshots) {
    if (!schedule) {
      continue;
    }
    queryClient.setQueryData<Schedule>(key, {
      ...schedule,
      bookings: schedule.bookings.map((booking) => {
        if (booking.id !== input.bookingId) {
          return booking;
        }
        const shift = Date.parse(input.start) - Date.parse(booking.start);
        const moved = (instant: string) => new Date(Date.parse(instant) + shift).toISOString();
        const staffAxis = schedule.columns.some((column) => column.kind === 'staff');
        return {
          ...booking,
          staffId: input.staffId,
          columnId: staffAxis ? input.staffId : booking.columnId,
          start: input.start,
          end: moved(booking.end),
          occupied: { start: moved(booking.occupied.start), end: moved(booking.occupied.end) },
        };
      }),
    });
  }
  return () => {
    for (const [key, schedule] of snapshots) {
      queryClient.setQueryData(key, schedule);
    }
  };
}

/** Moves a booking at once on screen; the server confirms or the move is undone. */
export function useMoveBooking(businessId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: MoveInput) =>
      api.request('moveCabinetBooking', {
        params: { businessId, bookingId: input.bookingId },
        body: {
          staffId: input.staffId,
          start: input.start,
          expectedVersion: input.expectedVersion,
        },
      }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ['schedule', businessId] });
      return { rollback: moveInSchedules(queryClient, businessId, input) };
    },
    onError: (_error, _input, context) => {
      context?.rollback();
    },
    onSuccess: (details) => {
      queryClient.setQueryData(queryKeys.booking(businessId, details.id), details);
    },
    onSettled: () => refreshBookings(queryClient, businessId),
  });
}

export interface CreateInput {
  readonly locationId: string;
  readonly staffId: string;
  readonly serviceIds: readonly string[];
  readonly start: string;
  readonly client: DeskClient;
  readonly comment: string | null;
  /** One key per form: repeating the same submit books once. */
  readonly idempotencyKey: string;
}

export function useCreateBooking(businessId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ idempotencyKey, ...body }: CreateInput) =>
      api.request('createCabinetBooking', {
        params: { businessId },
        headers: { 'idempotency-key': idempotencyKey },
        body: { ...body, serviceIds: [...body.serviceIds] },
      }),
    onSuccess: (details) => {
      queryClient.setQueryData(queryKeys.booking(businessId, details.id), details);
    },
    onSettled: () => refreshBookings(queryClient, businessId),
  });
}

/** Changes that need only the version the user saw. */
const versionedActions = {
  cancel: 'cancelCabinetBooking',
  noShow: 'markCabinetNoShow',
} as const;

export function useBookingAction(businessId: string, action: keyof typeof versionedActions) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (booking: Pick<CabinetBookingDetails, 'id' | 'version'>) =>
      api.request(versionedActions[action], {
        params: { businessId, bookingId: booking.id },
        body: { expectedVersion: booking.version },
      }),
    onSuccess: (details) => {
      queryClient.setQueryData(queryKeys.booking(businessId, details.id), details);
    },
    onSettled: () => refreshBookings(queryClient, businessId),
  });
}

export function useCompleteVisit(businessId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      readonly booking: Pick<CabinetBookingDetails, 'id' | 'version'>;
      readonly passId: string | null;
      readonly points: number;
    }) =>
      api.request('completeCabinetBooking', {
        params: { businessId, bookingId: input.booking.id },
        body: {
          expectedVersion: input.booking.version,
          passId: input.passId,
          points: input.points,
        },
      }),
    onSuccess: (details) => {
      queryClient.setQueryData(queryKeys.booking(businessId, details.id), details);
    },
    onSettled: () => refreshBookings(queryClient, businessId),
  });
}

export function useSettlementOptions(businessId: string, bookingId: string | null) {
  const api = useApi();
  return useQuery({
    queryKey: ['settlement', businessId, bookingId ?? ''],
    queryFn: ({ signal }) =>
      api.request(
        'getVisitSettlementOptions',
        { params: { businessId, bookingId: bookingId ?? '' } },
        { signal },
      ),
    enabled: bookingId !== null,
    staleTime: 0,
  });
}

/** Services bookable at a location, grouped by category, with who provides them. */
export function useBookableServices(slug: string, locationId: string) {
  const api = useApi();
  return useQuery({
    queryKey: ['bookable-services', slug, locationId],
    queryFn: ({ signal }) =>
      api.request('listPublicServices', { params: { slug }, query: { locationId } }, { signal }),
    enabled: locationId !== '',
    staleTime: 5 * MS_PER_MINUTE,
  });
}

/** Free starts of a staff member on a day as clients see them: hints for the desk. */
export function useFreeStarts(
  slug: string,
  input: {
    readonly locationId: string;
    readonly serviceIds: readonly string[];
    readonly staffId: string | null;
    readonly date: string;
  },
) {
  const api = useApi();
  return useQuery({
    queryKey: ['free-starts', slug, input],
    queryFn: ({ signal }) =>
      api.request(
        'getAvailability',
        {
          params: { slug },
          query: {
            locationId: input.locationId,
            serviceIds: [...input.serviceIds],
            ...(input.staffId ? { staffId: input.staffId } : {}),
            from: input.date,
            to: input.date,
          },
        },
        { signal },
      ),
    enabled: input.serviceIds.length > 0 && input.date !== '' && input.locationId !== '',
  });
}

/** Clients matching what the desk types, for booking an existing client. */
export function useClientSearch(businessId: string, search: string, enabled: boolean) {
  const api = useApi();
  const query = search.trim();
  return useQuery({
    queryKey: ['client-search', businessId, query],
    queryFn: ({ signal }) =>
      api.request(
        'listClients',
        { params: { businessId }, query: { search: query, limit: 6 } },
        { signal },
      ),
    enabled: enabled && query.length >= 2,
    staleTime: MS_PER_MINUTE,
  });
}
