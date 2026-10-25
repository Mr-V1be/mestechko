import type {
  DemoBusiness,
  PublicBusiness,
  getCabinetOverview,
  RouteResult,
} from '@mestechko/contracts';
import type { UnitOfWork } from '../../../shared/application/unit-of-work.js';
import type { AvatarUrls } from '../../../shared/application/avatar-urls.js';
import { verticalSummaryOf } from '../../tenancy/application/vertical-summary.js';
import type { BusinessContextResolver } from '../../tenancy/application/business-context.js';
import type {
  BusinessDirectory,
  MembershipDirectory,
} from '../../tenancy/application/business-directory.js';
import type { CatalogReader } from './catalog-reader.js';

type CabinetOverview = RouteResult<typeof getCabinetOverview>;

export class CatalogQueries {
  constructor(
    private readonly businesses: BusinessContextResolver,
    private readonly directory: BusinessDirectory,
    private readonly memberships: MembershipDirectory,
    private readonly catalog: CatalogReader,
    private readonly unitOfWork: UnitOfWork,
    private readonly avatars: AvatarUrls,
    private readonly demoEnabled: boolean,
  ) {}

  async publicBusiness(slug: string): Promise<PublicBusiness> {
    const { business, vertical, rules } = await this.businesses.bySlug(slug);
    const locations = await this.unitOfWork.inTenant(
      business.id,
      () => this.catalog.listLocations(),
      {
        readOnly: true,
      },
    );
    return {
      id: business.id,
      slug: business.slug,
      name: business.name,
      vertical: verticalSummaryOf(vertical),
      countryCode: business.countryCode,
      currency: business.currency,
      locations,
      booking: {
        slotStepMinutes: rules.slotStepMinutes,
        horizonDays: rules.horizonDays,
        maxServicesPerBooking: rules.maxServicesPerBooking,
      },
    };
  }

  async cabinetOverview(businessId: string): Promise<CabinetOverview> {
    const { business, vertical } = await this.businesses.byId(businessId);
    const [locations, staff, resources] = await this.unitOfWork.inTenant(
      business.id,
      () =>
        Promise.all([
          this.catalog.listLocations(),
          this.catalog.listStaff(),
          this.catalog.listResources(),
        ]),
      { readOnly: true },
    );
    const resourceTerm = (typeId: string): string =>
      vertical.resourceTypes.find((type) => type.id === typeId)?.term ?? typeId;
    return {
      business: {
        id: business.id,
        slug: business.slug,
        name: business.name,
        vertical: verticalSummaryOf(vertical),
        currency: business.currency,
        countryCode: business.countryCode,
      },
      locations,
      staff: staff.map((member) => ({
        id: member.id,
        displayName: member.displayName,
        title: member.title,
        avatarUrl: this.avatars.forSeed(member.avatarSeed),
      })),
      resources: resources.map((resource) => ({
        id: resource.id,
        name: resource.name,
        typeId: resource.typeId,
        typeTerm: resourceTerm(resource.typeId),
        locationId: resource.locationId,
      })),
    };
  }

  /** Demo businesses with the address of their main location. A handful at most. */
  async demoBusinesses(): Promise<DemoBusiness[]> {
    if (!this.demoEnabled) {
      return [];
    }
    const businesses = await this.directory.listDemo();
    return Promise.all(
      businesses.map(async (record) => {
        const context = this.businesses.contextOf(record);
        const [locations, holders] = await Promise.all([
          this.unitOfWork.inTenant(record.id, () => this.catalog.listLocations(), {
            readOnly: true,
          }),
          this.memberships.listRoleHolders(record.id),
        ]);
        return {
          slug: record.slug,
          name: record.name,
          locale: record.locale,
          vertical: verticalSummaryOf(context.vertical),
          address: locations[0]?.address ?? '',
          personas: holders.map((holder) => ({
            role: holder.role,
            displayName: holder.displayName,
          })),
        };
      }),
    );
  }
}
