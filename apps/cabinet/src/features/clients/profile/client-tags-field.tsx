import { TagInput, type TagInputProps } from '@mestechko/ui';
import { useTranslation } from 'react-i18next';
import { useClientTags } from '../../../platform/api/clients-queries';

export interface ClientTagsFieldProps {
  readonly businessId: string;
  readonly value: readonly string[];
  readonly onChange: (tags: string[]) => void;
  readonly appearance?: TagInputProps['appearance'];
  readonly hideLabel?: boolean;
  readonly disabled?: boolean;
}

/** A client's tags, suggesting the ones the business already uses, most used first. */
export function ClientTagsField({
  businessId,
  value,
  onChange,
  appearance = 'field',
  hideLabel = false,
  disabled = false,
}: ClientTagsFieldProps) {
  const { t } = useTranslation();
  const tags = useClientTags(businessId);
  return (
    <TagInput
      label={t('clients:tags.label')}
      hideLabel={hideLabel}
      value={value}
      onChange={onChange}
      suggestions={tags.data?.tags.map((entry) => entry.tag) ?? []}
      placeholder={t('clients:tags.placeholder')}
      appearance={appearance}
      disabled={disabled}
      texts={{
        remove: (tag) => t('clients:tags.remove', { tag }),
        create: (tag) => t('clients:tags.create', { tag }),
      }}
    />
  );
}
