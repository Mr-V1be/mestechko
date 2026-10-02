import { z } from 'zod';

/**
 * Button payloads. Messengers cap them at 64 bytes, so ids travel as 22-character
 * base64url and times as epoch minutes in base 36. The payload only names what was
 * pressed; who pressed it is checked against the booking's owner every time.
 */
export type BotAction =
  | { readonly kind: 'bookings' }
  | { readonly kind: 'open'; readonly businessId: string; readonly bookingId: string }
  | { readonly kind: 'attend'; readonly businessId: string; readonly bookingId: string }
  | { readonly kind: 'cancel_ask'; readonly businessId: string; readonly bookingId: string }
  | { readonly kind: 'cancel'; readonly businessId: string; readonly bookingId: string }
  | { readonly kind: 'move_days'; readonly businessId: string; readonly bookingId: string }
  | {
      readonly kind: 'move_times';
      readonly businessId: string;
      readonly bookingId: string;
      readonly date: string;
    }
  | {
      readonly kind: 'move_ask';
      readonly businessId: string;
      readonly bookingId: string;
      readonly start: number;
    }
  | {
      readonly kind: 'move';
      readonly businessId: string;
      readonly bookingId: string;
      readonly start: number;
    }
  | {
      readonly kind: 'offer_accept';
      readonly businessId: string;
      readonly entryId: string;
      readonly start: number;
    }
  | {
      readonly kind: 'offer_decline';
      readonly businessId: string;
      readonly entryId: string;
      readonly start: number;
    };

export type BotActionKind = BotAction['kind'];

const MS_PER_MINUTE = 60_000;
const SEPARATOR = '.';

/** One letter per action; the letters are part of payloads already sent, keep them stable. */
const codes: Readonly<Record<BotActionKind, string>> = {
  bookings: 'l',
  open: 'o',
  attend: 'a',
  cancel_ask: 'c',
  cancel: 'C',
  move_days: 'r',
  move_times: 'd',
  move_ask: 't',
  move: 'T',
  offer_accept: 'w',
  offer_decline: 'x',
};

const kindsByCode = new Map(
  (Object.entries(codes) as [BotActionKind, string][]).map(([kind, code]) => [code, kind]),
);

function packId(uuid: string): string {
  return Buffer.from(uuid.replaceAll('-', ''), 'hex').toString('base64url');
}

function unpackId(packed: string): string {
  const hex = Buffer.from(packed, 'base64url').toString('hex');
  const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  return z.uuid().parse(uuid);
}

const packTime = (epoch: number) => Math.round(epoch / MS_PER_MINUTE).toString(36);
const unpackTime = (packed: string) => {
  const minutes = Number.parseInt(packed, 36);
  if (!Number.isSafeInteger(minutes) || minutes <= 0) {
    throw new Error('Invalid time');
  }
  return minutes * MS_PER_MINUTE;
};
const packDate = (date: string) => date.replaceAll('-', '');
const unpackDate = (packed: string) =>
  z.iso.date().parse(`${packed.slice(0, 4)}-${packed.slice(4, 6)}-${packed.slice(6, 8)}`);

export function encodeAction(action: BotAction): string {
  const parts: string[] = [];
  switch (action.kind) {
    case 'bookings':
      break;
    case 'open':
    case 'attend':
    case 'cancel_ask':
    case 'cancel':
    case 'move_days':
      parts.push(packId(action.businessId), packId(action.bookingId));
      break;
    case 'move_times':
      parts.push(packId(action.businessId), packId(action.bookingId), packDate(action.date));
      break;
    case 'move_ask':
    case 'move':
      parts.push(packId(action.businessId), packId(action.bookingId), packTime(action.start));
      break;
    case 'offer_accept':
    case 'offer_decline':
      parts.push(packId(action.businessId), packId(action.entryId), packTime(action.start));
      break;
  }
  return [codes[action.kind], ...parts].join(SEPARATOR);
}

/** `null` for payloads that are not ours or no longer parse. */
export function decodeAction(data: string): BotAction | null {
  const [code = '', first = '', second = '', third = ''] = data.split(SEPARATOR);
  const kind = kindsByCode.get(code);
  try {
    switch (kind) {
      case 'bookings':
        return { kind };
      case 'open':
      case 'attend':
      case 'cancel_ask':
      case 'cancel':
      case 'move_days':
        return { kind, businessId: unpackId(first), bookingId: unpackId(second) };
      case 'move_times':
        return {
          kind,
          businessId: unpackId(first),
          bookingId: unpackId(second),
          date: unpackDate(third),
        };
      case 'move_ask':
      case 'move':
        return {
          kind,
          businessId: unpackId(first),
          bookingId: unpackId(second),
          start: unpackTime(third),
        };
      case 'offer_accept':
      case 'offer_decline':
        return {
          kind,
          businessId: unpackId(first),
          entryId: unpackId(second),
          start: unpackTime(third),
        };
      case undefined:
        return null;
    }
  } catch {
    return null;
  }
}
