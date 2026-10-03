/** The few ffmpeg jobs the media tooling needs; ffmpeg comes from the system. */
import { spawnSync } from 'node:child_process';

function ffmpeg(args: readonly string[]): void {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(`ffmpeg ${args.join(' ')} failed`);
  }
}

/** A screenshot as WebP: a fraction of the PNG's weight, sharp on 2x screens. */
export function toWebp(input: string, output: string, quality = 82): void {
  ffmpeg(['-i', input, '-c:v', 'libwebp', '-quality', String(quality), output]);
}

/**
 * A silent H.264 loop from a recording: trimmed to the scene, streaming-friendly, with
 * the frame size kept even as the codec wants.
 */
export function toLoop(input: string, output: string, fromSeconds: number, seconds: number): void {
  ffmpeg([
    '-ss',
    fromSeconds.toFixed(2),
    '-i',
    input,
    '-t',
    seconds.toFixed(2),
    '-an',
    '-vf',
    'scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=30',
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '27',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    output,
  ]);
}

/** The first frame of a loop as its poster. */
export function posterOf(video: string, output: string): void {
  ffmpeg(['-i', video, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '80', output]);
}
