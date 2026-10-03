import type { ClientCard, ClientNote, clientSorts } from '@mestechko/contracts/client';
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { useApi } from './api-context';

const HOUR_MS = 3_600_000;
/** The API searches from two characters; shorter input shows everyone. */
const MIN_SEARCH_LENGTH = 2;

export type ClientSort = (typeof clientSorts)[number];

export interface ClientsFilter {
  readonly search: string;
  readonly tag: string | null;
  readonly sort: ClientSort;
}

/** What a client card is made of when it is added or its profile changes. */
export interface ClientFields {
  readonly displayName: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly tags: string[];
}

export const clientKeys = {
  lists: (businessId: string) => ['clients', businessId, 'list'] as const,
  list: (businessId: string, filter: ClientsFilter) =>
    ['clients', businessId, 'list', filter] as const,
  tags: (businessId: string) => ['clients', businessId, 'tags'] as const,
  card: (businessId: string, clientId: string) =>
    ['clients', businessId, 'card', clientId] as const,
  passPlans: (businessId: string) => ['clients', businessId, 'pass-plans'] as const,
  region: (slug: string) => ['business-region', slug] as const,
};

/** The search the API will run, or `null` while the input is too short to search. */
export function appliedSearch(search: string): string | null {
  const trimmed = search.trim();
  return trimmed.length >= MIN_SEARCH_LENGTH ? trimmed : null;
}

export function useClients(businessId: string, filter: ClientsFilter) {
  const api = useApi();
  const search = appliedSearch(filter.search);
  return useInfiniteQuery({
    queryKey: clientKeys.list(businessId, { ...filter, search: search ?? '' }),
    queryFn: ({ signal, pageParam }) =>
      api.request(
        'listClients',
        {
          params: { businessId },
          query: {
            sort: filter.sort,
            ...(search ? { search } : {}),
            ...(filter.tag ? { tag: filter.tag } : {}),
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

export function useClientTags(businessId: string) {
  const api = useApi();
  return useQuery({
    queryKey: clientKeys.tags(businessId),
    queryFn: ({ signal }) =>
      api.request('listClientTags', { params: { businessId } }, { signal }),
  });
}

export function useClientCard(businessId: string, clientId: string) {
  const api = useApi();
  return useQuery({
    queryKey: clientKeys.card(businessId, clientId),
    queryFn: ({ signal }) =>
      api.request('getClientCard', { params: { businessId, clientId } }, { signal }),
  });
}

/** The default region of phone numbers people type without a country code. */
export function useBusinessRegion(slug: string) {
  const api = useApi();
  return useQuery({
    queryKey: clientKeys.region(slug),
    queryFn: ({ signal }) => api.request('getPublicBusiness', { params: { slug } }, { signal }),
    select: (business) => business.countryCode,
    staleTime: HOUR_MS,
  });
}

/** Passes on sale; only active plans can be sold. */
export function usePassPlans(businessId: string, enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: clientKeys.passPlans(businessId),
    queryFn: ({ signal }) =>
      api.request('getLoyaltySettings', { params: { businessId } }, { signal }),
    select: (settings) => settings.plans.filter((plan) => plan.isActive),
    enabled,
  });
}

/** Lists and tag counts change with any card; they refetch in the background. */
function refreshLists(queryClient: QueryClient, businessId: string): void {
  void queryClient.invalidateQueries({ queryKey: clientKeys.lists(businessId) });
  void queryClient.invalidateQueries({ queryKey: clientKeys.tags(businessId) });
}

export function useCreateClient(businessId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ClientFields) =>
      api.request('createClient', { params: { businessId }, body }),
    onSuccess: (card) => {
      queryClient.setQueryData(clientKeys.card(businessId, card.client.id), card);
      refreshLists(queryClient, businessId);
    },
  });
}

/** Contacts are saved before they show: the phone may turn out to be someone else's. */
export function useUpdateClientProfile(businessId: string, clientId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Omit<ClientFields, 'tags'>) =>
      api.request('updateClient', { params: { businessId, clientId }, body }),
    onSuccess: (card) => {
      queryClient.setQueryData(clientKeys.card(businessId, clientId), card);
      refreshLists(queryClient, businessId);
    },
  });
}

