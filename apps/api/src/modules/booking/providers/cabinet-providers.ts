import type { Provider } from '@nestjs/common';
import { AVATAR_URLS, type AvatarUrls } from '../../../shared/application/avatar-urls.js';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../shared/application/unit-of-work.js';
import { CATALOG_READER, type CatalogReader } from '../../catalog/application/catalog-reader.js';
import {
  WORK_CALENDAR_READER,
  type WorkCalendarReader,
} from '../../scheduling/application/ports.js';
import { ProductionCalendars } from '../../scheduling/application/production-calendars.js';
import { BusinessContextResolver } from '../../tenancy/application/business-context.js';
import { CabinetBookings } from '../application/cabinet/cabinet-bookings.js';
import {
  CABINET_BOOKING_QUERIES,
  type CabinetBookingQueries,
} from '../application/cabinet/ports.js';
import { ScheduleView } from '../application/cabinet/schedule-view.js';

/** Use cases of the business cabinet: the schedule and the bookings list. */
export const cabinetBookingProviders: Provider[] = [
  {
    provide: ScheduleView,
    useFactory: (
      businesses: BusinessContextResolver,
      unitOfWork: UnitOfWork,
      catalog: CatalogReader,
      workCalendars: WorkCalendarReader,
      calendars: ProductionCalendars,
      queries: CabinetBookingQueries,
      avatars: AvatarUrls,
    ) =>
      new ScheduleView(businesses, unitOfWork, catalog, workCalendars, calendars, queries, avatars),
    inject: [
      BusinessContextResolver,
      UNIT_OF_WORK,
      CATALOG_READER,
      WORK_CALENDAR_READER,
      ProductionCalendars,
      CABINET_BOOKING_QUERIES,
      AVATAR_URLS,
    ],
  },
  {
    provide: CabinetBookings,
    useFactory: (
      businesses: BusinessContextResolver,
      unitOfWork: UnitOfWork,
      catalog: CatalogReader,
      queries: CabinetBookingQueries,
      avatars: AvatarUrls,
    ) => new CabinetBookings(businesses, unitOfWork, catalog, queries, avatars),
    inject: [
      BusinessContextResolver,
      UNIT_OF_WORK,
      CATALOG_READER,
      CABINET_BOOKING_QUERIES,
      AVATAR_URLS,
    ],
  },
];
