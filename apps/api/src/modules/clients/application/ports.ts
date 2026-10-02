import type { MessengerChannel } from '@mestechko/domain';

export interface ClientRecord {
  readonly id: string;
  readonly customerId: string | null;
  readonly displayName: string;
  readonly phone: string | null;
}

export interface ClientContact {
  readonly displayName: string;
  readonly phone: string;
}

/** People across the platform, identified by their messenger accounts. */
export interface CustomerIdentities {
  /** Customer of a messenger account, created on first contact. Safe under concurrency. */
  ensure(channel: MessengerChannel, externalId: string, now: Date): Promise<string>;
  find(channel: MessengerChannel, externalId: string): Promise<string | null>;
}

/** Client cards of the current tenant (the business's own CRM). */
export interface ClientDirectory {
  findByCustomer(customerId: string): Promise<ClientRecord | null>;
  /** Client card of a customer in this business, created or updated with the contact. */
  upsertForCustomer(
    customerId: string,
    contact: ClientContact,
    ids: { readonly newId: string; readonly now: Date },
  ): Promise<ClientRecord>;
}

export const CUSTOMER_IDENTITIES = Symbol('CUSTOMER_IDENTITIES');
export const CLIENT_DIRECTORY = Symbol('CLIENT_DIRECTORY');
