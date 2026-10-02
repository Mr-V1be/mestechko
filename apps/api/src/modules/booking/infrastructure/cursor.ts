import { z } from 'zod';

const keysetSchema = z.object({ at: z.iso.datetime(), id: z.uuid() });

export interface Keyset {
  readonly at: Date;
  readonly id: string;
}

/** Opaque keyset cursor: position after the last row of the previous page. */
export function encodeCursor(keyset: Keyset): string {
  return Buffer.from(JSON.stringify({ at: keyset.at.toISOString(), id: keyset.id })).toString(
    'base64url',
  );
}

export function decodeCursor(cursor: string | null): Keyset | null {
  if (cursor === null) {
    return null;
  }
  try {
    const parsed = keysetSchema.parse(
      JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')),
    );
    return { at: new Date(parsed.at), id: parsed.id };
  } catch {
    return null;
  }
}
