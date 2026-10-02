import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module.js';
import { ClientsModule } from '../clients/clients.module.js';
import { LoyaltyModule } from '../loyalty/loyalty.module.js';
import { MediaModule } from '../media/media.module.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { SchedulingModule } from '../scheduling/scheduling.module.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { BookingOptionsController } from './api/booking-options.controller.js';
import { CabinetBookingsController } from './api/cabinet-bookings.controller.js';
import { CabinetDeskController } from './api/cabinet-desk.controller.js';
import { MiniAppBookingsController } from './api/miniapp-bookings.controller.js';
import { PaymentWebhookController } from './api/payment-webhook.controller.js';
import { WidgetBookingsController } from './api/widget-bookings.controller.js';
import { AvailabilityAssembler } from './application/availability/availability-assembler.js';
import { ClientBookings } from './application/client/client-bookings.js';
import { CabinetBookings } from './application/cabinet/cabinet-bookings.js';
import { ClientBookingPresenter } from './application/client/client-booking-presenter.js';
import { CreateClientBooking } from './application/client/create-client-booking.js';
import { BookingCancellation } from './application/lifecycle/booking-cancellation.js';
import { BookingHolds } from './application/lifecycle/booking-holds.js';
import { BookingNotifier } from './application/lifecycle/booking-notifier.js';
import { ClientBookingChanges } from './application/lifecycle/client-booking-changes.js';
import { BOOKING_LIFECYCLE_STORE } from './application/lifecycle/ports.js';
import { RescheduleOptions } from './application/lifecycle/reschedule-options.js';
import { BOOKING_WRITER, CLIENT_BOOKING_QUERIES, STAFF_VISITS } from './application/ports.js';
import { cabinetBookingProviders } from './providers/cabinet-providers.js';
import { clientBookingProviders } from './providers/client-providers.js';
import { lifecycleProviders } from './providers/lifecycle-providers.js';
import { bookingStorageProviders } from './providers/storage-providers.js';

/**
 * Bookings: availability, booking, the client's and the business's changes, holds and
 * prepayments, the website widget and the cabinet's views. Exposes the client use
 * cases to the channels that act on a client's behalf, and the lifecycle to the
 * waitlist that offers freed time.
 */
@Module({
  imports: [
    TenancyModule,
    CatalogModule,
    SchedulingModule,
    ClientsModule,
    MediaModule,
    NotificationsModule,
    LoyaltyModule,
    PaymentsModule,
  ],
  controllers: [
    BookingOptionsController,
    MiniAppBookingsController,
    CabinetBookingsController,
    CabinetDeskController,
    PaymentWebhookController,
    WidgetBookingsController,
  ],
  providers: [
    ...bookingStorageProviders,
    ...clientBookingProviders,
    ...lifecycleProviders,
    ...cabinetBookingProviders,
  ],
  exports: [
    AvailabilityAssembler,
    CabinetBookings,
    ClientBookings,
    CreateClientBooking,
    ClientBookingChanges,
    ClientBookingPresenter,
    RescheduleOptions,
    BookingHolds,
    BookingCancellation,
    BookingNotifier,
    BOOKING_LIFECYCLE_STORE,
    BOOKING_WRITER,
    CLIENT_BOOKING_QUERIES,
    STAFF_VISITS,
  ],
})
export class BookingModule {}
