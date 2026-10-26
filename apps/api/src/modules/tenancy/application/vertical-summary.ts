import type { VerticalSummary } from '@slotwise/contracts';
import type { VerticalDefinition } from '@slotwise/domain';

/** Public view of a vertical: icon and vocabulary keys for the client apps. */
export function verticalSummaryOf(vertical: VerticalDefinition): VerticalSummary {
  return {
    id: vertical.id,
    icon: vertical.presentation.icon,
    vocabulary: { ...vertical.vocabulary },
  };
}
