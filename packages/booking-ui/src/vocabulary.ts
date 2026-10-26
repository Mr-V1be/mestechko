import type { VerticalSummary } from '@slotwise/contracts/client';
import { useTranslation } from 'react-i18next';

/**
 * Words of the business's vertical: "мастер" in a salon, "врач" in a clinic.
 * Every form is a translation key, so new verticals only add translations.
 */
export function useVocabulary(vertical: VerticalSummary | null | undefined) {
  const { t } = useTranslation();
  const staff = vertical?.vocabulary.staff ?? 'master';
  const resource = vertical?.vocabulary.resource ?? 'workplace';
  const client = vertical?.vocabulary.client ?? 'client';
  return {
    staffOne: t(`terms:staff.${staff}.one`),
    staffMany: t(`terms:staff.${staff}.many`),
    staffAny: t(`terms:staff.${staff}.any`),
    staffChoose: t(`terms:staff.${staff}.choose`),
    staffNext: t(`terms:staff.${staff}.next`),
    resourceOne: t(`terms:resource.${resource}.one`),
    resourceMany: t(`terms:resource.${resource}.many`),
    clientOne: t(`terms:client.${client}.one`),
    clientMany: t(`terms:client.${client}.many`),
    resourceType: (term: string) => t(`terms:resourceType.${term}`),
    verticalName: vertical ? t(`catalog:verticals.${vertical.id}`) : '',
  };
}
