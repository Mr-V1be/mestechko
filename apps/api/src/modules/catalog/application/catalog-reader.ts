export interface LocationView {
  readonly id: string;
  readonly name: string;
  readonly address: string;
  readonly timeZone: string;
}

export interface ServiceView {
  readonly id: string;
  readonly categoryId: string;
  readonly categoryName: string;
  readonly name: string;
  readonly description: string | null;
  readonly durationMinutes: number;
  readonly bufferBeforeMinutes: number;
  readonly bufferAfterMinutes: number;
  readonly priceMinor: number;
  readonly resourceTypeId: string | null;
}

export interface StaffView {
  readonly id: string;
  readonly displayName: string;
  readonly title: string | null;
  readonly avatarSeed: string;
  readonly rank: number;
}

export interface ResourceView {
  readonly id: string;
  readonly locationId: string;
  readonly typeId: string;
  readonly name: string;
}

/** Personal terms of a staff member for a service; `null` keeps the service default. */
export interface StaffServiceTerms {
  readonly staffId: string;
  readonly serviceId: string;
  readonly durationMinutes: number | null;
  readonly priceMinor: number | null;
}

/** Catalog of the current tenant. Every call must run inside a tenant unit of work. */
export interface CatalogReader {
  listLocations(): Promise<LocationView[]>;
  findLocation(id: string): Promise<LocationView | null>;
  /** Active services in display order; all of them when `ids` is omitted. */
  listServices(ids?: readonly string[]): Promise<ServiceView[]>;
  /** Active staff in display order; all of them when `ids` is omitted. */
  listStaff(ids?: readonly string[]): Promise<StaffView[]>;
  listResources(locationId?: string): Promise<ResourceView[]>;
  /** Terms of active staff for the given services. */
  listStaffTerms(serviceIds: readonly string[]): Promise<StaffServiceTerms[]>;
}

export const CATALOG_READER = Symbol('CATALOG_READER');
