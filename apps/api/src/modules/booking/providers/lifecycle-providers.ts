import type { Provider } from '@nestjs/common';
import type { Clock } from '@mestechko/domain';
import { CLOCK, ID_GENERATOR, type IdGenerator } from '../../../shared/application/ports.js';
import { RATE_LIMITER, type RateLimiter } from '../../../shared/application/rate-limits.js';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../shared/application/unit-of-work.js';
import {
  CLIENT_DIRECTORY,
  CUSTOMER_IDENTITIES,
  MESSENGER_CONTACTS,
  type ClientDirectory,
  type CustomerIdentities,
  type MessengerContacts,
} from '../../clients/application/ports.js';
import {
  NOTIFICATION_OUTBOX,
  type NotificationOutbox,
} from '../../notifications/application/ports.js';
import { PaymentCheckout } from '../../payments/application/payment-checkout.js';
import { PAYMENT_PROVIDER, type PaymentProvider } from '../../payments/application/ports.js';
import { Prepayments } from '../../payments/application/prepayments.js';
import { BusinessContextResolver } from '../../tenancy/application/business-context.js';
import { AvailabilityAssembler } from '../application/availability/availability-assembler.js';
import { BookingPlacement } from '../application/client/booking-placement.js';
import { ClientBookingPresenter } from '../application/client/client-booking-presenter.js';
import { PrepaidBookings } from '../application/client/prepaid-bookings.js';
import { WebsiteBookings } from '../application/client/website-bookings.js';
import { BookingCancellation } from '../application/lifecycle/booking-cancellation.js';
import {
  bookingHoldHandlerTokens,
  BookingHolds,
  ReleaseExpiredHolds,
} from '../application/lifecycle/booking-holds.js';
import { BookingNotifier } from '../application/lifecycle/booking-notifier.js';
import { ClientBookingChanges } from '../application/lifecycle/client-booking-changes.js';
import {
  BOOKING_LIFECYCLE_STORE,
  type BookingLifecycleStore,
} from '../application/lifecycle/ports.js';
import {
  BOOKING_FOLLOW_UPS,
  BOOKING_TOKENS,
  CLIENT_BOOKING_QUERIES,
  EXPIRED_HOLDS,
  PAYMENT_DESCRIPTIONS,
  type BookingFollowUps,
  type BookingTokens,
  type ClientBookingQueries,
  type ExpiredHolds,
  type PaymentDescriptions,
} from '../application/ports.js';

