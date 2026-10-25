import type { ClientPreferences } from '@mestechko/contracts/client';
import type { Locale } from '@mestechko/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from './api-context';

const preferencesKey = ['preferences'] as const;

/** The client's own settings, kept with them: the bot follows them too. */
export function usePreferences(enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: preferencesKey,
    queryFn: ({ signal }) => api.request('getMiniAppPreferences', {}, { signal }),
    enabled,
    staleTime: Infinity,
  });
}

export function useSaveLocale() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (locale: Locale) => api.request('updateMiniAppPreferences', { body: { locale } }),
    onSuccess: (saved: ClientPreferences) => {
      queryClient.setQueryData(preferencesKey, saved);
    },
  });
}
