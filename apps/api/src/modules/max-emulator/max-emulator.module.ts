import { Module } from '@nestjs/common';
import { KyselyUnitOfWork } from '../../platform/db/kysely-unit-of-work.js';
import {
  CLOCK,
  ID_GENERATOR,
  type Clock,
  type IdGenerator,
} from '../../shared/application/ports.js';
import { UNIT_OF_WORK, type UnitOfWork } from '../../shared/application/unit-of-work.js';
import { CLIENT_DIRECTORY, type ClientDirectory } from '../clients/application/ports.js';
import { ClientsModule } from '../clients/clients.module.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { CabinetMaxEmulatorController } from './api/cabinet-max-emulator.controller.js';
import { MaxBotApiController } from './api/max-bot-api.controller.js';
import { EmulatorChats } from './application/emulator-chats.js';
import { MaxBotApiEmulator } from './application/max-bot-api-emulator.js';
import { EMULATOR_STORE, type EmulatorStore } from './application/ports.js';
import { KyselyEmulatorStore } from './infrastructure/kysely-emulator-store.js';

/**
 * An emulator of the MAX servers for the demo: the bot talks to it through the real
 * MAX adapter, and the cabinet shows the chats as a client would see them.
 */
@Module({
  imports: [TenancyModule, ClientsModule],
  controllers: [MaxBotApiController, CabinetMaxEmulatorController],
  providers: [
    {
      provide: EMULATOR_STORE,
      useFactory: (unitOfWork: KyselyUnitOfWork) => new KyselyEmulatorStore(unitOfWork),
      inject: [KyselyUnitOfWork],
    },
    {
      provide: MaxBotApiEmulator,
      useFactory: (store: EmulatorStore, ids: IdGenerator, clock: Clock) =>
        new MaxBotApiEmulator(store, ids, clock),
      inject: [EMULATOR_STORE, ID_GENERATOR, CLOCK],
    },
    {
      provide: EmulatorChats,
      useFactory: (
        unitOfWork: UnitOfWork,
        clients: ClientDirectory,
        store: EmulatorStore,
        ids: IdGenerator,
        clock: Clock,
      ) => new EmulatorChats(unitOfWork, clients, store, ids, clock),
      inject: [UNIT_OF_WORK, CLIENT_DIRECTORY, EMULATOR_STORE, ID_GENERATOR, CLOCK],
    },
  ],
})
export class MaxEmulatorModule {}
