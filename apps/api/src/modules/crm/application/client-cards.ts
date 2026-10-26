import type { ClientCard, ClientNote, ClientSummary } from '@slotwise/contracts';
import type { Clock } from '@slotwise/domain';
import { ApplicationError, notFound } from '../../../shared/application/application-error.js';
import { definedFields, type Patch } from '../../../shared/application/patch.js';
import type { IdGenerator } from '../../../shared/application/ports.js';
import type { CabinetBookings } from '../../booking/application/cabinet/cabinet-bookings.js';
import type { ClientVisitStats } from '../../booking/application/cabinet/ports.js';
import type { CatalogStore } from '../../catalog/application/catalog-store.js';
import type {
  ClientCrmStore,
  ClientFields,
  ClientProfile,
  ClientSearch,
} from '../../clients/application/crm-ports.js';
import type { CabinetActor, LoyaltyAdmin } from '../../loyalty/application/loyalty-admin.js';
import type { BusinessContext } from '../../tenancy/application/business-context.js';

const VISITS_ON_CARD = 20;
const NOTES_ON_CARD = 50;
const DEFAULT_PAGE_SIZE = 50;

const noVisits: ClientVisitStats = {
  visits: 0,
  noShows: 0,
  cancellations: 0,
  spentMinor: 0,
  lastVisitAt: null,
  nextVisitAt: null,
};

/** Tags as people type them: trimmed, without repeats that differ only in case. */
export function normalizeTags(tags: readonly string[]): string[] {
  const seen = new Map<string, string>();
  for (const tag of tags.map((value) => value.trim()).filter(Boolean)) {
    if (!seen.has(tag.toLowerCase())) {
      seen.set(tag.toLowerCase(), tag);
    }
  }
  return [...seen.values()];
}

/**
 * The client CRM: cards with visits, no-shows, notes, tags, passes and points, and the
 * search over them. Composes the clients, bookings and loyalty modules; runs inside the
 * caller's tenant unit of work.
 */
