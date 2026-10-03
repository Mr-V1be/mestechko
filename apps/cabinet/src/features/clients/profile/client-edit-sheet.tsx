import type { ClientSummary } from '@mestechko/contracts/client';
import { useToast } from '@mestechko/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBusinessRegion, useUpdateClientProfile } from '../../../platform/api/clients-queries';
import { ProfileFields } from './profile-fields';
import { ProfileSheet } from './profile-sheet';
import { profileDraftOf, useProfileForm } from './use-profile-form';

export interface ClientEditSheetProps {
  readonly businessId: string;
  readonly businessSlug: string;
  readonly client: ClientSummary;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

/**
 * Name and contacts of a card. It starts from the card as it is when opened: the
 * caller remounts it with a new `key` for every opening.
 */
export function ClientEditSheet({
  businessId,
  businessSlug,
  client,
  open,
  onOpenChange,
}: ClientEditSheetProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const region = useBusinessRegion(businessSlug);
  const form = useProfileForm(profileDraftOf(client), region.data);
  const [failure, setFailure] = useState<unknown>(null);
  const update = useUpdateClientProfile(businessId, client.id);
  return (
    <ProfileSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('clients:form.editTitle')}
      submitLabel={t('clients:form.save')}
      pending={update.isPending}
      ready={form.ready}
      failure={failure}
      onSubmit={() => {
        const fields = form.submit();
        if (!fields) {
          return;
        }
        setFailure(null);
        update.mutate(fields, {
          onSuccess: () => {
            toast.show({ title: t('clients:form.saved') });
            onOpenChange(false);
          },
          onError: (error) => {
            setFailure(form.reject(error) ? null : error);
          },
        });
      }}
    >
      <ProfileFields form={form} businessId={businessId} />
    </ProfileSheet>
  );
}
