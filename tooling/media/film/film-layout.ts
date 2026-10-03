/**
 * Where things sit on the film's frame, in both formats: the device with its screen,
 * and the words. Shared by the cards (drawn in HTML) and the montage (ffmpeg places the
 * recording into the screen).
 */
import type { FilmDevice, FilmSceneId } from './film-recording.ts';

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface DeviceLayout {
  /** Where the recording goes. */
  readonly screen: Box;
  /** The frame around it: its thickness and outer corner radius. */
  readonly bezel: number;
  readonly radius: number;
  /** A laptop's base under the lid. */
  readonly base?: Box;
}

export interface FormatLayout {
  readonly width: number;
  readonly height: number;
  /** Where the words of a moment go. */
  readonly copy: Box;
  readonly align: 'start' | 'center';
  /** The device each moment is recorded on and shown in, for this format. */
  readonly scenes: Readonly<Record<FilmSceneId, FilmDevice>>;
  readonly devices: Readonly<Partial<Record<FilmDevice, DeviceLayout>>>;
}

export const filmFormats = {
  landscape: {
    width: 1920,
    height: 1080,
    copy: { x: 120, y: 160, width: 600, height: 760 },
    align: 'start',
    scenes: { booking: 'phone', schedule: 'laptop', remind: 'phone', drag: 'laptop' },
    devices: {
      phone: { screen: { x: 1100, y: 64, width: 440, height: 952 }, bezel: 16, radius: 64 },
      laptop: {
        screen: { x: 780, y: 190, width: 1040, height: 650 },
        bezel: 18,
        radius: 26,
        base: { x: 690, y: 858, width: 1220, height: 26 },
      },
    },
  },
  // A vertical frame shows the cabinet as on a tablet: the schedule stays readable.
  portrait: {
    width: 1080,
    height: 1920,
    copy: { x: 90, y: 150, width: 900, height: 420 },
    align: 'center',
    scenes: { booking: 'phone', schedule: 'tablet', remind: 'phone', drag: 'tablet' },
    devices: {
      phone: { screen: { x: 260, y: 640, width: 560, height: 1212 }, bezel: 18, radius: 72 },
      tablet: { screen: { x: 109, y: 630, width: 862, height: 1240 }, bezel: 22, radius: 54 },
    },
  },
} as const satisfies Record<string, FormatLayout>;

export type FilmFormat = keyof typeof filmFormats;
export const filmFormatIds = Object.keys(filmFormats) as FilmFormat[];

/** The layout of a device in a format; a format shows only the devices it names. */
export function deviceIn(format: FormatLayout, device: FilmDevice): DeviceLayout {
  const layout = format.devices[device];
  if (!layout) {
    throw new Error(`The ${device} has no place in this format`);
  }
  return layout;
}

/** The frame around a screen: the screen box grown by the bezel on every side. */
export function deviceBox(device: DeviceLayout): Box {
  return {
    x: device.screen.x - device.bezel,
    y: device.screen.y - device.bezel,
    width: device.screen.width + device.bezel * 2,
    height: device.screen.height + device.bezel * 2,
  };
}
