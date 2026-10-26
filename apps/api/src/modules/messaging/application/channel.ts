import type { MessengerChannel } from '@slotwise/domain';

/** How a button reads: neutral, the safe choice, or a destructive one. */
export type ButtonTone = 'default' | 'positive' | 'negative';

export type OutboundButton =
  | {
      readonly kind: 'action';
      readonly label: string;
      /** Opaque payload returned when pressed; at most 64 bytes on every messenger. */
      readonly data: string;
      readonly tone: ButtonTone;
    }
  /** Opens the client web app inside the messenger. */
  | { readonly kind: 'web_app'; readonly label: string; readonly url: string };

/** A message in messenger-neutral form; adapters render it in their own markup. */
export interface OutboundMessage {
  readonly title: string;
  readonly lines: readonly string[];
  readonly buttons: readonly (readonly OutboundButton[])[];
}

export interface InboundPerson {
  /** Account id in the messenger. */
  readonly externalId: string;
  /** Chat the bot answers in; for private chats usually the same as the account. */
  readonly chatId: string;
  readonly firstName: string;
  /** The language of the person's messenger app (BCP 47), when the messenger tells it. */
  readonly languageTag: string | null;
}

/** A button press the adapter must acknowledge. */
export interface InboundAction {
  readonly token: string;
  readonly chatId: string;
  readonly messageId: string | null;
}

export type InboundEvent =
  | {
      readonly kind: 'started';
      readonly channel: MessengerChannel;
      readonly person: InboundPerson;
      readonly payload: string | null;
    }
  | {
      readonly kind: 'command';
      readonly channel: MessengerChannel;
      readonly person: InboundPerson;
      readonly command: string;
    }
  | {
      readonly kind: 'text';
      readonly channel: MessengerChannel;
      readonly person: InboundPerson;
    }
  | {
      readonly kind: 'action';
      readonly channel: MessengerChannel;
      readonly person: InboundPerson;
      readonly data: string;
      readonly action: InboundAction;
    }
  | {
      readonly kind: 'stopped';
      readonly channel: MessengerChannel;
      readonly person: InboundPerson;
    };

export interface ActionReply {
  /** New content of the message whose button was pressed. */
  readonly replace: OutboundMessage | null;
  /** A short notice shown on the press. */
  readonly notice: string | null;
}

export type DeliveryFailure = 'recipient_blocked' | 'temporarily_unavailable' | 'rejected';

/** A messenger refused or could not take a message. */
export class MessengerDeliveryError extends Error {
  constructor(
    readonly reason: DeliveryFailure,
    message: string,
  ) {
    super(message);
    this.name = 'MessengerDeliveryError';
  }
}

/** One messenger. Every channel is reached through this port; none is special-cased. */
export interface MessengerChannelAdapter {
  readonly id: MessengerChannel;
  send(chatId: string, message: OutboundMessage): Promise<{ readonly messageId: string }>;
  answer(action: InboundAction, reply: ActionReply): Promise<void>;
}

/** Configured messengers by id; a channel without credentials is simply absent. */
export class MessengerChannels {
  private readonly adapters: ReadonlyMap<MessengerChannel, MessengerChannelAdapter>;

  constructor(adapters: readonly MessengerChannelAdapter[]) {
    this.adapters = new Map(adapters.map((adapter) => [adapter.id, adapter]));
  }

  get(channel: MessengerChannel): MessengerChannelAdapter | null {
    return this.adapters.get(channel) ?? null;
  }
}

export const MESSENGER_CHANNELS = Symbol('MESSENGER_CHANNELS');
