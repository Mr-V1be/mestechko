/** Renders illustrated avatars deterministically from a seed. */
export interface AvatarRenderer {
  renderSvg(seed: string): string;
}

export const AVATAR_RENDERER = Symbol('AVATAR_RENDERER');
