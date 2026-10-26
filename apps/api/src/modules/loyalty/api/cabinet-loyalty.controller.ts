import { Controller, Inject } from '@nestjs/common';
import {
  createPassPlan,
  getLoyaltySettings,
  updateLoyaltyProgram,
  updatePassPlan,
  type RouteInput,
  type RouteResult,
} from '@slotwise/contracts';
import { CurrentBusinessAccess } from '../../../platform/http/auth.guard.js';
import { ContractInput, ContractRoute } from '../../../platform/http/contract-route.js';
import type { BusinessAccess } from '../../../shared/application/business-access.js';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../shared/application/unit-of-work.js';
import { RequireAccess } from '../../tenancy/api/business-access.guard.js';
import { BusinessContextResolver } from '../../tenancy/application/business-context.js';
import { LoyaltyAdmin } from '../application/loyalty-admin.js';

/** The loyalty program and the passes on sale. */
@Controller()
export class CabinetLoyaltyController {
  constructor(
    @Inject(LoyaltyAdmin) private readonly loyalty: LoyaltyAdmin,
    @Inject(BusinessContextResolver) private readonly businesses: BusinessContextResolver,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  @ContractRoute(getLoyaltySettings)
  @RequireAccess('loyalty')
  async settings(
    @CurrentBusinessAccess() access: BusinessAccess,
  ): Promise<RouteResult<typeof getLoyaltySettings>> {
    const { business } = await this.businesses.byId(access.businessId);
    return this.unitOfWork.inTenant(
      business.id,
      async () => ({
        program: await this.loyalty.program(),
        plans: await this.loyalty.plans(business.currency),
      }),
      { readOnly: true },
    );
  }

  @ContractRoute(updateLoyaltyProgram)
  @RequireAccess('loyalty')
  updateProgram(
    @ContractInput() input: RouteInput<typeof updateLoyaltyProgram>,
    @CurrentBusinessAccess() access: BusinessAccess,
  ): Promise<RouteResult<typeof updateLoyaltyProgram>> {
    return this.unitOfWork.inTenant(access.businessId, () =>
      this.loyalty.updateProgram(input.body),
    );
  }

  @ContractRoute(createPassPlan)
  @RequireAccess('loyalty')
  createPlan(
    @ContractInput() input: RouteInput<typeof createPassPlan>,
    @CurrentBusinessAccess() access: BusinessAccess,
  ): Promise<RouteResult<typeof createPassPlan>> {
    return this.savePlan(access, null, input.body);
  }

  @ContractRoute(updatePassPlan)
  @RequireAccess('loyalty')
  updatePlan(
    @ContractInput() input: RouteInput<typeof updatePassPlan>,
    @CurrentBusinessAccess() access: BusinessAccess,
  ): Promise<RouteResult<typeof updatePassPlan>> {
    return this.savePlan(access, input.params.planId, input.body);
  }

  private async savePlan(
    access: BusinessAccess,
    planId: string | null,
    fields: RouteInput<typeof createPassPlan>['body'],
  ) {
    const { business } = await this.businesses.byId(access.businessId);
    return this.unitOfWork.inTenant(business.id, () =>
      this.loyalty.savePlan(planId, fields, business.currency),
    );
  }
}
