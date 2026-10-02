import { Module } from '@nestjs/common';
import { createI18n } from '@mestechko/i18n';
import crm from '../../locales/ru/crm.json' with { type: 'json' };
import {
  CLOCK,
  ID_GENERATOR,
  type Clock,
  type IdGenerator,
} from '../../shared/application/ports.js';
import { CabinetBookings } from '../booking/application/cabinet/cabinet-bookings.js';
import { BookingModule } from '../booking/booking.module.js';
import { CATALOG_STORE, type CatalogStore } from '../catalog/application/catalog-store.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { CLIENT_CRM_STORE, type ClientCrmStore } from '../clients/application/crm-ports.js';
import { ClientsModule } from '../clients/clients.module.js';
import { LoyaltyAdmin } from '../loyalty/application/loyalty-admin.js';
import { LEDGER_STORE, type LedgerStore } from '../loyalty/application/ports.js';
import { LoyaltyModule } from '../loyalty/loyalty.module.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { CabinetClientsController } from './api/cabinet-clients.controller.js';
import { ClientCards } from './application/client-cards.js';
import { ClientTransfer } from './application/client-transfer.js';
import {
  SPREADSHEET_CODECS,
  TRANSFER_TEXTS,
  type ImportColumn,
  type SpreadsheetCodecs,
  type TransferColumn,
  type TransferTexts,
} from './application/spreadsheets.js';
import { spreadsheetCodecs } from './infrastructure/spreadsheet-codecs.js';

async function loadTransferTexts(): Promise<TransferTexts> {
  const i18n = await createI18n({ defaultNamespace: 'crm', resources: { ru: { crm } } });
  return {
    fileName: i18n.t('fileName'),
    column: (key: TransferColumn) => i18n.t(`columns.${key}`),
    aliases: (key: ImportColumn) => {
      const value: unknown = i18n.t(`aliases.${key}`, { returnObjects: true });
      return Array.isArray(value) ? value.filter((alias) => typeof alias === 'string') : [];
    },
  };
}

/** The client CRM: cards, notes, tags, passes and points, import and export. */
@Module({
  imports: [TenancyModule, ClientsModule, BookingModule, LoyaltyModule, CatalogModule],
  controllers: [CabinetClientsController],
  providers: [
    { provide: SPREADSHEET_CODECS, useValue: spreadsheetCodecs },
    { provide: TRANSFER_TEXTS, useFactory: loadTransferTexts },
    {
      provide: ClientCards,
      useFactory: (
        store: ClientCrmStore,
        bookings: CabinetBookings,
        loyalty: LoyaltyAdmin,
        catalog: CatalogStore,
        ids: IdGenerator,
        clock: Clock,
      ) => new ClientCards(store, bookings, loyalty, catalog, ids, clock),
      inject: [CLIENT_CRM_STORE, CabinetBookings, LoyaltyAdmin, CATALOG_STORE, ID_GENERATOR, CLOCK],
    },
    {
      provide: ClientTransfer,
      useFactory: (
        store: ClientCrmStore,
        bookings: CabinetBookings,
        ledger: LedgerStore,
        codecs: SpreadsheetCodecs,
        texts: TransferTexts,
        ids: IdGenerator,
        clock: Clock,
      ) => new ClientTransfer(store, bookings, ledger, codecs, texts, ids, clock),
      inject: [
        CLIENT_CRM_STORE,
        CabinetBookings,
        LEDGER_STORE,
        SPREADSHEET_CODECS,
        TRANSFER_TEXTS,
        ID_GENERATOR,
        CLOCK,
      ],
    },
  ],
})
export class CrmModule {}
