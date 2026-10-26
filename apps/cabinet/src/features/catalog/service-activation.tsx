import type { ServiceAdmin } from '@slotwise/contracts/client';
import { ConfirmDialog, useToast } from '@slotwise/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUpdateService } from '../../platform/api/catalog-queries';
import { errorMessage } from '../common/error-message';

/**
 * Turns booking of a service on or off. Turning it off asks first, naming what changes
 * for clients; the list shows the new state at once and returns if the server refuses.
 */
export function useServiceActivation(businessId: string) {
  const { t } = useTranslation();
  const toast = useToast();
  const update = useUpdateService(businessId);
  const [asking, setAsking] = useState<{ service: ServiceAdmin; open: boolean } | null>(null);

  const apply = (service: ServiceAdmin, isActive: boolean) => {
    update.mutate(
      { serviceId: service.id, changes: { isActive } },
      {
        onSuccess: () => {
          toast.show({
            title: t(
              isActive ? 'services:activation.activated' : 'services:activation.deactivated',
              {
                name: service.name,
              },
            ),
          });
        },
        onError: (error) => {
          toast.show({
            tone: 'error',
            title: t('services:activation.failed'),
            description: errorMessage(t, error),
          });
        },
      },
    );
  };

  const request = (service: ServiceAdmin, isActive: boolean) => {
    if (isActive) {
      apply(service, true);
    } else {
      setAsking({ service, open: true });
    }
  };

  const dialog = (
    <ConfirmDialog
      open={asking?.open ?? false}
      onOpenChange={(open) => {
        setAsking((current) => (current ? { ...current, open } : current));
      }}
      title={t('services:activation.title', { name: asking?.service.name ?? '' })}
      consequence={t('services:activation.consequence')}
      confirmLabel={t('services:activation.confirm')}
      cancelLabel={t('common:actions.cancel')}
      closeLabel={t('common:actions.close')}
      tone="danger"
      onConfirm={() => {
        if (asking) {
          apply(asking.service, false);
          setAsking({ ...asking, open: false });
        }
      }}
    />
  );

  return { request, dialog };
}
