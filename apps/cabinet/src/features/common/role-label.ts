import { useVocabulary } from '@slotwise/booking-ui';
import type { Membership, VerticalSummary } from '@slotwise/contracts/client';
import { useTranslation } from 'react-i18next';

type Role = Membership['role'];
type Vocabulary = ReturnType<typeof useVocabulary>;
type Translate = ReturnType<typeof useTranslation>['t'];

/** Every role has a label; a staff member is called what the vertical calls them. */
const roleLabels: Readonly<Record<Role, (t: Translate, vocabulary: Vocabulary) => string>> = {
  owner: (t) => t('roles.owner'),
  admin: (t) => t('roles.admin'),
  staff: (_t, vocabulary) => vocabulary.staffOne,
};

export function useRoleLabel(vertical: VerticalSummary | null | undefined): (role: Role) => string {
  const { t } = useTranslation();
  const vocabulary = useVocabulary(vertical);
  return (role) => roleLabels[role](t, vocabulary);
}
