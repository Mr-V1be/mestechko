import { Controller, Inject } from '@nestjs/common';
import {
  getBusinessSettings,
  updateBusinessSettings,
  type RouteInput,
  type RouteResult,
} from '@mestechko/contracts';
import { CurrentBusinessAccess } from '../../../platform/http/auth.guard.js';
import { ContractInput, ContractRoute } from '../../../platform/http/contract-route.js';
import type { BusinessAccess } from '../../../shared/application/business-access.js';
import { BusinessSettings } from '../application/business-settings.js';
import { RequireAccess } from './business-access.guard.js';

/** The business's name and booking rules. */
@Controller()
export class CabinetSettingsController {
  constructor(@Inject(BusinessSettings) private readonly settings: BusinessSettings) {}

  @ContractRoute(getBusinessSettings)
  @RequireAccess('settings')
  get(
    @CurrentBusinessAccess() access: BusinessAccess,
  ): Promise<RouteResult<typeof getBusinessSettings>> {
    return this.settings.get(access.businessId);
  }

  @ContractRoute(updateBusinessSettings)
  @RequireAccess('settings')
  update(
    @ContractInput() input: RouteInput<typeof updateBusinessSettings>,
    @CurrentBusinessAccess() access: BusinessAccess,
  ): Promise<RouteResult<typeof updateBusinessSettings>> {
    return this.settings.update(access.businessId, input.body);
  }
}
