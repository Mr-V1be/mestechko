import { Module } from '@nestjs/common';
import { KyselyUnitOfWork } from '../../platform/db/kysely-unit-of-work.js';
import { ID_GENERATOR, type IdGenerator } from '../../shared/application/ports.js';
import { CLIENT_DIRECTORY, CUSTOMER_IDENTITIES } from './application/ports.js';
import {
  KyselyClientDirectory,
  KyselyCustomerIdentities,
} from './infrastructure/kysely-clients.js';

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
  ],
  exports: [CUSTOMER_IDENTITIES, CLIENT_DIRECTORY],
})
export class ClientsModule {}
