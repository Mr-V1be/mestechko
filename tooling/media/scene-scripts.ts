/**
 * What the recorded scenes click and wait for, per language of the product. Words come
 * from the apps' own translations, so a reworded button never breaks a recording; the
 * demo business is the one each language's demo opens.
 */
import cabinetEn from '../../apps/cabinet/src/locales/en/cabinet.json' with { type: 'json' };
import cabinetRu from '../../apps/cabinet/src/locales/ru/cabinet.json' with { type: 'json' };
import deskEn from '../../apps/cabinet/src/locales/en/desk.json' with { type: 'json' };
import deskRu from '../../apps/cabinet/src/locales/ru/desk.json' with { type: 'json' };
import reportsEn from '../../apps/cabinet/src/locales/en/reports.json' with { type: 'json' };
import reportsRu from '../../apps/cabinet/src/locales/ru/reports.json' with { type: 'json' };
import miniappEn from '../../apps/miniapp/src/locales/en.json' with { type: 'json' };
import miniappRu from '../../apps/miniapp/src/locales/ru.json' with { type: 'json' };
import bookingEn from '../../packages/i18n/src/locales/en/booking.json' with { type: 'json' };
import bookingRu from '../../packages/i18n/src/locales/ru/booking.json' with { type: 'json' };
import termsEn from '../../packages/i18n/src/locales/en/terms.json' with { type: 'json' };
import termsRu from '../../packages/i18n/src/locales/ru/terms.json' with { type: 'json' };

export type SceneLocale = 'en' | 'ru';

/** How the client answers a reminder on camera: in MAX's chat, or in the Mini App. */
export type ReminderSurface = 'max' | 'miniapp';

export interface SceneScript {
  readonly locale: SceneLocale;
  /** The browser's language and the demo business's clock. */
  readonly browserLocale: string;
  readonly timeZone: string;
  readonly business: {
    readonly name: string;
    readonly slug: string;
    readonly location: string;
    /** The business's demo website with the widget. */
    readonly site: string;
  };
  /** Services the screens and the booking loop pick. */
  readonly services: { readonly screen: string; readonly loop: string };
  readonly reminder: ReminderSurface;
  /** Demo phones of the business's country start so; the form fills one in. */
  readonly demoPhonePrefix: string;
  /** A free start in the time grid, e.g. `10:00` or `9:30 AM`. */
  readonly slot: RegExp;
  readonly words: {
    readonly demoSignIn: string;
    readonly occupancy: string;
    readonly chooseStaff: string;
    readonly anyStaff: string;
    readonly weekFull: string;
    readonly nextWeek: string;
    readonly continue: string;
    readonly name: string;
    readonly book: string;
    readonly waitlistJoin: string;
    readonly waitlistTitle: string;
    readonly moved: string;
    readonly moveRefused: RegExp;
    readonly undo: string;
    readonly myBookings: string;
    readonly reschedule: string;
    readonly rescheduleSubmit: RegExp;
    readonly rescheduled: string;
  };
}

/** The fixed part of a text before its first placeholder, as a pattern of its start. */
function startOf(text: string): RegExp {
  const fixed = text.split('{{')[0] ?? text;
  return new RegExp(`^${fixed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
}

export const sceneScripts: Readonly<Record<SceneLocale, SceneScript>> = {
  ru: {
    locale: 'ru',
    browserLocale: 'ru-RU',
    timeZone: 'Europe/Moscow',
    business: {
      name: 'Сирень',
      slug: 'siren',
      location: 'Сирень на Пятницкой',
      site: '/demo/siren.html',
    },
    services: { screen: 'Женская стрижка', loop: 'Укладка' },
    reminder: 'max',
    demoPhonePrefix: '+7 0',
    slot: /^\d\d:\d\d$/,
    words: {
      demoSignIn: cabinetRu.signIn.demoSubmit,
      occupancy: reportsRu.metrics.occupancy.title,
      chooseStaff: termsRu.staff.master.next,
      anyStaff: termsRu.staff.master.any,
      weekFull: bookingRu.picker.weekFullTitle,
      nextWeek: bookingRu.picker.nextWeek,
      continue: miniappRu.time.continue,
      name: miniappRu.confirm.name,
      book: miniappRu.confirm.submit,
      waitlistJoin: miniappRu.time.waitlistJoin,
      waitlistTitle: miniappRu.waitlist.title,
      moved: deskRu.move.done,
      moveRefused: startOf(deskRu.dropRefused),
      undo: deskRu.move.undo,
      myBookings: miniappRu.nav.myBookings,
      reschedule: miniappRu.booking.reschedule,
      rescheduleSubmit: startOf(miniappRu.reschedule.submit),
      rescheduled: miniappRu.booking.rescheduled,
    },
  },
  en: {
    locale: 'en',
    browserLocale: 'en-US',
    timeZone: 'America/New_York',
    business: {
      name: 'Marigold Studio',
      slug: 'marigold',
      location: 'Marigold Williamsburg',
      site: '/demo/marigold.html',
    },
    services: { screen: "Women's haircut", loop: 'Blowout' },
    reminder: 'miniapp',
    demoPhonePrefix: '+1 ',
    slot: /^\d{1,2}:\d\d\s?[AP]M$/,
    words: {
      demoSignIn: cabinetEn.signIn.demoSubmit,
      occupancy: reportsEn.metrics.occupancy.title,
      chooseStaff: termsEn.staff.master.next,
      anyStaff: termsEn.staff.master.any,
      weekFull: bookingEn.picker.weekFullTitle,
      nextWeek: bookingEn.picker.nextWeek,
      continue: miniappEn.time.continue,
      name: miniappEn.confirm.name,
      book: miniappEn.confirm.submit,
      waitlistJoin: miniappEn.time.waitlistJoin,
      waitlistTitle: miniappEn.waitlist.title,
      moved: deskEn.move.done,
      moveRefused: startOf(deskEn.dropRefused),
      undo: deskEn.move.undo,
      myBookings: miniappEn.nav.myBookings,
      reschedule: miniappEn.booking.reschedule,
      rescheduleSubmit: startOf(miniappEn.reschedule.submit),
      rescheduled: miniappEn.booking.rescheduled,
    },
  },
};
