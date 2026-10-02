import { Module } from '@nestjs/common';
import { KyselyUnitOfWork } from '../../platform/db/kysely-unit-of-work.js';
import { ID_GENERATOR, type IdGenerator } from '../../shared/application/ports.js';
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
  ],
  exports: [CUSTOMER_IDENTITIES, CLIENT_DIRECTORY, CLIENT_CRM_STORE, MESSENGER_CONTACTS],
})
export class ClientsModule {}
