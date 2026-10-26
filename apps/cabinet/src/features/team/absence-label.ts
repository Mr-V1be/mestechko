import { useFormat } from '@slotwise/booking-ui';
import type { TeamMemberSummary } from '@slotwise/contracts/client';
import type { AbsenceKind } from '@slotwise/domain';
import { Coffee, Thermometer, TreePalm, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type Absence = NonNullable<TeamMemberSummary['nextAbsence']>;

/** How each kind of absence is pictured; a new kind of the domain needs its icon here. */
export const absenceIcons: Readonly<Record<AbsenceKind, LucideIcon>> = {
  vacation: TreePalm,
  sick_leave: Thermometer,
  day_off: Coffee,
};

/** «В отпуске до 18 окт.» while it lasts, «Отпуск 12–18 окт.» before it starts. */
export function useAbsenceLabel(): (absence: Absence, today: string) => string {
  const { t } = useTranslation('team');
  const format = useFormat();
  return (absence, today) =>
    absence.from <= today
      ? t(`absence.current.${absence.kind}`, {
          date: format.localDate(absence.to, 'dayMonthShort'),
        })
      : t(`absence.upcoming.${absence.kind}`, {
          dates: format.localDateRange(absence.from, absence.to, 'dayMonthShort'),
        });
}
