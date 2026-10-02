/** Messengers may deliver an update more than once; each is handled once. */
export interface UpdateDeduplicator {
  /** `true` the first time the key is seen. */
  firstTime(key: string): Promise<boolean>;
  /** Lets a key through again, after handling it failed and a redelivery should retry. */
  forget(key: string): Promise<void>;
}

export const UPDATE_DEDUPLICATOR = Symbol('UPDATE_DEDUPLICATOR');
