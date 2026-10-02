/** Public URLs of generated avatars, relative to the API base. */
export interface AvatarUrls {
  forSeed(seed: string): string;
}

export const AVATAR_URLS = Symbol('AVATAR_URLS');
