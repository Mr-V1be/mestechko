import type { MessengerChannel } from '@slotwise/domain';
import type { MessengerContacts } from '../../clients/application/ports.js';

/** Where a person allows a messenger's bot to write to them, if there is such a link. */
export interface MessengerLinks {
  connectUrl(channel: MessengerChannel): string | null;
}

export const MESSENGER_LINKS = Symbol('MESSENGER_LINKS');

/** Whether the client gets messages, and how to turn them on if not. */
export class NotificationSettings {
  constructor(
    private readonly contacts: MessengerContacts,
    private readonly links: MessengerLinks,
  ) {}

  async status(
    channel: MessengerChannel,
    externalId: string,
  ): Promise<{ enabled: boolean; connectUrl: string | null }> {
    const enabled = await this.contacts.isAllowed(channel, externalId);
    return { enabled, connectUrl: enabled ? null : this.links.connectUrl(channel) };
  }
}
