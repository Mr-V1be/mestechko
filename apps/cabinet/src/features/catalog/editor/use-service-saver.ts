import type { ServiceAdmin } from '@slotwise/contracts/client';
import type { CurrencyCode } from '@slotwise/domain';
import { useMutation } from '@tanstack/react-query';
import {
  useCreateService,
  useSetServiceIncompatibilities,
  useSetServiceStaff,
  useUpdateService,
} from '../../../platform/api/catalog-queries';
import {
  changesOf,
  fieldsOf,
  incompatibleChanged,
  staffChanged,
  staffTermsOf,
  type ServiceDraft,
} from './service-draft';

export interface SaveServiceInput {
  readonly draft: ServiceDraft;
  /** The service as saved, `null` for a new one. */
  readonly saved: ServiceAdmin | null;
  readonly currency: CurrencyCode;
  /** Called as soon as a new service exists, so a retry after a later failure edits it. */
  readonly onCreated: (service: ServiceAdmin) => void;
}

/**
 * Saves a service in the API's steps: its fields, who provides it, and what it is never
 * booked with. Each step is sent only when its part changed, so a retry after a failure
 * sends only what is still missing.
 */
export function useServiceSaver(businessId: string) {
  const create = useCreateService(businessId);
  const update = useUpdateService(businessId);
  const staff = useSetServiceStaff(businessId);
  const incompatible = useSetServiceIncompatibilities(businessId);
  return useMutation({
    mutationFn: async ({ draft, saved, currency, onCreated }: SaveServiceInput) => {
      let service: ServiceAdmin;
      if (saved === null) {
        service = await create.mutateAsync(fieldsOf(draft, currency));
        onCreated(service);
      } else {
        const changes = changesOf(draft, saved, currency);
        service =
          Object.keys(changes).length > 0
            ? await update.mutateAsync({ serviceId: saved.id, changes })
            : saved;
      }
      if (staffChanged(draft, service, currency)) {
        service = await staff.mutateAsync({
          serviceId: service.id,
          staff: staffTermsOf(draft, currency),
        });
      }
      if (incompatibleChanged(draft, service)) {
        service = await incompatible.mutateAsync({
          serviceId: service.id,
          serviceIds: draft.incompatibleWith,
        });
      }
      return { service, created: saved === null };
    },
  });
}
