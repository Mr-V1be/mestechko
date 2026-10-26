import { Controller, Inject } from '@nestjs/common';
import type { Locale } from '@slotwise/domain';
import {
  addClientNote,
  adjustClientPoints,
  createClient,
  deleteClientNote,
  exportClients,
  getClientCard,
  importClients,
  listClients,
  listClientTags,
  sellClientPass,
  updateClient,
  type RouteInput,
  type RouteResult,
} from '@slotwise/contracts';
import { CurrentBusinessAccess, SessionUser } from '../../../platform/http/auth.guard.js';
import { ContractInput, ContractRoute } from '../../../platform/http/contract-route.js';
import { RequestLocale } from '../../../platform/http/request-locale.js';
import type { BusinessAccess } from '../../../shared/application/business-access.js';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../shared/application/unit-of-work.js';
import type { CabinetActor } from '../../loyalty/application/loyalty-admin.js';
import { RequireAccess } from '../../tenancy/api/business-access.guard.js';
import {
  BusinessContextResolver,
  type BusinessContext,
} from '../../tenancy/application/business-context.js';
import { CATALOG_READER, type CatalogReader } from '../../catalog/application/catalog-reader.js';
import { ClientCards } from '../application/client-cards.js';
import { ClientTransfer } from '../application/client-transfer.js';

interface SessionUserView {
  readonly userId: string;
}

/** The client CRM of the cabinet. */
@Controller()
export class CabinetClientsController {
  constructor(
    @Inject(ClientCards) private readonly cards: ClientCards,
    @Inject(ClientTransfer) private readonly transfer: ClientTransfer,
    @Inject(BusinessContextResolver) private readonly businesses: BusinessContextResolver,
    @Inject(CATALOG_READER) private readonly catalog: CatalogReader,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  @ContractRoute(listClients)
  @RequireAccess('clients')
  list(
    @ContractInput() input: RouteInput<typeof listClients>,
    @CurrentBusinessAccess() access: BusinessAccess,
  ): Promise<RouteResult<typeof listClients>> {
    const query = input.query;
    return this.inTenant(
      access,
      () =>
        this.cards.list(
          { search: query.search ?? null, tag: query.tag ?? null, sort: query.sort ?? 'recent' },
          { cursor: query.cursor ?? null, limit: query.limit ?? null },
        ),
      true,
    );
  }

  @ContractRoute(listClientTags)
  @RequireAccess('clients')
  async tags(
    @CurrentBusinessAccess() access: BusinessAccess,
  ): Promise<RouteResult<typeof listClientTags>> {
    return { tags: await this.inTenant(access, () => this.cards.tags(), true) };
  }

  @ContractRoute(getClientCard)
  @RequireAccess('clients')
  card(
    @ContractInput() input: RouteInput<typeof getClientCard>,
    @CurrentBusinessAccess() access: BusinessAccess,
  ): Promise<RouteResult<typeof getClientCard>> {
    return this.inTenant(
      access,
      (context) => this.cards.card(context, input.params.clientId),
      true,
    );
  }

  @ContractRoute(createClient)
  @RequireAccess('clients')
  create(
    @ContractInput() input: RouteInput<typeof createClient>,
    @CurrentBusinessAccess() access: BusinessAccess,
  ): Promise<RouteResult<typeof createClient>> {
    return this.inTenant(access, (context) => this.cards.create(context, input.body));
  }

  @ContractRoute(updateClient)
  @RequireAccess('clients')
  update(
    @ContractInput() input: RouteInput<typeof updateClient>,
    @CurrentBusinessAccess() access: BusinessAccess,
  ): Promise<RouteResult<typeof updateClient>> {
    return this.inTenant(access, (context) =>
      this.cards.update(context, input.params.clientId, input.body),
    );
  }

  @ContractRoute(addClientNote)
  @RequireAccess('clients')
  addNote(
    @ContractInput() input: RouteInput<typeof addClientNote>,
    @CurrentBusinessAccess() access: BusinessAccess,
    @SessionUser() user: SessionUserView,
  ): Promise<RouteResult<typeof addClientNote>> {
    return this.inTenant(access, () =>
      this.cards.addNote(input.params.clientId, input.body.body, user.userId),
    );
  }

  @ContractRoute(deleteClientNote)
  @RequireAccess('clients')
  async deleteNote(
    @ContractInput() input: RouteInput<typeof deleteClientNote>,
    @CurrentBusinessAccess() access: BusinessAccess,
  ): Promise<void> {
    await this.inTenant(access, () =>
      this.cards.deleteNote(input.params.clientId, input.params.noteId),
    );
  }

  @ContractRoute(exportClients)
  @RequireAccess('clients')
  export(
    @ContractInput() input: RouteInput<typeof exportClients>,
    @CurrentBusinessAccess() access: BusinessAccess,
    @RequestLocale() requestLocale: Locale,
  ): Promise<RouteResult<typeof exportClients>> {
    return this.inTenant(
      access,
      async () =>
        this.transfer.export(
          input.query.format,
          await this.catalog.homeTimeZone(),
          input.query.locale ?? requestLocale,
        ),
      true,
    );
  }

  @ContractRoute(importClients)
  @RequireAccess('clients')
  import(
    @ContractInput() input: RouteInput<typeof importClients>,
    @CurrentBusinessAccess() access: BusinessAccess,
    @SessionUser() user: SessionUserView,
  ): Promise<RouteResult<typeof importClients>> {
    return this.inTenant(access, (context) =>
      this.transfer.import(context, input.file, {
        dryRun: input.query.dryRun,
        authorUserId: user.userId,
      }),
    );
  }

  @ContractRoute(sellClientPass)
  @RequireAccess('loyalty')
  sellPass(
    @ContractInput() input: RouteInput<typeof sellClientPass>,
    @CurrentBusinessAccess() access: BusinessAccess,
    @SessionUser() user: SessionUserView,
  ): Promise<RouteResult<typeof sellClientPass>> {
    return this.inTenant(access, async (context) =>
      this.cards.sellPass(
        context,
        input.params.clientId,
        input.body.planId,
        input.headers['idempotency-key'],
        await this.actorOf(context, user),
      ),
    );
  }

  @ContractRoute(adjustClientPoints)
  @RequireAccess('loyalty')
  adjustPoints(
    @ContractInput() input: RouteInput<typeof adjustClientPoints>,
    @CurrentBusinessAccess() access: BusinessAccess,
    @SessionUser() user: SessionUserView,
  ): Promise<RouteResult<typeof adjustClientPoints>> {
    return this.inTenant(access, async (context) =>
      this.cards.adjustPoints(
        context,
        input.params.clientId,
        { ...input.body, idempotencyKey: input.headers['idempotency-key'] },
        await this.actorOf(context, user),
      ),
    );
  }

  private async actorOf(context: BusinessContext, user: SessionUserView): Promise<CabinetActor> {
    return {
      userId: user.userId,
      currency: context.business.currency,
      timeZone: await this.catalog.homeTimeZone(),
    };
  }

  private async inTenant<T>(
    access: BusinessAccess,
    work: (context: BusinessContext) => Promise<T>,
    readOnly = false,
  ): Promise<T> {
    const context = await this.businesses.byId(access.businessId);
    return this.unitOfWork.inTenant(context.business.id, () => work(context), { readOnly });
  }
}
