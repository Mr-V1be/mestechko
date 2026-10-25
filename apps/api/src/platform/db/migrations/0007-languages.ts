import { sql, type Kysely } from 'kysely';

/**
 * Languages. A business presents itself in one language (its catalogue, the demo it
 * opens for); a person may choose the language they are spoken to in; each messenger
 * account carries the language its app reports. The payment page of the test provider
 * speaks the payer's language, as a real provider's page does.
 *
 * Until now the platform spoke Russian only: existing businesses, messenger accounts
 * and test payments are Russian, and an account's language is refreshed by the next
 * update its messenger sends.
 */
const up = sql.raw(`
ALTER TABLE businesses ADD COLUMN locale text;
UPDATE businesses SET locale = 'ru';
ALTER TABLE businesses
  ALTER COLUMN locale SET NOT NULL,
  ADD CONSTRAINT businesses_locale_check CHECK (locale ~ '^[a-z]{2}$');

ALTER TABLE customers
  ADD COLUMN locale text CONSTRAINT customers_locale_check CHECK (locale ~ '^[a-z]{2}$');

ALTER TABLE customer_identities
  ADD COLUMN language_tag text
    CONSTRAINT customer_identities_language_tag_check
    CHECK (language_tag ~ '^[A-Za-z]{2,8}([-_][A-Za-z0-9]{1,8})*$');
UPDATE customer_identities SET language_tag = 'ru';

ALTER TABLE test_pay_payments ADD COLUMN locale text;
UPDATE test_pay_payments SET locale = 'ru';
ALTER TABLE test_pay_payments
  ALTER COLUMN locale SET NOT NULL,
  ADD CONSTRAINT test_pay_payments_locale_check CHECK (locale ~ '^[a-z]{2}$');
`);

const down = sql.raw(`
ALTER TABLE test_pay_payments DROP COLUMN locale;
ALTER TABLE customer_identities DROP COLUMN language_tag;
ALTER TABLE customers DROP COLUMN locale;
ALTER TABLE businesses DROP COLUMN locale;
`);

export const languagesMigration = {
  async up(db: Kysely<unknown>): Promise<void> {
    await up.execute(db);
  },
  async down(db: Kysely<unknown>): Promise<void> {
    await down.execute(db);
  },
};
