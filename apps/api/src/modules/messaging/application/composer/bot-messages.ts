import type { ClientBooking } from '@mestechko/contracts';
import {
  bookingActionIds,
  notificationKinds,
  type BookingAction,
  type Locale,
  type NotificationKind,
  type VerticalDefinition,
} from '@mestechko/domain';
import { formatInstant, formatLocalDate, formatMoney } from '@mestechko/i18n';
import type { Translations, Translator } from '../../../../shared/application/translations.js';
import { encodeAction } from '../action-data.js';
import type { ButtonTone, OutboundButton, OutboundMessage } from '../channel.js';

/** What a message needs to know about the business it speaks for. */
export interface BusinessCard {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly vertical: VerticalDefinition;
}

export interface OfferCard {
  readonly entryId: string;
  readonly startsAt: Date;
  readonly total: {
    readonly amountMinor: number;
    readonly currency: ClientBooking['total']['currency'];
  };
  readonly timeZone: string;
  readonly address: string;
  readonly services: readonly string[];
  readonly staffName: string | null;
  /** Until when the time is kept for the client. */
  readonly holdsUntil: Date;
}

/** How each booking action appears as a button and what pressing it starts. */
const actionButtons: Readonly<
  Record<BookingAction, { kind: 'attend' | 'move_days' | 'cancel_ask'; tone: ButtonTone }>
> = {
  confirm_attendance: { kind: 'attend', tone: 'positive' },
  reschedule: { kind: 'move_days', tone: 'default' },
  cancel: { kind: 'cancel_ask', tone: 'negative' },
};

const TIMES_PER_ROW = 4;
const DAYS_PER_ROW = 2;

function rows<T>(items: readonly T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, index * size + size),
  );
}

/** The bot's namespace of texts; shared namespaces are reached with their prefix. */
const BOT_NAMESPACE = 'bot';

/** The bot's messages in every language: each person reads their own. */
export class BotMessageBook {
  private readonly composers = new Map<Locale, BotMessages>();

  constructor(
    private readonly translations: Translations,
    private readonly miniAppUrl: string | null,
  ) {}

  in(locale: Locale): BotMessages {
    const known = this.composers.get(locale);
    if (known) {
      return known;
    }
    const composer = new BotMessages(this.translations.in(locale, BOT_NAMESPACE), this.miniAppUrl);
    this.composers.set(locale, composer);
    return composer;
  }
}

/** Renders every message of the bot in one language; no channel markup here. */
export class BotMessages {
  constructor(
    private readonly texts: Translator,
    private readonly miniAppUrl: string | null,
  ) {}

  welcome(firstName: string): OutboundMessage {
    return {
      title: this.texts.text('welcome.title', { name: firstName }),
      lines: this.texts.lines('welcome.lines'),
      buttons: [[this.button('bookings', { kind: 'bookings' })]],
    };
  }

  help(): OutboundMessage {
    return {
      title: this.texts.text('help.title'),
      lines: this.texts.lines('help.lines'),
      buttons: [],
    };
  }

  unknown(): OutboundMessage {
    return {
      title: this.texts.text('unknown.title'),
      lines: this.texts.lines('unknown.lines'),
      buttons: [],
    };
  }

  bookings(items: readonly { business: BusinessCard; booking: ClientBooking }[]): OutboundMessage {
    return {
      title: this.texts.text('bookings.title'),
      lines: items.length === 0 ? [this.texts.text('bookings.empty')] : [],
      buttons: items.map(({ business, booking }) => [
        {
          kind: 'action',
          label: this.texts.text('bookings.item', {
            date: this.date(booking.start, booking.location.timeZone),
            time: this.time(booking.start, booking.location.timeZone),
            business: business.name,
          }),
          data: encodeAction({ kind: 'open', businessId: business.id, bookingId: booking.id }),
          tone: 'default',
        },
      ]),
    };
  }

