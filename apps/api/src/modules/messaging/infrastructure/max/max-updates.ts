import type {
  BeforeApplicationShutdown,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import type { Redis } from 'ioredis';
import type { PinoLogger } from 'nestjs-pino';
import type { MessengerChannel } from '@slotwise/domain';
import type { AppConfig } from '../../../../platform/config/app-config.js';
import { redisKeyOf } from '../../../../platform/system-name.js';
import type { InboundEvent, InboundPerson } from '../../application/channel.js';
import type { BotConversation } from '../../application/conversation/bot-conversation.js';
import type { MaxBotApi, MaxUpdate, MaxUser } from './max-bot-api.js';

const CHANNEL: MessengerChannel = 'max';
export const MAX_UPDATES_MARKER_KEY = redisKeyOf('max', 'updates-marker');
const POLL_SECONDS = 25;
const RETRY_DELAY_MS = 5_000;
const COMMAND = /^\/([a-z_]+)(?:\s+(.+))?$/i;

function personOf(
  user: MaxUser,
  chatId: number | null | undefined,
  locale: string | null | undefined,
): InboundPerson | null {
  if (user.is_bot || chatId === null || chatId === undefined) {
    return null;
  }
  return {
    externalId: String(user.user_id),
    chatId: String(chatId),
    firstName: user.first_name ?? user.name ?? '',
    languageTag: locale ?? null,
  };
}

/** MAX updates in messenger-neutral form; `null` for what the bot does not serve. */
export function inboundOf(update: MaxUpdate): InboundEvent | null {
  switch (update.update_type) {
    case 'bot_started': {
      const person = personOf(update.user, update.chat_id, update.user_locale);
      return person
        ? { kind: 'started', channel: CHANNEL, person, payload: update.payload ?? null }
        : null;
    }
    case 'bot_stopped': {
      const person = personOf(update.user, update.chat_id, null);
      return person ? { kind: 'stopped', channel: CHANNEL, person } : null;
    }
    case 'message_created': {
      const sender = update.message.sender;
      const person = sender
        ? personOf(sender, update.message.recipient.chat_id, update.user_locale)
        : null;
      if (!person) {
        return null;
      }
      const match = COMMAND.exec((update.message.body.text ?? '').trim());
      const command = match?.[1]?.toLowerCase();
      if (command === 'start') {
        return { kind: 'started', channel: CHANNEL, person, payload: match?.[2] ?? null };
      }
      return command
        ? { kind: 'command', channel: CHANNEL, person, command }
        : { kind: 'text', channel: CHANNEL, person };
    }
    case 'message_callback': {
      const chatId = update.message?.recipient.chat_id;
      const person = personOf(update.callback.user, chatId, update.user_locale);
      if (!person || !update.callback.payload) {
        return null;
      }
      return {
        kind: 'action',
        channel: CHANNEL,
        person,
        data: update.callback.payload,
        action: {
          token: update.callback.callback_id,
          chatId: person.chatId,
          messageId: update.message?.body.mid ?? null,
        },
      };
    }
  }
}

/**
 * Long-polls MAX for updates in the `bot` process. The marker lives in Redis, so a
 * restart continues where the previous run stopped.
 */
export class MaxUpdatesPoller
  implements OnApplicationBootstrap, BeforeApplicationShutdown, OnApplicationShutdown
{
  private readonly stop = new AbortController();
  private loop: Promise<void> | null = null;

  constructor(
    private readonly config: AppConfig,
    private readonly api: MaxBotApi,
    private readonly conversation: BotConversation,
    private readonly redis: Redis,
    private readonly logger: PinoLogger,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.roles.includes('bot')) {
      this.loop = this.run();
      this.logger.info('MAX long polling started');
    }
  }

  /** The pending long poll ends before the HTTP server waits for open requests. */
  beforeApplicationShutdown(): void {
    this.stop.abort();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.loop;
  }

  private async run(): Promise<void> {
    while (!this.stop.signal.aborted) {
      try {
        const stored = await this.redis.get(MAX_UPDATES_MARKER_KEY);
        const batch = await this.api.updates(
          stored === null ? null : Number(stored),
          POLL_SECONDS,
          this.stop.signal,
        );
        for (const update of batch.updates) {
          await this.deliver(update);
        }
        if (batch.marker !== null) {
          await this.redis.set(MAX_UPDATES_MARKER_KEY, String(batch.marker));
        }
      } catch (error) {
        if (this.stopped()) {
          return;
        }
        this.logger.warn({ err: error }, 'MAX polling failed; retrying');
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }

  private stopped(): boolean {
    return this.stop.signal.aborted;
  }

  private async deliver(update: MaxUpdate): Promise<void> {
    const event = inboundOf(update);
    if (!event) {
      return;
    }
    try {
      await this.conversation.handle(event);
    } catch (error) {
      this.logger.error({ err: error, updateType: update.update_type }, 'MAX update failed');
    }
  }
}
