import type {
  CabinetCatalog,
  CategoryAdmin,
  RouteRequest,
  ServiceAdmin,
  createService,
  setServiceStaff,
  updateService,
  updateServiceCategory,
} from '@mestechko/contracts/client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useApi } from './api-context';
import { useQueryCache } from './query-cache';

export type ServiceFieldsBody = RouteRequest<typeof createService>['body'];
export type ServiceChangesBody = RouteRequest<typeof updateService>['body'];
export type ServiceStaffTerms = RouteRequest<typeof setServiceStaff>['body']['staff'];
export type CategoryChangesBody = RouteRequest<typeof updateServiceCategory>['body'];

export const catalogKeys = {
  catalog: (businessId: string) => ['catalog', businessId] as const,
  /** Under the team prefix, so changes to the team refresh the people listed here too. */
  teamMembers: (businessId: string) => ['team', businessId, 'members'] as const,
};

/** `enabled: false` for people whose role cannot see the catalog. */
export function useCabinetCatalog(businessId: string, enabled = true) {
  const api = useApi();
  return useQuery({
    queryKey: catalogKeys.catalog(businessId),
    queryFn: ({ signal }) =>
      api.request('getCabinetCatalog', { params: { businessId } }, { signal }),
    enabled,
  });
}

/** Everyone on the team, inactive people included, for choosing who provides a service. */
export function useTeamMembers(businessId: string, enabled = true) {
  const api = useApi();
  return useQuery({
    queryKey: catalogKeys.teamMembers(businessId),
    queryFn: ({ signal }) => api.request('listTeam', { params: { businessId } }, { signal }),
    enabled,
  });
}

/** The ids with one of them moved to a position, the others keeping their order. */
function moved<T extends { readonly id: string }>(
  items: readonly T[],
  id: string,
  position: number,
) {
  const item = items.find((candidate) => candidate.id === id);
  if (!item) {
    return [...items];
  }
  const rest = items.filter((candidate) => candidate.id !== id);
  const index = Math.max(0, Math.min(position, rest.length));
  return [...rest.slice(0, index), item, ...rest.slice(index)];
}

/** The catalog with a service put in its category: in its place, or last when it is new there. */
function withService(catalog: CabinetCatalog, service: ServiceAdmin): CabinetCatalog {
  return {
    ...catalog,
    categories: catalog.categories.map((category) => {
      const services = category.services.filter((candidate) => candidate.id !== service.id);
      if (category.id !== service.categoryId) {
        return { ...category, services };
      }
      const inPlace = category.services.some((candidate) => candidate.id === service.id);
      return {
        ...category,
        services: inPlace
          ? category.services.map((candidate) =>
              candidate.id === service.id ? service : candidate,
            )
          : [...services, service],
      };
    }),
  };
}

/** What shows before the server answers: whether it is offered and its place in the list. */
function withServiceChanges(
  catalog: CabinetCatalog,
  serviceId: string,
  changes: ServiceChangesBody,
): CabinetCatalog {
  const service = catalog.categories
    .flatMap((category) => category.services)
    .find((candidate) => candidate.id === serviceId);
  if (!service) {
    return catalog;
  }
  const next =
    changes.isActive === undefined
      ? catalog
      : withService(catalog, { ...service, isActive: changes.isActive });
  const position = changes.position;
  if (position === undefined) {
    return next;
  }
  return {
    ...next,
    categories: next.categories.map((category) =>
      category.id === service.categoryId
        ? { ...category, services: moved(category.services, serviceId, position) }
        : category,
    ),
  };
}

function withCategoryChanges(
  catalog: CabinetCatalog,
  categoryId: string,
  changes: CategoryChangesBody,
): CabinetCatalog {
  const renamed = catalog.categories.map((category) =>
    category.id === categoryId && changes.name !== undefined
      ? { ...category, name: changes.name }
      : category,
  );
  return {
    ...catalog,
    categories:
      changes.position === undefined ? renamed : moved(renamed, categoryId, changes.position),
  };
}

function useCatalogCache(businessId: string) {
  return useQueryCache<CabinetCatalog>(catalogKeys.catalog(businessId));
}

export function useCreateCategory(businessId: string) {
  const api = useApi();
  const cache = useCatalogCache(businessId);
  return useMutation({
    mutationFn: (name: string) =>
      api.request('createServiceCategory', { params: { businessId }, body: { name } }),
    onSuccess: (category: CategoryAdmin) => {
      cache.update((catalog) => ({ ...catalog, categories: [...catalog.categories, category] }));
    },
    onSettled: cache.refresh,
  });
}

export function useUpdateCategory(businessId: string) {
  const api = useApi();
  const cache = useCatalogCache(businessId);
  return useMutation({
    mutationFn: (input: { readonly categoryId: string; readonly changes: CategoryChangesBody }) =>
      api.request('updateServiceCategory', {
        params: { businessId, categoryId: input.categoryId },
        body: input.changes,
      }),
    onMutate: (input) =>
      cache.change((catalog) => withCategoryChanges(catalog, input.categoryId, input.changes)),
    onError: (_error, _input, context) => {
      cache.restore(context?.previous);
    },
    onSettled: cache.refresh,
  });
}

export function useCreateService(businessId: string) {
  const api = useApi();
  const cache = useCatalogCache(businessId);
  return useMutation({
    mutationFn: (body: ServiceFieldsBody) =>
      api.request('createService', { params: { businessId }, body }),
    onSuccess: (service) => {
      cache.update((catalog) => withService(catalog, service));
    },
  });
}

export function useUpdateService(businessId: string) {
  const api = useApi();
  const cache = useCatalogCache(businessId);
  return useMutation({
    mutationFn: (input: { readonly serviceId: string; readonly changes: ServiceChangesBody }) =>
      api.request('updateService', {
        params: { businessId, serviceId: input.serviceId },
        body: input.changes,
      }),
    onMutate: (input) =>
      cache.change((catalog) => withServiceChanges(catalog, input.serviceId, input.changes)),
    onSuccess: (service) => {
      cache.update((catalog) => withService(catalog, service));
    },
    onError: (_error, _input, context) => {
      cache.restore(context?.previous);
    },
    onSettled: cache.refresh,
  });
}

export function useSetServiceStaff(businessId: string) {
  const api = useApi();
  const cache = useCatalogCache(businessId);
  return useMutation({
    mutationFn: (input: { readonly serviceId: string; readonly staff: ServiceStaffTerms }) =>
      api.request('setServiceStaff', {
        params: { businessId, serviceId: input.serviceId },
        body: { staff: input.staff },
      }),
    onSuccess: (service) => {
      cache.update((catalog) => withService(catalog, service));
    },
  });
}

/** Both directions of a pair are stored, so the other services change too. */
export function useSetServiceIncompatibilities(businessId: string) {
  const api = useApi();
  const cache = useCatalogCache(businessId);
  return useMutation({
    mutationFn: (input: { readonly serviceId: string; readonly serviceIds: readonly string[] }) =>
      api.request('setServiceIncompatibilities', {
        params: { businessId, serviceId: input.serviceId },
        body: { serviceIds: [...input.serviceIds] },
      }),
    onSuccess: (service) => {
      cache.update((catalog) => withService(catalog, service));
    },
    onSettled: cache.refresh,
  });
}
