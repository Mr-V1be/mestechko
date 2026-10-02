/** Areas of the business cabinet guarded by role permissions. */
export const accessAreas = [
  'schedule',
  'bookings',
  'messengers',
  'clients',
  'team',
  'catalog',
  'loyalty',
  'reports',
  'settings',
] as const;
export type AccessArea = (typeof accessAreas)[number];

/** `own` limits access to the staff member's own records. */
export const accessScopes = ['none', 'own', 'all'] as const;
export type AccessScope = (typeof accessScopes)[number];

interface RoleDefinition {
  readonly areas: Readonly<Record<AccessArea, AccessScope>>;
  /** Whether the role must be linked to a staff profile (for `own` scopes). */
  readonly requiresStaffProfile: boolean;
}

export const roles = {
  owner: {
    areas: {
      schedule: 'all',
      bookings: 'all',
      messengers: 'all',
      clients: 'all',
      team: 'all',
      catalog: 'all',
      loyalty: 'all',
      reports: 'all',
      settings: 'all',
    },
    requiresStaffProfile: false,
  },
  /** Runs the front desk: everything but the business's own rules. */
  admin: {
    areas: {
      schedule: 'all',
      bookings: 'all',
      messengers: 'all',
      clients: 'all',
      team: 'all',
      catalog: 'all',
      loyalty: 'all',
      reports: 'all',
      settings: 'none',
    },
    requiresStaffProfile: false,
  },
  /** Sees and keeps their own day; the rest of the business is not theirs to change. */
  staff: {
    areas: {
      schedule: 'own',
      bookings: 'own',
      messengers: 'none',
      clients: 'none',
      team: 'none',
      catalog: 'none',
      loyalty: 'none',
      reports: 'own',
      settings: 'none',
    },
    requiresStaffProfile: true,
  },
} as const satisfies Record<string, RoleDefinition>;

export type RoleId = keyof typeof roles;

export const roleIds = Object.keys(roles) as RoleId[];

export function accessScope(role: RoleId, area: AccessArea): AccessScope {
  return roles[role].areas[area];
}
