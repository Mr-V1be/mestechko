/**
 * Configures the Telegram bot's profile from the translation system: commands,
 * description, short description and the menu button. The avatar and name are left
 * as the owner set them. The token is read from the environment and never printed.
 */
import { supportedLocales } from '@mestechko/i18n';
import { Api } from 'grammy';
import { loadConfig } from '../platform/config/app-config.js';
import { loadBotTexts } from '../modules/messaging/infrastructure/i18n-bot-texts.js';

const COMMANDS = ['start', 'bookings', 'help'] as const;

const config = loadConfig();
const token = config.telegram.botToken;
if (!token) {
  console.error('TELEGRAM_BOT_TOKEN is not set: nothing to configure.');
  process.exit(1);
}
const api = new Api(token, { apiRoot: config.telegram.apiRoot });
const texts = await loadBotTexts();
const me = await api.getMe();

const commands = COMMANDS.map((command) => ({
  command,
  description: texts.text(`commands.${command}`),
}));
// The default set serves every language; each supported locale also gets its own.
for (const language of [undefined, ...supportedLocales]) {
  const scope = language ? { language_code: language } : {};
  await api.setMyCommands(commands, scope);
  await api.setMyDescription(texts.text('profile.description'), scope);
  await api.setMyShortDescription(texts.text('profile.shortDescription'), scope);
}

const miniApp = config.miniApp.publicUrl;
await api.setChatMenuButton({
  menu_button: miniApp
    ? { type: 'web_app', text: texts.text('profile.menuButton'), web_app: { url: miniApp } }
    : { type: 'commands' },
});

console.warn(`Configured @${me.username}: ${String(commands.length)} commands, description,`);
console.warn(
  miniApp
    ? `short description and a menu button opening ${miniApp}.`
    : 'short description; the menu button lists commands until MINIAPP_PUBLIC_URL is set.',
);
