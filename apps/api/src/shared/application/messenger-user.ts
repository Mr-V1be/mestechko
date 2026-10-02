/** A person as a messenger presents them; identity is verified by the channel adapter. */
export interface TelegramUser {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string | null;
  readonly username: string | null;
  readonly languageCode: string | null;
}

/** A Telegram user of a request, and whether the launch was signed for the demo. */
export interface TelegramClientUser extends TelegramUser {
  /** Demo launches may use demo contacts; real launches are held to real data. */
  readonly demoLaunch: boolean;
}
