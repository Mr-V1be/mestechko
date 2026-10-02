import { invariant } from '../shared/domain-error.js';

/** What the engine needs to know about a bookable service. */
export interface ServiceSpec {
  readonly id: string;
  readonly durationMinutes: number;
  /** Preparation before the client arrives; occupies staff and resource. */
  readonly bufferBeforeMinutes: number;
  /** Clean-up after the client leaves; occupies staff and resource. */
  readonly bufferAfterMinutes: number;
  /** Resource type the service needs, e.g. a dental cabinet or a car lift. */
  readonly resourceTypeId: string | null;
}

/** Staff-specific terms for a service; absent terms mean the staff member does not provide it. */
export interface StaffServiceTerms {
  readonly durationMinutes: number | null;
}

const MAX_SERVICE_MINUTES = 12 * 60;

function isPositiveMinutes(value: number): boolean {
  return Number.isInteger(value) && value > 0 && value <= MAX_SERVICE_MINUTES;
}

function isBufferMinutes(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= MAX_SERVICE_MINUTES;
}

export function validateServiceSpec(service: ServiceSpec): void {
  invariant(
    isPositiveMinutes(service.durationMinutes),
    'invalid_service_combo',
    `Service ${service.id} has an invalid duration`,
  );
  invariant(
    isBufferMinutes(service.bufferBeforeMinutes) && isBufferMinutes(service.bufferAfterMinutes),
    'invalid_service_combo',
    `Service ${service.id} has invalid buffers`,
  );
}

export function validateStaffServiceTerms(terms: StaffServiceTerms): void {
  invariant(
    terms.durationMinutes === null || isPositiveMinutes(terms.durationMinutes),
    'invalid_service_combo',
    'Staff-specific duration must be positive',
  );
}

/**
 * Services of one booking run back to back with the same staff member; buffers apply
 * only at the edges of the combination (preparation before the first service and
 * clean-up after the last one).
 */
export function validateServiceCombo(services: readonly ServiceSpec[], maxServices: number): void {
  invariant(services.length > 0, 'invalid_service_combo', 'Choose at least one service');
  invariant(
    services.length <= maxServices,
    'invalid_service_combo',
    `At most ${String(maxServices)} services per booking`,
  );
  invariant(
    new Set(services.map((service) => service.id)).size === services.length,
    'invalid_service_combo',
    'A service can appear in a booking only once',
  );
  services.forEach(validateServiceSpec);
}

export function serviceMinutesFor(
  service: ServiceSpec,
  terms: StaffServiceTerms | undefined,
): number {
  return terms?.durationMinutes ?? service.durationMinutes;
}
