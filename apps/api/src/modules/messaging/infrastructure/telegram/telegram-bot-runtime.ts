import type { OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { Bot } from 'grammy';
import type { Update } from 'grammy/types';
import type { PinoLogger } from 'nestjs-pino';
import type { AppConfig } from '../../../../platform/config/app-config.js';
import type { BotConversation } from '../../application/conversation/bot-conversation.js';
import type { UpdateDeduplicator } from '../../application/update-deduplicator.js';
import { wireTelegramUpdates } from './telegram-updates.js';

const ALLOWED_UPDATES = ['message', 'callback_query', 'my_chat_member'] as const;

/**
 * The Telegram bot's update intake. A `bot` process long-polls in development; in
 * production Telegram pushes updates to the webhook and the API hands them over here.
 */
export class TelegramBotRuntime implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly bot: Bot;
  private initialized: Promise<void> | null = null;

  constructor(
    private readonly config: AppConfig,
    token: string,
    conversation: BotConversation,
    deduplicator: UpdateDeduplicator,
    private readonly logger: PinoLogger,
  ) {
    this.bot = new Bot(token, {
      client: {
        apiRoot: config.telegram.apiRoot,
        timeoutSeconds: Math.ceil(config.externalHttp.timeoutMs / 1_000),
      },
    });
    this.bot.use(async (context, next) => {
      const key = `telegram:${String(context.update.update_id)}`;
      if (!(await deduplicator.firstTime(key))) {
        return;
      }
      try {
        await next();
      } catch (error) {
        await deduplicator.forget(key);
        throw error;
      }
    });
    wireTelegramUpdates(this.bot, (event) => conversation.handle(event));
    this.bot.catch((error) => {
      this.logger.error(
        { err: error.error, updateId: error.ctx.update.update_id },
        'Telegram update failed',
      );
    });
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.roles.includes('bot')) {
      return;
    }
    const updates = this.config.telegram.updates;
    if (updates.kind === 'webhook') {
      await this.bot.api.setWebhook(updates.url, {
        secret_token: updates.secret,
        allowed_updates: [...ALLOWED_UPDATES],
      });
      this.logger.info('Telegram webhook registered');
      return;
    }
    // Long polling runs until shutdown; it removes a webhook left from another mode.
    void this.bot
      .start({
        allowed_updates: [...ALLOWED_UPDATES],
        onStart: (info) => {
          this.logger.info({ bot: info.username }, 'Telegram long polling started');
        },
      })
      .catch((error: unknown) => {
        this.logger.error({ err: error }, 'Telegram long polling stopped');
      });
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.bot.isRunning()) {
      await this.bot.stop();
    }
  }

  /** An update pushed to the webhook; errors propagate so Telegram redelivers it. */
  async handleWebhookUpdate(update: Update): Promise<void> {
    this.initialized ??= this.bot.init();
    await this.initialized;
    await this.bot.handleUpdate(update);
  }
}
