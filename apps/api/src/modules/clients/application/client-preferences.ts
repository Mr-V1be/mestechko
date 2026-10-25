import type { Clock, Locale, MessengerChannel } from '@mestechko/domain';
import type { CustomerIdentities } from './ports.js';

/** A person's own settings, kept with them across businesses: the language they read. */
export class ClientPreferences {
  constructor(
    private readonly identities: CustomerIdentities,
    private readonly clock: Clock,
  ) {}

  async of(channel: MessengerChannel, externalId: string): Promise<{ locale: Locale | null }> {
    return { locale: await this.identities.chosenLocale(channel, externalId) };
  }

  /** The choice holds for the apps and for the bot's messages alike. */
  async chooseLocale(
    channel: MessengerChannel,
    externalId: string,
    locale: Locale,
  ): Promise<{ locale: Locale }> {
    await this.identities.chooseLocale(
      channel,
      externalId,
      locale,
      new Date(this.clock.now().epochMilliseconds),
    );
    return { locale };
  }
}
