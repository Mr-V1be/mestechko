import { useQueryClient, type QueryKey } from '@tanstack/react-query';

/**
 * Edits of one cached query for mutations: an optimistic change that can be undone, the
 * server's answer put in place, and a refresh that brings back the server's truth.
 */
export function useQueryCache<T>(key: QueryKey) {
  const queryClient = useQueryClient();
  return {
    /** Changes the data at once; keep `previous` to undo it if the server refuses. */
    async change(change: (data: T) => T): Promise<{ readonly previous: T | undefined }> {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<T>(key);
      if (previous !== undefined) {
        queryClient.setQueryData(key, change(previous));
      }
      return { previous };
    },
    update(change: (data: T) => T): void {
      queryClient.setQueryData<T>(key, (current) =>
        current === undefined ? current : change(current),
      );
    },
    restore(previous: T | undefined): void {
      if (previous !== undefined) {
        queryClient.setQueryData(key, previous);
      }
    },
    refresh: () => queryClient.invalidateQueries({ queryKey: key }),
  };
}
