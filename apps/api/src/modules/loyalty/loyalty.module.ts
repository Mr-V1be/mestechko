import { Module } from '@nestjs/common';
import { KyselyUnitOfWork } from '../../platform/db/kysely-unit-of-work.js';
import {
  CLOCK,
  ID_GENERATOR,
  type Clock,
  type IdGenerator,
} from '../../shared/application/ports.js';
import { CATALOG_READER, type CatalogReader } from '../catalog/application/catalog-reader.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { CabinetLoyaltyController } from './api/cabinet-loyalty.controller.js';
import { LedgerBook } from './application/ledger-book.js';
import { LoyaltyAdmin } from './application/loyalty-admin.js';
import {
  LEDGER_STORE,
  LOYALTY_STORE,
  type LedgerStore,
  type LoyaltyStore,
} from './application/ports.js';
import { VisitSettlements } from './application/visit-settlements.js';
import { KyselyLedgerStore } from './infrastructure/kysely-ledger-store.js';
import { KyselyLoyaltyStore } from './infrastructure/kysely-loyalty-store.js';

/**
 * Loyalty points, visit passes and the ledger that holds them and the money clients
 * pay. Other modules post to the ledger only through `LedgerBook`.
 */
@Module({
  imports: [TenancyModule, CatalogModule],
  controllers: [CabinetLoyaltyController],
  providers: [
    {
      provide: LEDGER_STORE,
      useFactory: (unitOfWork: KyselyUnitOfWork) => new KyselyLedgerStore(unitOfWork),
      inject: [KyselyUnitOfWork],
    },
    {
      provide: LOYALTY_STORE,
      useFactory: (unitOfWork: KyselyUnitOfWork) => new KyselyLoyaltyStore(unitOfWork),
      inject: [KyselyUnitOfWork],
    },
    {
      provide: LedgerBook,
      useFactory: (ledger: LedgerStore, ids: IdGenerator) => new LedgerBook(ledger, ids),
      inject: [LEDGER_STORE, ID_GENERATOR],
    },
    {
      provide: VisitSettlements,
      useFactory: (loyalty: LoyaltyStore, ledger: LedgerStore, book: LedgerBook) =>
        new VisitSettlements(loyalty, ledger, book),
      inject: [LOYALTY_STORE, LEDGER_STORE, LedgerBook],
    },
    {
      provide: LoyaltyAdmin,
      useFactory: (
        loyalty: LoyaltyStore,
        ledger: LedgerStore,
        book: LedgerBook,
        catalog: CatalogReader,
        ids: IdGenerator,
        clock: Clock,
      ) => new LoyaltyAdmin(loyalty, ledger, book, catalog, ids, clock),
      inject: [LOYALTY_STORE, LEDGER_STORE, LedgerBook, CATALOG_READER, ID_GENERATOR, CLOCK],
    },
  ],
  exports: [LEDGER_STORE, LedgerBook, VisitSettlements, LoyaltyAdmin],
})
export class LoyaltyModule {}
