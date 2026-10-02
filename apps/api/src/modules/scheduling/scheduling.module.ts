import { Module } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { APP_CONFIG, type AppConfig } from '../../platform/config/app-config.js';
import { KyselyUnitOfWork } from '../../platform/db/kysely-unit-of-work.js';
import { JOB_QUEUE, type JobQueue } from '../../shared/application/job-queue.js';
import { CLOCK, type Clock } from '../../shared/application/ports.js';
import {
  BUSINESS_DIRECTORY,
  type BusinessDirectory,
} from '../tenancy/application/business-directory.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import {
  productionCalendarHandlerTokens,
  RefreshProductionCalendars,
  SyncProductionCalendar,
} from './application/production-calendar-jobs.js';
import { ProductionCalendars } from './application/production-calendars.js';
import {
  PRODUCTION_CALENDAR_SOURCE,
  PRODUCTION_CALENDAR_STORE,
  WORK_CALENDAR_READER,
  type ProductionCalendarSource,
  type ProductionCalendarStore,
} from './application/ports.js';
import { CalendarSyncBootstrap } from './infrastructure/calendar-sync-bootstrap.js';
import { IsDayOffCalendarSource } from './infrastructure/isdayoff-calendar-source.js';
import { KyselyProductionCalendarStore } from './infrastructure/kysely-production-calendar-store.js';
import { KyselyWorkCalendarReader } from './infrastructure/kysely-work-calendar-reader.js';

@Module({
  imports: [TenancyModule],
  providers: [
    {
      provide: WORK_CALENDAR_READER,
      useFactory: (unitOfWork: KyselyUnitOfWork) => new KyselyWorkCalendarReader(unitOfWork),
      inject: [KyselyUnitOfWork],
    },
    {
      provide: PRODUCTION_CALENDAR_STORE,
      useFactory: (unitOfWork: KyselyUnitOfWork) => new KyselyProductionCalendarStore(unitOfWork),
      inject: [KyselyUnitOfWork],
    },
    {
      provide: PRODUCTION_CALENDAR_SOURCE,
      useFactory: (config: AppConfig) =>
        new IsDayOffCalendarSource(config.calendar.isDayOffBaseUrl, config.externalHttp.timeoutMs),
      inject: [APP_CONFIG],
    },
    {
      provide: ProductionCalendars,
      useFactory: (
        store: ProductionCalendarStore,
        queue: JobQueue,
        clock: Clock,
        logger: PinoLogger,
      ) => {
        logger.setContext(ProductionCalendars.name);
        return new ProductionCalendars(store, queue, clock, logger);
      },
      inject: [PRODUCTION_CALENDAR_STORE, JOB_QUEUE, CLOCK, PinoLogger],
    },
    {
      provide: productionCalendarHandlerTokens.sync,
      useFactory: (
        source: ProductionCalendarSource,
        store: ProductionCalendarStore,
        clock: Clock,
      ) => new SyncProductionCalendar(source, store, clock),
      inject: [PRODUCTION_CALENDAR_SOURCE, PRODUCTION_CALENDAR_STORE, CLOCK],
    },
    {
      provide: productionCalendarHandlerTokens.refresh,
      useFactory: (businesses: BusinessDirectory, queue: JobQueue, clock: Clock) =>
        new RefreshProductionCalendars(businesses, queue, clock),
      inject: [BUSINESS_DIRECTORY, JOB_QUEUE, CLOCK],
    },
    CalendarSyncBootstrap,
  ],
  exports: [
    WORK_CALENDAR_READER,
    ProductionCalendars,
    PRODUCTION_CALENDAR_SOURCE,
    PRODUCTION_CALENDAR_STORE,
    productionCalendarHandlerTokens.sync,
    productionCalendarHandlerTokens.refresh,
  ],
})
export class SchedulingModule {}
