import { Controller, Inject } from '@nestjs/common';
import {
  getCabinetOverview,
  getPublicBusiness,
  listDemoBusinesses,
  type DemoBusiness,
  type PublicBusiness,
  type RouteInput,
  type RouteResult,
} from '@mestechko/contracts';
import { CurrentBusinessAccess } from '../../../platform/http/auth.guard.js';
import { ContractInput, ContractRoute } from '../../../platform/http/contract-route.js';
import type { BusinessAccess } from '../../../platform/http/principal.js';
import { RequireAccess } from '../../tenancy/api/business-access.guard.js';
import { CatalogQueries } from '../application/catalog-queries.js';

@Controller()
export class CatalogController {
  constructor(@Inject(CatalogQueries) private readonly queries: CatalogQueries) {}

  @ContractRoute(getPublicBusiness)
  business(@ContractInput() input: RouteInput<typeof getPublicBusiness>): Promise<PublicBusiness> {
    return this.queries.publicBusiness(input.params.slug);
  }

  @ContractRoute(listDemoBusinesses)
  async demoBusinesses(): Promise<{ businesses: DemoBusiness[] }> {
    return { businesses: await this.queries.demoBusinesses() };
  }

  @ContractRoute(getCabinetOverview)
  @RequireAccess('schedule')
  overview(
    @CurrentBusinessAccess() access: BusinessAccess,
  ): Promise<RouteResult<typeof getCabinetOverview>> {
    return this.queries.cabinetOverview(access.businessId);
  }
}
