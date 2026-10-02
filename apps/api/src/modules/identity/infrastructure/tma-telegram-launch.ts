import type { Clock } from '@mestechko/domain';
import { parse, sign, validate } from '@tma.js/init-data-node';
import { ApplicationError } from '../../../shared/application/application-error.js';
import type { TelegramUser } from '../../../shared/application/messenger-user.js';
import type {
  TelegramLaunch,
  TelegramLaunchSigner,
  TelegramLaunchVerifier,
} from '../application/ports.js';

const MS_PER_SECOND = 1_000;

export interface TelegramLaunchKeys {
  /** Real bot token; `null` until the owner provides it. */
  readonly botToken: string | null;
  /** Demo signing key; accepted only in demo mode. */
  readonly demoKey: string | null;
}

/**
 * Verifies launch data with the HMAC scheme Telegram documents for Mini Apps.
 * Freshness is checked against the application clock, not the library's.
 */
export class TmaTelegramLaunch implements TelegramLaunchVerifier, TelegramLaunchSigner {
  private readonly verificationKeys: readonly string[];

  constructor(
    private readonly keys: TelegramLaunchKeys,
    private readonly ttlSeconds: number,
    private readonly clock: Clock,
  ) {
    this.verificationKeys = [keys.botToken, keys.demoKey].filter(
      (key): key is string => key !== null,
    );
  }

  verify(initData: string): TelegramLaunch {
    const signedWith = this.verificationKeys.find((key) => {
      try {
        validate(initData, key, { expiresIn: 0 });
        return true;
      } catch {
        return false;
      }
    });
    if (signedWith === undefined) {
      throw new ApplicationError('telegram_auth_invalid', 'Launch data signature is invalid');
    }
    const data = parse(initData);
    const ageMs = this.clock.now().epochMilliseconds - data.auth_date.getTime();
    if (ageMs > this.ttlSeconds * MS_PER_SECOND) {
      throw new ApplicationError('telegram_auth_expired', 'Launch data has expired');
    }
    const user = data.user;
    if (!user) {
      throw new ApplicationError('telegram_auth_invalid', 'Launch data carries no user');
    }
    return {
      user: {
        id: String(user.id),
        firstName: user.first_name,
        lastName: user.last_name ?? null,
        username: user.username ?? null,
        languageCode: user.language_code ?? null,
        demoLaunch: signedWith === this.keys.demoKey,
      },
      startParam: data.start_param ?? null,
    };
  }

  sign(launch: { readonly user: TelegramUser; readonly startParam: string }): string {
    if (!this.keys.demoKey) {
      throw new Error('Demo signing key is not configured');
    }
    return sign(
      {
        user: {
          id: Number(launch.user.id),
          first_name: launch.user.firstName,
          ...(launch.user.lastName ? { last_name: launch.user.lastName } : {}),
          ...(launch.user.languageCode ? { language_code: launch.user.languageCode } : {}),
          allows_write_to_pm: true,
        },
        start_param: launch.startParam,
        chat_type: 'sender',
        chat_instance: launch.user.id,
      },
      this.keys.demoKey,
      new Date(this.clock.now().epochMilliseconds),
    );
  }
}
