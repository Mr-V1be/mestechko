import { randomInt } from 'node:crypto';
import { ApplicationError } from '../../../shared/application/application-error.js';
import type { BusinessDirectory } from '../../tenancy/application/business-directory.js';
import type { TelegramLaunchSigner } from './ports.js';

/**
 * Telegram user ids of demo visitors are drawn from a range real accounts do not use
 * yet, so a demo identity never collides with a person.
 */
const DEMO_USER_ID_RANGE = { min: 9_000_000_000_000, max: 9_999_999_999_999 } as const;

export interface DemoLaunch {
  readonly initData: string;
  readonly demoUserId: string;
  readonly startParam: string;
}

/** Lets the client app run outside Telegram in demo mode with genuinely signed launch data. */
export class CreateDemoTelegramLaunch {
  constructor(
    private readonly businesses: BusinessDirectory,
    private readonly signer: TelegramLaunchSigner,
    private readonly enabled: boolean,
    private readonly guestName: string,
  ) {}

  async execute(businessSlug: string, demoUserId: string | null): Promise<DemoLaunch> {
    const business = this.enabled ? await this.businesses.findBySlug(businessSlug) : null;
    if (!business?.isDemo) {
      throw new ApplicationError('not_found', 'Demo business not found');
    }
    const id = demoUserId ?? String(randomInt(DEMO_USER_ID_RANGE.min, DEMO_USER_ID_RANGE.max));
    const initData = this.signer.sign({
      user: { id, firstName: this.guestName, lastName: null, username: null, languageCode: 'ru' },
      startParam: business.slug,
    });
    return { initData, demoUserId: id, startParam: business.slug };
  }
}
