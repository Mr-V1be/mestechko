import { Controller, Inject } from '@nestjs/common';
import { getBusinessReport, type RouteInput, type RouteResult } from '@slotwise/contracts';
import { CurrentBusinessAccess } from '../../../platform/http/auth.guard.js';
import { ContractInput, ContractRoute } from '../../../platform/http/contract-route.js';
import type { BusinessAccess } from '../../../shared/application/business-access.js';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../shared/application/unit-of-work.js';
import { staffFilterOf } from '../../booking/application/cabinet/staff-scope.js';
import { RequireAccess } from '../../tenancy/api/business-access.guard.js';
import { BusinessContextResolver } from '../../tenancy/application/business-context.js';
import { BusinessReports } from '../application/business-reports.js';

/** Business reports; a staff member sees only their own figures. */
@Controller()
export class CabinetReportsController {
  constructor(
    @Inject(BusinessReports) private readonly reports: BusinessReports,
    @Inject(BusinessContextResolver) private readonly businesses: BusinessContextResolver,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  @ContractRoute(getBusinessReport)
  @RequireAccess('reports')
  async report(
    @ContractInput() input: RouteInput<typeof getBusinessReport>,
    @CurrentBusinessAccess() access: BusinessAccess,
  ): Promise<RouteResult<typeof getBusinessReport>> {
    const context = await this.businesses.byId(access.businessId);
    const ownStaffId = staffFilterOf(access);
    return this.unitOfWork.inTenant(
      context.business.id,
      () =>
        this.reports.report(context, {
          from: input.query.from,
          to: input.query.to,
          locationId: input.query.locationId ?? null,
          staffId: ownStaffId ?? input.query.staffId ?? null,
        }),
      { readOnly: true },
    );
  }
}
