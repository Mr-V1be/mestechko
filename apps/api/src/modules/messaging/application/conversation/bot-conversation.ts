import type { ApiErrorCode } from '@mestechko/contracts';
import { resolveLocale, type Clock, type MessengerChannel } from '@mestechko/domain';
import { ApplicationError } from '../../../../shared/application/application-error.js';
import type { CustomerIdentities, MessengerContacts } from '../../../clients/application/ports.js';
import { decodeAction, type BotAction, type BotActionKind } from '../action-data.js';
import type {
  ActionReply,
  InboundEvent,
  MessengerChannelAdapter,
  MessengerChannels,
  OutboundMessage,
} from '../channel.js';
import type { BotMessageBook } from '../composer/bot-messages.js';
import type { BookingDialog } from './booking-dialog.js';
import type { Speaker } from './conversation-context.js';
import type { OfferDialog } from './offer-dialog.js';

type ActionHandler<K extends BotActionKind> = (
  channel: MessengerChannel,
  person: Speaker,
  action: Extract<BotAction, { kind: K }>,
) => Promise<ActionReply>;

type CommandHandler = (channel: MessengerChannel, person: Speaker) => Promise<OutboundMessage>;

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
 * the permission to write that starting the bot grants. Every answer is in the
 * person's language: the one they chose, otherwise the one their messenger reports.
 */
export class BotConversation {
  private readonly commands: Readonly<Record<string, CommandHandler>>;
  private readonly actions: { readonly [K in BotActionKind]: ActionHandler<K> };

  constructor(
    private readonly channels: MessengerChannels,
    private readonly contacts: MessengerContacts,
    private readonly identities: CustomerIdentities,
    private readonly messages: BotMessageBook,
    private readonly bookings: BookingDialog,
    private readonly offers: OfferDialog,
    private readonly clock: Clock,
  ) {
    this.commands = {
      start: (channel, person) => this.start(channel, person),
      bookings: (channel, person) => this.bookings.list(channel, person),
      help: (_channel, person) => Promise.resolve(this.messages.in(person.locale).help()),
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
            return this.offers.gone('taken', person.locale);
          }
          if (error instanceof ApplicationError && error.code === 'change_not_allowed') {
            return this.offers.gone('closed', person.locale);
          }
          throw error;
        }
      },
      offer_decline: async (channel, person, action) => {
        try {
          return await this.offers.decline(channel, person, action);
        } catch (error) {
          if (error instanceof ApplicationError && error.code === 'change_not_allowed') {
            return this.offers.gone('closed', person.locale);
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
    if (event.kind === 'stopped') {
      await this.contacts.revoke(event.channel, event.person.externalId);
      return;
    }
    const person = await this.speaker(event);
    const messages = this.messages.in(person.locale);
    switch (event.kind) {
      case 'started':
        await adapter.send(person.chatId, await this.start(event.channel, person));
        return;
      case 'command': {
        const command = this.commands[event.command] ?? (() => Promise.resolve(messages.unknown()));
        await adapter.send(person.chatId, await command(event.channel, person));
        return;
      }
      case 'text':
        await adapter.send(person.chatId, messages.unknown());
        return;
      case 'action':
        await this.press(adapter, event, person);
        return;
    }
  }

  /** Who wrote, and in which language to answer; the messenger's language is kept for later. */
  private async speaker(event: Exclude<InboundEvent, { kind: 'stopped' }>): Promise<Speaker> {
    const { channel, person } = event;
    if (person.languageTag && event.kind !== 'started') {
      await this.identities.recordLanguage(channel, person.externalId, person.languageTag);
    }
    const chosen = await this.identities.chosenLocale(channel, person.externalId);
    return { ...person, locale: resolveLocale([chosen, person.languageTag]) };
  }

  /** Starting the bot is the permission to write: it is recorded before anything else. */
  private async start(channel: MessengerChannel, person: Speaker): Promise<OutboundMessage> {
    await this.contacts.allow(
      channel,
      person.externalId,
      { chatId: person.chatId, languageTag: person.languageTag },
      new Date(this.clock.now().epochMilliseconds),
    );
    return this.messages.in(person.locale).welcome(person.firstName);
  }

  private async press(
    adapter: MessengerChannelAdapter,
    event: Extract<InboundEvent, { kind: 'action' }>,
    person: Speaker,
  ): Promise<void> {
    const messages = this.messages.in(person.locale);
    const action = decodeAction(event.data);
    if (!action) {
      await adapter.answer(event.action, { replace: null, notice: messages.notice('stale') });
      return;
    }
    try {
      const handler = this.actions[action.kind] as ActionHandler<typeof action.kind>;
      await adapter.answer(event.action, await handler(event.channel, person, action));
    } catch (error) {
      const notice = error instanceof ApplicationError ? refusalNotices[error.code] : undefined;
      await adapter.answer(event.action, {
        replace: null,
        notice: messages.notice(notice ?? 'failed'),
      });
      if (!notice) {
        throw error;
      }
    }
  }
}
