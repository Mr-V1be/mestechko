import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module.js';
import { ClientsModule } from '../clients/clients.module.js';
import { MediaModule } from '../media/media.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { SchedulingModule } from '../scheduling/scheduling.module.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { BookingOptionsController } from './api/booking-options.controller.js';
import { CabinetBookingsController } from './api/cabinet-bookings.controller.js';
import { MiniAppBookingsController } from './api/miniapp-bookings.controller.js';
import { AvailabilityAssembler } from './application/availability/availability-assembler.js';
import { ClientBookings } from './application/client/client-bookings.js';
import { CreateClientBooking } from './application/client/create-client-booking.js';
import { ClientBookingChanges } from './application/lifecycle/client-booking-changes.js';
import { RescheduleOptions } from './application/lifecycle/reschedule-options.js';
import { CLIENT_BOOKING_QUERIES } from './application/ports.js';
import { cabinetBookingProviders } from './providers/cabinet-providers.js';
import { clientBookingProviders } from './providers/client-providers.js';
import { bookingStorageProviders } from './providers/storage-providers.js';

/**
 * Bookings: availability, booking, the client's changes and the cabinet's views.
 * Exposes the client use cases to the channels that act on a client's behalf.
 */
@Module({
  imports: [
    TenancyModule,
    CatalogModule,
    SchedulingModule,
    ClientsModule,
    MediaModule,
    NotificationsModule,
  ],
  controllers: [BookingOptionsController, MiniAppBookingsController, CabinetBookingsController],
  providers: [...bookingStorageProviders, ...clientBookingProviders, ...cabinetBookingProviders],
  exports: [
    AvailabilityAssembler,
    ClientBookings,
    CreateClientBooking,
    ClientBookingChanges,
    RescheduleOptions,
    CLIENT_BOOKING_QUERIES,
  ],
})
export class BookingModule {}
