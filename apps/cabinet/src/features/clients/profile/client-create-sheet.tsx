import { useToast } from '@slotwise/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useBusinessRegion, useCreateClient } from '../../../platform/api/clients-queries';
import { ClientTagsField } from './client-tags-field';
import { ProfileFields } from './profile-fields';
import { ProfileSheet } from './profile-sheet';
import { emptyProfile, useProfileForm } from './use-profile-form';

export interface ClientCreateSheetProps {
  readonly businessId: string;
  readonly businessSlug: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

/**
 * A new client card. What was typed survives closing the sheet until the card is
 * added; then the new card opens.
 */
export function ClientCreateSheet({
  businessId,
  businessSlug,
  open,
  onOpenChange,
}: ClientCreateSheetProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const region = useBusinessRegion(businessSlug);
  const form = useProfileForm(emptyProfile, region.data);
  const [tags, setTags] = useState<string[]>([]);
  const [failure, setFailure] = useState<unknown>(null);
  const create = useCreateClient(businessId);
  return (
    <ProfileSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('clients:form.createTitle')}
      submitLabel={t('clients:form.create')}
      pending={create.isPending}
      ready={form.ready}
      failure={failure}
      onSubmit={() => {
        const fields = form.submit();
        if (!fields) {
          return;
        }
        setFailure(null);
        create.mutate(
          { ...fields, tags },
          {
            onSuccess: (card) => {
              toast.show({
                title: t('clients:form.created'),
                description: card.client.displayName,
              });
              form.reset(emptyProfile);
              setTags([]);
              onOpenChange(false);
              void navigate(`/b/${businessId}/clients/${card.client.id}`);
            },
            onError: (error) => {
              setFailure(form.reject(error) ? null : error);
            },
          },
        );
      }}
    >
      <ProfileFields form={form} businessId={businessId} />
      <ClientTagsField businessId={businessId} value={tags} onChange={setTags} />
    </ProfileSheet>
  );
}
