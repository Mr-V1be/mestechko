import type { Clock } from '@mestechko/domain';
import type { AppConfig } from '../../../platform/config/app-config.js';
import type { PaymentProvider } from '../application/ports.js';
import { TestPayProvider } from './test-pay-provider.js';

type ProviderId = AppConfig['payments']['provider'];

/** Adapters by provider id; a new provider is a new entry and its configuration. */
const providerFactories: Readonly<
  Record<ProviderId, (config: AppConfig, clock: Clock) => PaymentProvider>
> = {
  test: (config, clock) => {
    const { apiUrl, secretKey, webhookSecret, checkout } = config.payments.test;
    if (!secretKey || !webhookSecret) {
      throw new Error('The test payment provider is not configured');
    }
    return new TestPayProvider({
      apiUrl,
      secretKey,
      webhookSecret,
      timeoutMs: config.externalHttp.timeoutMs,
      now: () => clock.now().epochMilliseconds,
      presentation: checkout,
    });
  },
};

export function createPaymentProvider(config: AppConfig, clock: Clock): PaymentProvider {
  return providerFactories[config.payments.provider](config, clock);
}
