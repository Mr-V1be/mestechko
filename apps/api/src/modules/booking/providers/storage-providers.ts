import type { Provider } from '@nestjs/common';
import { KyselyUnitOfWork } from '../../../platform/db/kysely-unit-of-work.js';
import { CABINET_BOOKING_QUERIES } from '../application/cabinet/ports.js';
import { BOOKING_LIFECYCLE_STORE } from '../application/lifecycle/ports.js';
import {
  BOOKING_TELEMETRY,
  BOOKING_WRITER,
  CLIENT_BOOKING_QUERIES,
  OCCUPANCY_READER,
} from '../application/ports.js';
import { KyselyBookingLifecycleStore } from '../infrastructure/kysely-booking-lifecycle-store.js';
import { KyselyBookingWriter } from '../infrastructure/kysely-booking-writer.js';
import { KyselyCabinetBookingQueries } from '../infrastructure/kysely-cabinet-booking-queries.js';
import { KyselyClientBookingQueries } from '../infrastructure/kysely-client-booking-queries.js';
import { KyselyOccupancyReader } from '../infrastructure/kysely-occupancy-reader.js';
import { OtelBookingTelemetry } from '../infrastructure/otel-booking-telemetry.js';

const kysely = <T>(build: (unitOfWork: KyselyUnitOfWork) => T) => ({
  useFactory: build,
  inject: [KyselyUnitOfWork],
});

/** Adapters of the booking ports to PostgreSQL and OpenTelemetry. */
export const bookingStorageProviders: Provider[] = [
  { provide: OCCUPANCY_READER, ...kysely((unitOfWork) => new KyselyOccupancyReader(unitOfWork)) },
  { provide: BOOKING_WRITER, ...kysely((unitOfWork) => new KyselyBookingWriter(unitOfWork)) },
  {
    provide: BOOKING_LIFECYCLE_STORE,
    ...kysely((unitOfWork) => new KyselyBookingLifecycleStore(unitOfWork)),
  },
  {
    provide: CLIENT_BOOKING_QUERIES,
    ...kysely((unitOfWork) => new KyselyClientBookingQueries(unitOfWork)),
  },
  {
    provide: CABINET_BOOKING_QUERIES,
    ...kysely((unitOfWork) => new KyselyCabinetBookingQueries(unitOfWork)),
  },
  { provide: BOOKING_TELEMETRY, useFactory: () => new OtelBookingTelemetry() },
];
