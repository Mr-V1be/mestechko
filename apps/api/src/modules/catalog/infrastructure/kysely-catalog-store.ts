import { sql } from 'kysely';
import type { IncompatiblePair } from '@mestechko/domain';
import type { KyselyUnitOfWork } from '../../../platform/db/kysely-unit-of-work.js';
import type { StaffServiceTerms } from '../application/catalog-reader.js';
import type {
  CatalogStore,
  CategoryRecord,
  ServiceRecord,
  StaffRecord,
  TermsInput,
} from '../application/catalog-store.js';

const serviceColumns = [
  'id',
  'categoryId',
  'name',
  'description',
  'durationMinutes',
  'bufferBeforeMinutes',
  'bufferAfterMinutes',
  'priceMinor',
  'resourceTypeId',
  'depositPercent',
  'isActive',
] as const;

const nextSortOrder = (table: 'staff_members' | 'service_categories' | 'services') =>
  sql<number>`(select coalesce(max(sort_order), -1) + 1 from ${sql.table(table)})`;

export class KyselyCatalogStore implements CatalogStore {
  constructor(private readonly unitOfWork: KyselyUnitOfWork) {}

  private get db() {
    return this.unitOfWork.tenant();
  }

  private get businessId() {
    return this.unitOfWork.currentBusinessId();
  }

  listStaff(): Promise<StaffRecord[]> {
    return this.db
      .selectFrom('staffMembers')
      .select(['id', 'displayName', 'title', 'avatarSeed', 'isActive'])
      .orderBy('isActive', 'desc')
      .orderBy('sortOrder')
      .orderBy('id')
      .execute();
  }

  async findStaff(staffId: string): Promise<StaffRecord | null> {
    const row = await this.db
      .selectFrom('staffMembers')
      .select(['id', 'displayName', 'title', 'avatarSeed', 'isActive'])
      .where('id', '=', staffId)
      .executeTakeFirst();
    return row ?? null;
  }

  async createStaff(staff: StaffRecord, now: Date): Promise<void> {
    await this.db
      .insertInto('staffMembers')
      .values({
        ...staff,
        businessId: this.businessId,
        sortOrder: nextSortOrder('staff_members'),
        createdAt: now,
      })
      .execute();
  }

  async updateStaff(staffId: string, changes: Partial<Omit<StaffRecord, 'id'>>): Promise<void> {
    if (Object.keys(changes).length === 0) {
      return;
    }
    await this.db.updateTable('staffMembers').set(changes).where('id', '=', staffId).execute();
  }

  async setStaffServices(
    staffId: string,
    terms: readonly (TermsInput & { readonly serviceId: string })[],
  ): Promise<void> {
    await this.db.deleteFrom('staffServices').where('staffId', '=', staffId).execute();
    if (terms.length > 0) {
      await this.db
        .insertInto('staffServices')
        .values(terms.map((term) => ({ ...term, staffId, businessId: this.businessId })))
        .execute();
    }
  }

  listCategories(): Promise<CategoryRecord[]> {
    return this.db
      .selectFrom('serviceCategories')
      .select(['id', 'name'])
      .orderBy('sortOrder')
      .orderBy('id')
      .execute();
  }

  async createCategory(category: CategoryRecord, now: Date): Promise<void> {
    await this.db
      .insertInto('serviceCategories')
      .values({
        ...category,
        businessId: this.businessId,
        sortOrder: nextSortOrder('service_categories'),
        createdAt: now,
      })
      .execute();
  }

  async updateCategory(categoryId: string, changes: { readonly name?: string }): Promise<void> {
    if (changes.name !== undefined) {
      await this.db
        .updateTable('serviceCategories')
        .set({ name: changes.name })
        .where('id', '=', categoryId)
        .execute();
    }
  }

  async moveCategory(categoryId: string, position: number): Promise<void> {
    const ids = (await this.listCategories()).map((category) => category.id);
    await this.reorder('serviceCategories', moved(ids, categoryId, position));
  }

  listServices(): Promise<ServiceRecord[]> {
    return this.db
      .selectFrom('services')
      .select(serviceColumns)
      .orderBy('sortOrder')
      .orderBy('id')
      .execute();
  }

  async findService(serviceId: string): Promise<ServiceRecord | null> {
    const row = await this.db
      .selectFrom('services')
      .select(serviceColumns)
      .where('id', '=', serviceId)
      .executeTakeFirst();
    return row ?? null;
  }

  async createService(service: ServiceRecord, now: Date): Promise<void> {
    await this.db
      .insertInto('services')
      .values({
        ...service,
        businessId: this.businessId,
        templateKey: null,
        sortOrder: nextSortOrder('services'),
        createdAt: now,
      })
      .execute();
  }

  async updateService(
    serviceId: string,
    changes: Partial<Omit<ServiceRecord, 'id'>>,
  ): Promise<void> {
    if (Object.keys(changes).length === 0) {
      return;
    }
    await this.db.updateTable('services').set(changes).where('id', '=', serviceId).execute();
  }

  async moveService(serviceId: string, position: number): Promise<void> {
    const service = await this.findService(serviceId);
    if (!service) {
      return;
    }
    const siblings = (await this.listServices())
      .filter((candidate) => candidate.categoryId === service.categoryId)
      .map((candidate) => candidate.id);
    await this.reorder('services', moved(siblings, serviceId, position));
  }

  async setServiceStaff(
    serviceId: string,
    terms: readonly (TermsInput & { readonly staffId: string })[],
  ): Promise<void> {
    await this.db.deleteFrom('staffServices').where('serviceId', '=', serviceId).execute();
    if (terms.length > 0) {
      await this.db
        .insertInto('staffServices')
        .values(terms.map((term) => ({ ...term, serviceId, businessId: this.businessId })))
        .execute();
    }
  }

  listTerms(): Promise<StaffServiceTerms[]> {
    return this.db
      .selectFrom('staffServices')
      .select(['staffId', 'serviceId', 'durationMinutes', 'priceMinor'])
      .execute();
  }

  listIncompatibilities(): Promise<IncompatiblePair[]> {
    return this.db
      .selectFrom('serviceIncompatibilities')
      .select(['serviceId', 'otherServiceId'])
      .execute();
  }

  async setIncompatibilities(
    serviceId: string,
    otherIds: readonly string[],
    now: Date,
  ): Promise<void> {
    await this.db
      .deleteFrom('serviceIncompatibilities')
      .where((eb) => eb.or([eb('serviceId', '=', serviceId), eb('otherServiceId', '=', serviceId)]))
      .execute();
    const pairs = [...new Set(otherIds)]
      .filter((otherId) => otherId !== serviceId)
      .map((otherId) =>
        serviceId < otherId
          ? { serviceId, otherServiceId: otherId }
          : { serviceId: otherId, otherServiceId: serviceId },
      );
    if (pairs.length > 0) {
      await this.db
        .insertInto('serviceIncompatibilities')
        .values(pairs.map((pair) => ({ ...pair, businessId: this.businessId, createdAt: now })))
        .execute();
    }
  }

  private async reorder(
    table: 'serviceCategories' | 'services',
    ids: readonly string[],
  ): Promise<void> {
    for (const [sortOrder, id] of ids.entries()) {
      await this.db.updateTable(table).set({ sortOrder }).where('id', '=', id).execute();
    }
  }
}

/** The ids with one of them moved to a position, the others keeping their order. */
function moved(ids: readonly string[], id: string, position: number): string[] {
  const rest = ids.filter((candidate) => candidate !== id);
  const index = Math.max(0, Math.min(position, rest.length));
  return [...rest.slice(0, index), id, ...rest.slice(index)];
}
