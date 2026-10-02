import type { KyselyUnitOfWork } from '../../../platform/db/kysely-unit-of-work.js';
import type {
  CatalogReader,
  LocationView,
  ResourceView,
  ServiceView,
  StaffServiceTerms,
  StaffView,
} from '../application/catalog-reader.js';

export class KyselyCatalogReader implements CatalogReader {
  constructor(private readonly unitOfWork: KyselyUnitOfWork) {}

  listLocations(): Promise<LocationView[]> {
    return this.unitOfWork
      .tenant()
      .selectFrom('locations')
      .select(['id', 'name', 'address', 'timeZone'])
      .orderBy('sortOrder')
      .orderBy('id')
      .execute();
  }

  async findLocation(id: string): Promise<LocationView | null> {
    const row = await this.unitOfWork
      .tenant()
      .selectFrom('locations')
      .select(['id', 'name', 'address', 'timeZone'])
      .where('id', '=', id)
      .executeTakeFirst();
    return row ?? null;
  }

  async listServices(ids?: readonly string[]): Promise<ServiceView[]> {
    if (ids?.length === 0) {
      return [];
    }
    let query = this.unitOfWork
      .tenant()
      .selectFrom('services')
      .innerJoin('serviceCategories', 'serviceCategories.id', 'services.categoryId')
      .select([
        'services.id',
        'services.categoryId',
        'serviceCategories.name as categoryName',
        'services.name',
        'services.description',
        'services.durationMinutes',
        'services.bufferBeforeMinutes',
        'services.bufferAfterMinutes',
        'services.priceMinor',
        'services.resourceTypeId',
      ])
      .where('services.isActive', '=', true)
      .orderBy('serviceCategories.sortOrder')
      .orderBy('services.sortOrder')
      .orderBy('services.id');
    if (ids) {
      query = query.where('services.id', 'in', ids);
    }
    return query.execute();
  }

  async listStaff(ids?: readonly string[]): Promise<StaffView[]> {
    if (ids?.length === 0) {
      return [];
    }
    let query = this.unitOfWork
      .tenant()
      .selectFrom('staffMembers')
      .select(['id', 'displayName', 'title', 'avatarSeed', 'sortOrder as rank'])
      .where('isActive', '=', true)
      .orderBy('sortOrder')
      .orderBy('id');
    if (ids) {
      query = query.where('id', 'in', ids);
    }
    return query.execute();
  }

  async listResources(locationId?: string): Promise<ResourceView[]> {
    let query = this.unitOfWork
      .tenant()
      .selectFrom('resources')
      .select(['id', 'locationId', 'typeId', 'name'])
      .orderBy('sortOrder')
      .orderBy('id');
    if (locationId) {
      query = query.where('locationId', '=', locationId);
    }
    return query.execute();
  }

  async listStaffTerms(serviceIds: readonly string[]): Promise<StaffServiceTerms[]> {
    if (serviceIds.length === 0) {
      return [];
    }
    return this.unitOfWork
      .tenant()
      .selectFrom('staffServices')
      .innerJoin('staffMembers', 'staffMembers.id', 'staffServices.staffId')
      .select([
        'staffServices.staffId',
        'staffServices.serviceId',
        'staffServices.durationMinutes',
        'staffServices.priceMinor',
      ])
      .where('staffMembers.isActive', '=', true)
      .where('staffServices.serviceId', 'in', serviceIds)
      .execute();
  }
}
