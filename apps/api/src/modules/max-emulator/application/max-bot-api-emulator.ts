import type { Clock } from '@slotwise/domain';
import { brandName } from '@slotwise/i18n';
import { z } from 'zod';
import type { IdGenerator } from '../../../shared/application/ports.js';
import type { EmulatedMessage, EmulatorStore } from './ports.js';

/** The bot the emulator plays host to; MAX would report its own ids. */
export const EMULATED_BOT = {
  user_id: 1,
  first_name: brandName,
  username: 'slotwise_bot',
  is_bot: true,
} as const;

const MAX_UPDATES = 100;
const POLL_INTERVAL_MS = 400;
const MAX_POLL_SECONDS = 90;

const buttonSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('callback'),
    text: z.string().min(1).max(128),
    payload: z.string().min(1).max(1024),
    intent: z.enum(['default', 'positive', 'negative']).default('default'),
  }),
  z.object({ type: z.literal('link'), text: z.string().min(1).max(128), url: z.url() }),
]);

/** The fields of NewMessageBody the emulator supports, with the documented limits. */
export const newMessageBodySchema = z.object({
  text: z.string().max(4000).nullable().default(null),
  format: z.enum(['html', 'markdown']).nullable().default(null),
  attachments: z
    .array(
      z.object({
        type: z.literal('inline_keyboard'),
        payload: z.object({
          buttons: z.array(z.array(buttonSchema).min(1).max(7)).max(30),
        }),
      }),
    )
    .nullable()
    .default([]),
});

/** An answer the real API would give with an HTTP error status. */
export class EmulatorRefusal extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'EmulatorRefusal';
  }
}

function personOf(userId: string, firstName: string) {
  return { user_id: Number(userId), first_name: firstName, name: firstName, is_bot: false };
}

/** A message object as MAX returns it. */
export function messageObject(message: EmulatedMessage, firstName: string) {
  const person = personOf(message.userId, firstName);
  return {
    sender: message.fromBot ? EMULATED_BOT : person,
    recipient: {
      chat_id: Number(message.userId),
      chat_type: 'dialog',
      user_id: message.fromBot ? person.user_id : EMULATED_BOT.user_id,
    },
    timestamp: message.sentAt.getTime(),
    body: { mid: message.mid, seq: 0, text: message.text, attachments: message.attachments },
  };
}

/**
 * The bot-facing side of the MAX emulator: the subset of the MAX Bot API the product
 * uses, over the emulator's own storage. A bot may write only to people who started it.
 */
export class MaxBotApiEmulator {
  constructor(
    private readonly store: EmulatorStore,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  me() {
    return { ...EMULATED_BOT, last_activity_time: this.now().getTime(), description: null };
  }

  async sendMessage(chatId: string, body: unknown) {
    const user = await this.store.findUser(chatId);
    if (!user?.startedAt) {
      throw new EmulatorRefusal(403, 'The user has not started the bot');
    }
    const parsed = newMessageBodySchema.parse(body);
    const message: EmulatedMessage = {
      mid: `mid.${this.ids.next()}`,
      userId: user.userId,
      fromBot: true,
      text: parsed.text,
      format: parsed.format,
      attachments: parsed.attachments ?? [],
      sentAt: this.now(),
      editedAt: null,
    };
    await this.store.addMessage(message);
    return { message: messageObject(message, user.firstName) };
  }

  async editMessage(mid: string, body: unknown) {
    const parsed = newMessageBodySchema.parse(body);
    const edited = await this.store.editMessage(
      mid,
      { text: parsed.text, format: parsed.format, attachments: parsed.attachments ?? [] },
      this.now(),
    );
    return edited ? { success: true } : { success: false, message: 'Message not found' };
  }

  async answer(callbackId: string, body: unknown) {
    const reply = z
      .object({
        message: newMessageBodySchema.optional(),
        notification: z.string().max(200).optional(),
      })
      .parse(body);
    const target = await this.store.callbackMessage(callbackId);
    if (!target) {
      return { success: false, message: 'Unknown callback' };
    }
    if (reply.message) {
      await this.store.editMessage(
        target.mid,
        {
          text: reply.message.text,
          format: reply.message.format,
          attachments: reply.message.attachments ?? [],
        },
        this.now(),
      );
    }
    if (reply.notification) {
      await this.store.addNotice(target.userId, reply.notification, this.now());
    }
    return { success: true };
  }

  /**
   * Long polling: waits until there is something from the marker on, or the timeout.
   * Without a marker the latest update comes first, as the MAX API documents; a marker
   * beyond the stream (the emulator was reset) restarts at its end.
   */
  async updates(marker: number | null, timeoutSeconds: number, signal: AbortSignal) {
    const next = await this.store.nextMarker();
    const from = marker === null ? Math.max(1, next - 1) : Math.min(marker, next);
    const deadline = Date.now() + Math.min(timeoutSeconds, MAX_POLL_SECONDS) * 1_000;
    for (;;) {
      const updates = await this.store.updatesFrom(from, MAX_UPDATES);
      const last = updates.at(-1);
      if (last || Date.now() >= deadline || signal.aborted) {
        return {
          updates: updates.map((entry) => entry.update),
          marker: last ? last.marker + 1 : from,
        };
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }

  private now(): Date {
    return new Date(this.clock.now().epochMilliseconds);
  }
}
