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
import { CatalogController } from './api/catalog.controller.js';
import { CatalogQueries } from './application/catalog-queries.js';
import { CATALOG_READER, type CatalogReader } from './application/catalog-reader.js';
import { KyselyCatalogReader } from './infrastructure/kysely-catalog-reader.js';

@Module({
  imports: [TenancyModule, MediaModule],
  controllers: [CatalogController],
  providers: [
    {
      provide: CATALOG_READER,
      useFactory: (unitOfWork: KyselyUnitOfWork) => new KyselyCatalogReader(unitOfWork),
      inject: [KyselyUnitOfWork],
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
  exports: [CATALOG_READER],
})
export class CatalogModule {}
