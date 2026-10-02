import { describe, expect, it } from 'vitest';
import {
  decodeAction,
  encodeAction,
  type BotAction,
} from '../../src/modules/messaging/application/action-data.js';

const business = '01a0fe31-74e2-76cd-993a-789d419a77f8';
const booking = '01a0fe31-74e2-7f00-8123-456789abcdef';
const start = Date.UTC(2026, 9, 10, 9, 30);

const actions: BotAction[] = [
  { kind: 'bookings' },
  { kind: 'open', businessId: business, bookingId: booking },
  { kind: 'attend', businessId: business, bookingId: booking },
  { kind: 'cancel_ask', businessId: business, bookingId: booking },
  { kind: 'cancel', businessId: business, bookingId: booking },
  { kind: 'move_days', businessId: business, bookingId: booking },
  { kind: 'move_times', businessId: business, bookingId: booking, date: '2026-10-10' },
  { kind: 'move_ask', businessId: business, bookingId: booking, start },
  { kind: 'move', businessId: business, bookingId: booking, start },
  { kind: 'offer_accept', businessId: business, entryId: booking, start },
  { kind: 'offer_decline', businessId: business, entryId: booking, start },
];

describe('bot button payloads', () => {
  it('round-trip every action within the 64-byte limit of messengers', () => {
    for (const action of actions) {
      const data = encodeAction(action);
      expect(Buffer.byteLength(data)).toBeLessThanOrEqual(64);
      expect(decodeAction(data)).toEqual(action);
    }
  });

  it('ignores payloads that are not ours or were tampered with', () => {
    expect(decodeAction('')).toBeNull();
    expect(decodeAction('z.abc')).toBeNull();
    expect(decodeAction('o.short.ids')).toBeNull();
    expect(decodeAction('d.AaGg_jF04nbNmTp4nUGa9w.AaGg_jF04n8AgSNFZ4mrzw.2026-99')).toBeNull();
  });
});
