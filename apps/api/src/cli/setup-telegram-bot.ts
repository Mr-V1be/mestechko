/**
 * Configures the Telegram bot's profile from the translation system: commands,
 * description, short description and the menu button, in every language the platform
 * speaks. Telegram shows the default set to people whose language has none of its own,
 * so the default is the fallback language. The avatar and name are left as the owner
 * set them. The token is read from the environment and never printed.
 */
import { fallbackLocale, localeIds, type Locale } from '@mestechko/domain';
import { Api } from 'grammy';
import { loadConfig } from '../platform/config/app-config.js';
import { loadTranslations } from '../platform/i18n/i18next-translations.js';

const COMMANDS = ['start', 'bookings', 'help'] as const;

const config = loadConfig();
const token = config.telegram.botToken;
if (!token) {
  console.error('TELEGRAM_BOT_TOKEN is not set: nothing to configure.');
  process.exit(1);
}
const api = new Api(token, { apiRoot: config.telegram.apiRoot });
const translations = await loadTranslations();
const texts = (locale: Locale) => translations.in(locale, 'bot');
const me = await api.getMe();

const profiles: readonly { readonly scope: { language_code?: Locale }; readonly locale: Locale }[] =
  [
    { scope: {}, locale: fallbackLocale },
    ...localeIds.map((locale) => ({ scope: { language_code: locale }, locale })),
  ];
for (const { scope, locale } of profiles) {
  const bot = texts(locale);
  await api.setMyCommands(
    COMMANDS.map((command) => ({ command, description: bot.text(`commands.${command}`) })),
    scope,
  );
  await api.setMyDescription(bot.text('profile.description'), scope);
  await api.setMyShortDescription(bot.text('profile.shortDescription'), scope);
}

// The menu button has one text for every chat: the fallback language's.
const miniApp = config.miniApp.publicUrl;
await api.setChatMenuButton({
  menu_button: miniApp
    ? {
        type: 'web_app',
        text: texts(fallbackLocale).text('profile.menuButton'),
        web_app: { url: miniApp },
      }
    : { type: 'commands' },
});

console.warn(
  `Configured @${me.username}: ${String(COMMANDS.length)} commands, description and short description in ${localeIds.join(', ')},`,
);
console.warn(
  miniApp
    ? `and a menu button opening ${miniApp}.`
    : 'the menu button lists commands until MINIAPP_PUBLIC_URL is set.',
);
