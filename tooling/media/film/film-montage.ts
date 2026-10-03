/**
 * The montage: the opening card, each moment (background, the recording placed into
 * the device's screen, the bezel over it), the closing card, joined by crossfades.
 * One ffmpeg run per format; no sound track at all.
 */
import { spawnSync } from 'node:child_process';
import { ffmpeg } from '../ffmpeg.ts';
import type { FilmCards } from './film-cards.ts';
import { deviceIn, filmFormats, type FilmFormat } from './film-layout.ts';
import type { FilmClip } from './film-recording.ts';
import { filmScript } from './film-script.ts';

const FPS = 30;
/** Every segment the same: crossfades join only identical streams. */
const NORMALIZE = `format=yuv420p,setsar=1,fps=${String(FPS)},settb=AVTB`;

function secondsOf(video: string): number {
  const probe = spawnSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', video],
    { encoding: 'utf8' },
  );
  const seconds = Number.parseFloat(probe.stdout);
  if (probe.status !== 0 || !Number.isFinite(seconds)) {
    throw new Error(`Cannot read the length of ${video}`);
  }
  return seconds;
}

/** Writes the film of one format to `output`; returns its length in seconds. */
export function montage(
  format: FilmFormat,
  cards: FilmCards,
  clips: readonly FilmClip[],
  output: string,
): number {
  const layout = filmFormats[format];
  const inputs: string[] = [];
  const filters: string[] = [];
  const lengths: number[] = [];
  let count = 0;
  const still = (file: string, seconds: number) => {
    inputs.push('-loop', '1', '-framerate', String(FPS), '-t', seconds.toFixed(3), '-i', file);
    return count++;
  };
  const video = (file: string) => {
    inputs.push('-i', file);
    return count++;
  };

  const intro = still(cards.intro, filmScript.intro.seconds);
  filters.push(`[${String(intro)}:v]${NORMALIZE}[seg0]`);
  lengths.push(filmScript.intro.seconds);
  for (const [index, clip] of clips.entries()) {
    const layers = cards.scenes[index];
    if (!layers) {
      throw new Error(`No cards for ${clip.id}`);
    }
    const length = secondsOf(clip.file);
    const background = still(layers.background, length);
    const recording = video(clip.file);
    const bezel = still(layers.bezel, length);
    const { screen } = deviceIn(layout, clip.device);
    const size = `${String(screen.width)}:${String(screen.height)}`;
    filters.push(
      `[${String(recording)}:v]scale=${size}:force_original_aspect_ratio=increase:flags=lanczos,crop=${size},setsar=1,fps=${String(FPS)}[rec${String(index)}]`,
      `[${String(background)}:v][rec${String(index)}]overlay=${String(screen.x)}:${String(screen.y)}:shortest=1[under${String(index)}]`,
      `[under${String(index)}][${String(bezel)}:v]overlay=0:0:shortest=1,${NORMALIZE}[seg${String(index + 1)}]`,
    );
    lengths.push(length);
  }
  const outro = still(cards.outro, filmScript.outro.seconds);
  filters.push(`[${String(outro)}:v]${NORMALIZE}[seg${String(clips.length + 1)}]`);
  lengths.push(filmScript.outro.seconds);

  const fade = filmScript.fadeSeconds;
  let previous = 'seg0';
  let elapsed = lengths[0] ?? 0;
  for (let index = 1; index < lengths.length; index += 1) {
    const joined = index === lengths.length - 1 ? 'film' : `joined${String(index)}`;
    filters.push(
      `[${previous}][seg${String(index)}]xfade=transition=fade:duration=${String(fade)}:offset=${(elapsed - fade).toFixed(3)}[${joined}]`,
    );
    elapsed += (lengths[index] ?? 0) - fade;
    previous = joined;
  }
  ffmpeg([
    ...inputs,
    '-filter_complex',
    filters.join(';'),
    '-map',
    '[film]',
    '-an',
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '20',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    output,
  ]);
  return elapsed;
}
