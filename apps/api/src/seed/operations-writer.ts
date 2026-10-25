import {
  localDateOf,
  moneyFromMajor,
  passCovers,
  pointsEarned,
  type LedgerReason,
  type LoyaltySettings,
  type PlainDate,
} from '@mestechko/domain';
import type { Transaction } from 'kysely';
import type { Database } from '../platform/db/database.js';
import type { IdGenerator } from '../shared/application/ports.js';
import type { BuiltCatalog } from './catalog-builder.js';
import type { WrittenBooking } from './messenger-clients.js';
import { Random } from './random.js';

const BATCH_SIZE = 400;
/** Clients with this many visits behind them carry the business's regular tag. */
const REGULAR_VISITS = 4;
const TAG_SHARE = 0.05;
const NOTE_SHARE = 0.07;
/** Regulars who bought a pass, per plan. */
const PASS_HOLDERS_PER_PLAN = 6;

type Tx = Transaction<Database>;

interface LedgerRow {
  readonly id: string;
  readonly businessId: string;
  readonly clientId: string;
  readonly account: 'points' | 'pass' | 'money';
  readonly reason: LedgerReason;
  readonly amount: number;
  readonly currency: string | null;
  readonly passId: string | null;
  readonly bookingId: string | null;
  readonly createdAt: Date;
}

interface SoldPass {
  readonly id: string;
  readonly clientId: string;
  readonly serviceIds: readonly string[];
  readonly validUntil: PlainDate;
  readonly soldAt: Date;
  visitsLeft: number;
}

async function inBatches<T>(rows: readonly T[], write: (batch: T[]) => Promise<unknown>) {
  for (let index = 0; index < rows.length; index += BATCH_SIZE) {
    await write(rows.slice(index, index + BATCH_SIZE));
  }
}

/**
 * The business as it runs: absences, incompatible services, loyalty, passes sold to
 * regulars, the money and points of past visits in the ledger, and tagged, annotated
 * client cards. Written in the same transaction as the business.
 */
export async function writeOperations(
  tx: Tx,
  input: {
    readonly catalog: BuiltCatalog;
    readonly written: readonly WrittenBooking[];
    readonly clientIds: ReadonlyMap<number, string>;
    readonly ids: IdGenerator;
    readonly now: Date;
  },
): Promise<void> {
  const { catalog, written, clientIds, ids, now } = input;
  const businessId = catalog.businessId;
  const definition = catalog.definition;
  const timeZone = catalog.locations[0]?.timeZone;
  if (!timeZone) {
    throw new Error(`${definition.slug} has no location`);
  }
  const random = new Random(
    `${definition.slug}:operations:${localDateOf(now.getTime(), timeZone).toString()}`,
  );

  const absences = catalog.staff.flatMap((member) =>
    member.absences.map((absence) => ({
      id: absence.id,
      businessId,
      staffId: member.id,
      kind: absence.kind,
      startsOn: absence.from.toString(),
      endsOn: absence.to.toString(),
      createdAt: now,
    })),
  );
  if (absences.length > 0) {
    await tx.insertInto('staffAbsences').values(absences).execute();
  }
  if (catalog.incompatible.length > 0) {
    await tx
      .insertInto('serviceIncompatibilities')
      .values(catalog.incompatible.map((pair) => ({ ...pair, businessId, createdAt: now })))
      .execute();
  }
  const loyalty: LoyaltySettings | null = definition.loyalty
    ? { kind: 'cashback_points', ...definition.loyalty }
    : null;
  if (loyalty) {
    await tx
      .insertInto('loyaltyPrograms')
      .values({ businessId, ...loyalty, updatedAt: now })
      .execute();
  }

  const completed = written
    .filter((entry) => entry.booking.status === 'completed')
    .sort((a, b) => a.booking.plan.start - b.booking.plan.start);
  const visitsOf = new Map<string, number>();
  for (const entry of completed) {
    const clientId = clientIds.get(entry.booking.clientIndex) ?? '';
    visitsOf.set(clientId, (visitsOf.get(clientId) ?? 0) + 1);
  }

  const passes = await writePasses(tx, { ...input, completed, visitsOf, random, timeZone });
  const ledger: LedgerRow[] = [...passes.ledger];
  for (const entry of completed) {
    const clientId = clientIds.get(entry.booking.clientIndex) ?? '';
    const date = localDateOf(entry.booking.plan.end, timeZone);
    const serviceIds = entry.booking.services.map((service) => service.id);
    const at = new Date(entry.booking.plan.end);
    const row = (
      reason: LedgerReason,
      account: LedgerRow['account'],
      amount: number,
      passId: string | null = null,
    ): LedgerRow => ({
      id: ids.next(),
      businessId,
      clientId,
      account,
      reason,
      amount,
      currency: account === 'money' ? definition.currency : null,
      passId,
      bookingId: entry.id,
      createdAt: at,
    });
    const pass = passes.sold.find(
      (candidate) =>
        candidate.clientId === clientId &&
        candidate.soldAt.getTime() < entry.booking.plan.start &&
        passCovers(candidate, serviceIds, date),
    );
    if (pass) {
      pass.visitsLeft -= 1;
      ledger.push(row('pass_visit', 'pass', -1, pass.id));
      continue;
    }
    ledger.push(row('visit_payment', 'money', entry.booking.totalMinor));
    const earned = loyalty ? pointsEarned(loyalty, entry.booking.totalMinor) : 0;
    if (earned > 0) {
      ledger.push(row('points_accrual', 'points', earned));
    }
  }
  await inBatches(ledger, (batch) => tx.insertInto('ledgerEntries').values(batch).execute());

  await tagAndAnnotate(tx, { ...input, visitsOf, random });
}

