/** A screen of the product captured in both themes, as files under `/media`. */
export interface ThemedMedia {
  readonly light: string;
  readonly dark: string;
  readonly width: number;
  readonly height: number;
}

const themed = (name: string, extension: string, width: number, height: number): ThemedMedia => ({
  light: `/media/${name}-light.${extension}`,
  dark: `/media/${name}-dark.${extension}`,
  width,
  height,
});

const PHONE = { width: 390, height: 844 } as const;
const LAPTOP = { width: 1280, height: 800 } as const;

/** Screenshots of the real apps on the demo data (`pnpm media:landing`). */
export const shots = {
  schedule: themed('cabinet-schedule', 'webp', LAPTOP.width, LAPTOP.height),
  reports: themed('cabinet-reports', 'webp', LAPTOP.width, LAPTOP.height),
  widget: themed('widget-site', 'webp', LAPTOP.width, LAPTOP.height),
  miniapp: themed('miniapp-time', 'webp', PHONE.width, PHONE.height),
  waitlist: themed('miniapp-waitlist', 'webp', PHONE.width, PHONE.height),
  max: themed('max-emulator', 'webp', LAPTOP.width, LAPTOP.height),
} as const;

export interface Loop {
  readonly video: ThemedMedia;
  readonly poster: ThemedMedia;
}

const loop = (name: string, size: { width: number; height: number }): Loop => ({
  video: themed(name, 'mp4', size.width, size.height),
  poster: themed(name, 'webp', size.width, size.height),
});

/** Short silent loops of the key moments, recorded from the real apps. */
export const loops = {
  booking: loop('loop-booking', PHONE),
  drag: loop('loop-drag', LAPTOP),
  remind: loop('loop-remind', PHONE),
} as const;
