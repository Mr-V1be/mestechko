import type { MaxEmulatorButton, MaxEmulatorChat, MaxEmulatorMessage } from '@mestechko/contracts';
import type { Clock } from '@mestechko/domain';
import { notFound } from '../../../shared/application/application-error.js';
import type { IdGenerator } from '../../../shared/application/ports.js';
import type { UnitOfWork } from '../../../shared/application/unit-of-work.js';
import type { ClientDirectory, MessengerClient } from '../../clients/application/ports.js';
import { messageObject, newMessageBodySchema } from './max-bot-api-emulator.js';
import type { EmulatedMessage, EmulatorStore } from './ports.js';

const LOCALE = 'ru';

function buttonsOf(message: EmulatedMessage): MaxEmulatorButton[][] {
  const parsed = newMessageBodySchema.shape.attachments.safeParse(message.attachments);
  return (parsed.success ? (parsed.data ?? []) : []).flatMap((attachment) =>
    attachment.payload.buttons.map((row) => row.map((button) => ({ ...button }))),
  );
}

function toMessage(message: EmulatedMessage): MaxEmulatorMessage {
  return {
    id: message.mid,
    fromBot: message.fromBot,
    text: message.text,
    format: message.format,
    buttons: buttonsOf(message),
    sentAt: message.sentAt.toISOString(),
    editedAt: message.editedAt?.toISOString() ?? null,
  };
}

function firstNameOf(client: MessengerClient): string {
  return client.displayName.split(' ')[0] ?? client.displayName;
}

/**
 * The client-facing side of the MAX emulator, shown in the cabinet: the chats of the
 * business's clients who use MAX, and the client's own actions in them.
 */
export class EmulatorChats {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly clients: ClientDirectory,
    private readonly store: EmulatorStore,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async list(businessId: string): Promise<MaxEmulatorChat[]> {
    const clients = await this.maxClients(businessId);
    const last = new Map(
      (await this.store.lastMessages(clients.map((client) => client.externalId))).map((message) => [
        message.userId,
        message,
      ]),
    );
    const chats = await Promise.all(
      clients.map((client) => this.chatOf(client, last.get(client.externalId) ?? null)),
    );
    return chats.sort((a, b) =>
      (b.lastMessage?.sentAt ?? '').localeCompare(a.lastMessage?.sentAt ?? ''),
    );
  }

  async chat(businessId: string, userId: string) {
    const client = await this.client(businessId, userId);
    const messages = await this.store.dialog(userId);
    return {
      chat: await this.chatOf(client, messages.at(-1) ?? null),
      messages: messages.map(toMessage),
      notices: (await this.store.notices(userId)).map((notice) => ({
        text: notice.text,
        shownAt: notice.shownAt.toISOString(),
      })),
    };
  }

  async start(businessId: string, userId: string): Promise<void> {
    const client = await this.client(businessId, userId);
    const now = this.now();
    await this.store.ensureUser(userId, firstNameOf(client), now);
    await this.store.markStarted(userId, now);
    await this.store.addUpdate(
      {
        update_type: 'bot_started',
        timestamp: now.getTime(),
        chat_id: Number(userId),
        user: this.person(client),
        payload: null,
        user_locale: LOCALE,
      },
      now,
    );
  }

  async send(businessId: string, userId: string, text: string): Promise<void> {
    const client = await this.client(businessId, userId);
    const now = this.now();
    await this.store.ensureUser(userId, firstNameOf(client), now);
    const message: EmulatedMessage = {
      mid: `mid.${this.ids.next()}`,
      userId,
      fromBot: false,
      text,
      format: null,
      attachments: [],
      sentAt: now,
      editedAt: null,
    };
    await this.store.addMessage(message);
    await this.store.addUpdate(
      {
        update_type: 'message_created',
        timestamp: now.getTime(),
        message: messageObject(message, firstNameOf(client)),
        user_locale: LOCALE,
      },
      now,
    );
  }

  async press(businessId: string, userId: string, messageId: string, payload: string) {
    const client = await this.client(businessId, userId);
    const message = await this.store.findMessage(messageId);
    const pressable =
      message?.userId === userId &&
      buttonsOf(message)
        .flat()
        .some((button) => button.type === 'callback' && button.payload === payload);
    if (!message || !pressable) {
      throw notFound('Button');
    }
    const now = this.now();
    await this.store.addUpdate(
      {
        update_type: 'message_callback',
        timestamp: now.getTime(),
        callback: {
          timestamp: now.getTime(),
          callback_id: `cb.${this.ids.next()}`,
          payload,
          user: this.person(client),
        },
        message: messageObject(message, firstNameOf(client)),
        user_locale: LOCALE,
      },
      now,
    );
  }

  private async chatOf(
    client: MessengerClient,
    last: EmulatedMessage | null,
  ): Promise<MaxEmulatorChat> {
    const user = await this.store.findUser(client.externalId);
    return {
      userId: client.externalId,
      clientName: client.displayName,
      started: Boolean(user?.startedAt),
      lastMessage:
        last?.text !== null && last?.text !== undefined
          ? { text: last.text, sentAt: last.sentAt.toISOString() }
          : null,
    };
  }

  private maxClients(businessId: string): Promise<MessengerClient[]> {
    return this.unitOfWork.inTenant(businessId, () => this.clients.listByChannel('max'), {
      readOnly: true,
    });
  }

  /** Only chats of the business's own clients are visible from its cabinet. */
  private async client(businessId: string, userId: string): Promise<MessengerClient> {
    const client = (await this.maxClients(businessId)).find(
      (candidate) => candidate.externalId === userId,
    );
    if (!client) {
      throw notFound('Chat');
    }
    return client;
  }

  private person(client: MessengerClient) {
    const firstName = firstNameOf(client);
    return {
      user_id: Number(client.externalId),
      first_name: firstName,
      name: firstName,
      is_bot: false,
    };
  }

  private now(): Date {
    return new Date(this.clock.now().epochMilliseconds);
  }
}
