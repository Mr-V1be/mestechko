import { Controller, Inject } from '@nestjs/common';
import {
  getMiniAppPreferences,
  updateMiniAppPreferences,
  type RouteInput,
  type RouteResult,
} from '@mestechko/contracts';
import { TelegramClient } from '../../../platform/http/auth.guard.js';
import { ContractInput, ContractRoute } from '../../../platform/http/contract-route.js';
import type { TelegramUser } from '../../../platform/http/principal.js';
import { ClientPreferences } from '../application/client-preferences.js';

const CHANNEL = 'telegram';

/** The Mini App user's own settings. */
@Controller()
export class MiniAppPreferencesController {
  constructor(@Inject(ClientPreferences) private readonly preferences: ClientPreferences) {}

  @ContractRoute(getMiniAppPreferences)
  get(@TelegramClient() user: TelegramUser): Promise<RouteResult<typeof getMiniAppPreferences>> {
    return this.preferences.of(CHANNEL, user.id);
  }

  @ContractRoute(updateMiniAppPreferences)
  update(
    @ContractInput() input: RouteInput<typeof updateMiniAppPreferences>,
    @TelegramClient() user: TelegramUser,
  ): Promise<RouteResult<typeof updateMiniAppPreferences>> {
    return this.preferences.chooseLocale(CHANNEL, user.id, input.body.locale);
  }
}
