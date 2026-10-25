import type { Locale } from '@mestechko/domain';

/** Texts of one namespace in one language, as the server writes them. */
export interface Translator {
  readonly locale: Locale;
  /** The text of a key; a key without a text is a defect and throws. */
  text(key: string, values?: Readonly<Record<string, string | number>>): string;
  /** A key whose text is a list, e.g. lines of a message or accepted spellings. */
  lines(key: string): readonly string[];
}

/** Every text the server writes, in every language the platform speaks. */
export interface Translations {
  in(locale: Locale, namespace: string): Translator;
}

export const TRANSLATIONS = Symbol('TRANSLATIONS');
