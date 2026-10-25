import type { Bot, Context } from 'grammy';
import type { MessengerChannel } from '@mestechko/domain';
import type { InboundEvent, InboundPerson } from '../../application/channel.js';

const CHANNEL: MessengerChannel = 'telegram';
const COMMAND = /^\/([a-z_]+)(?:@\w+)?(?:\s+(.+))?$/i;

function personOf(context: Context): InboundPerson | null {
  const from = context.from;
  const chat = context.chat;
  if (!from || from.is_bot || chat?.type !== 'private') {
    return null;
  }
  return {
    externalId: String(from.id),
    chatId: String(chat.id),
    firstName: from.first_name,
    languageTag: from.language_code ?? null,
  };
}

/**
 * Translates Telegram updates into messenger-neutral events. Only private chats are
 * served: the bot talks to clients one to one.
 */
export function wireTelegramUpdates(
  bot: Bot,
  deliver: (event: InboundEvent) => Promise<void>,
): void {
  bot.on('message:text', async (context) => {
    const person = personOf(context);
    if (!person) {
      return;
    }
    const match = COMMAND.exec(context.message.text.trim());
    const command = match?.[1]?.toLowerCase();
    if (command === 'start') {
      await deliver({ kind: 'started', channel: CHANNEL, person, payload: match?.[2] ?? null });
    } else if (command) {
      await deliver({ kind: 'command', channel: CHANNEL, person, command });
    } else {
      await deliver({ kind: 'text', channel: CHANNEL, person });
    }
  });

  bot.on('callback_query:data', async (context) => {
    const query = context.callbackQuery;
    const message = query.message;
    if (message?.chat.type !== 'private' || query.from.is_bot) {
      await context.answerCallbackQuery();
      return;
    }
    await deliver({
      kind: 'action',
      channel: CHANNEL,
      person: {
        externalId: String(query.from.id),
        chatId: String(message.chat.id),
        firstName: query.from.first_name,
        languageTag: query.from.language_code ?? null,
      },
      data: query.data,
      action: {
        token: query.id,
        chatId: String(message.chat.id),
        messageId: String(message.message_id),
      },
    });
  });

  bot.on('my_chat_member', async (context) => {
    const person = personOf(context);
    if (person && context.myChatMember.new_chat_member.status === 'kicked') {
      await deliver({ kind: 'stopped', channel: CHANNEL, person });
    }
  });
}
