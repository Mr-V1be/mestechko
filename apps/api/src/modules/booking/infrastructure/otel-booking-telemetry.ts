import { metrics, type Counter } from '@opentelemetry/api';
import type { BookingSource } from '@slotwise/domain';
import { SYSTEM_NAME } from '../../../platform/system-name.js';
import type { BookingTelemetry } from '../application/ports.js';

export class OtelBookingTelemetry implements BookingTelemetry {
  private readonly created: Counter;
  private readonly conflicts: Counter;

  constructor() {
    const meter = metrics.getMeter(`${SYSTEM_NAME}.booking`);
    this.created = meter.createCounter('bookings_created', {
      description: 'Bookings created by clients',
    });
    this.conflicts = meter.createCounter('booking_slot_conflicts', {
      description: 'Booking attempts rejected because the time was taken concurrently',
    });
  }

  bookingCreated(source: BookingSource): void {
    this.created.add(1, { source });
  }

  slotConflict(): void {
    this.conflicts.add(1);
  }
}
