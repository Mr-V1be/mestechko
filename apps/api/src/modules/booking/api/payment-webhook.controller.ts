import {
  BadRequestException,
  Controller,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import {
  InvalidWebhookError,
  PAYMENT_PROVIDER,
  type PaymentProvider,
} from '../../payments/application/ports.js';
import { PrepaidBookings } from '../application/client/prepaid-bookings.js';

/**
 * Notifications of the payment provider. The provider signs the exact bytes, so the
 * raw body is verified before anything is read; repeated deliveries are harmless.
 */
@Controller()
export class PaymentWebhookController {
  constructor(
    @Inject(PrepaidBookings) private readonly prepaid: PrepaidBookings,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  @Post('/v1/payments/webhooks/:provider')
  @HttpCode(200)
  async receive(
    @Param('provider') provider: string,
    @Req() request: RawBodyRequest<FastifyRequest>,
  ): Promise<Record<string, never>> {
    if (provider !== this.provider.id || !request.rawBody) {
      throw new NotFoundException();
    }
    try {
      await this.prepaid.handleNotification({
        headers: Object.fromEntries(
          Object.entries(request.headers).map(([name, value]) => [
            name,
            Array.isArray(value) ? value.join(',') : value,
          ]),
        ),
        rawBody: request.rawBody,
      });
    } catch (error) {
      if (error instanceof InvalidWebhookError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
    return {};
  }
}
