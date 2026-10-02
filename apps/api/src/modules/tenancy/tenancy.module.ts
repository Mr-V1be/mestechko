import { Module } from '@nestjs/common';
import { verticalRegistry } from '@mestechko/domain';
import { KyselyUnitOfWork } from '../../platform/db/kysely-unit-of-work.js';
import { BusinessContextResolver } from './application/business-context.js';
import {
  BUSINESS_DIRECTORY,
  MEMBERSHIP_DIRECTORY,
  type BusinessDirectory,
} from './application/business-directory.js';
import { BusinessAccessGuard } from './api/business-access.guard.js';
import { KyselyBusinessDirectory } from './infrastructure/kysely-business-directory.js';

export const VERTICAL_REGISTRY = Symbol('VERTICAL_REGISTRY');

@Module({
  providers: [
    { provide: VERTICAL_REGISTRY, useValue: verticalRegistry },
    {
      provide: KyselyBusinessDirectory,
      useFactory: (unitOfWork: KyselyUnitOfWork) => new KyselyBusinessDirectory(unitOfWork),
      inject: [KyselyUnitOfWork],
    },
    { provide: BUSINESS_DIRECTORY, useExisting: KyselyBusinessDirectory },
    { provide: MEMBERSHIP_DIRECTORY, useExisting: KyselyBusinessDirectory },
    {
      provide: BusinessContextResolver,
      useFactory: (directory: BusinessDirectory) =>
        new BusinessContextResolver(directory, verticalRegistry),
      inject: [BUSINESS_DIRECTORY],
    },
    BusinessAccessGuard,
  ],
  exports: [
    VERTICAL_REGISTRY,
    BUSINESS_DIRECTORY,
    MEMBERSHIP_DIRECTORY,
    BusinessContextResolver,
    BusinessAccessGuard,
  ],
})
export class TenancyModule {}
