import { Module } from '@nestjs/common';
import { createI18n } from '@mestechko/i18n';
import { APP_CONFIG, type AppConfig } from '../../platform/config/app-config.js';
import { KyselyUnitOfWork } from '../../platform/db/kysely-unit-of-work.js';
import { JOB_QUEUE, type JobQueue } from '../../shared/application/job-queue.js';
import {
  CLOCK,
  ID_GENERATOR,
  type Clock,
  type IdGenerator,
} from '../../shared/application/ports.js';
import testPay from '../../locales/ru/test-pay.json' with { type: 'json' };
import { TEST_PAY_TEXTS, TestPayCheckoutController } from './api/test-pay-checkout.controller.js';
import { TestPayApiController } from './api/test-pay-api.controller.js';
import type { CheckoutTexts } from './api/checkout-page.js';
import { TEST_PAY_STORE, type TestPayStore } from './application/ports.js';
import {
  DeliverTestPayEvent,
  SweepTestPay,
  TestPayEmulator,
  testPayHandlerTokens,
} from './application/test-pay-emulator.js';
import { HttpWebhookSender } from './infrastructure/http-webhook-sender.js';
import { KyselyTestPayStore } from './infrastructure/kysely-test-pay-store.js';

async function loadTexts(): Promise<CheckoutTexts> {
  const i18n = await createI18n({
    defaultNamespace: 'test-pay',
    resources: { ru: { 'test-pay': testPay } },
  });
  return {
    locale: i18n.language,
    text: (key, values) => {
      const count = typeof values?.count === 'number' ? values.count : undefined;
      if (!i18n.exists(key, count === undefined ? undefined : { count })) {
        throw new Error(`Missing payment page text ${key}`);
      }
      return i18n.t(key, { ...values });
    },
  };
}

/**
 * An emulator of the test payment provider for the demo: its API, its hosted payment
 * page and its signed notifications. The shop side talks to it through the adapter.
 */
@Module({
  controllers: [TestPayApiController, TestPayCheckoutController],
  providers: [
    {
      provide: TEST_PAY_STORE,
      useFactory: (unitOfWork: KyselyUnitOfWork) => new KyselyTestPayStore(unitOfWork),
      inject: [KyselyUnitOfWork],
    },
    {
      provide: TestPayEmulator,
      useFactory: (
        store: TestPayStore,
        queue: JobQueue,
        ids: IdGenerator,
        clock: Clock,
        config: AppConfig,
      ) => new TestPayEmulator(store, queue, ids, clock, config.payments.test.checkoutBaseUrl),
      inject: [TEST_PAY_STORE, JOB_QUEUE, ID_GENERATOR, CLOCK, APP_CONFIG],
    },
    { provide: TEST_PAY_TEXTS, useFactory: loadTexts },
    {
      provide: testPayHandlerTokens.deliver,
      useFactory: (store: TestPayStore, config: AppConfig, clock: Clock) =>
        new DeliverTestPayEvent(
          store,
          new HttpWebhookSender({
            url: config.payments.test.webhookUrl,
            secret: config.payments.test.webhookSecret ?? '',
            timeoutMs: config.externalHttp.timeoutMs,
            now: () => clock.now().epochMilliseconds,
          }),
          clock,
        ),
      inject: [TEST_PAY_STORE, APP_CONFIG, CLOCK],
    },
    {
      provide: testPayHandlerTokens.sweep,
      useFactory: (emulator: TestPayEmulator) => new SweepTestPay(emulator),
      inject: [TestPayEmulator],
    },
  ],
})
export class TestPayModule {}
