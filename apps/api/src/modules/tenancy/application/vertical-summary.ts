import type { VerticalSummary } from '@mestechko/contracts';
import type { VerticalDefinition } from '@mestechko/domain';

/** Public view of a vertical: icon and vocabulary keys for the client apps. */
export function verticalSummaryOf(vertical: VerticalDefinition): VerticalSummary {
  return {
    id: vertical.id,
    icon: vertical.presentation.icon,
    vocabulary: { ...vertical.vocabulary },
  };
}
