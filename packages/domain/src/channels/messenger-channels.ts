interface MessengerChannelDefinition {
  /** The channel can open the client web app inside the messenger. */
  readonly hostsWebApp: boolean;
}

/** Messengers a client identity can come from; new channels are added here. */
export const messengerChannels = {
  telegram: { hostsWebApp: true },
  max: { hostsWebApp: true },
} as const satisfies Record<string, MessengerChannelDefinition>;

export type MessengerChannel = keyof typeof messengerChannels;

export const messengerChannelIds = Object.keys(messengerChannels) as MessengerChannel[];
