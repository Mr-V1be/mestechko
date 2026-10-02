import { Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../platform/config/app-config.js';
import { KyselyUnitOfWork } from '../../platform/db/kysely-unit-of-work.js';
import { AVATAR_URLS, type AvatarUrls } from '../../shared/application/avatar-urls.js';
import { UNIT_OF_WORK, type UnitOfWork } from '../../shared/application/unit-of-work.js';
import { MediaModule } from '../media/media.module.js';
import { BusinessContextResolver } from '../tenancy/application/business-context.js';
import {
  BUSINESS_DIRECTORY,
  MEMBERSHIP_DIRECTORY,
  type BusinessDirectory,
  type MembershipDirectory,
} from '../tenancy/application/business-directory.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import {
  CLOCK,
  ID_GENERATOR,
  type Clock,
  type IdGenerator,
} from '../../shared/application/ports.js';
import { CabinetCatalogController } from './api/cabinet-catalog.controller.js';
import { CatalogController } from './api/catalog.controller.js';
import { CatalogAdmin } from './application/catalog-admin.js';
import { CatalogQueries } from './application/catalog-queries.js';
import { CATALOG_READER, type CatalogReader } from './application/catalog-reader.js';
import { CATALOG_STORE, type CatalogStore } from './application/catalog-store.js';
import { KyselyCatalogReader } from './infrastructure/kysely-catalog-reader.js';
import { KyselyCatalogStore } from './infrastructure/kysely-catalog-store.js';

@Module({
  imports: [TenancyModule, MediaModule],
  controllers: [CatalogController, CabinetCatalogController],
  providers: [
    {
      provide: CATALOG_READER,
      useFactory: (unitOfWork: KyselyUnitOfWork) => new KyselyCatalogReader(unitOfWork),
      inject: [KyselyUnitOfWork],
    },
    {
      provide: CATALOG_STORE,
      useFactory: (unitOfWork: KyselyUnitOfWork) => new KyselyCatalogStore(unitOfWork),
      inject: [KyselyUnitOfWork],
    },
    {
      provide: CatalogAdmin,
      useFactory: (store: CatalogStore, ids: IdGenerator, clock: Clock) =>
        new CatalogAdmin(store, ids, clock),
      inject: [CATALOG_STORE, ID_GENERATOR, CLOCK],
    },
    {
      provide: CatalogQueries,
      useFactory: (
        resolver: BusinessContextResolver,
        directory: BusinessDirectory,
        memberships: MembershipDirectory,
        catalog: CatalogReader,
        unitOfWork: UnitOfWork,
        avatars: AvatarUrls,
        config: AppConfig,
      ) =>
        new CatalogQueries(
          resolver,
          directory,
          memberships,
          catalog,
          unitOfWork,
          avatars,
          config.demo.enabled,
        ),
      inject: [
        BusinessContextResolver,
        BUSINESS_DIRECTORY,
        MEMBERSHIP_DIRECTORY,
        CATALOG_READER,
        UNIT_OF_WORK,
        AVATAR_URLS,
        APP_CONFIG,
      ],
    },
  ],
  exports: [CATALOG_READER, CATALOG_STORE],
})
export class CatalogModule {}
