import type {
  ClientResult,
  LoyaltyProgram,
  PassPlan,
  RouteRequest,
  createPassPlan,
  getLoyaltySettings,
} from '@mestechko/contracts/client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useApi } from './api-context';
import { useQueryCache } from './query-cache';

export type PassPlanBody = RouteRequest<typeof createPassPlan>['body'];
type LoyaltySettings = ClientResult<typeof getLoyaltySettings>;

export const loyaltyKeys = {
  settings: (businessId: string) => ['loyalty', businessId] as const,
};

/** `enabled: false` for people whose role cannot see loyalty settings. */
export function useLoyaltySettings(businessId: string, enabled = true) {
  const api = useApi();
  return useQuery({
    queryKey: loyaltyKeys.settings(businessId),
    queryFn: ({ signal }) =>
      api.request('getLoyaltySettings', { params: { businessId } }, { signal }),
    enabled,
  });
}

function useSettingsCache(businessId: string) {
  return useQueryCache<LoyaltySettings>(loyaltyKeys.settings(businessId));
}

function withPlan(settings: LoyaltySettings, plan: PassPlan): LoyaltySettings {
  return {
    ...settings,
    plans: settings.plans.some((candidate) => candidate.id === plan.id)
      ? settings.plans.map((candidate) => (candidate.id === plan.id ? plan : candidate))
      : [...settings.plans, plan],
  };
}

/** Shown at once; the previous program returns if the server refuses. */
export function useUpdateLoyaltyProgram(businessId: string) {
  const api = useApi();
  const cache = useSettingsCache(businessId);
  return useMutation({
    mutationFn: (program: LoyaltyProgram) =>
      api.request('updateLoyaltyProgram', { params: { businessId }, body: program }),
    onMutate: (program) => cache.change((settings) => ({ ...settings, program })),
    onSuccess: (program) => {
      cache.update((settings) => ({ ...settings, program }));
    },
    onError: (_error, _program, context) => {
      cache.restore(context?.previous);
    },
    onSettled: cache.refresh,
  });
}

export function useCreatePassPlan(businessId: string) {
  const api = useApi();
  const cache = useSettingsCache(businessId);
  return useMutation({
    mutationFn: (body: PassPlanBody) =>
      api.request('createPassPlan', { params: { businessId }, body }),
    onSuccess: (plan) => {
      cache.update((settings) => withPlan(settings, plan));
    },
    onSettled: cache.refresh,
  });
}

/** Shown at once, e.g. taking a pass off sale; the previous terms return on failure. */
export function useUpdatePassPlan(businessId: string) {
  const api = useApi();
  const cache = useSettingsCache(businessId);
  return useMutation({
    mutationFn: (input: { readonly plan: PassPlan; readonly body: PassPlanBody }) =>
      api.request('updatePassPlan', {
        params: { businessId, planId: input.plan.id },
        body: input.body,
      }),
    onMutate: ({ plan, body }) =>
      cache.change((settings) =>
        withPlan(settings, {
          ...plan,
          name: body.name,
          visits: body.visits,
          validityDays: body.validityDays,
          price: { ...plan.price, amountMinor: body.priceMinor },
          serviceIds: body.serviceIds,
          isActive: body.isActive,
        }),
      ),
    onSuccess: (plan) => {
      cache.update((settings) => withPlan(settings, plan));
    },
    onError: (_error, _input, context) => {
      cache.restore(context?.previous);
    },
    onSettled: cache.refresh,
  });
}

/** The body that keeps a plan's terms as they are. */
export function planBodyOf(plan: PassPlan): PassPlanBody {
  return {
    name: plan.name,
    visits: plan.visits,
    validityDays: plan.validityDays,
    priceMinor: plan.price.amountMinor,
    serviceIds: plan.serviceIds,
    isActive: plan.isActive,
  };
}
