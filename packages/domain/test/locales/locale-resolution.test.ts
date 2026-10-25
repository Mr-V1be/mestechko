import { describe, expect, it } from 'vitest';
import { fallbackLocale, localeOfTag, offersMessenger, resolveLocale } from '../../src/index.js';

describe('language resolution', () => {
  it('lets a stored choice win over what the platform reports', () => {
    expect(resolveLocale(['ru', 'en-US'])).toBe('ru');
    expect(resolveLocale(['en', 'ru'])).toBe('en');
  });

  it('follows the platform language when nothing is stored', () => {
    expect(resolveLocale([null, 'ru'])).toBe('ru');
    expect(resolveLocale([undefined, 'en-GB'])).toBe('en');
  });

  it('takes the first supported language of a browser list', () => {
    expect(resolveLocale([null, 'de-DE', 'ru-RU', 'en'])).toBe('ru');
  });

  it('skips a stored value that is no longer supported', () => {
    expect(resolveLocale(['de', 'ru'])).toBe('ru');
  });

  it('falls back to English for unsupported or unknown languages', () => {
    expect(fallbackLocale).toBe('en');
    expect(resolveLocale(['uk', 'pt-BR'])).toBe('en');
    expect(resolveLocale([null, undefined, ''])).toBe('en');
    expect(resolveLocale([])).toBe('en');
  });

  it('matches language tags by their primary subtag, in any case', () => {
    expect(localeOfTag('EN-us')).toBe('en');
    expect(localeOfTag('ru_RU')).toBe('ru');
    expect(localeOfTag('eng')).toBeNull();
  });
});

describe('messengers by language', () => {
  it('offers MAX to Russian readers only', () => {
    expect(offersMessenger('ru', 'max')).toBe(true);
    expect(offersMessenger('en', 'max')).toBe(false);
    expect(offersMessenger('en', 'telegram')).toBe(true);
  });
});
