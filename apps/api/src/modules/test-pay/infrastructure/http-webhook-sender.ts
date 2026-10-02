import {
  signTestPayBody,
  TEST_PAY_SIGNATURE_HEADER,
} from '../../payments/infrastructure/test-pay-protocol.js';
import type { WebhookSender } from '../application/test-pay-emulator.js';

const MS_PER_SECOND = 1_000;

/**
 * Posts notifications to the shop's webhook address, signed like the provider does.
 * Network failures throw, so the delivery job retries with the cause in its log.
 */
export class HttpWebhookSender implements WebhookSender {
  constructor(
    private readonly options: {
      readonly url: string;
      readonly secret: string;
      readonly timeoutMs: number;
      readonly now: () => number;
    },
  ) {}

  async send(body: string): Promise<boolean> {
    const timestamp = Math.floor(this.options.now() / MS_PER_SECOND);
    const response = await fetch(this.options.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [TEST_PAY_SIGNATURE_HEADER]: signTestPayBody(this.options.secret, timestamp, body),
      },
      body,
      signal: AbortSignal.timeout(this.options.timeoutMs),
    });
    return response.ok;
  }
}