export class ClientCards {
  constructor(
    private readonly store: ClientCrmStore,
    private readonly bookings: CabinetBookings,
    private readonly loyalty: LoyaltyAdmin,
    private readonly catalog: CatalogStore,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async list(
    query: ClientSearch,
    page: { readonly cursor: string | null; readonly limit: number | null },
  ): Promise<{ items: ClientSummary[]; nextCursor: string | null }> {
    const found = await this.store.search(query, {
      cursor: page.cursor,
      limit: page.limit ?? DEFAULT_PAGE_SIZE,
    });
    const stats = await this.bookings.statsOf(found.items.map((client) => client.id));
    return {
      items: found.items.map((client) => summaryOf(client, stats.get(client.id) ?? noVisits)),
      nextCursor: found.nextCursor,
    };
  }

  tags() {
    return this.store.tagCounts();
  }

  async card(context: BusinessContext, clientId: string): Promise<ClientCard> {
    const client = await this.store.find(clientId);
    if (!client) {
      throw notFound('Client');
    }
    const [stats, visits, notes, loyalty, services] = await Promise.all([
      this.bookings.statsOf([clientId]),
      this.bookings.ofClient(clientId, VISITS_ON_CARD),
      this.store.notes(clientId, NOTES_ON_CARD),
      this.loyalty.clientLoyalty(clientId),
      this.catalog.listServices(),
    ]);
    const visitStats = stats.get(clientId) ?? noVisits;
    const currency = context.business.currency;
    const serviceName = new Map(services.map((service) => [service.id, service.name]));
    return {
      client: summaryOf(client, visitStats),
      stats: {
        visits: visitStats.visits,
        noShows: visitStats.noShows,
        cancellations: visitStats.cancellations,
        spent: { amountMinor: visitStats.spentMinor, currency },
      },
      upcoming: visits.upcoming,
      history: visits.history,
      notes: notes.map(noteOf),
      loyalty: {
        points: loyalty.points,
        passes: loyalty.passes.map((pass) => ({
          id: pass.id,
          name: pass.name,
          visits: pass.visits,
          visitsLeft: pass.visitsLeft,
          validFrom: pass.validFrom.toString(),
          validUntil: pass.validUntil.toString(),
          serviceNames: pass.serviceIds.flatMap((id) => serviceName.get(id) ?? []),
          price: { amountMinor: pass.priceMinor, currency },
        })),
        ledger: loyalty.ledger.map((entry) => ({
          id: entry.id,
          account: entry.account,
          reason: entry.reason,
          amount: entry.amount,
          currency: entry.currency,
          passName: entry.passName,
          note: entry.note,
          createdAt: entry.createdAt.toISOString(),
        })),
      },
    };
  }

  async create(context: BusinessContext, fields: ClientFields): Promise<ClientCard> {
    const normalized = { ...fields, tags: normalizeTags(fields.tags) };
    await this.assertPhoneFree(normalized.phone, null);
    const id = this.ids.next();
    await this.store.create(id, normalized, this.now());
    return this.card(context, id);
  }

  async update(
    context: BusinessContext,
    clientId: string,
    changes: Patch<ClientFields>,
  ): Promise<ClientCard> {
    if (!(await this.store.find(clientId))) {
      throw notFound('Client');
    }
    const defined = definedFields(changes);
    if (defined.phone !== undefined) {
      await this.assertPhoneFree(defined.phone, clientId);
    }
    await this.store.update(
      clientId,
      defined.tags ? { ...defined, tags: normalizeTags(defined.tags) } : defined,
      this.now(),
    );
    return this.card(context, clientId);
  }

  async addNote(clientId: string, body: string, authorUserId: string): Promise<ClientNote> {
    if (!(await this.store.find(clientId))) {
      throw notFound('Client');
    }
    const id = this.ids.next();
    await this.store.addNote({ id, clientId, authorUserId, body, now: this.now() });
    const note = (await this.store.notes(clientId, NOTES_ON_CARD)).find((item) => item.id === id);
    if (!note) {
      throw new Error(`Note ${id} vanished inside its transaction`);
    }
    return noteOf(note);
  }

  async deleteNote(clientId: string, noteId: string): Promise<void> {
    if (!(await this.store.deleteNote(clientId, noteId))) {
      throw notFound('Note');
    }
  }

  async sellPass(
    context: BusinessContext,
    clientId: string,
    planId: string,
    idempotencyKey: string,
    actor: CabinetActor,
  ): Promise<ClientCard> {
    await this.assertClient(clientId);
    await this.loyalty.sellPass(clientId, planId, idempotencyKey, actor);
    return this.card(context, clientId);
  }

  async adjustPoints(
    context: BusinessContext,
    clientId: string,
    change: { readonly amount: number; readonly note: string; readonly idempotencyKey: string },
    actor: CabinetActor,
  ): Promise<ClientCard> {
    await this.assertClient(clientId);
    await this.loyalty.adjustPoints(clientId, change, actor);
    return this.card(context, clientId);
  }

  private async assertClient(clientId: string): Promise<void> {
    if (!(await this.store.find(clientId))) {
      throw notFound('Client');
    }
  }

  /** One card per phone: a second card for the same number would split the history. */
  private async assertPhoneFree(phone: string | null, ownId: string | null): Promise<void> {
    if (phone === null) {
      return;
    }
    const owner = (await this.store.idsByPhone([phone])).get(phone);
    if (owner && owner !== ownId) {
      throw new ApplicationError('validation_failed', 'Another client has this phone', {
        fields: { phone: 'taken' },
        clientId: owner,
      });
    }
  }

  private now(): Date {
    return new Date(this.clock.now().epochMilliseconds);
  }
}

function summaryOf(client: ClientProfile, stats: ClientVisitStats): ClientSummary {
  return {
    id: client.id,
    displayName: client.displayName,
    phone: client.phone,
    email: client.email,
    tags: [...client.tags],
    messenger: client.messenger,
    visits: stats.visits,
    noShows: stats.noShows,
    lastVisitAt: stats.lastVisitAt?.toISOString() ?? null,
    nextVisitAt: stats.nextVisitAt?.toISOString() ?? null,
    createdAt: client.createdAt.toISOString(),
  };
}

function noteOf(note: {
  id: string;
  body: string;
  authorName: string | null;
  createdAt: Date;
}): ClientNote {
  return {
    id: note.id,
    body: note.body,
    authorName: note.authorName,
    createdAt: note.createdAt.toISOString(),
  };
}
