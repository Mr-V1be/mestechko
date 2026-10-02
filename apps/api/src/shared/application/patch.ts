/** A partial change as it arrives from a request: absent fields stay as they are. */
export type Patch<T> = { readonly [K in keyof T]?: T[K] | undefined };

/** The fields a patch actually sets. */
export function definedFields<T extends object>(patch: Patch<T>): Partial<T> {
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}
