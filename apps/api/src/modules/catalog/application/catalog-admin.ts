import type { CabinetCatalog, CategoryAdmin, ServiceAdmin } from '@mestechko/contracts';
import { incompatibleWith, type Clock, type IncompatiblePair } from '@mestechko/domain';
import { ApplicationError, notFound } from '../../../shared/application/application-error.js';
import { definedFields, type Patch } from '../../../shared/application/patch.js';
import type { IdGenerator } from '../../../shared/application/ports.js';
import type { BusinessContext } from '../../tenancy/application/business-context.js';
import type { StaffServiceTerms } from './catalog-reader.js';
import type { CatalogStore, ServiceFields, ServiceRecord, TermsInput } from './catalog-store.js';

interface CatalogState {
  readonly services: readonly ServiceRecord[];
  readonly terms: readonly StaffServiceTerms[];
  readonly pairs: readonly IncompatiblePair[];
}

/**
 * Services and prices as the business manages them: categories, services, who
 * provides what at which personal price and duration, and services never booked
 * together. Runs inside the caller's tenant unit of work.
 */
export class CatalogAdmin {
  constructor(
    private readonly store: CatalogStore,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async view(context: BusinessContext): Promise<CabinetCatalog> {
    const [categories, state] = await Promise.all([this.store.listCategories(), this.state()]);
    return {
      categories: categories.map((category) => ({
        id: category.id,
        name: category.name,
        services: state.services
          .filter((service) => service.categoryId === category.id)
          .map((service) => this.serviceView(context, service, state)),
      })),
      resourceTypes: context.vertical.resourceTypes.map((type) => ({
        id: type.id,
        term: type.term,
      })),
      depositPercent: context.rules.prepayment.depositPercent,
    };
  }

  async createCategory(context: BusinessContext, name: string): Promise<CategoryAdmin> {
    const id = this.ids.next();
    await this.store.createCategory({ id, name }, this.now());
    return this.category(context, id);
  }

  async updateCategory(
    context: BusinessContext,
    categoryId: string,
    changes: { readonly name?: string | undefined; readonly position?: number | undefined },
  ): Promise<CategoryAdmin> {
    await this.category(context, categoryId);
    if (changes.name !== undefined) {
      await this.store.updateCategory(categoryId, { name: changes.name });
    }
    if (changes.position !== undefined) {
      await this.store.moveCategory(categoryId, changes.position);
    }
    return this.category(context, categoryId);
  }

  async createService(context: BusinessContext, fields: ServiceFields): Promise<ServiceAdmin> {
    await this.assertFields(context, fields);
    const id = this.ids.next();
    await this.store.createService({ id, ...fields, isActive: true }, this.now());
    return this.service(context, id);
  }

  async updateService(
    context: BusinessContext,
    serviceId: string,
    changes: Patch<ServiceFields & { readonly isActive: boolean; readonly position: number }>,
  ): Promise<ServiceAdmin> {
    const current = await this.store.findService(serviceId);
    if (!current) {
      throw notFound('Service');
    }
    const { position, ...fields } = changes;
    const defined: Partial<Omit<ServiceRecord, 'id'>> = definedFields(fields);
    await this.assertFields(context, { ...current, ...defined });
    await this.store.updateService(serviceId, defined);
    if (position !== undefined) {
      await this.store.moveService(serviceId, position);
    }
    return this.service(context, serviceId);
  }

  async setServiceStaff(
    context: BusinessContext,
    serviceId: string,
    staff: readonly (TermsInput & { readonly staffId: string })[],
  ): Promise<ServiceAdmin> {
    if (!(await this.store.findService(serviceId))) {
      throw notFound('Service');
    }
    const known = new Set((await this.store.listStaff()).map((member) => member.id));
    if (staff.some((term) => !known.has(term.staffId))) {
      throw notFound('Staff member');
    }
    await this.store.setServiceStaff(
      serviceId,
      uniqueBy(staff, (term) => term.staffId),
    );
    return this.service(context, serviceId);
  }

  async setIncompatibilities(
    context: BusinessContext,
    serviceId: string,
    otherIds: readonly string[],
  ): Promise<ServiceAdmin> {
    const services = new Set((await this.store.listServices()).map((service) => service.id));
    if (!services.has(serviceId) || otherIds.some((id) => !services.has(id))) {
      throw notFound('Service');
    }
    await this.store.setIncompatibilities(serviceId, otherIds, this.now());
    return this.service(context, serviceId);
  }

  private async assertFields(context: BusinessContext, fields: ServiceFields): Promise<void> {
    const categories = await this.store.listCategories();
    if (!categories.some((category) => category.id === fields.categoryId)) {
      throw notFound('Category');
    }
    if (
      fields.resourceTypeId !== null &&
      !context.vertical.resourceTypes.some((type) => type.id === fields.resourceTypeId)
    ) {
      throw new ApplicationError('validation_failed', 'Unknown resource type', {
        fields: { resourceTypeId: 'invalid' },
      });
    }
  }

  private async category(context: BusinessContext, categoryId: string): Promise<CategoryAdmin> {
    const found = (await this.view(context)).categories.find((item) => item.id === categoryId);
    if (!found) {
      throw notFound('Category');
    }
    return found;
  }

  private async service(context: BusinessContext, serviceId: string): Promise<ServiceAdmin> {
    const state = await this.state();
    const service = state.services.find((candidate) => candidate.id === serviceId);
    if (!service) {
      throw notFound('Service');
    }
    return this.serviceView(context, service, state);
  }

  private async state(): Promise<CatalogState> {
    const [services, terms, pairs] = await Promise.all([
      this.store.listServices(),
      this.store.listTerms(),
      this.store.listIncompatibilities(),
    ]);
    return { services, terms, pairs };
  }

  private serviceView(
    context: BusinessContext,
    service: ServiceRecord,
    state: CatalogState,
  ): ServiceAdmin {
    const currency = context.business.currency;
    return {
      id: service.id,
      categoryId: service.categoryId,
      name: service.name,
      description: service.description,
      durationMinutes: service.durationMinutes,
      bufferBeforeMinutes: service.bufferBeforeMinutes,
      bufferAfterMinutes: service.bufferAfterMinutes,
      price: { amountMinor: service.priceMinor, currency },
      resourceTypeId: service.resourceTypeId,
      depositPercent: service.depositPercent,
      isActive: service.isActive,
      staff: state.terms
        .filter((term) => term.serviceId === service.id)
        .map((term) => ({
          staffId: term.staffId,
          durationMinutes: term.durationMinutes,
          price: term.priceMinor === null ? null : { amountMinor: term.priceMinor, currency },
        })),
      incompatibleWith: [...incompatibleWith([service.id], state.pairs)],
    };
  }

  private now(): Date {
    return new Date(this.clock.now().epochMilliseconds);
  }
}

function uniqueBy<T>(items: readonly T[], key: (item: T) => string): T[] {
  return [...new Map(items.map((item) => [key(item), item])).values()];
}
