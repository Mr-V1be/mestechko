import { Module } from '@nestjs/common';
import { AVATAR_URLS, type AvatarUrls } from '../../shared/application/avatar-urls.js';
import { AvatarsController } from './api/avatars.controller.js';
import { AVATAR_RENDERER } from './application/avatar-renderer.js';
import { DiceBearAvatarRenderer } from './infrastructure/dicebear-avatar-renderer.js';

const avatarUrls: AvatarUrls = {
  forSeed: (seed) => `/v1/avatars/${encodeURIComponent(seed)}.svg`,
};

@Module({
  controllers: [AvatarsController],
  providers: [
    { provide: AVATAR_RENDERER, useValue: new DiceBearAvatarRenderer() },
    { provide: AVATAR_URLS, useValue: avatarUrls },
  ],
  exports: [AVATAR_URLS],
})
export class MediaModule {}
