import { absenceKinds, scheduleTemplateIds } from '@mestechko/domain';
import { z } from 'zod';
import {
  bookingStatusSchema,
  instantSchema,
  localDateSchema,
  moneySchema,
  uuidSchema,
} from '../../primitives.js';
import { defineRoute } from '../../route.js';
import { cabinetParamsSchema } from './schedule.js';

const MAX_NAME_LENGTH = 120;
const MAX_CYCLE_DAYS = 56;
const MAX_BREAKS = 4;
const MAX_SERVICES = 200;

const staffParamsSchema = cabinetParamsSchema.extend({ staffId: uuidSchema });

/** Local wall time, `HH:MM`; `24:00` closes a day. */
export const wallTimeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/);

export const wallRangeSchema = z.object({ start: wallTimeSchema, end: wallTimeSchema });

/** Working hours of a day with its breaks. */
export const dayHoursSchema = z.object({
  start: wallTimeSchema,
  end: wallTimeSchema,
  breaks: z.array(wallRangeSchema).max(MAX_BREAKS),
});

export const schedulePatternSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('weekly'), days: z.array(dayHoursSchema.nullable()).length(7) }),
  z.object({
    kind: z.literal('cycle'),
    /** The first day of the cycle. */
    anchorDate: localDateSchema,
    days: z.array(dayHoursSchema.nullable()).min(1).max(MAX_CYCLE_DAYS),
  }),
]);

/** A pattern as the cabinet sets it: ready-made from a template, or day by day. */
export const patternInputSchema = z.union([
  schedulePatternSchema,
  z.object({
    kind: z.literal('template'),
    template: z.enum(scheduleTemplateIds),
    hours: dayHoursSchema,
    /** ISO weekdays (1 = Monday) for templates by weekday. */
    weekdays: z.array(z.number().int().min(1).max(7)).max(7),
    /** First working day of a shift cycle. */
    anchorDate: localDateSchema,
  }),
]);

export const teamMemberSummarySchema = z.object({
  id: uuidSchema,
  displayName: z.string(),
  title: z.string().nullable(),
  avatarUrl: z.string(),
  isActive: z.boolean(),
  /** Services the person provides. */
  serviceCount: z.number().int(),
  /** Days away from today on, if any. */
  nextAbsence: z
    .object({ kind: z.enum(absenceKinds), from: localDateSchema, to: localDateSchema })
    .nullable(),
});

export const staffAssignmentSchema = z.object({
  id: uuidSchema,
  locationId: uuidSchema,
  pattern: schedulePatternSchema,
  validFrom: localDateSchema,
  validUntil: localDateSchema.nullable(),
});

export const staffDayExceptionSchema = z.object({
  date: localDateSchema,
  /** `null` for a day off. */
  locationId: uuidSchema.nullable(),
  hours: dayHoursSchema.nullable(),
});

export const staffAbsenceSchema = z.object({
  id: uuidSchema,
  kind: z.enum(absenceKinds),
  from: localDateSchema,
  to: localDateSchema,
});

export const staffServiceTermsSchema = z.object({
  serviceId: uuidSchema,
  /** `null` keeps the service's own duration and price. */
  durationMinutes: z.number().int().min(1).max(720).nullable(),
  price: moneySchema.nullable(),
});

export const teamMemberSchema = teamMemberSummarySchema.extend({
  services: z.array(staffServiceTermsSchema),
  assignments: z.array(staffAssignmentSchema),
  /** Date exceptions from today on. */
  exceptions: z.array(staffDayExceptionSchema),
  /** Absences ending today or later. */
  absences: z.array(staffAbsenceSchema),
});

/** A change of someone's working time, previewed and then applied as one. */
export const scheduleChangeSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('pattern'),
    locationId: uuidSchema,
    pattern: patternInputSchema,
    /** The new schedule applies from this date on; earlier days keep the old one. */
    validFrom: localDateSchema,
  }),
  z.object({
    type: z.literal('day'),
    date: localDateSchema,
    day: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('work'), locationId: uuidSchema, hours: dayHoursSchema }),
      z.object({ kind: z.literal('off') }),
      /** Back to the regular schedule. */
      z.object({ kind: z.literal('regular') }),
    ]),
  }),
  z.object({
    type: z.literal('absence'),
    kind: z.enum(absenceKinds),
    from: localDateSchema,
    to: localDateSchema,
  }),
  z.object({ type: z.literal('absence_removal'), absenceId: uuidSchema }),
]);

