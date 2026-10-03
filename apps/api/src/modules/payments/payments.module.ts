import { Module } from '@nestjs/common';
import { defaultLocale } from '@mestechko/i18n';
import payments from '../../locales/ru/payments.json' with { type: 'json' };
import { APP_CONFIG, type AppConfig } from '../../platform/config/app-config.js';
import { PaymentReturnController, RETURN_PAGE_TEXTS } from './api/payment-return.controller.js';
import type { ReturnPageTexts } from './api/payment-return-page.js';
import { KyselyUnitOfWork } from '../../platform/db/kysely-unit-of-work.js';
import { JOB_QUEUE, type JobQueue } from '../../shared/application/job-queue.js';
import {
  CLOCK,
  ID_GENERATOR,
  type Clock,
  type IdGenerator,
} from '../../shared/application/ports.js';
import { UNIT_OF_WORK, type UnitOfWork } from '../../shared/application/unit-of-work.js';
import { LedgerBook } from '../loyalty/application/ledger-book.js';
import { LoyaltyModule } from '../loyalty/loyalty.module.js';
import { PaymentCheckout } from './application/payment-checkout.js';
import {
  PAYMENT_PROVIDER,
  PAYMENT_STORE,
  PENDING_REFUNDS,
  type PaymentProvider,
  type PaymentStore,
  type PendingRefunds,
} from './application/ports.js';
import { Prepayments } from './application/prepayments.js';
import { refundHandlerTokens, RefundPayment, SweepRefunds } from './application/refund-jobs.js';
import { KyselyPaymentStore, KyselyPendingRefunds } from './infrastructure/kysely-payment-store.js';
import { createPaymentProvider } from './infrastructure/payment-providers.js';

/** Prepayments through the configured payment provider, and their refunds. */
@Module({
  imports: [LoyaltyModule],
  controllers: [PaymentReturnController],
  providers: [
    {
      provide: RETURN_PAGE_TEXTS,
      useValue: { locale: defaultLocale, ...payments.returned } satisfies ReturnPageTexts,
    },
    {
      provide: PAYMENT_PROVIDER,
      useFactory: (config: AppConfig, clock: Clock) => createPaymentProvider(config, clock),
      inject: [APP_CONFIG, CLOCK],
    },
    {
      provide: PAYMENT_STORE,
      useFactory: (unitOfWork: KyselyUnitOfWork) => new KyselyPaymentStore(unitOfWork),
      inject: [KyselyUnitOfWork],
    },
    {
      provide: PENDING_REFUNDS,
      useFactory: (unitOfWork: KyselyUnitOfWork) => new KyselyPendingRefunds(unitOfWork),
      inject: [KyselyUnitOfWork],
    },
    {
      provide: Prepayments,
      useFactory: (
        store: PaymentStore,
        book: LedgerBook,
        provider: PaymentProvider,
        ids: IdGenerator,
      ) => new Prepayments(store, book, provider.id, ids),
      inject: [PAYMENT_STORE, LedgerBook, PAYMENT_PROVIDER, ID_GENERATOR],
    },
    {
      provide: PaymentCheckout,
      useFactory: (
        unitOfWork: UnitOfWork,
        store: PaymentStore,
        provider: PaymentProvider,
        config: AppConfig,
      ) => new PaymentCheckout(unitOfWork, store, provider, config.payments.returnPageUrl),
      inject: [UNIT_OF_WORK, PAYMENT_STORE, PAYMENT_PROVIDER, APP_CONFIG],
    },
    {
      provide: refundHandlerTokens.refund,
      useFactory: (
        unitOfWork: UnitOfWork,
        store: PaymentStore,
        prepayments: Prepayments,
        provider: PaymentProvider,
        clock: Clock,
      ) => new RefundPayment(unitOfWork, store, prepayments, provider, clock),
      inject: [UNIT_OF_WORK, PAYMENT_STORE, Prepayments, PAYMENT_PROVIDER, CLOCK],
    },
    {
      provide: refundHandlerTokens.sweep,
      useFactory: (pending: PendingRefunds, queue: JobQueue) => new SweepRefunds(pending, queue),
      inject: [PENDING_REFUNDS, JOB_QUEUE],
    },
  ],
  exports: [PAYMENT_PROVIDER, Prepayments, PaymentCheckout],
})
export class PaymentsModule {}
