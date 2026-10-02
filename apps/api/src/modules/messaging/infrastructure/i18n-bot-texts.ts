import { createI18n } from '@mestechko/i18n';
import bot from '../../../locales/ru/bot.json' with { type: 'json' };
import type { BotTexts } from '../application/composer/bot-texts.js';

/** Bot texts from the translation system, with the shared namespaces available too. */
export async function loadBotTexts(): Promise<BotTexts> {
  const i18n = await createI18n({ defaultNamespace: 'bot', resources: { ru: { bot } } });
  return {
    locale: i18n.language,
    text: (key, values) => {
      if (!i18n.exists(key)) {
        throw new Error(`Missing bot text ${key}`);
      }
      return i18n.t(key, { ...values });
    },
    lines: (key) => {
      const value: unknown = i18n.t(key, { returnObjects: true });
      if (!Array.isArray(value) || !value.every((line) => typeof line === 'string')) {
        throw new Error(`Bot text ${key} is not a list of lines`);
      }
      return value;
    },
  };
}
