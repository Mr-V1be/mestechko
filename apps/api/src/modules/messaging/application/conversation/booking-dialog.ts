import type { ClientBooking } from '@slotwise/contracts';
import { localDateOf, type Clock, type MessengerChannel } from '@slotwise/domain';
import type { ClientBookings } from '../../../booking/application/client/client-bookings.js';
import type { ClientBookingChanges } from '../../../booking/application/lifecycle/client-booking-changes.js';
import type { RescheduleOptions } from '../../../booking/application/lifecycle/reschedule-options.js';
import type { CustomerIdentities, MessengerContacts } from '../../../clients/application/ports.js';
import type { BusinessContextResolver } from '../../../tenancy/application/business-context.js';
import type { BotAction } from '../action-data.js';
import type { ActionReply, OutboundMessage } from '../channel.js';
import type { BotMessageBook, BotMessages, BusinessCard } from '../composer/bot-messages.js';
import { businessCardOf, chatOrigin, identityIn, type Speaker } from './conversation-context.js';

type BookingTarget = Extract<BotAction, { bookingId: string }>;

/** Days ahead the bot looks for a new time, and how many of them it offers. */
const MOVE_LOOKAHEAD_DAYS = 13;
const MOVE_DAYS_SHOWN = 8;
const MOVE_TIMES_SHOWN = 24;
const BOOKINGS_PER_BUSINESS = 5;
const BOOKINGS_SHOWN = 10;

/** A client's bookings in the chat: the list, the card and its buttons. */
export class BookingDialog {
  constructor(
    private readonly businesses: BusinessContextResolver,
    private readonly bookings: ClientBookings,
    private readonly changes: ClientBookingChanges,
    private readonly rescheduleOptions: RescheduleOptions,
    private readonly customers: CustomerIdentities,
    private readonly contacts: MessengerContacts,
    private readonly book: BotMessageBook,
    private readonly clock: Clock,
  ) {}

  /** Upcoming bookings across every business the person is a client of. */
  async list(channel: MessengerChannel, person: Speaker): Promise<OutboundMessage> {
    const customerId = await this.customers.find(channel, person.externalId);
    const businessIds = customerId ? await this.contacts.businessesOf(customerId) : [];
    const entries = await Promise.all(
      businessIds.map(async (businessId) => {
        const context = await this.businesses.byId(businessId);
        const page = await this.bookings.list(
          identityIn(businessId, channel, person),
          'upcoming',
          null,
          BOOKINGS_PER_BUSINESS,
        );
        return page.items.map((booking) => ({ business: businessCardOf(context), booking }));
      }),
    );
    return this.book.in(person.locale).bookings(
      entries
        .flat()
        .sort((a, b) => a.booking.start.localeCompare(b.booking.start))
        .slice(0, BOOKINGS_SHOWN),
    );
  }

  async open(channel: MessengerChannel, person: Speaker, target: BookingTarget) {
    const messages = this.book.in(person.locale);
    const { business, booking } = await this.load(channel, person, target);
    return this.replace(messages, messages.booking(business, booking, messages.text('card.title')));
  }

  async attend(channel: MessengerChannel, person: Speaker, target: BookingTarget) {
    const messages = this.book.in(person.locale);
    const business = await this.business(target.businessId);
    const booking = await this.changes.confirmAttendance(
      identityIn(target.businessId, channel, person),
      target.bookingId,
      chatOrigin(channel),
    );
    return this.replace(
      messages,
      messages.booking(business, booking, messages.text('card.title')),
      'attendanceConfirmed',
    );
  }

  async cancelAsk(channel: MessengerChannel, person: Speaker, target: BookingTarget) {
    const messages = this.book.in(person.locale);
    const { business, booking } = await this.load(channel, person, target);
    if (!booking.actions.cancel) {
      return this.replace(
        messages,
        messages.booking(business, booking, messages.text('card.title')),
        'tooLate',
      );
    }
    return this.replace(messages, messages.cancelQuestion(business, booking));
  }

  async cancel(channel: MessengerChannel, person: Speaker, target: BookingTarget) {
    const messages = this.book.in(person.locale);
    const business = await this.business(target.businessId);
    const booking = await this.changes.cancel(
      identityIn(target.businessId, channel, person),
      target.bookingId,
      chatOrigin(channel),
    );
    return this.replace(
      messages,
      messages.notification('booking_cancelled', business, booking),
      'cancelled',
    );
  }

  async moveDays(channel: MessengerChannel, person: Speaker, target: BookingTarget) {
    const messages = this.book.in(person.locale);
    const { business, booking } = await this.load(channel, person, target);
    if (!booking.actions.reschedule) {
      return this.replace(
        messages,
        messages.booking(business, booking, messages.text('card.title')),
        'tooLate',
      );
    }
    const today = localDateOf(this.clock.now().epochMilliseconds, booking.location.timeZone);
    const options = await this.rescheduleOptions.days(
      identityIn(target.businessId, channel, person),
      target.bookingId,
      { from: today.toString(), to: today.add({ days: MOVE_LOOKAHEAD_DAYS }).toString() },
    );
    const dates = options.days
      .filter((day) => day.slots.some((slot) => slot.start !== booking.start))
      .map((day) => day.date)
      .slice(0, MOVE_DAYS_SHOWN);
    return this.replace(messages, messages.chooseDay(business, booking, dates));
  }

  async moveTimes(
    channel: MessengerChannel,
    person: Speaker,
    target: Extract<BotAction, { kind: 'move_times' }>,
  ) {
    const messages = this.book.in(person.locale);
    const { business, booking } = await this.load(channel, person, target);
    const options = await this.rescheduleOptions.days(
      identityIn(target.businessId, channel, person),
      target.bookingId,
      { from: target.date, to: target.date },
    );
    const starts = (options.days[0]?.slots ?? [])
      .filter((slot) => slot.start !== booking.start)
      .map((slot) => Date.parse(slot.start))
      .slice(0, MOVE_TIMES_SHOWN);
    return this.replace(messages, messages.chooseTime(business, booking, target.date, starts));
  }

  async moveAsk(
    channel: MessengerChannel,
    person: Speaker,
    target: Extract<BotAction, { kind: 'move_ask' }>,
  ) {
    const messages = this.book.in(person.locale);
    const { business, booking } = await this.load(channel, person, target);
    return this.replace(messages, messages.confirmMove(business, booking, target.start));
  }

  async move(
    channel: MessengerChannel,
    person: Speaker,
    target: Extract<BotAction, { kind: 'move' }>,
  ) {
    const messages = this.book.in(person.locale);
    const business = await this.business(target.businessId);
    const booking = await this.changes.reschedule(
      identityIn(target.businessId, channel, person),
      target.bookingId,
      new Date(target.start).toISOString(),
      chatOrigin(channel),
    );
    return this.replace(
      messages,
      messages.notification('booking_rescheduled', business, booking),
      'moved',
    );
  }

  private async load(
    channel: MessengerChannel,
    person: Speaker,
    target: BookingTarget,
  ): Promise<{ business: BusinessCard; booking: ClientBooking }> {
    const [business, booking] = await Promise.all([
      this.business(target.businessId),
      this.bookings.get(identityIn(target.businessId, channel, person), target.bookingId),
    ]);
    return { business, booking };
  }

  private async business(businessId: string): Promise<BusinessCard> {
    return businessCardOf(await this.businesses.byId(businessId));
  }

  private replace(
    messages: BotMessages,
    message: OutboundMessage,
    notice: string | null = null,
  ): ActionReply {
    return { replace: message, notice: notice ? messages.notice(notice) : null };
  }
}
