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
    expect(config.roles).toEqual(['api', 'worker']);
  });

  it('requires a signing key in demo mode', () => {
    expect(() => loadConfig({ ...required, DEMO_MODE: 'true' })).toThrow(ConfigurationError);
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
