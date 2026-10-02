import { Controller, Get, Header, Inject, NotFoundException, Param } from '@nestjs/common';
import { AVATAR_RENDERER, type AvatarRenderer } from '../application/avatar-renderer.js';

const AVATAR_FILE = /^([a-z0-9-]{1,64})\.svg$/;

/** Avatars are immutable per seed, so browsers and proxies may cache them for a year. */
@Controller()
export class AvatarsController {
  constructor(@Inject(AVATAR_RENDERER) private readonly renderer: AvatarRenderer) {}

  @Get('/v1/avatars/:file')
  @Header('content-type', 'image/svg+xml; charset=utf-8')
  @Header('cache-control', 'public, max-age=31536000, immutable')
  @Header('x-content-type-options', 'nosniff')
  avatar(@Param('file') file: string): string {
    const seed = AVATAR_FILE.exec(file)?.[1];
    if (!seed) {
      throw new NotFoundException();
    }
    return this.renderer.renderSvg(seed);
  }
}
