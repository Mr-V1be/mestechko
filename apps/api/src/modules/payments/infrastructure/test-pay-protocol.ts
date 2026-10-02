import { createHmac } from 'node:crypto';

/**
 * The test payment provider's public protocol, shared by its adapter and its emulator:
 * notifications carry `t=<unix seconds>,v1=<hex HMAC-SHA256 of "t.body">`.
 */
export const TEST_PAY_SIGNATURE_HEADER = 'x-testpay-signature';

export function signTestPayBody(secret: string, timestamp: number, body: string): string {
  const digest = createHmac('sha256', secret)
    .update(`${String(timestamp)}.${body}`)
    .digest('hex');
  return `t=${String(timestamp)},v1=${digest}`;
}
