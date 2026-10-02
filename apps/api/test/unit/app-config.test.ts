import { describe, expect, it } from 'vitest';
import { ConfigurationError, loadConfig } from '../../src/platform/config/app-config.js';

const required = {
  DATABASE_URL: 'postgres://app:secret-password@127.0.0.1:46201/mestechko',
  REDIS_URL: 'redis://127.0.0.1:46202/0',
};

describe('configuration', () => {
  it('treats empty values as unset and applies defaults', () => {
    const config = loadConfig({ ...required, TELEGRAM_BOT_TOKEN: '', API_PORT: '' });
    expect(config.telegram.botToken).toBeNull();
    expect(config.http.port).toBe(46_210);
    expect(config.roles).toEqual(['api', 'worker', 'bot']);
    expect(config.telegram.updates).toEqual({ kind: 'polling' });
    expect(config.miniApp.publicUrl).toBeNull();
  });

  it('requires a signing key in demo mode', () => {
    expect(() => loadConfig({ ...required, DEMO_MODE: 'true' })).toThrow(ConfigurationError);
  });

  it('accepts the Mini App and a webhook only at https addresses', () => {
    expect(() => loadConfig({ ...required, MINIAPP_PUBLIC_URL: 'http://app.example' })).toThrow(
      ConfigurationError,
    );
    const config = loadConfig({
      ...required,
      MINIAPP_PUBLIC_URL: 'https://app.example/',
      TELEGRAM_BOT_TOKEN: '123456:ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      TELEGRAM_UPDATES_MODE: 'webhook',
      TELEGRAM_WEBHOOK_URL: 'https://api.example/v1/telegram/webhook',
      TELEGRAM_WEBHOOK_SECRET: 'a'.repeat(32),
    });
    expect(config.miniApp.publicUrl).toBe('https://app.example');
    expect(config.telegram.updates.kind).toBe('webhook');
  });

  it('refuses webhook mode without its address and secret', () => {
    expect(() =>
      loadConfig({
        ...required,
        TELEGRAM_BOT_TOKEN: '123456:ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        TELEGRAM_UPDATES_MODE: 'webhook',
      }),
    ).toThrow(ConfigurationError);
  });

  it('never echoes secret values in errors', () => {
    try {
      loadConfig({ ...required, REDIS_URL: 'not a url but a secret-value' });
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain('REDIS_URL');
      expect(String(error)).not.toContain('secret-value');
    }
  });
});
