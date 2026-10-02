import { DomainError, invariant } from '../shared/domain-error.js';
import { validateVertical, type VerticalDefinition } from './vertical.js';

export class VerticalRegistry {
  private readonly verticals: ReadonlyMap<string, VerticalDefinition>;

  constructor(definitions: readonly VerticalDefinition[]) {
    definitions.forEach(validateVertical);
    const ids = definitions.map((definition) => definition.id);
    invariant(new Set(ids).size === ids.length, 'invalid_vertical', 'Duplicate vertical id');
    this.verticals = new Map(definitions.map((definition) => [definition.id, definition]));
  }

  list(): readonly VerticalDefinition[] {
    return [...this.verticals.values()];
  }

  has(id: string): boolean {
    return this.verticals.has(id);
  }

  get(id: string): VerticalDefinition {
    const vertical = this.verticals.get(id);
    if (!vertical) {
      throw new DomainError('unknown_reference', `Unknown vertical "${id}"`);
    }
    return vertical;
  }

  /** Resource type definition by id within a vertical. */
  resourceType(
    verticalId: string,
    resourceTypeId: string,
  ): VerticalDefinition['resourceTypes'][number] {
    const type = this.get(verticalId).resourceTypes.find(
      (candidate) => candidate.id === resourceTypeId,
    );
    if (!type) {
      throw new DomainError(
        'unknown_reference',
        `Unknown resource type "${resourceTypeId}" in vertical "${verticalId}"`,
      );
    }
    return type;
  }
}
