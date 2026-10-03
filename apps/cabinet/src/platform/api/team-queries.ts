import type { ScheduleChange, TeamMember } from '@mestechko/contracts/client';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useApi } from './api-context';
import { queryKeys } from './queries';

export const teamKeys = {
  list: (businessId: string) => ['team', businessId, 'list'] as const,
  member: (businessId: string, staffId: string) => ['team', businessId, 'member', staffId] as const,
  /** The service catalog; personal terms of staff are part of it. */
  catalog: (businessId: string) => ['catalog', businessId] as const,
  /** Every view of the schedule: working hours change with the team's schedules. */
  schedule: (businessId: string) => ['schedule', businessId] as const,
};

export interface ProfileInput {
  readonly displayName: string;
  readonly title: string | null;
}

export interface ServiceTermsInput {
  readonly serviceId: string;
  readonly durationMinutes: number | null;
  readonly priceMinor: number | null;
}

/** A saved member is the truth for its page; lists and lookups that show it are refetched. */
function storeMember(queryClient: QueryClient, businessId: string, member: TeamMember): void {
  queryClient.setQueryData(teamKeys.member(businessId, member.id), member);
  void queryClient.invalidateQueries({ queryKey: teamKeys.list(businessId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.overview(businessId) });
}

export function useTeam(businessId: string, enabled = true) {
  const api = useApi();
  return useQuery({
    queryKey: teamKeys.list(businessId),
    queryFn: ({ signal }) => api.request('listTeam', { params: { businessId } }, { signal }),
    enabled,
  });
}

export function useTeamMember(businessId: string, staffId: string, enabled = true) {
  const api = useApi();
  return useQuery({
    queryKey: teamKeys.member(businessId, staffId),
    queryFn: ({ signal }) =>
      api.request('getTeamMember', { params: { businessId, staffId } }, { signal }),
    enabled,
  });
}

export function useServiceCatalog(businessId: string, enabled = true) {
  const api = useApi();
  return useQuery({
    queryKey: teamKeys.catalog(businessId),
    queryFn: ({ signal }) =>
      api.request('getCabinetCatalog', { params: { businessId } }, { signal }),
    enabled,
  });
}

export function useCreateTeamMember(businessId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (profile: ProfileInput) =>
      api.request('createTeamMember', { params: { businessId }, body: profile }),
    onSuccess: (member) => {
      storeMember(queryClient, businessId, member);
    },
  });
}

/** Profile edits; taking someone off bookings shows at once and rolls back on failure. */
export function useUpdateTeamMember(businessId: string, staffId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  const key = teamKeys.member(businessId, staffId);
  return useMutation({
    mutationFn: (changes: Partial<ProfileInput> & { readonly isActive?: boolean }) =>
      api.request('updateTeamMember', { params: { businessId, staffId }, body: changes }),
    onMutate: async (changes) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<TeamMember>(key);
      if (previous && changes.isActive !== undefined) {
        queryClient.setQueryData<TeamMember>(key, { ...previous, isActive: changes.isActive });
      }
      return { previous };
    },
    onError: (_error, _changes, context) => {
      if (context?.previous) {
        queryClient.setQueryData(key, context.previous);
      }
    },
    onSuccess: (member) => {
      storeMember(queryClient, businessId, member);
      void queryClient.invalidateQueries({ queryKey: teamKeys.schedule(businessId) });
    },
  });
}

export function useSetTeamMemberServices(businessId: string, staffId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (services: readonly ServiceTermsInput[]) =>
      api.request('setTeamMemberServices', {
        params: { businessId, staffId },
        body: { services: [...services] },
      }),
    onSuccess: (member) => {
      storeMember(queryClient, businessId, member);
      void queryClient.invalidateQueries({ queryKey: teamKeys.catalog(businessId) });
    },
  });
}

/** Visits a change would leave outside working time; nothing is saved. */
export function usePreviewScheduleChange(businessId: string, staffId: string) {
  const api = useApi();
  return useMutation({
    mutationFn: (change: ScheduleChange) =>
      api.request('previewScheduleChange', {
        params: { businessId, staffId },
        body: { change },
      }),
  });
}

export function useApplyScheduleChange(businessId: string, staffId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      readonly change: ScheduleChange;
      readonly acknowledgedAffected: number;
    }) =>
      api.request('applyScheduleChange', {
        params: { businessId, staffId },
        body: { change: input.change, acknowledgedAffected: input.acknowledgedAffected },
      }),
    onSuccess: ({ member }) => {
      storeMember(queryClient, businessId, member);
      void queryClient.invalidateQueries({ queryKey: teamKeys.schedule(businessId) });
    },
  });
}
