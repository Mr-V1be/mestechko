import { Module, type DynamicModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PinoLogger } from 'nestjs-pino';
import type { AppConfig } from './platform/config/app-config.js';
import { ApiExceptionFilter } from './platform/http/api-exception.filter.js';
import { AuthGuard } from './platform/http/auth.guard.js';
import { ContractResponseInterceptor } from './platform/http/contract-response.interceptor.js';
import type { Telemetry } from './platform/observability/telemetry.js';
import { PlatformModule } from './platform/platform.module.js';
import { BookingModule } from './modules/booking/booking.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { ClientsModule } from './modules/clients/clients.module.js';
import { IdentityModule } from './modules/identity/identity.module.js';
import { MediaModule } from './modules/media/media.module.js';
import { MessagingModule } from './modules/messaging/messaging.module.js';
import {
  deliverNotificationJob,
  dispatchNotificationsJob,
} from './modules/notifications/application/notification-jobs.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import {
  productionCalendarRefreshJob,
  productionCalendarSyncJob,
} from './modules/scheduling/application/production-calendar-jobs.js';
import { SchedulingModule } from './modules/scheduling/scheduling.module.js';
import { TenancyModule } from './modules/tenancy/tenancy.module.js';
import { matchWaitlistJob } from './modules/waitlist/application/waitlist-matching.js';
import { WaitlistModule } from './modules/waitlist/waitlist.module.js';
import { FollowUpsModule } from './composition/follow-ups/follow-ups.module.js';

/** Background jobs of the application; workers are started for each of them. */
const jobs = [
  productionCalendarSyncJob,
  productionCalendarRefreshJob,
  dispatchNotificationsJob,
  deliverNotificationJob,
  matchWaitlistJob,
];

/** Composition root: platform services, feature modules and global HTTP policies. */
@Module({})
export class AppModule {
  static forRoot(config: AppConfig, telemetry: Telemetry): DynamicModule {
    return {
      module: AppModule,
      imports: [
        PlatformModule.forRoot({ config, telemetry, jobs }),
        FollowUpsModule,
        TenancyModule,
        IdentityModule,
        MediaModule,
        CatalogModule,
        SchedulingModule,
        ClientsModule,
        NotificationsModule,
        BookingModule,
        WaitlistModule,
        MessagingModule,
      ],
      providers: [
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: APP_INTERCEPTOR, useClass: ContractResponseInterceptor },
        {
          provide: APP_FILTER,
          useFactory: (logger: PinoLogger) => {
            logger.setContext(ApiExceptionFilter.name);
            return new ApiExceptionFilter(logger);
          },
          inject: [PinoLogger],
        },
      ],
    };
  }
}
