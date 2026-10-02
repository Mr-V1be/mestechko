import type { Provider } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../../platform/config/app-config.js';
import { KyselyUnitOfWork } from '../../../platform/db/kysely-unit-of-work.js';
import { CABINET_BOOKING_QUERIES } from '../application/cabinet/ports.js';
import { BOOKING_LIFECYCLE_STORE } from '../application/lifecycle/ports.js';
import {
  BOOKING_TELEMETRY,
  BOOKING_TOKENS,
  BOOKING_WRITER,
  CLIENT_BOOKING_QUERIES,
  EXPIRED_HOLDS,
  OCCUPANCY_READER,
  PAYMENT_DESCRIPTIONS,
} from '../application/ports.js';
import { HmacBookingTokens } from '../infrastructure/hmac-booking-tokens.js';
import { loadPaymentDescriptions } from '../infrastructure/i18n-payment-descriptions.js';
import { KyselyExpiredHolds } from '../infrastructure/kysely-expired-holds.js';
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

/** Adapters of the booking ports: PostgreSQL, OpenTelemetry, signing, translations. */
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
  { provide: EXPIRED_HOLDS, ...kysely((unitOfWork) => new KyselyExpiredHolds(unitOfWork)) },
  { provide: BOOKING_TELEMETRY, useFactory: () => new OtelBookingTelemetry() },
  {
    provide: BOOKING_TOKENS,
    useFactory: (config: AppConfig) => new HmacBookingTokens(config.widget.signingKey),
    inject: [APP_CONFIG],
  },
  { provide: PAYMENT_DESCRIPTIONS, useFactory: loadPaymentDescriptions },
];
