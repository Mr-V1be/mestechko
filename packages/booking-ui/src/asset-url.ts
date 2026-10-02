/** Media paths from the API (e.g. avatars) are relative to the API base. */
export function apiAssetUrl(apiBaseUrl: string, path: string): string {
  return `${apiBaseUrl.replace(/\/$/, '')}${path}`;
}
