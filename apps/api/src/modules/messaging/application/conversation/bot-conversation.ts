import type { ApiErrorCode } from '@mestechko/contracts';
import type { Clock, MessengerChannel } from '@mestechko/domain';
import { ApplicationError } from '../../../../shared/application/application-error.js';
import type { MessengerContacts } from '../../../clients/application/ports.js';
import { decodeAction, type BotAction, type BotActionKind } from '../action-data.js';
import type {
  ActionReply,
  InboundEvent,
  InboundPerson,
  MessengerChannelAdapter,
  MessengerChannels,
  OutboundMessage,
} from '../channel.js';
import type { BotMessages } from '../composer/bot-messages.js';
import type { BookingDialog } from './booking-dialog.js';
import type { OfferDialog } from './offer-dialog.js';

type ActionHandler<K extends BotActionKind> = (
  channel: MessengerChannel,
  person: InboundPerson,
  action: Extract<BotAction, { kind: K }>,
) => Promise<ActionReply>;

type CommandHandler = (
  channel: MessengerChannel,
  person: InboundPerson,
) => Promise<OutboundMessage>;

/** Notices for refusals the person can understand; anything else is a failure. */
const refusalNotices: Partial<Record<ApiErrorCode, string>> = {
  not_found: 'notFound',
  change_not_allowed: 'tooLate',
  slot_unavailable: 'slotTaken',
  price_changed: 'priceChanged',
  booking_changed: 'stale',
};

/**
 * The bot's side of a chat, the same on every messenger: commands, button presses and
 * the permission to write that starting the bot grants.
 */
export class BotConversation {
  private readonly commands: Readonly<Record<string, CommandHandler>>;
  private readonly actions: { readonly [K in BotActionKind]: ActionHandler<K> };

  constructor(
    private readonly channels: MessengerChannels,
    private readonly contacts: MessengerContacts,
    private readonly messages: BotMessages,
    private readonly bookings: BookingDialog,
    private readonly offers: OfferDialog,
    private readonly clock: Clock,
  ) {
    this.commands = {
      start: (channel, person) => this.start(channel, person),
      bookings: (channel, person) => this.bookings.list(channel, person),
      help: () => Promise.resolve(this.messages.help()),
    };
    this.actions = {
      bookings: async (channel, person) => ({
        replace: await this.bookings.list(channel, person),
        notice: null,
      }),
      open: (channel, person, action) => this.bookings.open(channel, person, action),
      attend: (channel, person, action) => this.bookings.attend(channel, person, action),
      cancel_ask: (channel, person, action) => this.bookings.cancelAsk(channel, person, action),
      cancel: (channel, person, action) => this.bookings.cancel(channel, person, action),
      move_days: (channel, person, action) => this.bookings.moveDays(channel, person, action),
      move_times: (channel, person, action) => this.bookings.moveTimes(channel, person, action),
      move_ask: (channel, person, action) => this.bookings.moveAsk(channel, person, action),
      move: (channel, person, action) => this.bookings.move(channel, person, action),
      offer_accept: async (channel, person, action) => {
        try {
          return await this.offers.accept(channel, person, action);
        } catch (error) {
          if (error instanceof ApplicationError && error.code === 'slot_unavailable') {
            return this.offers.gone('taken');
          }
          if (error instanceof ApplicationError && error.code === 'change_not_allowed') {
            return this.offers.gone('closed');
          }
          throw error;
        }
      },
      offer_decline: async (channel, person, action) => {
        try {
          return await this.offers.decline(channel, person, action);
        } catch (error) {
          if (error instanceof ApplicationError && error.code === 'change_not_allowed') {
            return this.offers.gone('closed');
          }
          throw error;
        }
      },
    };
  }

  async handle(event: InboundEvent): Promise<void> {
    const adapter = this.channels.get(event.channel);
    if (!adapter) {
      return;
    }
    switch (event.kind) {
      case 'started':
        await adapter.send(event.person.chatId, await this.start(event.channel, event.person));
        return;
      case 'command': {
        const command =
          this.commands[event.command] ?? (() => Promise.resolve(this.messages.unknown()));
        await adapter.send(event.person.chatId, await command(event.channel, event.person));
        return;
      }
      case 'text':
        await adapter.send(event.person.chatId, this.messages.unknown());
        return;
      case 'stopped':
        await this.contacts.revoke(event.channel, event.person.externalId);
        return;
      case 'action':
        await this.press(adapter, event);
        return;
    }
  }

  /** Starting the bot is the permission to write: it is recorded before anything else. */
  private async start(channel: MessengerChannel, person: InboundPerson): Promise<OutboundMessage> {
    await this.contacts.allow(
      channel,
      person.externalId,
      person.chatId,
      new Date(this.clock.now().epochMilliseconds),
    );
    return this.messages.welcome(person.firstName);
  }

  private async press(
    adapter: MessengerChannelAdapter,
    event: Extract<InboundEvent, { kind: 'action' }>,
  ): Promise<void> {
    const action = decodeAction(event.data);
    if (!action) {
      await adapter.answer(event.action, { replace: null, notice: this.messages.notice('stale') });
      return;
    }
    try {
      const handler = this.actions[action.kind] as ActionHandler<typeof action.kind>;
      await adapter.answer(event.action, await handler(event.channel, event.person, action));
    } catch (error) {
      const notice = error instanceof ApplicationError ? refusalNotices[error.code] : undefined;
      await adapter.answer(event.action, {
        replace: null,
        notice: this.messages.notice(notice ?? 'failed'),
      });
      if (!notice) {
        throw error;
      }
    }
  }
}
