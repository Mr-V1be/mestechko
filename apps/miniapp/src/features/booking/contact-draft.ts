import { useEffect, useState } from 'react';

export interface ContactDraft {
  readonly name: string;
  readonly phone: string;
  readonly comment: string;
}

const EMPTY: ContactDraft = { name: '', phone: '', comment: '' };

function read(key: string): ContactDraft | null {
  try {
    const stored = window.sessionStorage.getItem(key);
    if (!stored) {
      return null;
    }
    const value = JSON.parse(stored) as Partial<Record<keyof ContactDraft, unknown>>;
    return {
      name: typeof value.name === 'string' ? value.name : '',
      phone: typeof value.phone === 'string' ? value.phone : '',
      comment: typeof value.comment === 'string' ? value.comment : '',
    };
  } catch {
    return null;
  }
}

/** Typed contact details survive leaving the screen, reloads and failed attempts. */
export function useContactDraft(key: string, initial: () => ContactDraft | null) {
  const [draft, setDraft] = useState<ContactDraft>(() => read(key) ?? initial() ?? EMPTY);
  useEffect(() => {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(draft));
    } catch {
      // The draft lives as long as the screen does.
    }
  }, [key, draft]);
  return [draft, setDraft] as const;
}

/** One idempotency key per attempted booking, so repeated presses never book twice. */
export function idempotencyKeyFor(selectionKey: string): string {
  const storageKey = `slotwise-idempotency:${selectionKey}`;
  try {
    const existing = window.sessionStorage.getItem(storageKey);
    if (existing) {
      return existing;
    }
    const created = crypto.randomUUID();
    window.sessionStorage.setItem(storageKey, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}
