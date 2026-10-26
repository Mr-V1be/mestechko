import type { MessengerChannel } from '@slotwise/domain';
import type { AppConfig } from '../../../platform/config/app-config.js';
import type { MessengerLinks } from '../application/notification-settings.js';

/** Start payload that marks people arriving to turn notifications on. */
const CONNECT_PAYLOAD = 'notify';

/** Deep links into each messenger's bot, from configuration. */
export class ConfigMessengerLinks implements MessengerLinks {
  private readonly links: Readonly<Record<MessengerChannel, string | null>>;

  constructor(config: AppConfig) {
    this.links = {
      telegram: config.telegram.botUsername
        ? `https://t.me/${config.telegram.botUsername}?start=${CONNECT_PAYLOAD}`
        : null,
      max: null,
    };
  }

  connectUrl(channel: MessengerChannel): string | null {
    return this.links[channel];
  }
}
