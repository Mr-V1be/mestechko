import type { MessengerChannel } from '@mestechko/domain';

/** A client card as the CRM shows it. */
export interface ClientProfile {
  readonly id: string;
  readonly customerId: string | null;
  readonly displayName: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly tags: readonly string[];
  /** Messenger the client can be written to; `null` when none. */
  readonly messenger: MessengerChannel | null;
  readonly createdAt: Date;
}

export interface ClientFields {
  readonly displayName: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly tags: readonly string[];
}

export type ClientSort = 'recent' | 'name';

export interface ClientSearch {
  readonly search: string | null;
  readonly tag: string | null;
  readonly sort: ClientSort;
}

export interface ClientNoteRecord {
  readonly id: string;
  readonly body: string;
  readonly authorName: string | null;
  readonly createdAt: Date;
}

export interface ClientPage {
  readonly items: readonly ClientProfile[];
  readonly nextCursor: string | null;
}

/** The business's client cards as its CRM reads and edits them. Tenant-scoped. */
export interface ClientCrmStore {
  search(
    query: ClientSearch,
    page: { readonly cursor: string | null; readonly limit: number },
  ): Promise<ClientPage>;
  find(clientId: string): Promise<ClientProfile | null>;
  create(id: string, fields: ClientFields, now: Date): Promise<void>;
  update(clientId: string, changes: Partial<ClientFields>, now: Date): Promise<void>;
  /** Tags in use with how many clients carry them, most used first. */
  tagCounts(): Promise<{ readonly tag: string; readonly clients: number }[]>;
  notes(clientId: string, limit: number): Promise<ClientNoteRecord[]>;
  addNote(note: {
    readonly id: string;
    readonly clientId: string;
    readonly authorUserId: string;
    readonly body: string;
    readonly now: Date;
  }): Promise<void>;
  /** `false` when the note does not exist on this client's card. */
  deleteNote(clientId: string, noteId: string): Promise<boolean>;
  /** Cards in id order after the given one, for exporting all of them in batches. */
  batchAfter(afterId: string | null, limit: number): Promise<ClientProfile[]>;
  /** Cards by phone, for matching imported rows. */
  idsByPhone(phones: readonly string[]): Promise<Map<string, string>>;
}

export const CLIENT_CRM_STORE = Symbol('CLIENT_CRM_STORE');
