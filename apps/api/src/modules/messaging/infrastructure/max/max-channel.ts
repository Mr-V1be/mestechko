import {
  MessengerDeliveryError,
  type ActionReply,
  type InboundAction,
  type MessengerChannelAdapter,
  type OutboundMessage,
} from '../../application/channel.js';
import { messageHtml } from '../html-text.js';
import { MaxApiError, type MaxBotApi, type MaxButton, type MaxNewMessage } from './max-bot-api.js';

const FORBIDDEN = 403;
const NOT_FOUND = 404;
const TOO_MANY_REQUESTS = 429;
const SERVER_ERROR = 500;

/** MAX has no in-chat web app buttons for every bot, so the app opens as a link. */
export function maxMessageOf(message: OutboundMessage): MaxNewMessage {
  const buttons = message.buttons.map((row) =>
    row.map((button): MaxButton =>
      button.kind === 'action'
        ? { type: 'callback', text: button.label, payload: button.data, intent: button.tone }
        : { type: 'link', text: button.label, url: button.url },
    ),
  );
  return {
    text: messageHtml(message),
    format: 'html',
    attachments: buttons.length > 0 ? [{ type: 'inline_keyboard', payload: { buttons } }] : [],
  };
}

function deliveryError(error: unknown): unknown {
  if (error instanceof MaxApiError) {
    if (error.status === FORBIDDEN || error.status === NOT_FOUND) {
      return new MessengerDeliveryError('recipient_blocked', error.message);
    }
    if (error.status === TOO_MANY_REQUESTS || error.status >= SERVER_ERROR) {
      return new MessengerDeliveryError('temporarily_unavailable', error.message);
    }
    return new MessengerDeliveryError('rejected', error.message);
  }
  return new MessengerDeliveryError(
    'temporarily_unavailable',
    error instanceof Error ? error.message : String(error),
  );
}

/** MAX through its Bot API (the demo points it at the bundled emulator). */
export class MaxChannel implements MessengerChannelAdapter {
  readonly id = 'max' as const;

  constructor(private readonly api: MaxBotApi) {}

  async send(chatId: string, message: OutboundMessage): Promise<{ messageId: string }> {
    try {
      const sent = await this.api.sendMessage(chatId, maxMessageOf(message));
      return { messageId: sent.mid };
    } catch (error) {
      throw deliveryError(error);
    }
  }

  async answer(action: InboundAction, reply: ActionReply): Promise<void> {
    try {
      await this.api.answer(action.token, {
        ...(reply.replace ? { message: maxMessageOf(reply.replace) } : {}),
        ...(reply.notice ? { notification: reply.notice } : {}),
      });
    } catch (error) {
      throw deliveryError(error);
    }
  }
}
