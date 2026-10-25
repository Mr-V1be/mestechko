import { describe, expect, it } from 'vitest';
import { formatPhone } from './phone';

describe('formatPhone', () => {
  it('groups a Russian mobile number the way people write it', () => {
    expect(formatPhone('+79161046686')).toBe('+7 916 104-66-86');
  });

  it('uses the grouping of each country', () => {
    expect(formatPhone('+375291234567')).toBe('+375 29 123-45-67');
    expect(formatPhone('+77011234567')).toBe('+7 701 123 4567');
  });

  it('writes demo numbers like Russian ones', () => {
    expect(formatPhone('+70004123785')).toBe('+7 000 412-37-85');
  });

  it('writes American numbers, the fictional demo ones included, with the local dash', () => {
    expect(formatPhone('+12125550123')).toBe('+1 212 555-0123');
  });

  it('returns unparseable input unchanged', () => {
    expect(formatPhone('12')).toBe('12');
  });
});
