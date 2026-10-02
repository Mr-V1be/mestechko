/** A person as a messenger presents them; identity is verified by the channel adapter. */
export interface TelegramUser {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string | null;
  readonly username: string | null;
  readonly languageCode: string | null;
}
