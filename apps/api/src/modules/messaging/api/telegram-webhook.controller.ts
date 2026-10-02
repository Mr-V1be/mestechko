import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Inject,
  NotFoundException,
  Post,
} from '@nestjs/common';
import type { Update } from 'grammy/types';
import { timingSafeEqual } from 'node:crypto';
import { APP_CONFIG, type AppConfig } from '../../../platform/config/app-config.js';
import { TELEGRAM_RUNTIME } from '../infrastructure/telegram/telegram-tokens.js';
import type { TelegramBotRuntime } from '../infrastructure/telegram/telegram-bot-runtime.js';

function sameSecret(expected: string, received: string | undefined): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(received ?? '');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Telegram pushes updates here in webhook mode; the secret header proves it is Telegram. */
@Controller()
export class TelegramWebhookController {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(TELEGRAM_RUNTIME) private readonly runtime: TelegramBotRuntime | null,
  ) {}

  @Post('/v1/telegram/webhook')
  @HttpCode(200)
  async receive(
    @Headers('x-telegram-bot-api-secret-token') secret: string | undefined,
    @Body() update: Update,
  ): Promise<Record<string, never>> {
    const updates = this.config.telegram.updates;
    if (!this.runtime || updates.kind !== 'webhook' || !sameSecret(updates.secret, secret)) {
      throw new NotFoundException();
    }
    await this.runtime.handleWebhookUpdate(update);
    return {};
  }
}
