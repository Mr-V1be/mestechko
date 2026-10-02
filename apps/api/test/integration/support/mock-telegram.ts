import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface BotApiCall {
  readonly method: string;
  readonly payload: Record<string, unknown>;
}

interface InlineButton {
  readonly text: string;
  readonly callback_data?: string;
}

/**
 * The Telegram Bot API as a local HTTP server: records every call the bot makes and
 * answers like Telegram does, so the real adapter runs end to end.
 */
export class MockTelegram {
  readonly token = '123456:TEST-TOKEN-abcdefghijklmnopqrstuvwxyz';
  readonly calls: BotApiCall[] = [];
  private readonly server: Server;
  private messageId = 100;
  /** Chats that blocked the bot: sending to them fails with 403. */
  readonly blocked = new Set<string>();

  constructor() {
    this.server = createServer((request, response) => {
      let body = '';
      request.on('data', (chunk: Buffer) => {
        body += chunk.toString();
      });
      request.on('end', () => {
        const method = request.url?.split('/').at(-1) ?? '';
        const payload = (body ? JSON.parse(body) : {}) as Record<string, unknown>;
        this.calls.push({ method, payload });
        const reply = this.answer(method, payload);
        response.writeHead(reply.ok ? 200 : (reply.error_code ?? 400), {
          'content-type': 'application/json',
        });
        response.end(JSON.stringify(reply));
      });
    });
  }

  async start(): Promise<string> {
    await new Promise<void>((resolve) => this.server.listen(0, '127.0.0.1', resolve));
    const { port } = this.server.address() as AddressInfo;
    return `http://127.0.0.1:${String(port)}`;
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /** Text messages and edits addressed to a chat, oldest first. */
  messagesTo(chatId: string): { method: string; text: string; buttons: InlineButton[] }[] {
    return this.calls
      .filter(
        (call) =>
          (call.method === 'sendMessage' || call.method === 'editMessageText') &&
          String(call.payload.chat_id) === chatId,
      )
      .map((call) => ({
        method: call.method,
        text: String(call.payload.text),
        buttons: (
          (call.payload.reply_markup as { inline_keyboard?: InlineButton[][] } | undefined)
            ?.inline_keyboard ?? []
        ).flat(),
      }));
  }

  lastMessageTo(chatId: string) {
    const last = this.messagesTo(chatId).at(-1);
    if (!last) {
      throw new Error(`No message to ${chatId}`);
    }
    return last;
  }

  notices(): string[] {
    return this.calls
      .filter((call) => call.method === 'answerCallbackQuery')
      .map((call) => (typeof call.payload.text === 'string' ? call.payload.text : ''));
  }

  private answer(method: string, payload: Record<string, unknown>) {
    const chatId =
      typeof payload.chat_id === 'string' || typeof payload.chat_id === 'number'
        ? String(payload.chat_id)
        : '';
    if (this.blocked.has(chatId)) {
      return { ok: false, error_code: 403, description: 'Forbidden: bot was blocked by the user' };
    }
    switch (method) {
      case 'getMe':
        return {
          ok: true,
          result: { id: 123456, is_bot: true, first_name: 'Test', username: 'test_bot' },
        };
      case 'sendMessage':
      case 'editMessageText':
        this.messageId += 1;
        return {
          ok: true,
          result: {
            message_id: method === 'sendMessage' ? this.messageId : Number(payload.message_id),
            date: Math.floor(Date.now() / 1000),
            chat: { id: Number(chatId), type: 'private' },
            text: payload.text,
          },
        };
      default:
        return { ok: true, result: true };
    }
  }
}
