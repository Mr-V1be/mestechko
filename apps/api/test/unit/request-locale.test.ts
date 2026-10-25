import { describe, expect, it } from 'vitest';
import { acceptedLanguages } from '../../src/platform/http/request-locale.js';

describe('Accept-Language', () => {
  it('lists languages by quality, keeping the order of equals', () => {
    expect(acceptedLanguages('ru;q=0.5, en-US, de;q=0.8, fr')).toEqual(['en-US', 'fr', 'de', 'ru']);
  });

  it('leaves out refused languages and the wildcard', () => {
    expect(acceptedLanguages('en;q=0, *;q=0.1, ru;q=0.3')).toEqual(['ru']);
  });

  it('reads a missing or empty header as no preference', () => {
    expect(acceptedLanguages(undefined)).toEqual([]);
    expect(acceptedLanguages('')).toEqual([]);
  });
});
