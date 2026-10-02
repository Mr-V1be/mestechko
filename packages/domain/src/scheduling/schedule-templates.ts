import { invariant } from '../shared/domain-error.js';
import type { PlainDate } from '../time/zoned-time.js';
import type { DayTemplate } from './day-template.js';
import type { SchedulePattern } from './schedule-pattern.js';

const DAYS_PER_WEEK = 7;

interface ScheduleTemplateDefinition {
  /** Builds the pattern from working hours, chosen weekdays and the cycle's first day. */
  readonly build: (input: {
    readonly hours: DayTemplate;
    readonly weekdays: readonly number[];
    readonly anchorDate: PlainDate;
  }) => SchedulePattern;
}

const cycle = (on: number, off: number): ScheduleTemplateDefinition => ({
  build: ({ hours, anchorDate }) => ({
    kind: 'cycle',
    anchorDate,
    days: [...Array.from({ length: on }, () => hours), ...Array.from({ length: off }, () => null)],
  }),
});

/**
 * Ready-made schedules a business assigns to staff: the usual work week, shift cycles
 * counted from a start date, or chosen weekdays. A new template is one entry here.
 */
export const scheduleTemplates = {
  five_two: {
    build: ({ hours }) => ({
      kind: 'weekly',
      week: Array.from({ length: DAYS_PER_WEEK }, (_, index) => (index < 5 ? hours : null)),
    }),
  },
  two_two: cycle(2, 2),
  three_three: cycle(3, 3),
  weekdays: {
    build: ({ hours, weekdays }) => {
      invariant(
        weekdays.length > 0 &&
          weekdays.every((day) => Number.isInteger(day) && day >= 1 && day <= 7),
        'invalid_schedule',
        'Choose at least one weekday from Monday (1) to Sunday (7)',
      );
      return {
        kind: 'weekly',
        week: Array.from({ length: DAYS_PER_WEEK }, (_, index) =>
          weekdays.includes(index + 1) ? hours : null,
        ),
      };
    },
  },
} as const satisfies Record<string, ScheduleTemplateDefinition>;

export type ScheduleTemplate = keyof typeof scheduleTemplates;

export const scheduleTemplateIds = Object.keys(scheduleTemplates) as ScheduleTemplate[];

export function patternFromTemplate(
  template: ScheduleTemplate,
  input: { hours: DayTemplate; weekdays: readonly number[]; anchorDate: PlainDate },
): SchedulePattern {
  return scheduleTemplates[template].build(input);
}
