/**
 * The page's picture for link previews: one per language, drawn by `pnpm brand:assets`
 * into the site's public files. Its size is the one Open Graph, X and Telegram show whole.
 */
export const shareImage = {
  width: 1200,
  height: 630,
  /** Where a language's picture lies, relative to the site's root. */
  path: (locale: string): string => `og/${locale}.png`,
} as const;
