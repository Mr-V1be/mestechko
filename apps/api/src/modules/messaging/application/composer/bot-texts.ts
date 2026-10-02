/** Translated texts of the bot; the locale is chosen when the texts are loaded. */
export interface BotTexts {
  readonly locale: string;
  text(key: string, values?: Readonly<Record<string, string>>): string;
  lines(key: string): readonly string[];
}

export const BOT_TEXTS = Symbol('BOT_TEXTS');