  /** A booking with the actions it offers now; `title` says why it is shown. */
  booking(
    business: BusinessCard,
    booking: ClientBooking,
    title: string,
    offered: readonly BookingAction[] = bookingActionIds,
  ): OutboundMessage {
    const actions = offered.filter((action) => booking.actions[action]);
    const actionRow = actions.map((action): OutboundButton => ({
      kind: 'action',
      label: this.texts.text(`actions.${action}`),
      data: encodeAction({
        kind: actionButtons[action].kind,
        businessId: business.id,
        bookingId: booking.id,
      }),
      tone: actionButtons[action].tone,
    }));
    const open = this.openButton(business, booking);
    return {
      title,
      lines: [...this.details(business, booking), ...this.status(booking)],
      buttons: [actionRow, ...(open ? [[open]] : [])].filter((row) => row.length > 0),
    };
  }

  notification(
    kind: NotificationKind,
    business: BusinessCard,
    booking: ClientBooking,
  ): OutboundMessage {
    return this.booking(
      business,
      booking,
      this.texts.text(`notice.${kind}`),
      notificationKinds[kind].actions,
    );
  }

  cancelQuestion(business: BusinessCard, booking: ClientBooking): OutboundMessage {
    const target = { businessId: business.id, bookingId: booking.id };
    return {
      title: this.texts.text('cancel.title'),
      lines: [...this.details(business, booking), this.texts.text('cancel.consequence')],
      buttons: [
        [
          this.button('cancelConfirm', { kind: 'cancel', ...target }, 'negative'),
          this.button('keep', { kind: 'open', ...target }),
        ],
      ],
    };
  }

  chooseDay(
    business: BusinessCard,
    booking: ClientBooking,
    dates: readonly string[],
  ): OutboundMessage {
    const target = { businessId: business.id, bookingId: booking.id };
    return {
      title: this.texts.text('move.chooseDay'),
      lines: dates.length === 0 ? [this.texts.text('move.noDays')] : [this.sameStaffNote(business)],
      buttons: [
        ...rows(
          dates.map((date): OutboundButton => ({
            kind: 'action',
            label: formatLocalDate(this.texts.locale, date, 'weekdayDayMonth'),
            data: encodeAction({ kind: 'move_times', ...target, date }),
            tone: 'default',
          })),
          DAYS_PER_ROW,
        ),
        [this.button('back', { kind: 'open', ...target })],
      ],
    };
  }

  chooseTime(
    business: BusinessCard,
    booking: ClientBooking,
    date: string,
    starts: readonly number[],
  ): OutboundMessage {
    const target = { businessId: business.id, bookingId: booking.id };
    const timeZone = booking.location.timeZone;
    return {
      title: this.texts.text('move.chooseTime', {
        date: formatLocalDate(this.texts.locale, date, 'weekdayDayMonth'),
      }),
      lines: starts.length === 0 ? [this.texts.text('move.noTimes')] : [],
      buttons: [
        ...rows(
          starts.map((start): OutboundButton => ({
            kind: 'action',
            label: this.time(start, timeZone),
            data: encodeAction({ kind: 'move_ask', ...target, start }),
            tone: 'default',
          })),
          TIMES_PER_ROW,
        ),
        [this.button('otherDay', { kind: 'move_days', ...target })],
      ],
    };
  }

  confirmMove(business: BusinessCard, booking: ClientBooking, start: number): OutboundMessage {
    const target = { businessId: business.id, bookingId: booking.id };
    const timeZone = booking.location.timeZone;
    return {
      title: this.texts.text('move.confirm', {
        date: this.date(start, timeZone),
        time: this.time(start, timeZone),
      }),
      lines: [this.sameStaffNote(business)],
      buttons: [
        [
          this.button('move', { kind: 'move', ...target, start }, 'positive'),
          this.button('back', { kind: 'move_days', ...target }),
        ],
      ],
    };
  }

