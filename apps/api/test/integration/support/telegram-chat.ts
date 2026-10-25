import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { MockTelegram } from './mock-telegram.js';

export const WEBHOOK_SECRET = 'test-webhook-secret-0123456789abcdefghij';

/** Unique across runs: the bot remembers update ids it has handled. */
let updateId = Date.now();

/**
 * A Telegram user in a private chat with the bot, driven through the webhook. Their
 * Telegram is in Russian unless the test says otherwise.
 */
export class TelegramChat {
  constructor(
    private readonly app: NestFastifyApplication,
    private readonly telegram: MockTelegram,
    readonly userId: number,
    private readonly languageCode = 'ru',
  ) {}

  get chatId(): string {
    return String(this.userId);
  }

  private get user() {
    return {
      id: this.userId,
      is_bot: false,
      first_name: 'Клиент',
      language_code: this.languageCode,
    };
  }

  async send(text: string): Promise<void> {
    updateId += 1;
    await this.push({
      update_id: updateId,
      message: {
        message_id: updateId,
        date: Math.floor(Date.now() / 1000),
        chat: { id: this.userId, type: 'private', first_name: 'Клиент' },
        from: this.user,
        text,
      },
    });
  }

  /** Presses the button with this label in the latest message that has it. */
  async press(label: string): Promise<void> {
    const message = this.telegram
      .messagesTo(this.chatId)
      .reverse()
      .find((candidate) => candidate.buttons.some((button) => button.text === label));
    const button = message?.buttons.find((candidate) => candidate.text === label);
    if (!button?.callback_data) {
      throw new Error(`No button "${label}" for ${this.chatId}`);
    }
    await this.pressData(button.callback_data);
  }

  async pressData(data: string): Promise<void> {
    updateId += 1;
    await this.push({
      update_id: updateId,
      callback_query: {
        id: `callback-${String(updateId)}`,
        from: this.user,
        chat_instance: 'test',
        data,
        message: {
          message_id: 1,
          date: Math.floor(Date.now() / 1000),
          chat: { id: this.userId, type: 'private' },
          text: 'previous',
        },
      },
    });
  }

  async blockBot(): Promise<void> {
    updateId += 1;
    const member = { user: { id: 123456, is_bot: true, first_name: 'Test' } };
    await this.push({
      update_id: updateId,
      my_chat_member: {
        chat: { id: this.userId, type: 'private' },
        from: this.user,
        date: Math.floor(Date.now() / 1000),
        old_chat_member: { ...member, status: 'member' },
        new_chat_member: { ...member, status: 'kicked', until_date: 0 },
      },
    });
  }

  lastText(): string {
    return this.telegram.lastMessageTo(this.chatId).text;
  }

  private async push(update: object): Promise<void> {
    const response = await this.app.inject({
      method: 'POST',
      url: '/v1/telegram/webhook',
      headers: { 'x-telegram-bot-api-secret-token': WEBHOOK_SECRET },
      payload: update,
    });
    if (response.statusCode !== 200) {
      throw new Error(`Webhook answered ${String(response.statusCode)}: ${response.body}`);
    }
  }
}
