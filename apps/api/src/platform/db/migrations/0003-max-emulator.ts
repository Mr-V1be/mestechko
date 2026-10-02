import { sql, type Kysely } from 'kysely';

/**
 * State of the MAX Bot API emulator used in the demo instead of the MAX servers:
 * people, the bot's dialogs with them and the update stream the bot polls.
 * The tables mirror what MAX keeps on its side; the product never reads them.
 */
const up = sql.raw(`
CREATE TABLE max_emulator_users (
  user_id bigint PRIMARY KEY CHECK (user_id > 0),
  first_name text NOT NULL CHECK (char_length(first_name) BETWEEN 1 AND 64),
  last_name text CHECK (last_name IS NULL OR char_length(last_name) BETWEEN 1 AND 64),
  bot_started_at timestamptz,
  created_at timestamptz NOT NULL
);

CREATE TABLE max_emulator_messages (
  mid text PRIMARY KEY CHECK (char_length(mid) BETWEEN 1 AND 64),
  seq bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  user_id bigint NOT NULL REFERENCES max_emulator_users (user_id) ON DELETE CASCADE,
  from_bot boolean NOT NULL,
  text text CHECK (text IS NULL OR char_length(text) <= 4000),
  format text CHECK (format IS NULL OR format IN ('markdown', 'html')),
  attachments jsonb NOT NULL CHECK (jsonb_typeof(attachments) = 'array'),
  sent_at timestamptz NOT NULL,
  edited_at timestamptz
);
CREATE INDEX max_emulator_messages_dialog_idx ON max_emulator_messages (user_id, seq);

CREATE TABLE max_emulator_updates (
  marker bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  update jsonb NOT NULL CHECK (jsonb_typeof(update) = 'object'),
  created_at timestamptz NOT NULL
);

-- One-time notices the bot showed in answer to a button press.
CREATE TABLE max_emulator_notices (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES max_emulator_users (user_id) ON DELETE CASCADE,
  text text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL
);
CREATE INDEX max_emulator_notices_user_idx ON max_emulator_notices (user_id, id);
`);

const down = sql.raw(`
DROP TABLE IF EXISTS max_emulator_notices, max_emulator_updates, max_emulator_messages,
  max_emulator_users;
`);

export const maxEmulatorMigration = {
  async up(db: Kysely<unknown>): Promise<void> {
    await up.execute(db);
  },
  async down(db: Kysely<unknown>): Promise<void> {
    await down.execute(db);
  },
};
