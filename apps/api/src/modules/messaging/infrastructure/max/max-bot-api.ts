import { z } from 'zod';

/** Subset of the MAX Bot API the product uses (dev.max.ru/docs-api). */
const userSchema = z.object({
  user_id: z.number().int(),
  first_name: z.string().optional(),
  name: z.string().optional(),
  is_bot: z.boolean().optional(),
});

const messageSchema = z.object({
  sender: userSchema.optional(),
  recipient: z.object({ chat_id: z.number().int().nullable().optional() }),
  timestamp: z.number(),
  body: z.object({ mid: z.string(), text: z.string().nullable().optional() }),
});

/** The language of the person's MAX app (IETF BCP 47), sent with what they do. */
const userLocale = z.string().nullable().optional();

export const maxUpdateSchema = z.discriminatedUnion('update_type', [
  z.object({
    update_type: z.literal('bot_started'),
    chat_id: z.number().int(),
    user: userSchema,
    payload: z.string().nullable().optional(),
    user_locale: userLocale,
  }),
  z.object({
    update_type: z.literal('bot_stopped'),
    chat_id: z.number().int(),
    user: userSchema,
  }),
  z.object({
    update_type: z.literal('message_created'),
    message: messageSchema,
    user_locale: userLocale,
  }),
  z.object({
    update_type: z.literal('message_callback'),
    callback: z.object({
      callback_id: z.string(),
      payload: z.string().optional(),
      user: userSchema,
    }),
    message: messageSchema.nullable().optional(),
    user_locale: userLocale,
  }),
]);

export type MaxUpdate = z.infer<typeof maxUpdateSchema>;
export type MaxUser = z.infer<typeof userSchema>;

const updatesSchema = z.object({
  updates: z.array(z.unknown()),
  marker: z.number().int().nullable(),
});

const sentSchema = z.object({ message: messageSchema });
const answerSchema = z.object({ success: z.boolean(), message: z.string().optional() });

export type MaxButton =
  | {
      readonly type: 'callback';
      readonly text: string;
      readonly payload: string;
      readonly intent: 'default' | 'positive' | 'negative';
    }
  | { readonly type: 'link'; readonly text: string; readonly url: string };

export interface MaxNewMessage {
  readonly text: string;
  readonly format: 'html';
  readonly attachments: readonly {
    readonly type: 'inline_keyboard';
    readonly payload: { readonly buttons: readonly (readonly MaxButton[])[] };
  }[];
}

/** An HTTP status the MAX API answered with, for the channel to classify. */
export class MaxApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'MaxApiError';
  }
}

export interface MaxBotApiOptions {
  readonly baseUrl: string;
  readonly token: string;
  readonly timeoutMs: number;
}

/** Long polls wait this much longer than the server-side timeout before giving up. */
const POLL_GRACE_MS = 10_000;

export class MaxBotApi {
  constructor(private readonly options: MaxBotApiOptions) {}

  async sendMessage(chatId: string, body: MaxNewMessage): Promise<{ mid: string }> {
    const result = sentSchema.parse(
      await this.request('POST', '/messages', { chat_id: chatId }, body),
    );
    return { mid: result.message.body.mid };
  }

  async answer(
    callbackId: string,
    reply: { readonly message?: MaxNewMessage; readonly notification?: string },
  ): Promise<void> {
    const result = answerSchema.parse(
      await this.request('POST', '/answers', { callback_id: callbackId }, reply),
    );
    if (!result.success) {
      throw new MaxApiError(200, result.message ?? 'Answer rejected');
    }
  }

  /** Waits up to `timeoutSeconds` for updates after `marker`; unknown kinds are skipped. */
  async updates(
    marker: number | null,
    timeoutSeconds: number,
    signal: AbortSignal,
  ): Promise<{ updates: MaxUpdate[]; marker: number | null }> {
    const result = updatesSchema.parse(
      await this.request(
        'GET',
        '/updates',
        {
          timeout: String(timeoutSeconds),
          ...(marker === null ? {} : { marker: String(marker) }),
          types: 'bot_started,bot_stopped,message_created,message_callback',
        },
        undefined,
        { timeoutMs: timeoutSeconds * 1_000 + POLL_GRACE_MS, signal },
      ),
    );
    return {
      updates: result.updates.flatMap((update) => {
        const parsed = maxUpdateSchema.safeParse(update);
        return parsed.success ? [parsed.data] : [];
      }),
      marker: result.marker,
    };
  }

  private async request(
    method: 'GET' | 'POST',
    path: string,
    query: Readonly<Record<string, string>>,
    body: unknown,
    options: { readonly timeoutMs?: number; readonly signal?: AbortSignal } = {},
  ): Promise<unknown> {
    const url = new URL(`${this.options.baseUrl}${path}`);
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
    const timeout = AbortSignal.timeout(options.timeoutMs ?? this.options.timeoutMs);
    const response = await fetch(url, {
      method,
      headers: {
        authorization: this.options.token,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? null : JSON.stringify(body),
      signal: options.signal ? AbortSignal.any([timeout, options.signal]) : timeout,
    });
    if (!response.ok) {
      throw new MaxApiError(
        response.status,
        `MAX API ${method} ${path} answered ${String(response.status)}`,
      );
    }
    return response.json();
  }
}
