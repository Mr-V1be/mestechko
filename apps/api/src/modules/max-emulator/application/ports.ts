/** A message in an emulated MAX dialog between the bot and one person. */
export interface EmulatedMessage {
  readonly mid: string;
  readonly userId: string;
  readonly fromBot: boolean;
  readonly text: string | null;
  readonly format: 'html' | 'markdown' | null;
  /** MAX attachment objects as the bot sent them. */
  readonly attachments: readonly unknown[];
  readonly sentAt: Date;
  readonly editedAt: Date | null;
}

export interface EmulatedUser {
  readonly userId: string;
  readonly firstName: string;
  readonly startedAt: Date | null;
}

export interface EmulatedUpdate {
  readonly marker: number;
  readonly update: Readonly<Record<string, unknown>>;
}

/** What the MAX servers would keep: people, dialogs, the update stream, notices. */
export interface EmulatorStore {
  ensureUser(userId: string, firstName: string, now: Date): Promise<EmulatedUser>;
  findUser(userId: string): Promise<EmulatedUser | null>;
  markStarted(userId: string, now: Date): Promise<void>;
  addMessage(message: EmulatedMessage): Promise<void>;
  editMessage(
    mid: string,
    change: Pick<EmulatedMessage, 'text' | 'format' | 'attachments'>,
    now: Date,
  ): Promise<boolean>;
  findMessage(mid: string): Promise<EmulatedMessage | null>;
  dialog(userId: string): Promise<EmulatedMessage[]>;
  lastMessages(userIds: readonly string[]): Promise<EmulatedMessage[]>;
  addUpdate(update: Readonly<Record<string, unknown>>, now: Date): Promise<number>;
  updatesFrom(marker: number, limit: number): Promise<EmulatedUpdate[]>;
  nextMarker(): Promise<number>;
  /** The message a pressed button belongs to, by the callback id handed to the bot. */
  callbackMessage(callbackId: string): Promise<{ mid: string; userId: string } | null>;
  addNotice(userId: string, text: string, now: Date): Promise<void>;
  notices(userId: string): Promise<{ text: string; shownAt: Date }[]>;
}

export const EMULATOR_STORE = Symbol('EMULATOR_STORE');
