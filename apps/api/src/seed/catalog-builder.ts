import {
  dayTemplate,
  parseWallInterval,
  resolveBookingRules,
  type BookingRules,
  type DayTemplate,
  type IncompatiblePair,
  type PlainDate,
  type SchedulePattern,
  type StaffAbsence,
  type StaffCandidate,
  type VerticalDefinition,
} from '@mestechko/domain';
import type { IdGenerator } from '../shared/application/ports.js';
import type { DemoBusiness, DemoDay, DemoPattern } from './definitions/types.js';

type Translate = (key: string) => string;

export interface IntervalRow {
  readonly dayIndex: number;
  readonly kind: 'work' | 'break';
  readonly startMinute: number;
  readonly endMinute: number;
}

export interface BuiltStaff {
  readonly id: string;
  readonly key: string;
  readonly displayName: string;
  readonly title: string;
  readonly avatarSeed: string;
  readonly sortOrder: number;
  readonly locationId: string;
  readonly terms: readonly {
    serviceId: string;
    durationMinutes: number | null;
    priceMinor: number | null;
  }[];
  readonly schedule: {
    readonly id: string;
    readonly patternKind: 'weekly' | 'cycle';
    readonly cycleLengthDays: number;
    readonly anchorDate: string | null;
    readonly validFrom: string;
    readonly intervals: readonly IntervalRow[];
  };
  readonly daysOff: readonly { readonly id: string; readonly date: string }[];
  readonly absences: readonly (StaffAbsence & { readonly id: string })[];
  readonly candidate: StaffCandidate;
}

export interface BuiltService {
  readonly id: string;
  readonly categoryId: string;
  readonly templateKey: string;
  readonly name: string;
  readonly description: string;
  readonly durationMinutes: number;
  readonly bufferBeforeMinutes: number;
  readonly bufferAfterMinutes: number;
  readonly priceMinor: number;
  readonly resourceTypeId: string | null;
  readonly depositPercent: number | null;
  readonly sortOrder: number;
}

export interface BuiltCatalog {
  readonly businessId: string;
  readonly definition: DemoBusiness;
  readonly vertical: VerticalDefinition;
  readonly rules: BookingRules;
  readonly locations: readonly {
    id: string;
    key: string;
    name: string;
    address: string;
    timeZone: string;
    sortOrder: number;
  }[];
  readonly resources: readonly {
    id: string;
    locationId: string;
    typeId: string;
    name: string;
    sortOrder: number;
  }[];
  readonly categories: readonly { id: string; key: string; name: string; sortOrder: number }[];
  readonly services: readonly BuiltService[];
  /** Services never booked together, as ordered pairs of ids. */
  readonly incompatible: readonly IncompatiblePair[];
  readonly staff: readonly BuiltStaff[];
}

const MINOR_PER_MAJOR = 100;

function templateOf(demo: DemoDay | null): DayTemplate | null {
  if (!demo) {
    return null;
  }
  return dayTemplate(
    [parseWallInterval(demo.hours[0], demo.hours[1])],
    (demo.breaks ?? []).map(([from, to]) => parseWallInterval(from, to)),
  );
}

function intervalRows(days: readonly (DemoDay | null)[]): IntervalRow[] {
  return days.flatMap((demo, dayIndex) => {
    const template = templateOf(demo);
    if (!template) {
      return [];
    }
    return [
      ...template.work.map((interval) => ({
        dayIndex,
        kind: 'work' as const,
        startMinute: interval.start,
        endMinute: interval.end,
      })),
      ...template.breaks.map((interval) => ({
        dayIndex,
        kind: 'break' as const,
        startMinute: interval.start,
        endMinute: interval.end,
      })),
    ];
  });
}

interface ConvertedPattern {
  readonly domain: SchedulePattern;
  readonly days: readonly (DemoDay | null)[];
  readonly anchorDate: PlainDate | null;
}

type DemoPatternByKind = { [K in DemoPattern['kind']]: Extract<DemoPattern, { kind: K }> };
type PatternConverter<P> = (pattern: P, weekStart: PlainDate) => ConvertedPattern;

const patternConverters: { [K in DemoPattern['kind']]: PatternConverter<DemoPatternByKind[K]> } = {
  weekly: (pattern) => ({
    domain: { kind: 'weekly', week: pattern.week.map(templateOf) },
    days: pattern.week,
    anchorDate: null,
  }),
  cycle: (pattern, weekStart) => {
    const anchorDate = weekStart.add({ days: pattern.anchorOffsetDays });
    return {
      domain: { kind: 'cycle', anchorDate, days: pattern.days.map(templateOf) },
      days: pattern.days,
      anchorDate,
    };
  },
};

function converterFor<K extends DemoPattern['kind']>(
  pattern: DemoPatternByKind[K],
): PatternConverter<DemoPatternByKind[K]> {
  return patternConverters[pattern.kind];
}

function convertPattern(pattern: DemoPattern, weekStart: PlainDate): ConvertedPattern {
  return converterFor(pattern)(pattern, weekStart);
}

