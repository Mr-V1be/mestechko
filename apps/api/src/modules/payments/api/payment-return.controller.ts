import { Controller, Get, Header, Inject } from '@nestjs/common';
import { renderReturnPage, type ReturnPageTexts } from './payment-return-page.js';

export const RETURN_PAGE_TEXTS = Symbol('RETURN_PAGE_TEXTS');

/** The neutral page after paying outside the app (`PAYMENTS_RETURN_PAGE_URL`). */
@Controller('v1/payments')
export class PaymentReturnController {
  constructor(@Inject(RETURN_PAGE_TEXTS) private readonly texts: ReturnPageTexts) {}

  @Get('return')
  @Header('content-type', 'text/html; charset=utf-8')
  @Header('cache-control', 'no-store')
  page(): string {
    return renderReturnPage(this.texts);
  }
}
