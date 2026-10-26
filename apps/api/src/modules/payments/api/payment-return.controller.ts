import { Controller, Get, Header, Inject, Query } from '@nestjs/common';
import { isLocale, type Locale } from '@slotwise/domain';
import { brandName } from '@slotwise/i18n';
import { RequestLocale } from '../../../platform/http/request-locale.js';
import { TRANSLATIONS, type Translations } from '../../../shared/application/translations.js';
import { renderReturnPage } from './payment-return-page.js';

/**
 * The neutral page after paying outside the app (`PAYMENTS_RETURN_PAGE_URL`). The
 * address carries the payer's language; a bare address follows their browser.
 */
@Controller('v1/payments')
export class PaymentReturnController {
  constructor(@Inject(TRANSLATIONS) private readonly translations: Translations) {}

  @Get('return')
  @Header('content-type', 'text/html; charset=utf-8')
  @Header('cache-control', 'no-store')
  page(@Query('locale') asked: unknown, @RequestLocale() requestLocale: Locale): string {
    const locale = isLocale(asked) ? asked : requestLocale;
    const texts = this.translations.in(locale, 'payments');
    return renderReturnPage({
      locale,
      title: texts.text('returned.title'),
      lead: texts.text('returned.lead'),
      close: texts.text('returned.close'),
      brand: brandName,
    });
  }
}