/** Turns a demo definition into rows with fresh ids plus the matching domain objects. */
export function buildCatalog(input: {
  readonly definition: DemoBusiness;
  readonly vertical: VerticalDefinition;
  readonly ids: IdGenerator;
  readonly translate: Translate;
  readonly seedDate: PlainDate;
  readonly historyStart: PlainDate;
}): BuiltCatalog {
  const { definition, vertical, ids, translate, seedDate, historyStart } = input;
  const weekStart = seedDate.subtract({ days: seedDate.dayOfWeek - 1 });
  const locations = definition.locations.map((location, sortOrder) => ({
    id: ids.next(),
    sortOrder,
    ...location,
  }));
  const locationId = (key: string): string => {
    const location = locations.find((candidate) => candidate.key === key);
    if (!location) {
      throw new Error(`Unknown location "${key}" in ${definition.slug}`);
    }
    return location.id;
  };
  const categories = vertical.serviceCategories.map((key, sortOrder) => ({
    id: ids.next(),
    key,
    name: translate(`catalog:categories.${vertical.id}.${key}`),
    sortOrder,
  }));
  const services: BuiltService[] = definition.services.map((offer, sortOrder) => {
    const template = vertical.serviceTemplates.find(
      (candidate) => candidate.key === offer.template,
    );
    const category = categories.find((candidate) => candidate.key === template?.categoryKey);
    if (!template || !category) {
      throw new Error(`Unknown service template "${offer.template}" in ${definition.slug}`);
    }
    return {
      id: ids.next(),
      categoryId: category.id,
      templateKey: template.key,
      name: translate(`catalog:services.${vertical.id}.${template.key}.name`),
      description: translate(`catalog:services.${vertical.id}.${template.key}.description`),
      durationMinutes: template.durationMinutes,
      bufferBeforeMinutes: template.bufferBeforeMinutes,
      bufferAfterMinutes: template.bufferAfterMinutes,
      priceMinor:
        offer.priceMajor === undefined
          ? template.suggestedPrice.amountMinor
          : offer.priceMajor * MINOR_PER_MAJOR,
      resourceTypeId: template.resourceTypeId,
      depositPercent: offer.depositPercent ?? null,
      sortOrder,
    };
  });
  const serviceId = (template: string): string => {
    const service = services.find((candidate) => candidate.templateKey === template);
    if (!service) {
      throw new Error(`Service "${template}" is not offered by ${definition.slug}`);
    }
    return service.id;
  };

  const staff = definition.staff.map((member, sortOrder): BuiltStaff => {
    const id = ids.next();
    const pattern = convertPattern(member.pattern, weekStart);
    const terms = member.services.map((offer) => {
      const normalized = typeof offer === 'string' ? { template: offer } : offer;
      return {
        serviceId: serviceId(normalized.template),
        durationMinutes: normalized.durationMinutes ?? null,
        priceMinor:
          normalized.priceMajor === undefined ? null : normalized.priceMajor * MINOR_PER_MAJOR,
      };
    });
    const daysOff = (member.daysOff ?? []).map((offset) => ({
      id: ids.next(),
      date: seedDate.add({ days: offset }),
    }));
    const absences = (member.absences ?? []).map((absence) => ({
      id: ids.next(),
      kind: absence.kind,
      from: seedDate.add({ days: absence.from }),
      to: seedDate.add({ days: absence.to }),
    }));
    const memberLocation = locationId(member.locationKey);
    return {
      id,
      key: member.key,
      displayName: member.displayName,
      title: member.title,
      avatarSeed: `${definition.slug}-${member.key}`,
      sortOrder,
      locationId: memberLocation,
      terms,
      schedule: {
        id: ids.next(),
        patternKind: member.pattern.kind,
        cycleLengthDays: pattern.days.length,
        anchorDate: pattern.anchorDate?.toString() ?? null,
        validFrom: historyStart.toString(),
        intervals: intervalRows(pattern.days),
      },
      daysOff: daysOff.map((dayOff) => ({ id: dayOff.id, date: dayOff.date.toString() })),
      absences,
      candidate: {
        id,
        rank: sortOrder,
        workCalendar: {
          assignments: [
            {
              locationId: memberLocation,
              pattern: pattern.domain,
              validFrom: historyStart,
              validUntil: null,
            },
          ],
          overrides: daysOff.map((dayOff) => ({
            date: dayOff.date,
            locationId: null,
            template: null,
          })),
          absences,
        },
        serviceTerms: new Map(
          terms.map((term) => [term.serviceId, { durationMinutes: term.durationMinutes }]),
        ),
      },
    };
  });

  return {
    businessId: ids.next(),
    definition,
    vertical,
    rules: resolveBookingRules(vertical.rules, definition.rulesOverrides ?? {}),
    locations,
    resources: definition.resources.map((resource, sortOrder) => ({
      id: ids.next(),
      locationId: locationId(resource.locationKey),
      typeId: resource.typeId,
      name: resource.name,
      sortOrder,
    })),
    categories,
    services,
    incompatible: (definition.incompatible ?? []).map(([a, b]) => {
      const [first, second] = [serviceId(a), serviceId(b)].sort();
      return { serviceId: first ?? '', otherServiceId: second ?? '' };
    }),
    staff,
  };
}
