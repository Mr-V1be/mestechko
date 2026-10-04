/**
 * The path a web app is served under, taken from its public address: `/` for an app at the
 * root of its own name (`https://app.example`), `/app/` for one under a path of a shared name
 * (`https://example.com/app`). Vite's `base` is set from it at build time; the router's
 * basename and the app's own links follow `import.meta.env.BASE_URL`. One address, so the
 * path and the links other apps use can never disagree.
 */
export function appBasePath(publicUrl: string | undefined): string {
  if (publicUrl === undefined || publicUrl.trim() === '') {
    return '/';
  }
  const path = new URL(publicUrl).pathname.replace(/\/+$/, '');
  return `${path}/`;
}
