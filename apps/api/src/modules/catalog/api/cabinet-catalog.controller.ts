import { Controller, Inject } from '@nestjs/common';
import {
  createService,
  createServiceCategory,
  getCabinetCatalog,
  setServiceIncompatibilities,
  setServiceStaff,
  updateService,
  updateServiceCategory,
  type RouteInput,
  type RouteResult,
} from '@mestechko/contracts';
import { CurrentBusinessAccess } from '../../../platform/http/auth.guard.js';
import { ContractInput, ContractRoute } from '../../../platform/http/contract-route.js';
import type { BusinessAccess } from '../../../shared/application/business-access.js';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../shared/application/unit-of-work.js';
import { RequireAccess } from '../../tenancy/api/business-access.guard.js';
import {
  BusinessContextResolver,
  type BusinessContext,
} from '../../tenancy/application/business-context.js';
import { CatalogAdmin } from '../application/catalog-admin.js';

/** Services and prices of the business, edited from the cabinet. */
@Controller()
export class CabinetCatalogController {
  constructor(
    @Inject(CatalogAdmin) private readonly catalog: CatalogAdmin,
    @Inject(BusinessContextResolver) private readonly businesses: BusinessContextResolver,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  @ContractRoute(getCabinetCatalog)
  @RequireAccess('catalog')
  view(
    @CurrentBusinessAccess() access: BusinessAccess,
  ): Promise<RouteResult<typeof getCabinetCatalog>> {
    return this.inTenant(access, (context) => this.catalog.view(context), true);
  }

  @ContractRoute(createServiceCategory)
  @RequireAccess('catalog')
  createCategory(
    @ContractInput() input: RouteInput<typeof createServiceCategory>,
    @CurrentBusinessAccess() access: BusinessAccess,
  ): Promise<RouteResult<typeof createServiceCategory>> {
    return this.inTenant(access, (context) =>
      this.catalog.createCategory(context, input.body.name),
    );
  }

  @ContractRoute(updateServiceCategory)
  @RequireAccess('catalog')
  updateCategory(
    @ContractInput() input: RouteInput<typeof updateServiceCategory>,
    @CurrentBusinessAccess() access: BusinessAccess,
  ): Promise<RouteResult<typeof updateServiceCategory>> {
    return this.inTenant(access, (context) =>
      this.catalog.updateCategory(context, input.params.categoryId, input.body),
    );
  }

  @ContractRoute(createService)
  @RequireAccess('catalog')
  createService(
    @ContractInput() input: RouteInput<typeof createService>,
    @CurrentBusinessAccess() access: BusinessAccess,
  ): Promise<RouteResult<typeof createService>> {
    return this.inTenant(access, (context) => this.catalog.createService(context, input.body));
  }

  @ContractRoute(updateService)
  @RequireAccess('catalog')
  updateService(
    @ContractInput() input: RouteInput<typeof updateService>,
    @CurrentBusinessAccess() access: BusinessAccess,
  ): Promise<RouteResult<typeof updateService>> {
    return this.inTenant(access, (context) =>
      this.catalog.updateService(context, input.params.serviceId, input.body),
    );
  }

  @ContractRoute(setServiceStaff)
  @RequireAccess('catalog')
  setStaff(
    @ContractInput() input: RouteInput<typeof setServiceStaff>,
    @CurrentBusinessAccess() access: BusinessAccess,
  ): Promise<RouteResult<typeof setServiceStaff>> {
    return this.inTenant(access, (context) =>
      this.catalog.setServiceStaff(context, input.params.serviceId, input.body.staff),
    );
  }

  @ContractRoute(setServiceIncompatibilities)
  @RequireAccess('catalog')
  setIncompatible(
    @ContractInput() input: RouteInput<typeof setServiceIncompatibilities>,
    @CurrentBusinessAccess() access: BusinessAccess,
  ): Promise<RouteResult<typeof setServiceIncompatibilities>> {
    return this.inTenant(access, (context) =>
      this.catalog.setIncompatibilities(context, input.params.serviceId, input.body.serviceIds),
    );
  }

  private async inTenant<T>(
    access: BusinessAccess,
    work: (context: BusinessContext) => Promise<T>,
    readOnly = false,
  ): Promise<T> {
    const context = await this.businesses.byId(access.businessId);
    return this.unitOfWork.inTenant(context.business.id, () => work(context), { readOnly });
  }
}
