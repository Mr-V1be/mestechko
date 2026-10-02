import { z } from 'zod';

const MAX_PART_LENGTH = 200;
const partsSchema = z.array(z.string().max(MAX_PART_LENGTH));

/**
 * Opaque keyset cursor: the sort key values of the last row of the previous page.
 * Clients pass it back untouched; anything else reads as "from the start".
 */
export function encodeKeyset(parts: readonly string[]): string {
  return Buffer.from(JSON.stringify(parts)).toString('base64url');
}

export function decodeKeyset(cursor: string | null, length: number): string[] | null {
  if (cursor === null) {
    return null;
  }
  try {
    const parts = partsSchema.parse(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')));
    return parts.length === length ? parts : null;
  } catch {
    return null;
  }
}
