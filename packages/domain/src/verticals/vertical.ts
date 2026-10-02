import { validateBookingRules, type BookingRules } from '../booking/booking-rules.js';
import { validateServiceSpec } from '../availability/service-spec.js';
import type { Money } from '../money/money.js';
import { invariant } from '../shared/domain-error.js';

/**
 * Translation keys of the words a vertical uses: "master" in a salon, "doctor" in a
 * clinic, "mechanic" in a garage. Texts live in the translation system.
 */
export interface VerticalVocabulary {
  readonly staff: string;
  readonly resource: string;
  readonly client: string;
}

export interface ResourceTypeDefinition {
  readonly id: string;
  /** Translation key of the resource type name. */
  readonly term: string;
}

/** A typical service offered when a business of the vertical starts out. */
export interface ServiceTemplate {
  readonly key: string;
  readonly categoryKey: string;
  readonly durationMinutes: number;
  readonly bufferBeforeMinutes: number;
  readonly bufferAfterMinutes: number;
  readonly suggestedPrice: Money;
  readonly resourceTypeId: string | null;
}

export interface VerticalPresentation {
  /** Key of the icon in the client apps' icon registry. */
  readonly icon: string;
}

/** A line of business. Adding a vertical means adding one definition to the registry. */
export interface VerticalDefinition {
  readonly id: string;
  readonly presentation: VerticalPresentation;
  readonly vocabulary: VerticalVocabulary;
  readonly resourceTypes: readonly ResourceTypeDefinition[];
  readonly serviceCategories: readonly string[];
  readonly serviceTemplates: readonly ServiceTemplate[];
  readonly rules: BookingRules;
}

const IDENTIFIER_PATTERN = /^[a-z][a-z0-9_]*$/;

function assertIdentifier(value: string, what: string): void {
  invariant(
    IDENTIFIER_PATTERN.test(value),
    'invalid_vertical',
    `${what} "${value}" is not snake_case`,
  );
}

function assertUnique(values: readonly string[], what: string): void {
  invariant(new Set(values).size === values.length, 'invalid_vertical', `Duplicate ${what}`);
}

export function validateVertical(vertical: VerticalDefinition): void {
  assertIdentifier(vertical.id, 'Vertical id');
  const resourceTypeIds = vertical.resourceTypes.map((type) => type.id);
  resourceTypeIds.forEach((id) => {
    assertIdentifier(id, 'Resource type id');
  });
  assertUnique(resourceTypeIds, `resource types in ${vertical.id}`);
  assertUnique([...vertical.serviceCategories], `service categories in ${vertical.id}`);
  assertUnique(
    vertical.serviceTemplates.map((template) => template.key),
    `service templates in ${vertical.id}`,
  );
  for (const template of vertical.serviceTemplates) {
    invariant(
      vertical.serviceCategories.includes(template.categoryKey),
      'invalid_vertical',
      `Template ${template.key} refers to unknown category ${template.categoryKey}`,
    );
    invariant(
      template.resourceTypeId === null || resourceTypeIds.includes(template.resourceTypeId),
      'invalid_vertical',
      `Template ${template.key} refers to unknown resource type`,
    );
    validateServiceSpec({ id: template.key, ...template });
  }
  validateBookingRules(vertical.rules);
}

/** Identity helper that keeps literal types of a definition while type-checking it. */
export function defineVertical<const T extends VerticalDefinition>(definition: T): T {
  return definition;
}
