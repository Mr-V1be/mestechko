import type { IncompatiblePair } from '@mestechko/domain';
import type { StaffServiceTerms } from './catalog-reader.js';

export interface StaffRecord {
  readonly id: string;
  readonly displayName: string;
  readonly title: string | null;
  readonly avatarSeed: string;
  readonly isActive: boolean;
}

export interface CategoryRecord {
  readonly id: string;
  readonly name: string;
}

export interface ServiceRecord {
  readonly id: string;
  readonly categoryId: string;
  readonly name: string;
  readonly description: string | null;
  readonly durationMinutes: number;
  readonly bufferBeforeMinutes: number;
  readonly bufferAfterMinutes: number;
  readonly priceMinor: number;
  readonly resourceTypeId: string | null;
  readonly depositPercent: number | null;
  readonly isActive: boolean;
}

export type ServiceFields = Omit<ServiceRecord, 'id' | 'isActive'>;

/** Personal terms a staff member has for a service, as the cabinet sets them. */
export interface TermsInput {
  readonly durationMinutes: number | null;
  readonly priceMinor: number | null;
}

/**
 * The catalog of the current tenant as the cabinet edits it: inactive staff and
 * services included, in display order. Every call runs inside a tenant unit of work.
 */
export interface CatalogStore {
  listStaff(): Promise<StaffRecord[]>;
  findStaff(staffId: string): Promise<StaffRecord | null>;
  createStaff(staff: StaffRecord, now: Date): Promise<void>;
  updateStaff(staffId: string, changes: Partial<Omit<StaffRecord, 'id'>>): Promise<void>;
  setStaffServices(
    staffId: string,
    terms: readonly (TermsInput & { readonly serviceId: string })[],
  ): Promise<void>;

  listCategories(): Promise<CategoryRecord[]>;
  createCategory(category: CategoryRecord, now: Date): Promise<void>;
  updateCategory(categoryId: string, changes: { readonly name?: string }): Promise<void>;
  moveCategory(categoryId: string, position: number): Promise<void>;

  listServices(): Promise<ServiceRecord[]>;
  findService(serviceId: string): Promise<ServiceRecord | null>;
  createService(service: ServiceRecord, now: Date): Promise<void>;
  updateService(serviceId: string, changes: Partial<Omit<ServiceRecord, 'id'>>): Promise<void>;
  moveService(serviceId: string, position: number): Promise<void>;
  setServiceStaff(
    serviceId: string,
    terms: readonly (TermsInput & { readonly staffId: string })[],
  ): Promise<void>;

  /** Terms of every staff member, active or not. */
  listTerms(): Promise<StaffServiceTerms[]>;
  listIncompatibilities(): Promise<IncompatiblePair[]>;
  setIncompatibilities(serviceId: string, otherIds: readonly string[], now: Date): Promise<void>;
}

export const CATALOG_STORE = Symbol('CATALOG_STORE');