/** A visit the change would leave outside working time. */
export const affectedVisitSchema = z.object({
  bookingId: uuidSchema,
  status: bookingStatusSchema,
  start: instantSchema,
  end: instantSchema,
  timeZone: z.string(),
  clientName: z.string(),
  serviceNames: z.array(z.string()),
});

export const listTeam = defineRoute({
  method: 'GET',
  path: '/v1/cabinet/businesses/:businessId/team',
  summary: 'Staff of the business, active first',
  tag: 'cabinet',
  auth: 'session',
  status: 200,
  params: cabinetParamsSchema,
  response: z.object({ members: z.array(teamMemberSummarySchema) }),
});

export const getTeamMember = defineRoute({
  method: 'GET',
  path: '/v1/cabinet/businesses/:businessId/team/:staffId',
  summary: 'A staff member with services, schedules, exceptions and absences',
  tag: 'cabinet',
  auth: 'session',
  status: 200,
  params: staffParamsSchema,
  response: teamMemberSchema,
});

const memberProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(MAX_NAME_LENGTH),
  title: z
    .string()
    .trim()
    .max(MAX_NAME_LENGTH)
    .nullable()
    .transform((value) => (value === '' ? null : value)),
});

export const createTeamMember = defineRoute({
  method: 'POST',
  path: '/v1/cabinet/businesses/:businessId/team',
  summary: 'Add a staff member',
  tag: 'cabinet',
  auth: 'session',
  status: 201,
  params: cabinetParamsSchema,
  body: memberProfileSchema,
  response: teamMemberSchema,
});

export const updateTeamMember = defineRoute({
  method: 'PATCH',
  path: '/v1/cabinet/businesses/:businessId/team/:staffId',
  summary: 'Change a staff member’s profile, or take them off or back on bookings',
  tag: 'cabinet',
  auth: 'session',
  status: 200,
  params: staffParamsSchema,
  body: memberProfileSchema.partial().extend({ isActive: z.boolean().optional() }),
  response: teamMemberSchema,
});

export const setTeamMemberServices = defineRoute({
  method: 'PUT',
  path: '/v1/cabinet/businesses/:businessId/team/:staffId/services',
  summary: 'Services a staff member provides, with personal durations and prices',
  tag: 'cabinet',
  auth: 'session',
  status: 200,
  params: staffParamsSchema,
  body: z.object({
    services: z
      .array(
        z.object({
          serviceId: uuidSchema,
          durationMinutes: z.number().int().min(1).max(720).nullable(),
          priceMinor: z.number().int().min(0).nullable(),
        }),
      )
      .max(MAX_SERVICES),
  }),
  response: teamMemberSchema,
});

export const previewScheduleChange = defineRoute({
  method: 'POST',
  path: '/v1/cabinet/businesses/:businessId/team/:staffId/schedule-changes/preview',
  summary: 'Upcoming visits a schedule change would leave outside working time',
  tag: 'cabinet',
  auth: 'session',
  status: 200,
  params: staffParamsSchema,
  body: z.object({ change: scheduleChangeSchema }),
  response: z.object({ affected: z.array(affectedVisitSchema) }),
});

export const applyScheduleChange = defineRoute({
  method: 'POST',
  path: '/v1/cabinet/businesses/:businessId/team/:staffId/schedule-changes',
  summary:
    'Apply a schedule change; the caller confirms how many visits it affects, and a different count is refused',
  tag: 'cabinet',
  auth: 'session',
  status: 200,
  params: staffParamsSchema,
  body: z.object({
    change: scheduleChangeSchema,
    acknowledgedAffected: z.number().int().min(0),
  }),
  response: z.object({ member: teamMemberSchema, affected: z.array(affectedVisitSchema) }),
});

export type TeamMemberSummary = z.infer<typeof teamMemberSummarySchema>;
export type TeamMember = z.infer<typeof teamMemberSchema>;
export type SchedulePatternView = z.infer<typeof schedulePatternSchema>;
export type PatternInput = z.infer<typeof patternInputSchema>;
export type DayHours = z.infer<typeof dayHoursSchema>;
export type ScheduleChange = z.infer<typeof scheduleChangeSchema>;
export type AffectedVisit = z.infer<typeof affectedVisitSchema>;
export type StaffAssignmentView = z.infer<typeof staffAssignmentSchema>;
export type StaffDayException = z.infer<typeof staffDayExceptionSchema>;
export type StaffAbsenceView = z.infer<typeof staffAbsenceSchema>;
