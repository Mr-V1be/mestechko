import { randomInt } from 'node:crypto';
import type { Locale } from '@slotwise/domain';
import { ApplicationError } from '../../../shared/application/application-error.js';
import type { BusinessDirectory } from '../../tenancy/application/business-directory.js';
import type { Translations } from '../../../shared/application/translations.js';
import type { TelegramLaunchSigner } from './ports.js';

/**
 * Telegram user ids of demo visitors are drawn from a range real accounts do not use
 * yet, so a demo identity never collides with a person.
 */
const DEMO_USER_ID_RANGE = { min: 9_000_000_000_000, max: 9_999_999_999_999 } as const;

function isDemoUserId(value: string): boolean {
  const id = Number(value);
  return Number.isSafeInteger(id) && id >= DEMO_USER_ID_RANGE.min && id <= DEMO_USER_ID_RANGE.max;
}

export interface DemoLaunch {
  readonly initData: string;
  readonly demoUserId: string;
  readonly startParam: string;
}

/**
 * Lets the client app run outside Telegram in demo mode with genuinely signed launch data.
 * The emulated Telegram speaks the visitor's language, as their own Telegram would.
 */
export class CreateDemoTelegramLaunch {
  constructor(
    private readonly businesses: BusinessDirectory,
    private readonly signer: TelegramLaunchSigner,
    private readonly enabled: boolean,
    private readonly translations: Translations,
  ) {}

  async execute(
    businessSlug: string,
    demoUserId: string | null,
    locale: Locale,
  ): Promise<DemoLaunch> {
    const business = this.enabled ? await this.businesses.findBySlug(businessSlug) : null;
    if (!business?.isDemo) {
      throw new ApplicationError('not_found', 'Demo business not found');
    }
    // Only ids from the demo range are reused: a demo visitor can never act as a real
    // Telegram account, whose bot chat would then receive the visitor's bookings.
    const id =
      demoUserId !== null && isDemoUserId(demoUserId)
        ? demoUserId
        : String(randomInt(DEMO_USER_ID_RANGE.min, DEMO_USER_ID_RANGE.max));
    const initData = this.signer.sign({
      user: {
        id,
        firstName: this.translations.in(locale, 'common').text('demo.guestName'),
        lastName: null,
        username: null,
        languageCode: locale,
      },
      startParam: business.slug,
    });
    return { initData, demoUserId: id, startParam: business.slug };
  }
}
