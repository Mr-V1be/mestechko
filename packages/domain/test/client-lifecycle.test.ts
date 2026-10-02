import { describe, expect, it } from 'vitest';
import {
  availableBookingActions,
  canConfirmAttendance,
  clientChangeVerdict,
  dayPartOfMinute,
  firstStartInWindow,
  planBookingNotifications,
  waitlistWindowOf,
  type ClientBookingState,
} from '../src/index.js';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const START = Date.UTC(2026, 9, 10, 9, 0);
const rule = { cutoffMinutes: 120 };

const booking = (overrides: Partial<ClientBookingState> = {}): ClientBookingState => ({
  status: 'confirmed',
  startsAt: START,
  attendanceConfirmedAt: null,
  ...overrides,
});

describe('client changes', () => {
  it('allows changes up to the cutoff and refuses them after it', () => {
    expect(clientChangeVerdict(booking(), START - 2 * HOUR, rule)).toBe('allowed');
    expect(clientChangeVerdict(booking(), START - 2 * HOUR + MINUTE, rule)).toBe('too_late');
  });

  it('closes changes once the booking is final or the visit began', () => {
    expect(clientChangeVerdict(booking({ status: 'cancelled' }), START - 5 * HOUR, rule)).toBe(
      'closed',
    );
    expect(clientChangeVerdict(booking({ status: 'completed' }), START - 5 * HOUR, rule)).toBe(
      'closed',
    );
    expect(clientChangeVerdict(booking(), START, { cutoffMinutes: 0 })).toBe('closed');
  });

  it('lets the client confirm a visit once, before it starts', () => {
    expect(canConfirmAttendance(booking(), START - HOUR)).toBe(true);
    expect(
      canConfirmAttendance(booking({ attendanceConfirmedAt: START - 3 * HOUR }), START - HOUR),
    ).toBe(false);
    expect(canConfirmAttendance(booking(), START + MINUTE)).toBe(false);
  });

  it('offers only the actions that will work right now', () => {
    const actions = ['confirm_attendance', 'reschedule', 'cancel'] as const;
    expect(availableBookingActions(actions, booking(), START - 5 * HOUR, rule)).toEqual([
      'confirm_attendance',
      'reschedule',
      'cancel',
    ]);
    expect(availableBookingActions(actions, booking(), START - HOUR, rule)).toEqual([
      'confirm_attendance',
    ]);
  });
});

describe('notification planning', () => {
  it('confirms a new booking now and reminds a day and two hours before', () => {
    const now = START - 3 * 24 * HOUR;
    expect(
      planBookingNotifications({ event: 'created', startsAt: START, now, seenByClient: false }),
    ).toEqual([
      { kind: 'booking_created', dueAt: now },
      { kind: 'reminder_24h', dueAt: START - 24 * HOUR },
      { kind: 'reminder_2h', dueAt: START - 2 * HOUR },
    ]);
  });

  it('skips reminders that are already past or would follow the notice too closely', () => {
    const now = START - 24 * HOUR - 30 * MINUTE;
    expect(
      planBookingNotifications({ event: 'created', startsAt: START, now, seenByClient: false }).map(
        (planned) => planned.kind,
      ),
    ).toEqual(['booking_created', 'reminder_2h']);
    expect(
      planBookingNotifications({
        event: 'created',
        startsAt: START,
        now: START - 90 * MINUTE,
        seenByClient: false,
      }).map((planned) => planned.kind),
    ).toEqual(['booking_created']);
  });

  it('does not repeat a notice the client already saw, but still plans reminders', () => {
    const now = START - 3 * 24 * HOUR;
    expect(
      planBookingNotifications({
        event: 'rescheduled',
        startsAt: START,
        now,
        seenByClient: true,
      }).map((planned) => planned.kind),
    ).toEqual(['reminder_24h', 'reminder_2h']);
  });

  it('sends nothing but the notice after a cancellation', () => {
    const now = START - 3 * 24 * HOUR;
    expect(
      planBookingNotifications({ event: 'cancelled', startsAt: START, now, seenByClient: false }),
    ).toEqual([{ kind: 'booking_cancelled', dueAt: now }]);
  });
});

describe('waitlist windows', () => {
  const localMinute = (epoch: number) =>
    new Date(epoch).getUTCHours() * 60 + new Date(epoch).getUTCMinutes();

  it('offers the earliest free start inside the wanted part of the day', () => {
    const starts = [
      Date.UTC(2026, 9, 10, 18, 0),
      Date.UTC(2026, 9, 10, 10, 0),
      Date.UTC(2026, 9, 10, 13, 30),
    ];
    expect(firstStartInWindow(starts, waitlistWindowOf('afternoon'), localMinute)).toBe(
      Date.UTC(2026, 9, 10, 13, 30),
    );
    expect(firstStartInWindow(starts, waitlistWindowOf(null), localMinute)).toBe(
      Date.UTC(2026, 9, 10, 10, 0),
    );
    expect(
      firstStartInWindow([Date.UTC(2026, 9, 10, 10, 0)], waitlistWindowOf('evening'), localMinute),
    ).toBeNull();
  });

  it('passes a time the client let go to the next start, not back to them', () => {
    const starts = [Date.UTC(2026, 9, 10, 10, 0), Date.UTC(2026, 9, 10, 11, 0)];
    const offered = new Set([Date.UTC(2026, 9, 10, 10, 0)]);
    expect(firstStartInWindow(starts, waitlistWindowOf(null), localMinute, offered)).toBe(
      Date.UTC(2026, 9, 10, 11, 0),
    );
  });

  it('places every minute of the day in exactly one part', () => {
    expect(dayPartOfMinute(0)).toBe('morning');
    expect(dayPartOfMinute(12 * 60)).toBe('afternoon');
    expect(dayPartOfMinute(17 * 60 - 1)).toBe('afternoon');
    expect(dayPartOfMinute(23 * 60 + 59)).toBe('evening');
  });
});
