import { Controller, Inject } from '@nestjs/common';
import type { Locale } from '@slotwise/domain';
import { createTelegramLaunch, type RouteInput, type RouteResult } from '@slotwise/contracts';
import { ContractInput, ContractRoute } from '../../../platform/http/contract-route.js';
import { RequestLocale } from '../../../platform/http/request-locale.js';
import { CreateDemoTelegramLaunch } from '../application/demo-telegram-launch.js';

@Controller()
export class DemoLaunchController {
  constructor(
    @Inject(CreateDemoTelegramLaunch) private readonly launches: CreateDemoTelegramLaunch,
  ) {}

  @ContractRoute(createTelegramLaunch)
  launch(
    @ContractInput() input: RouteInput<typeof createTelegramLaunch>,
    @RequestLocale() locale: Locale,
  ): Promise<RouteResult<typeof createTelegramLaunch>> {
    return this.launches.execute(input.body.businessSlug, input.body.demoUserId, locale);
  }
}
