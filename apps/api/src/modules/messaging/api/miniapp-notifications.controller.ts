import { Controller, Inject } from '@nestjs/common';
import { getMiniAppNotifications, type RouteResult } from '@slotwise/contracts';
import { TelegramClient } from '../../../platform/http/auth.guard.js';
import { ContractRoute } from '../../../platform/http/contract-route.js';
import type { TelegramUser } from '../../../platform/http/principal.js';
import { NotificationSettings } from '../application/notification-settings.js';

/** Whether the bot may message the Mini App's user, and where to allow it. */
@Controller()
export class MiniAppNotificationsController {
  constructor(@Inject(NotificationSettings) private readonly settings: NotificationSettings) {}

  @ContractRoute(getMiniAppNotifications)
  status(
    @TelegramClient() user: TelegramUser,
  ): Promise<RouteResult<typeof getMiniAppNotifications>> {
    return this.settings.status('telegram', user.id);
  }
}
