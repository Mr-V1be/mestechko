import { Module } from '@nestjs/common';
import { KyselyUnitOfWork } from '../../platform/db/kysely-unit-of-work.js';
import { CATALOG_READER, type CatalogReader } from '../catalog/application/catalog-reader.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { WORK_CALENDAR_READER, type WorkCalendarReader } from '../scheduling/application/ports.js';
import { ProductionCalendars } from '../scheduling/application/production-calendars.js';
import { SchedulingModule } from '../scheduling/scheduling.module.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { CabinetReportsController } from './api/cabinet-reports.controller.js';
import { BusinessReports } from './application/business-reports.js';
import { REPORT_FACTS_SOURCE, type ReportFactsSource } from './application/ports.js';
import { KyselyReportFacts } from './infrastructure/kysely-report-facts.js';

/** Business reports over bookings, schedules and the money ledger. */
@Module({
  imports: [TenancyModule, CatalogModule, SchedulingModule],
  controllers: [CabinetReportsController],
  providers: [
    {
      provide: REPORT_FACTS_SOURCE,
      useFactory: (unitOfWork: KyselyUnitOfWork) => new KyselyReportFacts(unitOfWork),
      inject: [KyselyUnitOfWork],
    },
    {
      provide: BusinessReports,
      useFactory: (
        source: ReportFactsSource,
        catalog: CatalogReader,
        workCalendars: WorkCalendarReader,
        calendars: ProductionCalendars,
      ) => new BusinessReports(source, catalog, workCalendars, calendars),
      inject: [REPORT_FACTS_SOURCE, CATALOG_READER, WORK_CALENDAR_READER, ProductionCalendars],
    },
  ],
})
export class ReportsModule {}
