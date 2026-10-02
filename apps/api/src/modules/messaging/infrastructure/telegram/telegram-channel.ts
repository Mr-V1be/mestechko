import { GrammyError, HttpError, type Api } from 'grammy';
import type { InlineKeyboardButton, InlineKeyboardMarkup } from 'grammy/types';
import {
  MessengerDeliveryError,
  type ActionReply,
  type InboundAction,
  type MessengerChannelAdapter,
  type OutboundButton,
  type OutboundMessage,
} from '../../application/channel.js';
import { messageHtml } from '../html-text.js';

const FORBIDDEN = 403;
const TOO_MANY_REQUESTS = 429;
const SERVER_ERROR = 500;

function keyboardOf(message: OutboundMessage): InlineKeyboardMarkup {
  return {
    inline_keyboard: message.buttons.map((row) =>
      row.map((button: OutboundButton): InlineKeyboardButton =>
        button.kind === 'action'
          ? { text: button.label, callback_data: button.data }
          : { text: button.label, web_app: { url: button.url } },
      ),
    ),
  };
}

function deliveryError(error: unknown): unknown {
  if (error instanceof GrammyError) {
    if (error.error_code === FORBIDDEN) {
      return new MessengerDeliveryError('recipient_blocked', error.description);
    }
    if (error.error_code === TOO_MANY_REQUESTS || error.error_code >= SERVER_ERROR) {
      return new MessengerDeliveryError('temporarily_unavailable', error.description);
    }
    return new MessengerDeliveryError('rejected', error.description);
  }
  if (error instanceof HttpError) {
    return new MessengerDeliveryError('temporarily_unavailable', error.message);
  }
  return error;
}

/** Edits fail harmlessly when nothing changed, and for messages too old to edit. */
function isUnchanged(error: unknown): boolean {
  return error instanceof GrammyError && error.description.includes('message is not modified');
}

/** Telegram through the Bot API: HTML text and inline keyboards. */
export class TelegramChannel implements MessengerChannelAdapter {
  readonly id = 'telegram' as const;

  constructor(private readonly api: Api) {}

  async send(chatId: string, message: OutboundMessage): Promise<{ messageId: string }> {
    try {
      const sent = await this.api.sendMessage(chatId, messageHtml(message), {
        parse_mode: 'HTML',
        reply_markup: keyboardOf(message),
        link_preview_options: { is_disabled: true },
      });
      return { messageId: String(sent.message_id) };
    } catch (error) {
      throw deliveryError(error);
    }
  }

  async answer(action: InboundAction, reply: ActionReply): Promise<void> {
    await this.api.answerCallbackQuery(action.token, reply.notice ? { text: reply.notice } : {});
    if (!reply.replace) {
      return;
    }
    if (action.messageId === null) {
      await this.send(action.chatId, reply.replace);
      return;
    }
    try {
      await this.api.editMessageText(
        action.chatId,
        Number(action.messageId),
        messageHtml(reply.replace),
        { parse_mode: 'HTML', reply_markup: keyboardOf(reply.replace) },
      );
    } catch (error) {
      if (isUnchanged(error)) {
        return;
      }
      if (error instanceof GrammyError) {
        // The message can no longer be edited: the answer arrives as a new one.
        await this.send(action.chatId, reply.replace);
        return;
      }
      throw deliveryError(error);
    }
  }
}
