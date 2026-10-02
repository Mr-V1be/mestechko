import { Controller, Inject } from '@nestjs/common';
import {
  applyScheduleChange,
  createTeamMember,
  getTeamMember,
  listTeam,
  previewScheduleChange,
  setTeamMemberServices,
  updateTeamMember,
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
import { TeamAdmin } from '../application/team-admin.js';

/** Staff, their services and their working time, from the cabinet. */
@Controller()
export class CabinetTeamController {
  constructor(
    @Inject(TeamAdmin) private readonly team: TeamAdmin,
    @Inject(BusinessContextResolver) private readonly businesses: BusinessContextResolver,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  @ContractRoute(listTeam)
  @RequireAccess('team')
  async list(
    @CurrentBusinessAccess() access: BusinessAccess,
  ): Promise<RouteResult<typeof listTeam>> {
    return { members: await this.inTenant(access, () => this.team.list(), true) };
  }

  @ContractRoute(getTeamMember)
  @RequireAccess('team')
  member(
    @ContractInput() input: RouteInput<typeof getTeamMember>,
    @CurrentBusinessAccess() access: BusinessAccess,
  ): Promise<RouteResult<typeof getTeamMember>> {
    return this.inTenant(
      access,
      (context) => this.team.member(context, input.params.staffId),
      true,
    );
  }

  @ContractRoute(createTeamMember)
  @RequireAccess('team')
  create(
    @ContractInput() input: RouteInput<typeof createTeamMember>,
    @CurrentBusinessAccess() access: BusinessAccess,
  ): Promise<RouteResult<typeof createTeamMember>> {
    return this.inTenant(access, (context) => this.team.create(context, input.body));
  }

  @ContractRoute(updateTeamMember)
  @RequireAccess('team')
  update(
    @ContractInput() input: RouteInput<typeof updateTeamMember>,
    @CurrentBusinessAccess() access: BusinessAccess,
  ): Promise<RouteResult<typeof updateTeamMember>> {
    return this.inTenant(access, (context) =>
      this.team.update(context, input.params.staffId, input.body),
    );
  }

  @ContractRoute(setTeamMemberServices)
  @RequireAccess('team')
  setServices(
    @ContractInput() input: RouteInput<typeof setTeamMemberServices>,
    @CurrentBusinessAccess() access: BusinessAccess,
  ): Promise<RouteResult<typeof setTeamMemberServices>> {
    return this.inTenant(access, (context) =>
      this.team.setServices(context, input.params.staffId, input.body.services),
    );
  }

  @ContractRoute(previewScheduleChange)
  @RequireAccess('team')
  async preview(
    @ContractInput() input: RouteInput<typeof previewScheduleChange>,
    @CurrentBusinessAccess() access: BusinessAccess,
  ): Promise<RouteResult<typeof previewScheduleChange>> {
    return {
      affected: await this.inTenant(
        access,
        (context) => this.team.preview(context, input.params.staffId, input.body.change),
        true,
      ),
    };
  }

  @ContractRoute(applyScheduleChange)
  @RequireAccess('team')
  apply(
    @ContractInput() input: RouteInput<typeof applyScheduleChange>,
    @CurrentBusinessAccess() access: BusinessAccess,
  ): Promise<RouteResult<typeof applyScheduleChange>> {
    return this.inTenant(access, (context) =>
      this.team.apply(
        context,
        input.params.staffId,
        input.body.change,
        input.body.acknowledgedAffected,
      ),
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
