import { describe, expect, it } from 'vitest';
import { appBasePath } from './app-base';

describe('appBasePath', () => {
  it('is the root for an app on its own name or without an address', () => {
    expect(appBasePath('https://app.slotwise.example')).toBe('/');
    expect(appBasePath('http://127.0.0.1:46220/')).toBe('/');
    expect(appBasePath(undefined)).toBe('/');
    expect(appBasePath('')).toBe('/');
  });

  it('is the path, with one trailing slash, for an app under a shared name', () => {
    expect(appBasePath('https://slotwise.example/app')).toBe('/app/');
    expect(appBasePath('https://slotwise.example/miniapp/')).toBe('/miniapp/');
    expect(appBasePath('https://example.com/products/widget//')).toBe('/products/widget/');
  });
});
