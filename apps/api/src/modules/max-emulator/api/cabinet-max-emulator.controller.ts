import { Controller, Inject, NotFoundException } from '@nestjs/common';
import {
  getMaxEmulatorChat,
  listMaxEmulatorChats,
  pressMaxEmulatorButton,
  sendMaxEmulatorText,
  startMaxEmulatorChat,
  type RouteInput,
  type RouteResult,
} from '@mestechko/contracts';
import { APP_CONFIG, type AppConfig } from '../../../platform/config/app-config.js';
import { CurrentBusinessAccess } from '../../../platform/http/auth.guard.js';
import { ContractInput, ContractRoute } from '../../../platform/http/contract-route.js';
import type { BusinessAccess } from '../../../shared/application/business-access.js';
import { RequireAccess } from '../../tenancy/api/business-access.guard.js';
import { EmulatorChats } from '../application/emulator-chats.js';

/** The MAX emulator screen of the cabinet: clients' chats with the bot, demo only. */
@Controller()
export class CabinetMaxEmulatorController {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(EmulatorChats) private readonly chats: EmulatorChats,
  ) {}

  @ContractRoute(listMaxEmulatorChats)
  @RequireAccess('messengers')
  async list(
    @CurrentBusinessAccess() access: BusinessAccess,
  ): Promise<RouteResult<typeof listMaxEmulatorChats>> {
    this.assertEnabled();
    return { chats: await this.chats.list(access.businessId) };
  }

  @ContractRoute(getMaxEmulatorChat)
  @RequireAccess('messengers')
  chat(
    @ContractInput() input: RouteInput<typeof getMaxEmulatorChat>,
    @CurrentBusinessAccess() access: BusinessAccess,
  ): Promise<RouteResult<typeof getMaxEmulatorChat>> {
    this.assertEnabled();
    return this.chats.chat(access.businessId, input.params.userId);
  }

  @ContractRoute(startMaxEmulatorChat)
  @RequireAccess('messengers')
  start(
    @ContractInput() input: RouteInput<typeof startMaxEmulatorChat>,
    @CurrentBusinessAccess() access: BusinessAccess,
  ): Promise<void> {
    this.assertEnabled();
    return this.chats.start(access.businessId, input.params.userId);
  }

  @ContractRoute(sendMaxEmulatorText)
  @RequireAccess('messengers')
  send(
    @ContractInput() input: RouteInput<typeof sendMaxEmulatorText>,
    @CurrentBusinessAccess() access: BusinessAccess,
  ): Promise<void> {
    this.assertEnabled();
    return this.chats.send(access.businessId, input.params.userId, input.body.text);
  }

  @ContractRoute(pressMaxEmulatorButton)
  @RequireAccess('messengers')
  press(
    @ContractInput() input: RouteInput<typeof pressMaxEmulatorButton>,
    @CurrentBusinessAccess() access: BusinessAccess,
  ): Promise<void> {
    this.assertEnabled();
    return this.chats.press(
      access.businessId,
      input.params.userId,
      input.body.messageId,
      input.body.payload,
    );
  }

  private assertEnabled(): void {
    if (!this.config.max.emulatorEnabled) {
      throw new NotFoundException();
    }
  }
}
