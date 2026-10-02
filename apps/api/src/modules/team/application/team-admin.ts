import type {
  AffectedVisit,
  ScheduleChange as ScheduleChangeInput,
  TeamMember,
  TeamMemberSummary,
} from '@mestechko/contracts';
import {
  applyScheduleChange,
  localDateOf,
  Temporal,
  visitsOutsideWork,
  type Clock,
  type PlainDate,
  type StaffWorkCalendar,
} from '@mestechko/domain';
import { ApplicationError, notFound } from '../../../shared/application/application-error.js';
import type { AvatarUrls } from '../../../shared/application/avatar-urls.js';
import { definedFields, type Patch } from '../../../shared/application/patch.js';
import type { IdGenerator } from '../../../shared/application/ports.js';
import type { StaffVisits, StaffVisitView } from '../../booking/application/ports.js';
import type { CatalogReader } from '../../catalog/application/catalog-reader.js';
import type {
  CatalogStore,
  StaffRecord,
  TermsInput,
} from '../../catalog/application/catalog-store.js';
import type { ScheduleStore, StaffScheduleSnapshot } from '../../scheduling/application/ports.js';
import type { ProductionCalendars } from '../../scheduling/application/production-calendars.js';
import type { BusinessContext } from '../../tenancy/application/business-context.js';
import { firstDayOf, scheduleViews, toChange } from './schedule-views.js';

export interface MemberProfile {
  readonly displayName: string;
  readonly title: string | null;
  readonly isActive: boolean;
}

/**
 * The team page: who works here, what they do at which personal terms, and when they
 * work. A schedule change first shows which visits it would leave outside working
 * time; it is saved only if the caller confirmed exactly those. Runs inside the
 * caller's tenant unit of work.
 */
