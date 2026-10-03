import type { BusinessRules } from '@mestechko/contracts/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from './api-context';
import { queryKeys } from './queries';

export const settingsQueryKeys = {
  settings: (businessId: string) => ['business-settings', businessId] as const,
};

export function useBusinessSettings(businessId: string, enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: settingsQueryKeys.settings(businessId),
    queryFn: ({ signal }) =>
      api.request('getBusinessSettings', { params: { businessId } }, { signal }),
    enabled,
  });
}

export interface SettingsChange {
  readonly name: string;
  readonly rules: BusinessRules;
}

/**
 * Saves the name and the rules. The name also lives in the session's business list and
 * the overview, so both are refreshed.
 */
export function useUpdateBusinessSettings(businessId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SettingsChange) =>
      api.request('updateBusinessSettings', { params: { businessId }, body }),
    onSuccess: (settings) => {
      queryClient.setQueryData(settingsQueryKeys.settings(businessId), settings);
      void queryClient.invalidateQueries({ queryKey: queryKeys.me });
      void queryClient.invalidateQueries({ queryKey: queryKeys.overview(businessId) });
    },
  });
}
