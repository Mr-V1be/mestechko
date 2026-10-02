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

/** Where a messenger delivers messages to a person who allowed it. */
export interface MessagingAddress {
  readonly externalId: string;
  readonly chatId: string;
}

/**
 * Permission to message people. A bot may write only to those who started it, and it
 * stops when they block it.
 */
export interface MessengerContacts {
  /** Records the permission; the person becomes a customer if they were not one yet. */
  allow(channel: MessengerChannel, externalId: string, chatId: string, now: Date): Promise<string>;
  revoke(channel: MessengerChannel, externalId: string): Promise<void>;
  isAllowed(channel: MessengerChannel, externalId: string): Promise<boolean>;
  addressOf(customerId: string, channel: MessengerChannel): Promise<MessagingAddress | null>;
  /** Businesses where the customer has a client card; the platform bot serves them all. */
  businessesOf(customerId: string): Promise<string[]>;
}

export const CUSTOMER_IDENTITIES = Symbol('CUSTOMER_IDENTITIES');
export const MESSENGER_CONTACTS = Symbol('MESSENGER_CONTACTS');
export const CLIENT_DIRECTORY = Symbol('CLIENT_DIRECTORY');