/** Tags change on the card at once and roll back if the API refuses. */
export function useUpdateClientTags(businessId: string, clientId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  const key = clientKeys.card(businessId, clientId);
  return useMutation({
    mutationFn: (tags: string[]) =>
      api.request('updateClient', { params: { businessId, clientId }, body: { tags } }),
    onMutate: async (tags) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ClientCard>(key);
      if (previous) {
        queryClient.setQueryData<ClientCard>(key, {
          ...previous,
          client: { ...previous.client, tags },
        });
      }
      return { previous };
    },
    onError: (_error, _tags, context) => {
      if (context?.previous) {
        queryClient.setQueryData(key, context.previous);
      }
    },
    onSuccess: (card) => {
      queryClient.setQueryData(key, card);
    },
    onSettled: () => {
      refreshLists(queryClient, businessId);
    },
  });
}

function updateNotes(
  queryClient: QueryClient,
  key: readonly unknown[],
  change: (notes: readonly ClientNote[]) => ClientNote[],
): void {
  queryClient.setQueryData<ClientCard>(key, (card) =>
    card ? { ...card, notes: change(card.notes) } : card,
  );
}

const PENDING_NOTE_PREFIX = 'pending:';

export function isPendingNote(note: ClientNote): boolean {
  return note.id.startsWith(PENDING_NOTE_PREFIX);
}

/** A new note shows at once under its author's name and is replaced by the saved one. */
export function useAddClientNote(businessId: string, clientId: string, authorName: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  const key = clientKeys.card(businessId, clientId);
  return useMutation({
    mutationFn: (body: string) =>
      api.request('addClientNote', { params: { businessId, clientId }, body: { body } }),
    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: key });
      const pending: ClientNote = {
        id: `${PENDING_NOTE_PREFIX}${crypto.randomUUID()}`,
        body,
        authorName,
        createdAt: new Date().toISOString(),
      };
      updateNotes(queryClient, key, (notes) => [pending, ...notes]);
      return { pendingId: pending.id };
    },
    onError: (_error, _body, context) => {
      updateNotes(queryClient, key, (notes) =>
        notes.filter((note) => note.id !== context?.pendingId),
      );
    },
    onSuccess: (saved, _body, context) => {
      updateNotes(queryClient, key, (notes) =>
        notes.map((note) => (note.id === context.pendingId ? saved : note)),
      );
    },
  });
}

/** A deleted note leaves at once and comes back in its place if the API refuses. */
export function useDeleteClientNote(businessId: string, clientId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  const key = clientKeys.card(businessId, clientId);
  return useMutation({
    mutationFn: (note: ClientNote) =>
      api.request('deleteClientNote', { params: { businessId, clientId, noteId: note.id } }),
    onMutate: async (note) => {
      await queryClient.cancelQueries({ queryKey: key });
      const index = queryClient
        .getQueryData<ClientCard>(key)
        ?.notes.findIndex((candidate) => candidate.id === note.id);
      updateNotes(queryClient, key, (notes) =>
        notes.filter((candidate) => candidate.id !== note.id),
      );
      return { index: index ?? 0 };
    },
    onError: (_error, note, context) => {
      updateNotes(queryClient, key, (notes) => notes.toSpliced(context?.index ?? 0, 0, note));
    },
  });
}

/** Money and balances change only with the API's answer, never optimistically. */
export function useSellClientPass(businessId: string, clientId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { readonly planId: string; readonly idempotencyKey: string }) =>
      api.request('sellClientPass', {
        params: { businessId, clientId },
        headers: { 'idempotency-key': input.idempotencyKey },
        body: { planId: input.planId },
      }),
    onSuccess: (card) => {
      queryClient.setQueryData(clientKeys.card(businessId, clientId), card);
      void queryClient.invalidateQueries({ queryKey: clientKeys.passPlans(businessId) });
    },
  });
}

export function useAdjustClientPoints(businessId: string, clientId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      readonly amount: number;
      readonly note: string;
      readonly idempotencyKey: string;
    }) =>
      api.request('adjustClientPoints', {
        params: { businessId, clientId },
        headers: { 'idempotency-key': input.idempotencyKey },
        body: { amount: input.amount, note: input.note },
      }),
    onSuccess: (card) => {
      queryClient.setQueryData(clientKeys.card(businessId, clientId), card);
    },
  });
}

/** A dry run checks the file; the real run adds and updates the clients. */
export function useImportClients(businessId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { readonly file: Blob; readonly dryRun: boolean }) =>
      api.request('importClients', {
        params: { businessId },
        query: { dryRun: input.dryRun ? 'true' : 'false' },
        file: input.file,
      }),
    onSuccess: (result) => {
      if (result.applied) {
        void queryClient.invalidateQueries({ queryKey: ['clients', businessId] });
      }
    },
  });
}
