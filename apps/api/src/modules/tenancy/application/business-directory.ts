import type { BookingRulesOverrides, CurrencyCode, Locale, RoleId } from '@slotwise/domain';

export interface BusinessRecord {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly verticalId: string;
  readonly countryCode: string;
  readonly currency: CurrencyCode;
  /** The language the business presents itself in: its catalogue and the demo it opens. */
  readonly locale: Locale;
  readonly rulesOverrides: BookingRulesOverrides;
  readonly isDemo: boolean;
}

export interface RoleHolder {
  readonly role: RoleId;
  readonly userId: string;
  readonly displayName: string;
}

export interface MembershipRecord {
  readonly business: BusinessRecord;
  readonly role: RoleId;
  readonly staffId: string | null;
}

/** Tenants of the platform. Not tenant-scoped itself: it is how a tenant is found. */
export interface BusinessDirectory {
  findBySlug(slug: string): Promise<BusinessRecord | null>;
  findById(id: string): Promise<BusinessRecord | null>;
  /** Saves the name and the rules that differ from the vertical's defaults. */
  updateSettings(
    id: string,
    settings: { readonly name: string; readonly rulesOverrides: BookingRulesOverrides },
    now: Date,
  ): Promise<void>;
  listDemo(): Promise<BusinessRecord[]>;
  listCountryCodes(): Promise<string[]>;
}

/** Which businesses a cabinet user belongs to, and in what role. */
export interface MembershipDirectory {
  listForUser(userId: string): Promise<MembershipRecord[]>;
  find(userId: string, businessId: string): Promise<MembershipRecord | null>;
  /** First user holding the role in the business, e.g. the owner for demo sign-in. */
  findUserWithRole(businessId: string, role: RoleId): Promise<string | null>;
  /** The first member of each role in the business, in registry order of roles. */
  listRoleHolders(businessId: string): Promise<RoleHolder[]>;
}

export const BUSINESS_DIRECTORY = Symbol('BUSINESS_DIRECTORY');
export const MEMBERSHIP_DIRECTORY = Symbol('MEMBERSHIP_DIRECTORY');
