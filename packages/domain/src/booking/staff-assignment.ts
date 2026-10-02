/** Facts a strategy may use to order interchangeable staff members for "any" bookings. */
export interface AssignmentContext {
  /** Minutes already booked for the staff member on the day of the slot. */
  bookedMinutes(staffId: string): number;
  /** Position of the staff member in the business's own ordering. */
  rank(staffId: string): number;
}

export interface StaffAssignmentStrategy {
  order(staffIds: readonly string[], context: AssignmentContext): string[];
}

const byRank =
  (context: AssignmentContext) =>
  (a: string, b: string): number =>
    context.rank(a) - context.rank(b);

export const staffAssignmentStrategies = {
  /** Spreads load: the least booked staff member of the day goes first. */
  balanced: {
    order: (staffIds, context) =>
      [...staffIds].sort(
        (a, b) => context.bookedMinutes(a) - context.bookedMinutes(b) || byRank(context)(a, b),
      ),
  },
  /** Fills staff in the business's own order, e.g. senior doctors first. */
  first_listed: {
    order: (staffIds, context) => [...staffIds].sort(byRank(context)),
  },
} as const satisfies Record<string, StaffAssignmentStrategy>;

export type StaffAssignmentStrategyId = keyof typeof staffAssignmentStrategies;

export const staffAssignmentStrategyIds = Object.keys(
  staffAssignmentStrategies,
) as StaffAssignmentStrategyId[];
