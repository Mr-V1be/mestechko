import type { ReportMetric } from '@slotwise/domain';
import { Gauge, Repeat, UserX, Wallet, type LucideIcon } from 'lucide-react';

/** How the part and the whole of a share are counted: time in hours or visits. */
export type AmountKind = 'hours' | 'count';

interface MetricView {
  readonly icon: LucideIcon;
  /** What the share is made of, shown next to it in tables; money has no parts. */
  readonly amounts: AmountKind | null;
}

/**
 * How each report metric is shown. Values and units come from the domain's metric
 * registry; a new metric there fails the type check until it has a view here.
 */
export const metricViews = {
  occupancy: { icon: Gauge, amounts: 'hours' },
  revenue: { icon: Wallet, amounts: null },
  no_shows: { icon: UserX, amounts: 'count' },
  repeat_visits: { icon: Repeat, amounts: 'count' },
} as const satisfies Record<ReportMetric, MetricView>;