  offer(business: BusinessCard, offer: OfferCard): OutboundMessage {
    const target = {
      businessId: business.id,
      entryId: offer.entryId,
      start: offer.startsAt.getTime(),
    };
    return {
      title: this.texts.text('notice.waitlist_offer'),
      lines: [
        this.texts.text('offer.when', {
          date: this.date(offer.startsAt, offer.timeZone),
          time: this.time(offer.startsAt, offer.timeZone),
        }),
        this.texts.text('card.where', { business: business.name, address: offer.address }),
        this.texts.text('card.what', { services: offer.services.join(', ') }),
        ...(offer.staffName
          ? [
              this.texts.text('card.staff', {
                role: this.staffRole(business),
                name: offer.staffName,
              }),
            ]
          : []),
        this.texts.text('offer.total', {
          total: formatMoney(this.texts.locale, offer.total),
        }),
        this.texts.text('offer.holdsUntil', { time: this.time(offer.holdsUntil, offer.timeZone) }),
      ],
      buttons: [
        [
          this.button('acceptOffer', { kind: 'offer_accept', ...target }, 'positive'),
          this.button('declineOffer', { kind: 'offer_decline', ...target }),
        ],
      ],
    };
  }

  /** The offer message once it is answered or gone: the facts stay, the buttons go. */
  offerAnswered(previous: OutboundMessage, note: string): OutboundMessage {
    return { title: previous.title, lines: [...previous.lines, note], buttons: [] };
  }

  notice(key: string): string {
    return this.texts.text(`notices.${key}`);
  }

  text(key: string): string {
    return this.texts.text(key);
  }

  private details(business: BusinessCard, booking: ClientBooking): string[] {
    const timeZone = booking.location.timeZone;
    return [
      this.texts.text('card.when', {
        date: this.date(booking.start, timeZone),
        start: this.time(booking.start, timeZone),
        end: this.time(booking.end, timeZone),
      }),
      this.texts.text('card.where', { business: business.name, address: booking.location.address }),
      this.texts.text('card.what', {
        services: booking.services.map((service) => service.name).join(', '),
      }),
      this.texts.text('card.staff', {
        role: this.staffRole(business),
        name: booking.staff.displayName,
      }),
      this.texts.text('card.total', { total: formatMoney(this.texts.locale, booking.total) }),
    ];
  }

  private status(booking: ClientBooking): string[] {
    if (booking.hold) {
      return [
        this.texts.text(`card.hold.${booking.hold.reason}`, {
          time: this.time(booking.hold.expiresAt, booking.location.timeZone),
          amount: booking.deposit ? formatMoney(this.texts.locale, booking.deposit) : '',
        }),
      ];
    }
    if (booking.status !== 'confirmed') {
      return [
        this.texts.text('card.status', {
          status: this.texts.text(`booking:status.${booking.status}`),
        }),
      ];
    }
    const lines = booking.attendanceConfirmed ? [this.texts.text('card.attendanceConfirmed')] : [];
    if (booking.actions.reschedule && booking.changeDeadline) {
      lines.push(
        this.texts.text('card.deadline', {
          deadline: `${this.date(booking.changeDeadline, booking.location.timeZone)}, ${this.time(booking.changeDeadline, booking.location.timeZone)}`,
        }),
      );
    } else if (!booking.actions.cancel) {
      lines.push(this.texts.text('card.closed'));
    }
    return lines;
  }

  private sameStaffNote(business: BusinessCard): string {
    return this.texts.text('move.sameStaff', { role: this.staffRole(business) });
  }

  private staffRole(business: BusinessCard): string {
    return this.texts.text(`terms:staff.${business.vertical.vocabulary.staff}.one`);
  }

  private openButton(business: BusinessCard, booking: ClientBooking): OutboundButton | null {
    return this.miniAppUrl
      ? {
          kind: 'web_app',
          label: this.texts.text('actions.open'),
          url: `${this.miniAppUrl}/b/${encodeURIComponent(business.slug)}/bookings/${booking.id}`,
        }
      : null;
  }

  private button(
    labelKey: string,
    action: Parameters<typeof encodeAction>[0],
    tone: ButtonTone = 'default',
  ): OutboundButton {
    return {
      kind: 'action',
      label: this.texts.text(`actions.${labelKey}`),
      data: encodeAction(action),
      tone,
    };
  }

  private date(instant: string | number | Date, timeZone: string): string {
    return formatInstant(
      this.texts.locale,
      new Date(instant).getTime(),
      timeZone,
      'weekdayDayMonth',
    );
  }

  private time(instant: string | number | Date, timeZone: string): string {
    return formatInstant(this.texts.locale, new Date(instant).getTime(), timeZone, 'time');
  }
}
