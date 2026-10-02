import {
  resolveBookingRules,
  type BookingRules,
  type VerticalDefinition,
  type VerticalRegistry,
} from '@mestechko/domain';
import { notFound } from '../../../shared/application/application-error.js';
import type { BusinessDirectory, BusinessRecord } from './business-directory.js';

/** A business together with its line of business and effective booking rules. */
export interface BusinessContext {
  readonly business: BusinessRecord;
  readonly vertical: VerticalDefinition;
  readonly rules: BookingRules;
}

export function businessContextOf(
  business: BusinessRecord,
  verticals: VerticalRegistry,
): BusinessContext {
  const vertical = verticals.get(business.verticalId);
  return {
    business,
    vertical,
    rules: resolveBookingRules(vertical.rules, business.rulesOverrides),
  };
}

/** Resolves the business a public or client request addresses. */
export class BusinessContextResolver {
  constructor(
    private readonly directory: BusinessDirectory,
    private readonly verticals: VerticalRegistry,
  ) {}

  contextOf(business: BusinessRecord): BusinessContext {
    return businessContextOf(business, this.verticals);
  }

  async bySlug(slug: string): Promise<BusinessContext> {
    const business = await this.directory.findBySlug(slug);
    if (!business) {
      throw notFound('Business');
    }
    return businessContextOf(business, this.verticals);
  }

  async byId(id: string): Promise<BusinessContext> {
    const business = await this.directory.findById(id);
    if (!business) {
      throw notFound('Business');
    }
    return businessContextOf(business, this.verticals);
  }
}