export class TeamAdmin {
  constructor(
    private readonly catalog: CatalogStore,
    private readonly locations: CatalogReader,
    private readonly schedules: ScheduleStore,
    private readonly visits: StaffVisits,
    private readonly calendars: ProductionCalendars,
    private readonly avatars: AvatarUrls,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async list(): Promise<TeamMemberSummary[]> {
    const [staff, terms] = await Promise.all([this.catalog.listStaff(), this.catalog.listTerms()]);
    const snapshots = await this.schedules.snapshots(
      staff.map((member) => member.id),
      await this.today(),
    );
    return staff.map((member) =>
      this.summary(
        member,
        terms.filter((term) => term.staffId === member.id).length,
        snapshots.get(member.id),
      ),
    );
  }

  async member(context: BusinessContext, staffId: string): Promise<TeamMember> {
    const member = await this.catalog.findStaff(staffId);
    if (!member) {
      throw notFound('Staff member');
    }
    const today = await this.today();
    const [terms, snapshot, upcoming] = await Promise.all([
      this.catalog.listTerms(),
      this.snapshotOf(staffId, today),
      this.visits.upcoming(staffId, this.now()),
    ]);
    const own = terms.filter((term) => term.staffId === staffId);
    const currency = context.business.currency;
    return {
      ...this.summary(member, own.length, snapshot),
      upcomingVisits: upcoming.length,
      services: own.map((term) => ({
        serviceId: term.serviceId,
        durationMinutes: term.durationMinutes,
        price: term.priceMinor === null ? null : { amountMinor: term.priceMinor, currency },
      })),
      ...scheduleViews(snapshot),
    };
  }

  async create(
    context: BusinessContext,
    profile: Omit<MemberProfile, 'isActive'>,
  ): Promise<TeamMember> {
    const id = this.ids.next();
    await this.catalog.createStaff({ id, ...profile, avatarSeed: id, isActive: true }, this.now());
    return this.member(context, id);
  }

  async update(
    context: BusinessContext,
    staffId: string,
    changes: Patch<MemberProfile>,
  ): Promise<TeamMember> {
    if (!(await this.catalog.findStaff(staffId))) {
      throw notFound('Staff member');
    }
    await this.catalog.updateStaff(staffId, definedFields(changes));
    return this.member(context, staffId);
  }

  async setServices(
    context: BusinessContext,
    staffId: string,
    services: readonly (TermsInput & { readonly serviceId: string })[],
  ): Promise<TeamMember> {
    if (!(await this.catalog.findStaff(staffId))) {
      throw notFound('Staff member');
    }
    const known = new Set((await this.catalog.listServices()).map((service) => service.id));
    if (services.some((service) => !known.has(service.serviceId))) {
      throw notFound('Service');
    }
    await this.catalog.setStaffServices(staffId, [
      ...new Map(services.map((service) => [service.serviceId, service])).values(),
    ]);
    return this.member(context, staffId);
  }

  /** Visits ahead that the change would leave outside working time. */
  async preview(
    context: BusinessContext,
    staffId: string,
    input: ScheduleChangeInput,
  ): Promise<AffectedVisit[]> {
    return (await this.impact(context, staffId, input)).affected;
  }

  /** Saves the change if it affects exactly as many visits as the caller confirmed. */
  async apply(
    context: BusinessContext,
    staffId: string,
    input: ScheduleChangeInput,
    acknowledgedAffected: number,
  ): Promise<{ member: TeamMember; affected: AffectedVisit[] }> {
    await this.schedules.lockStaff(staffId);
    const { change, affected } = await this.impact(context, staffId, input);
    if (affected.length !== acknowledgedAffected) {
      throw new ApplicationError('impact_changed', 'The change affects other visits now', {
        affected,
      });
    }
    await this.schedules.save(staffId, change, this.now());
    return { member: await this.member(context, staffId), affected };
  }

  private async impact(context: BusinessContext, staffId: string, input: ScheduleChangeInput) {
    if (!(await this.catalog.findStaff(staffId))) {
      throw notFound('Staff member');
    }
    const today = await this.today();
    const snapshot = await this.snapshotOf(staffId, today.subtract({ days: 1 }));
    const change = toChange(input, snapshot);
    if (Temporal.PlainDate.compare(firstDayOf(change), today) < 0) {
      throw new ApplicationError('validation_failed', 'Past days keep their schedule', {
        fields: { date: 'past' },
      });
    }
    const after = applyScheduleChange(snapshot, change);
    const visits = await this.visits.upcoming(staffId, this.now());
    const leftOut = await this.outside(context, visits, snapshot, after);
    return {
      change,
      affected: visits.filter((visit) => leftOut.has(visit.bookingId)).map(affectedOf),
    };
  }

  /** Visits inside working time before the change and outside it after. */
  private async outside(
    context: BusinessContext,
    visits: readonly StaffVisitView[],
    before: StaffWorkCalendar,
    after: StaffWorkCalendar,
  ): Promise<Set<string>> {
    const years = [
      ...new Set(visits.map((visit) => localDateOf(visit.startsAt.getTime(), visit.timeZone).year)),
    ];
    const calendar = await this.calendars.calendarFor(context.business.countryCode, years);
    const calendarContext = { calendar, policy: context.rules.calendarPolicy };
    const outsideOf = (workCalendar: StaffWorkCalendar) =>
      new Set(
        [...new Set(visits.map((visit) => visit.timeZone))].flatMap((timeZone) =>
          visitsOutsideWork(
            visits
              .filter((visit) => visit.timeZone === timeZone)
              .map((visit) => ({
                id: visit.bookingId,
                locationId: visit.locationId,
                occupied: visit.occupied,
              })),
            workCalendar,
            timeZone,
            calendarContext,
          ).map((visit) => visit.id),
        ),
      );
    const already = outsideOf(before);
    return new Set([...outsideOf(after)].filter((id) => !already.has(id)));
  }

  private summary(
    member: StaffRecord,
    serviceCount: number,
    snapshot: StaffScheduleSnapshot | undefined,
  ): TeamMemberSummary {
    const next = snapshot?.absences
      .slice()
      .sort((a, b) => Temporal.PlainDate.compare(a.from, b.from))[0];
    return {
      id: member.id,
      displayName: member.displayName,
      title: member.title,
      avatarUrl: this.avatars.forSeed(member.avatarSeed),
      isActive: member.isActive,
      serviceCount,
      nextAbsence: next
        ? { kind: next.kind, from: next.from.toString(), to: next.to.toString() }
        : null,
    };
  }

  private async snapshotOf(staffId: string, from: PlainDate): Promise<StaffScheduleSnapshot> {
    const snapshot = (await this.schedules.snapshots([staffId], from)).get(staffId);
    if (!snapshot) {
      throw notFound('Staff member');
    }
    return snapshot;
  }

  /** Today in the business's main location, where its schedules are kept. */
  private async today(): Promise<PlainDate> {
    return localDateOf(this.clock.now().epochMilliseconds, await this.locations.homeTimeZone());
  }

  private now(): Date {
    return new Date(this.clock.now().epochMilliseconds);
  }
}

function affectedOf(visit: StaffVisitView): AffectedVisit {
  return {
    bookingId: visit.bookingId,
    status: visit.status,
    start: visit.startsAt.toISOString(),
    end: visit.endsAt.toISOString(),
    timeZone: visit.timeZone,
    clientName: visit.clientName,
    serviceNames: [...visit.serviceNames],
  };
}
