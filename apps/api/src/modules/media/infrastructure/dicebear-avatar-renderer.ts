import { Avatar, Style } from '@dicebear/core';
import notionists from '@dicebear/styles/notionists.json' with { type: 'json' };
import type { AvatarRenderer } from '../application/avatar-renderer.js';

/**
 * Warm pastel backgrounds that sit well with the brand accent in both themes.
 * Illustration style "Notionists" by Zoish, CC0 1.0 (see CREDITS.md).
 */
const BACKGROUNDS = ['ffe1d6', 'ffd9c2', 'fde8c8', 'e6f0dc', 'dcebf5', 'efe0f3'] as const;

export class DiceBearAvatarRenderer implements AvatarRenderer {
  private readonly style = new Style(notionists);

  renderSvg(seed: string): string {
    return new Avatar(this.style, { seed, backgroundColor: [...BACKGROUNDS] }).toString();
  }
}
