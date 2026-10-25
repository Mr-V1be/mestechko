/** Who the clients of a demo business are, in the language of its city. */
export interface DemoPopulation {
  readonly femaleNames: readonly string[];
  readonly maleNames: readonly string[];
  /** Surnames as [masculine, feminine]; where surnames have no gender both are the same. */
  readonly surnames: readonly (readonly [string, string])[];
  /** Occasional notes clients leave when booking. */
  readonly comments: readonly string[];
}
