import { Module } from '@nestjs/common';
import { AVATAR_URLS, type AvatarUrls } from '../../shared/application/avatar-urls.js';
import {
  CLOCK,
  ID_GENERATOR,
  type Clock,
  type IdGenerator,
} from '../../shared/application/ports.js';
import { STAFF_VISITS, type StaffVisits } from '../booking/application/ports.js';
import { BookingModule } from '../booking/booking.module.js';
import { CATALOG_READER, type CatalogReader } from '../catalog/application/catalog-reader.js';
import { CATALOG_STORE, type CatalogStore } from '../catalog/application/catalog-store.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { MediaModule } from '../media/media.module.js';
import { SCHEDULE_STORE, type ScheduleStore } from '../scheduling/application/ports.js';
import { ProductionCalendars } from '../scheduling/application/production-calendars.js';
import { SchedulingModule } from '../scheduling/scheduling.module.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { CabinetTeamController } from './api/cabinet-team.controller.js';
import { TeamAdmin } from './application/team-admin.js';

/** The team page: staff profiles, services and schedules, composed from their modules. */
@Module({
  imports: [TenancyModule, CatalogModule, SchedulingModule, BookingModule, MediaModule],
  controllers: [CabinetTeamController],
  providers: [
    {
      provide: TeamAdmin,
      useFactory: (
        catalog: CatalogStore,
        locations: CatalogReader,
        schedules: ScheduleStore,
        visits: StaffVisits,
        calendars: ProductionCalendars,
        avatars: AvatarUrls,
        ids: IdGenerator,
        clock: Clock,
      ) => new TeamAdmin(catalog, locations, schedules, visits, calendars, avatars, ids, clock),
      inject: [
        CATALOG_STORE,
        CATALOG_READER,
        SCHEDULE_STORE,
        STAFF_VISITS,
        ProductionCalendars,
        AVATAR_URLS,
        ID_GENERATOR,
        CLOCK,
      ],
    },
  ],
})
export class TeamModule {}