/** A booking's life: messages, changes by the client, holds, prepayments, the website. */
export const lifecycleProviders: Provider[] = [
  {
    provide: BookingNotifier,
    useFactory: (outbox: NotificationOutbox, contacts: MessengerContacts) =>
      new BookingNotifier(outbox, contacts),
    inject: [NOTIFICATION_OUTBOX, MESSENGER_CONTACTS],
  },
  {
    provide: BookingCancellation,
    useFactory: (
      store: BookingLifecycleStore,
      prepayments: Prepayments,
      notifier: BookingNotifier,
      ids: IdGenerator,
    ) => new BookingCancellation(store, prepayments, notifier, ids),
    inject: [BOOKING_LIFECYCLE_STORE, Prepayments, BookingNotifier, ID_GENERATOR],
  },
  {
    provide: BookingHolds,
    useFactory: (
      store: BookingLifecycleStore,
      cancellation: BookingCancellation,
      notifier: BookingNotifier,
      ids: IdGenerator,
    ) => new BookingHolds(store, cancellation, notifier, ids),
    inject: [BOOKING_LIFECYCLE_STORE, BookingCancellation, BookingNotifier, ID_GENERATOR],
  },
  {
    provide: bookingHoldHandlerTokens.sweep,
    useFactory: (
      expired: ExpiredHolds,
      unitOfWork: UnitOfWork,
      store: BookingLifecycleStore,
      holds: BookingHolds,
      followUps: BookingFollowUps,
      clock: Clock,
    ) => new ReleaseExpiredHolds(expired, unitOfWork, store, holds, followUps, clock),
    inject: [
      EXPIRED_HOLDS,
      UNIT_OF_WORK,
      BOOKING_LIFECYCLE_STORE,
      BookingHolds,
      BOOKING_FOLLOW_UPS,
      CLOCK,
    ],
  },
  {
    provide: ClientBookingChanges,
    useFactory: (
      businesses: BusinessContextResolver,
      unitOfWork: UnitOfWork,
      customers: CustomerIdentities,
      clients: ClientDirectory,
      store: BookingLifecycleStore,
      assembler: AvailabilityAssembler,
      notifier: BookingNotifier,
      cancellation: BookingCancellation,
      followUps: BookingFollowUps,
      presenter: ClientBookingPresenter,
      ids: IdGenerator,
      clock: Clock,
    ) =>
      new ClientBookingChanges(
        businesses,
        unitOfWork,
        customers,
        clients,
        store,
        assembler,
        notifier,
        cancellation,
        followUps,
        presenter,
        ids,
        clock,
      ),
    inject: [
      BusinessContextResolver,
      UNIT_OF_WORK,
      CUSTOMER_IDENTITIES,
      CLIENT_DIRECTORY,
      BOOKING_LIFECYCLE_STORE,
      AvailabilityAssembler,
      BookingNotifier,
      BookingCancellation,
      BOOKING_FOLLOW_UPS,
      ClientBookingPresenter,
      ID_GENERATOR,
      CLOCK,
    ],
  },
  {
    provide: PrepaidBookings,
    useFactory: (
      businesses: BusinessContextResolver,
      unitOfWork: UnitOfWork,
      customers: CustomerIdentities,
      clients: ClientDirectory,
      queries: ClientBookingQueries,
      store: BookingLifecycleStore,
      holds: BookingHolds,
      prepayments: Prepayments,
      checkout: PaymentCheckout,
      provider: PaymentProvider,
      descriptions: PaymentDescriptions,
      presenter: ClientBookingPresenter,
      followUps: BookingFollowUps,
      clock: Clock,
    ) =>
      new PrepaidBookings(
        businesses,
        unitOfWork,
        customers,
        clients,
        queries,
        store,
        holds,
        prepayments,
        checkout,
        provider,
        descriptions,
        presenter,
        followUps,
        clock,
      ),
    inject: [
      BusinessContextResolver,
      UNIT_OF_WORK,
      CUSTOMER_IDENTITIES,
      CLIENT_DIRECTORY,
      CLIENT_BOOKING_QUERIES,
      BOOKING_LIFECYCLE_STORE,
      BookingHolds,
      Prepayments,
      PaymentCheckout,
      PAYMENT_PROVIDER,
      PAYMENT_DESCRIPTIONS,
      ClientBookingPresenter,
      BOOKING_FOLLOW_UPS,
      CLOCK,
    ],
  },
  {
    provide: WebsiteBookings,
    useFactory: (
      businesses: BusinessContextResolver,
      unitOfWork: UnitOfWork,
      clients: ClientDirectory,
      queries: ClientBookingQueries,
      placement: BookingPlacement,
      prepayments: Prepayments,
      prepaid: PrepaidBookings,
      notifier: BookingNotifier,
      tokens: BookingTokens,
      limits: RateLimiter,
      followUps: BookingFollowUps,
      ids: IdGenerator,
      clock: Clock,
    ) =>
      new WebsiteBookings(
        businesses,
        unitOfWork,
        clients,
        queries,
        placement,
        prepayments,
        prepaid,
        notifier,
        tokens,
        limits,
        followUps,
        ids,
        clock,
      ),
    inject: [
      BusinessContextResolver,
      UNIT_OF_WORK,
      CLIENT_DIRECTORY,
      CLIENT_BOOKING_QUERIES,
      BookingPlacement,
      Prepayments,
      PrepaidBookings,
      BookingNotifier,
      BOOKING_TOKENS,
      RATE_LIMITER,
      BOOKING_FOLLOW_UPS,
      ID_GENERATOR,
      CLOCK,
    ],
  },
];
