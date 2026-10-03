import { describe, expect, it } from 'vitest';
import { isTimeConflict, isUniqueViolation } from '../../src/platform/db/pg-errors.js';

describe('PostgreSQL errors', () => {
  it('reads an exclusion violation as a time conflict', () => {
    expect(isTimeConflict({ code: '23P01' })).toBe(true);
  });

  it('reads a deadlock between writers of the same time as a time conflict', () => {
    expect(isTimeConflict({ code: '40P01' })).toBe(true);
  });

  it('leaves other failures alone', () => {
    expect(isTimeConflict({ code: '23505' })).toBe(false);
    expect(isTimeConflict(new Error('connection lost'))).toBe(false);
    expect(isTimeConflict(null)).toBe(false);
  });

  it('matches a unique violation by its constraint', () => {
    const error = { code: '23505', constraint: 'bookings_idempotency_key' };
    expect(isUniqueViolation(error, 'bookings_idempotency_key')).toBe(true);
    expect(isUniqueViolation(error, 'another')).toBe(false);
  });
});
