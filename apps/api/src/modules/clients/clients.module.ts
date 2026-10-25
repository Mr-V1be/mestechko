import { Module } from '@nestjs/common';
import { KyselyUnitOfWork } from '../../platform/db/kysely-unit-of-work.js';
import {
  CLOCK,
  ID_GENERATOR,
  type Clock,
  type IdGenerator,
} from '../../shared/application/ports.js';
import { MiniAppPreferencesController } from './api/miniapp-preferences.controller.js';
import { ClientPreferences } from './application/client-preferences.js';
import {
  CLIENT_DIRECTORY,
  CUSTOMER_IDENTITIES,
  MESSENGER_CONTACTS,
  type CustomerIdentities,
} from './application/ports.js';
import { CLIENT_CRM_STORE } from './application/crm-ports.js';
import { KyselyClientCrmStore } from './infrastructure/kysely-client-crm-store.js';
import {
  KyselyClientDirectory,
  KyselyCustomerIdentities,
} from './infrastructure/kysely-clients.js';
import { KyselyMessengerContacts } from './infrastructure/kysely-messenger-contacts.js';

@Module({
  controllers: [MiniAppPreferencesController],
  providers: [
    {
      provide: CUSTOMER_IDENTITIES,
      useFactory: (unitOfWork: KyselyUnitOfWork, ids: IdGenerator) =>
        new KyselyCustomerIdentities(unitOfWork, ids),
      inject: [KyselyUnitOfWork, ID_GENERATOR],
    },
    {
      provide: CLIENT_DIRECTORY,
      useFactory: (unitOfWork: KyselyUnitOfWork) => new KyselyClientDirectory(unitOfWork),
      inject: [KyselyUnitOfWork],
    },
    {
      provide: CLIENT_CRM_STORE,
      useFactory: (unitOfWork: KyselyUnitOfWork) => new KyselyClientCrmStore(unitOfWork),
      inject: [KyselyUnitOfWork],
    },
    {
      provide: MESSENGER_CONTACTS,
      useFactory: (unitOfWork: KyselyUnitOfWork, identities: CustomerIdentities) =>
        new KyselyMessengerContacts(unitOfWork, identities),
      inject: [KyselyUnitOfWork, CUSTOMER_IDENTITIES],
    },
    {
      provide: ClientPreferences,
      useFactory: (identities: CustomerIdentities, clock: Clock) =>
        new ClientPreferences(identities, clock),
      inject: [CUSTOMER_IDENTITIES, CLOCK],
    },
  ],
  exports: [CUSTOMER_IDENTITIES, CLIENT_DIRECTORY, CLIENT_CRM_STORE, MESSENGER_CONTACTS],
})
export class ClientsModule {}
