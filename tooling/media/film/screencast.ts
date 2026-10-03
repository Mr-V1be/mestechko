/**
 * Sharp recordings for the film. Playwright's own video keeps CSS pixels; the DevTools
 * screencast sends frames at the device pixel ratio, so a 2x page records at 2x. Frames
 * come only when the page changes and carry their time, so the clip is rebuilt at a
 * constant frame rate with each frame held until the next.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CDPSession, Page } from 'playwright';
import { ffmpeg } from '../ffmpeg.ts';

interface Frame {
  readonly file: string;
  /** Seconds, on the same clock as `Screencast.now()`. */
  readonly at: number;
}

interface FrameEvent {
  readonly data: string;
  readonly sessionId: number;
  readonly metadata: { readonly timestamp?: number };
}

const FPS = 30;
const JPEG_QUALITY = 92;

export class Screencast {
  private readonly frames: Frame[] = [];
  private stoppedAt: number | null = null;
  private readonly session: CDPSession;
  private readonly directory: string;

  private constructor(session: CDPSession, directory: string) {
    this.session = session;
    this.directory = directory;
  }

  /** Starts recording `page` at its viewport size times the device pixel ratio. */
  static async start(page: Page, directory: string): Promise<Screencast> {
    mkdirSync(directory, { recursive: true });
    const size = page.viewportSize() ?? { width: 1280, height: 800 };
    const ratio = await page.evaluate(() => window.devicePixelRatio);
    const session = await page.context().newCDPSession(page);
    const recording = new Screencast(session, directory);
    session.on('Page.screencastFrame', (event: FrameEvent) => {
      recording.keep(event);
    });
    await session.send('Page.startScreencast', {
      format: 'jpeg',
      quality: JPEG_QUALITY,
      maxWidth: Math.round(size.width * ratio),
      maxHeight: Math.round(size.height * ratio),
      everyNthFrame: 1,
    });
    return recording;
  }

  /** The recording clock, for marking where a scene starts and ends. */
  static now(): number {
    return Date.now() / 1000;
  }

  private keep(event: FrameEvent): void {
    const file = join(this.directory, `frame-${String(this.frames.length).padStart(5, '0')}.jpg`);
    writeFileSync(file, Buffer.from(event.data, 'base64'));
    this.frames.push({ file, at: event.metadata.timestamp ?? Screencast.now() });
    void this.session.send('Page.screencastFrameAck', { sessionId: event.sessionId });
  }

  async stop(): Promise<void> {
    await this.session.send('Page.stopScreencast');
    this.stoppedAt = Screencast.now();
    await this.session.detach();
  }

  /**
   * The part between `from` and `to` as an H.264 clip at a constant frame rate. The
   * frame on screen at `from` opens the clip.
   */
  toClip(output: string, from: number, to: number): void {
    const end = Math.min(to, this.stoppedAt ?? to);
    const opening = this.frames.findLast((frame) => frame.at <= from) ?? this.frames[0];
    if (!opening) {
      throw new Error('The screencast has no frames');
    }
    const shown = [
      { file: opening.file, at: from },
      ...this.frames.filter((frame) => frame.at > from && frame.at < end),
    ];
    const lines = shown.flatMap((frame, index) => {
      const next = shown[index + 1]?.at ?? end;
      return [`file '${frame.file}'`, `duration ${Math.max(next - frame.at, 0.001).toFixed(4)}`];
    });
    // The concat format wants the last file once more to honour its duration.
    lines.push(`file '${shown.at(-1)?.file ?? opening.file}'`);
    const list = join(this.directory, 'frames.txt');
    writeFileSync(list, `${lines.join('\n')}\n`);
    ffmpeg([
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      list,
      '-vf',
      `fps=${String(FPS)},scale=trunc(iw/2)*2:trunc(ih/2)*2`,
      '-an',
      '-c:v',
      'libx264',
      '-preset',
      'slow',
      '-crf',
      '16',
      '-pix_fmt',
      'yuv420p',
      output,
    ]);
  }
}
