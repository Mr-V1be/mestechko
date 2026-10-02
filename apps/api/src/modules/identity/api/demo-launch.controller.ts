import { Controller, Inject } from '@nestjs/common';
import { createTelegramLaunch, type RouteInput, type RouteResult } from '@mestechko/contracts';
import { ContractInput, ContractRoute } from '../../../platform/http/contract-route.js';
import { CreateDemoTelegramLaunch } from '../application/demo-telegram-launch.js';

@Controller()
export class DemoLaunchController {
  constructor(
    @Inject(CreateDemoTelegramLaunch) private readonly launches: CreateDemoTelegramLaunch,
  ) {}

  @ContractRoute(createTelegramLaunch)
  launch(
    @ContractInput() input: RouteInput<typeof createTelegramLaunch>,
  ): Promise<RouteResult<typeof createTelegramLaunch>> {
    return this.launches.execute(input.body.businessSlug, input.body.demoUserId);
  }
}