async function writePasses(
  tx: Tx,
  input: {
    readonly catalog: BuiltCatalog;
    readonly completed: readonly WrittenBooking[];
    readonly clientIds: ReadonlyMap<number, string>;
    readonly visitsOf: ReadonlyMap<string, number>;
    readonly ids: IdGenerator;
    readonly now: Date;
    readonly random: Random;
    readonly timeZone: string;
  },
): Promise<{ sold: SoldPass[]; ledger: LedgerRow[] }> {
  const { catalog, completed, clientIds, ids, now } = input;
  const businessId = catalog.businessId;
  const sold: SoldPass[] = [];
  const ledger: LedgerRow[] = [];
  for (const [sortOrder, plan] of (catalog.definition.passPlans ?? []).entries()) {
    const planId = ids.next();
    const serviceIds = plan.services.map((template) => {
      const service = catalog.services.find((candidate) => candidate.templateKey === template);
      if (!service) {
        throw new Error(`Pass plan service "${template}" is not offered`);
      }
      return service.id;
    });
    const priceMinor = moneyFromMajor(plan.priceMajor, catalog.definition.currency).amountMinor;
    await tx
      .insertInto('passPlans')
      .values({
        id: planId,
        businessId,
        name: plan.name,
        visits: plan.visits,
        validityDays: plan.validityDays,
        priceMinor,
        isActive: true,
        sortOrder,
        createdAt: now,
        updatedAt: now,
      })
      .execute();
    await tx
      .insertInto('passPlanServices')
      .values(serviceIds.map((serviceId) => ({ businessId, planId, serviceId })))
      .execute();
    // Regulars of these services buy the pass a day before one of their visits.
    const firstCovered = new Map<string, WrittenBooking>();
    for (const entry of completed) {
      const clientId = clientIds.get(entry.booking.clientIndex) ?? '';
      const covered = entry.booking.services.every((service) => serviceIds.includes(service.id));
      if (
        covered &&
        (input.visitsOf.get(clientId) ?? 0) >= REGULAR_VISITS &&
        !firstCovered.has(clientId)
      ) {
        firstCovered.set(clientId, entry);
      }
    }
    const holders = [...firstCovered.entries()].slice(0, PASS_HOLDERS_PER_PLAN);
    for (const [clientId, entry] of holders) {
      const passId = ids.next();
      const at = new Date(entry.booking.plan.start - 86_400_000);
      const validFrom = localDateOf(at.getTime(), input.timeZone);
      const validUntil = validFrom.add({ days: plan.validityDays - 1 });
      await tx
        .insertInto('clientPasses')
        .values({
          id: passId,
          businessId,
          clientId,
          planId,
          name: plan.name,
          visits: plan.visits,
          priceMinor,
          validFrom: validFrom.toString(),
          validUntil: validUntil.toString(),
          soldAt: at,
          soldByUserId: null,
          idempotencyKey: ids.next(),
        })
        .execute();
      await tx
        .insertInto('clientPassServices')
        .values(serviceIds.map((serviceId) => ({ businessId, passId, serviceId })))
        .execute();
      sold.push({
        id: passId,
        clientId,
        serviceIds,
        validUntil,
        soldAt: at,
        visitsLeft: plan.visits,
      });
      const base = { businessId, clientId, passId, bookingId: null, createdAt: at };
      ledger.push(
        {
          ...base,
          id: ids.next(),
          account: 'pass',
          reason: 'pass_sale',
          amount: plan.visits,
          currency: null,
        },
        {
          ...base,
          id: ids.next(),
          account: 'money',
          reason: 'pass_payment',
          amount: priceMinor,
          currency: catalog.definition.currency,
        },
      );
    }
  }
  return { sold, ledger };
}

async function tagAndAnnotate(
  tx: Tx,
  input: {
    readonly catalog: BuiltCatalog;
    readonly clientIds: ReadonlyMap<number, string>;
    readonly visitsOf: ReadonlyMap<string, number>;
    readonly ids: IdGenerator;
    readonly now: Date;
    readonly random: Random;
  },
): Promise<void> {
  const { crm } = input.catalog.definition;
  const notes = [];
  // Cards with the same tags are updated together: a handful of statements in all.
  const byTags = new Map<string, string[]>();
  for (const clientId of input.clientIds.values()) {
    const tags = [
      ...((input.visitsOf.get(clientId) ?? 0) >= REGULAR_VISITS ? [crm.regularTag] : []),
      ...(input.random.chance(TAG_SHARE) ? [input.random.pick(crm.tags)] : []),
    ];
    if (tags.length > 0) {
      const key = JSON.stringify(tags);
      byTags.set(key, [...(byTags.get(key) ?? []), clientId]);
    }
    if (input.random.chance(NOTE_SHARE)) {
      notes.push({
        id: input.ids.next(),
        businessId: input.catalog.businessId,
        clientId,
        authorUserId: null,
        body: input.random.pick(crm.notes),
        createdAt: input.now,
        updatedAt: input.now,
      });
    }
  }
  for (const [key, clientIds] of byTags) {
    await tx
      .updateTable('clients')
      .set({ tags: JSON.parse(key) as string[] })
      .where('id', 'in', clientIds)
      .execute();
  }
  await inBatches(notes, (batch) => tx.insertInto('clientNotes').values(batch).execute());
}
