import type { Locale } from '@mestechko/domain';

/** A screen of the product captured in both themes, as files under the site's `media/`. */
export interface ThemedMedia {
  readonly light: string;
  readonly dark: string;
  readonly width: number;
  readonly height: number;
}

export interface Loop {
  readonly video: ThemedMedia;
  readonly poster: ThemedMedia;
}

const PHONE = { width: 390, height: 844 } as const;
const LAPTOP = { width: 1280, height: 800 } as const;

/**
 * Screenshots and short silent loops of the real apps on the demo data
 * (`pnpm media:landing`), in the page's language: `media/<locale>/…`.
 */
function mediaOf(locale: Locale) {
  const themed = (name: string, extension: string, width: number, height: number): ThemedMedia => ({
    light: `${import.meta.env.BASE_URL}media/${locale}/${name}-light.${extension}`,
    dark: `${import.meta.env.BASE_URL}media/${locale}/${name}-dark.${extension}`,
    width,
    height,
  });
  const loop = (name: string, size: { width: number; height: number }): Loop => ({
    video: themed(name, 'mp4', size.width, size.height),
    poster: themed(name, 'webp', size.width, size.height),
  });
  return {
    shots: {
      schedule: themed('cabinet-schedule', 'webp', LAPTOP.width, LAPTOP.height),
      reports: themed('cabinet-reports', 'webp', LAPTOP.width, LAPTOP.height),
      widget: themed('widget-site', 'webp', LAPTOP.width, LAPTOP.height),
      miniapp: themed('miniapp-time', 'webp', PHONE.width, PHONE.height),
      waitlist: themed('miniapp-waitlist', 'webp', PHONE.width, PHONE.height),
      max: themed('max-emulator', 'webp', LAPTOP.width, LAPTOP.height),
    },
    loops: {
      booking: loop('loop-booking', PHONE),
      drag: loop('loop-drag', LAPTOP),
      remind: loop('loop-remind', PHONE),
    },
  } as const;
}

export type SiteMedia = ReturnType<typeof mediaOf>;

const siteMedia = new Map<Locale, SiteMedia>();

export function siteMediaOf(locale: Locale): SiteMedia {
  const known = siteMedia.get(locale);
  if (known) {
    return known;
  }
  const media = mediaOf(locale);
  siteMedia.set(locale, media);
  return media;
}
