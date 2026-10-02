import { z } from 'zod';
import { decodeKeyset, encodeKeyset } from '../../../platform/db/keyset-cursor.js';

export interface Keyset {
  readonly at: Date;
  readonly id: string;
}

/** Position after the last booking of the previous page: its start and id. */
export function encodeCursor(keyset: Keyset): string {
  return encodeKeyset([keyset.at.toISOString(), keyset.id]);
}

export function decodeCursor(cursor: string | null): Keyset | null {
  const [at, id] = decodeKeyset(cursor, 2) ?? [];
  const parsed = z.object({ at: z.iso.datetime(), id: z.uuid() }).safeParse({ at, id });
  return parsed.success ? { at: new Date(parsed.data.at), id: parsed.data.id } : null;
}
