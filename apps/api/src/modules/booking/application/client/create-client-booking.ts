import type { ClientBooking } from '@slotwise/contracts';
import type { BookingSource, Clock, MessengerChannel, Money } from '@slotwise/domain';
import { notFound } from '../../../../shared/application/application-error.js';
import type { IdGenerator } from '../../../../shared/application/ports.js';
import type { UnitOfWork } from '../../../../shared/application/unit-of-work.js';
import type {
  ClientContact,
  ClientDirectory,
  ClientRecord,
  CustomerIdentities,
} from '../../../clients/application/ports.js';
import type {
  BusinessContext,
  BusinessContextResolver,
  BusinessKey,
} from '../../../tenancy/application/business-context.js';
import type { BookingNotifier } from '../lifecycle/booking-notifier.js';
import type { BookingFollowUps } from '../ports.js';
import type { BookingPlacement } from './booking-placement.js';
import type { ClientBookingPresenter } from './client-booking-presenter.js';

export interface CreateClientBookingCommand {
  readonly business: BusinessKey;
  readonly channel: MessengerChannel;
  readonly source: BookingSource;
  readonly externalUserId: string;
  readonly idempotencyKey: string;
  readonly locationId: string;
  readonly serviceIds: readonly string[];
  readonly staffId: string | null;
  readonly start: string;
  /** Contact to save on the client card; `null` books with the card the client already has. */
  readonly contact: ClientContact | null;
  readonly comment: string | null;
  /** Total the client confirmed; the booking never costs more. */
  readonly agreedTotal: Money;
  /** In a chat the client sees the booking in the message they pressed; no notice follows. */
  readonly surface: 'web_app' | 'chat';
}

/**
 * Books a free start for a client of a messenger. A booking that asks for a prepayment
 * holds its time; the client hears about it once it is paid.
 */
export class CreateClientBooking {
  constructor(
    private readonly businesses: BusinessContextResolver,
    private readonly unitOfWork: UnitOfWork,
    private readonly customers: CustomerIdentities,
    private readonly clients: ClientDirectory,
    private readonly placement: BookingPlacement,
    private readonly notifier: BookingNotifier,
    private readonly followUps: BookingFollowUps,
    private readonly presenter: ClientBookingPresenter,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(command: CreateClientBookingCommand): Promise<ClientBooking> {
    const context = await this.businesses.resolve(command.business);
    const booking = await this.unitOfWork.inTenant(context.business.id, () =>
      this.bookInTenant(context, command),
    );
    await this.followUps.afterCommit({ businessId: context.business.id, freedTime: null });
    return booking;
  }

  private async bookInTenant(
    context: BusinessContext,
    command: CreateClientBookingCommand,
  ): Promise<ClientBooking> {
    const now = new Date(this.clock.now().epochMilliseconds);
    const customerId = await this.customers.ensure(command.channel, command.externalUserId, now);
    const client = await this.clientCard(customerId, command.contact, now);
    const placed = await this.placement.place(
      context,
      {
        clientId: client.id,
        source: command.source,
        idempotencyKey: command.idempotencyKey,
        locationId: command.locationId,
        serviceIds: command.serviceIds,
        staffId: command.staffId,
        start: command.start,
        comment: command.comment,
        agreedTotal: command.agreedTotal,
      },
      now,
    );
    if (placed.isNew && !placed.awaitsPayment) {
      await this.notifier.plan({
        businessId: context.business.id,
        booking: {
          id: placed.id,
          version: 1,
          startsAt: placed.startsAt,
          source: command.source,
          customerId,
        },
        event: 'created',
        seenByClient: command.surface === 'chat',
        now,
      });
    }
    return this.presenter.present(context, client.id, placed.id);
  }

  private async clientCard(
    customerId: string,
    contact: ClientContact | null,
    now: Date,
  ): Promise<ClientRecord> {
    if (contact) {
      return this.clients.upsertForCustomer(customerId, contact, { newId: this.ids.next(), now });
    }
    const existing = await this.clients.findByCustomer(customerId);
    if (!existing) {
      throw notFound('Client');
    }
    return existing;
  }
}
