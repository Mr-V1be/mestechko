/** Areas of the business cabinet guarded by role permissions. */
export const accessAreas = ['schedule', 'bookings'] as const;
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
  owner: { areas: { schedule: 'all', bookings: 'all' }, requiresStaffProfile: false },
  admin: { areas: { schedule: 'all', bookings: 'all' }, requiresStaffProfile: false },
  staff: { areas: { schedule: 'own', bookings: 'own' }, requiresStaffProfile: true },
} as const satisfies Record<string, RoleDefinition>;

export type RoleId = keyof typeof roles;

export const roleIds = Object.keys(roles) as RoleId[];

export function accessScope(role: RoleId, area: AccessArea): AccessScope {
  return roles[role].areas[area];
}
