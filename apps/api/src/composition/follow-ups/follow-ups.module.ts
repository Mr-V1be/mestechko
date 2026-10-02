import { Global, Module } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { JOB_QUEUE, type JobQueue } from '../../shared/application/job-queue.js';
import { BOOKING_FOLLOW_UPS } from '../../modules/booking/application/ports.js';
import { QueuedBookingFollowUps } from './queued-booking-follow-ups.js';

/** Cross-module reactions to booking changes, bound at the composition root. */
@Global()
@Module({
  providers: [
    {
      provide: BOOKING_FOLLOW_UPS,
      useFactory: (queue: JobQueue, logger: PinoLogger) => {
        logger.setContext(QueuedBookingFollowUps.name);
        return new QueuedBookingFollowUps(queue, logger);
      },
      inject: [JOB_QUEUE, PinoLogger],
    },
  ],
  exports: [BOOKING_FOLLOW_UPS],
})
export class FollowUpsModule {}
