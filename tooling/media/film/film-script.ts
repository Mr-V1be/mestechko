/** What the film says, card by card. Silent film: the words are on screen. */
import type { FilmSceneId } from './film-recording.ts';

/** The bot's handle is shown only when a bot is configured: the username is not fixed. */
const botUsername = process.env.TELEGRAM_BOT_USERNAME;

export interface SceneCopy {
  /** Who acts in this moment. */
  readonly who: string;
  readonly title: string;
  readonly text: string;
}

export const filmScript = {
  intro: {
    text: 'Онлайн-запись для салонов, барбершопов, клиник и автосервисов — в Telegram и MAX',
    seconds: 4,
  },
  scenes: {
    booking: {
      who: 'Клиент',
      title: 'Записывается за минуту',
      text: 'Услуга, мастер и свободное время — в Mini App прямо в Telegram',
    },
    schedule: {
      who: 'Кабинет',
      title: 'Запись сразу в расписании',
      text: 'Кто записался, откуда пришёл и что выбрал — без звонков и переписки',
    },
    remind: {
      who: 'Бот',
      title: 'Напоминает о визите',
      text: 'За сутки и за два часа. Перенести или отменить — кнопками в чате',
    },
    drag: {
      who: 'Администратор',
      title: 'Переносит визит перетаскиванием',
      text: 'Клиент сам получит уведомление о новом времени',
    },
  } satisfies Record<FilmSceneId, SceneCopy>,
  outro: {
    title: 'Попробуйте демо',
    text: 'Кабинет заведения и Mini App клиента — на вымышленных данных',
    footnote: botUsername ? `Бот в Telegram: @${botUsername}` : undefined,
    seconds: 5,
  },
  /** Crossfade between cards and moments. */
  fadeSeconds: 0.5,
} as const;
