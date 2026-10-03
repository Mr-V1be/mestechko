import { useFormat } from '@mestechko/booking-ui';
import { apiAssetUrl } from '@mestechko/booking-ui';
import type {
  CabinetCatalog,
  CategoryAdmin,
  ServiceAdmin,
  TeamMemberSummary,
} from '@mestechko/contracts/client';
import {
  AvatarGroup,
  Badge,
  Button,
  ListGroup,
  ListItem,
  Menu,
  type MenuAction,
} from '@mestechko/ui';
import { clsx } from 'clsx';
import {
  ArrowDown,
  ArrowUp,
  Ban,
  CircleOff,
  Pencil,
  Plus,
  Power,
  PowerOff,
  UserX,
  Wallet,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { appConfig } from '../../app/config';
import { durationSpan, priceSpan, varies } from './service-summary';
import styles from './catalog.module.css';

/** What people can do with categories and services from the list. */
export interface CatalogListActions {
  readonly addService: (categoryId: string) => void;
  readonly editService: (service: ServiceAdmin) => void;
  readonly renameCategory: (category: CategoryAdmin) => void;
  readonly moveCategory: (category: CategoryAdmin, position: number) => void;
  readonly moveService: (service: ServiceAdmin, position: number) => void;
  readonly setServiceActive: (service: ServiceAdmin, isActive: boolean) => void;
}

/** What rows show beside the services themselves. */
interface RowContext {
  /** Name of the resource a service occupies, by resource type id. */
  readonly resourceName: (resourceTypeId: string) => string;
  /** The team by id, once loaded, to show who provides each service. */
  readonly staff: ReadonlyMap<string, TeamMemberSummary> | null;
  readonly actions: CatalogListActions;
}

interface CatalogListProps extends RowContext {
  readonly catalog: CabinetCatalog;
}

function Performers({
  service,
  staff,
}: {
  readonly service: ServiceAdmin;
  readonly staff: RowContext['staff'];
}) {
  const { t } = useTranslation();
  const people = service.staff.flatMap((terms) => {
    const member = staff?.get(terms.staffId);
    return member
      ? [
          {
            id: member.id,
            name: member.displayName,
            src: apiAssetUrl(appConfig.apiBaseUrl, member.avatarUrl),
          },
        ]
      : [];
  });
  return people.length > 0 ? (
    <span className={styles.performers}>
      <AvatarGroup
        people={people}
        label={t('services:performers', {
          names: people.map((person) => person.name).join(', '),
        })}
      />
    </span>
  ) : null;
}

function ServiceBadges({ service }: { readonly service: ServiceAdmin }) {
  const { t } = useTranslation();
  const badges = [
    !service.isActive && (
      <Badge key="inactive" tone="neutral" className={styles.badge}>
        <CircleOff aria-hidden="true" />
        {t('services:badges.inactive')}
      </Badge>
    ),
    service.staff.length === 0 && (
      <Badge key="staff" tone="danger" className={styles.badge}>
        <UserX aria-hidden="true" />
        {t('services:badges.noStaff')}
      </Badge>
    ),
    service.depositPercent !== null && (
      <Badge key="deposit" tone="accent" className={styles.badge}>
        <Wallet aria-hidden="true" />
        {t('services:badges.deposit', { percent: service.depositPercent })}
      </Badge>
    ),
    service.incompatibleWith.length > 0 && (
      <Badge key="incompatible" tone="outline" className={styles.badge}>
        <Ban aria-hidden="true" />
        {t('services:badges.incompatible', { count: service.incompatibleWith.length })}
      </Badge>
    ),
  ].filter(Boolean);
  return badges.length > 0 ? <span className={styles.badges}>{badges}</span> : null;
}

function ServiceRow({
  service,
  index,
  count,
  context,
}: {
  readonly service: ServiceAdmin;
  readonly index: number;
  readonly count: number;
  readonly context: RowContext;
}) {
  const { resourceName, actions } = context;
  const { t } = useTranslation();
  const format = useFormat();
  const prices = priceSpan(service);
  const durations = durationSpan(service);
  const price = format.money(prices.min);
  const duration = format.duration(durations.min);
  const menu: MenuAction[] = [
    {
      key: 'edit',
      label: t('services:serviceMenu.edit'),
      icon: <Pencil />,
      onSelect: () => {
        actions.editService(service);
      },
    },
    {
      key: 'up',
      label: t('services:serviceMenu.moveUp'),
      icon: <ArrowUp />,
      disabled: index === 0,
      onSelect: () => {
        actions.moveService(service, index - 1);
      },
    },
    {
      key: 'down',
      label: t('services:serviceMenu.moveDown'),
      icon: <ArrowDown />,
      disabled: index === count - 1,
      onSelect: () => {
        actions.moveService(service, index + 1);
      },
    },
    service.isActive
      ? {
          key: 'deactivate',
          label: t('services:serviceMenu.deactivate'),
          icon: <PowerOff />,
          tone: 'danger',
          onSelect: () => {
            actions.setServiceActive(service, false);
          },
        }
      : {
          key: 'activate',
          label: t('services:serviceMenu.activate'),
          icon: <Power />,
          onSelect: () => {
            actions.setServiceActive(service, true);
          },
        },
  ];
  return (
    <ListItem
      title={<span className={clsx(!service.isActive && styles.muted)}>{service.name}</span>}
      description={
        <span className={styles.summary}>
          <span className={clsx(styles.facts, !service.isActive && styles.muted)}>
            {[
              varies(durations) ? t('services:from', { value: duration }) : duration,
              service.resourceTypeId ? resourceName(service.resourceTypeId) : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
          <ServiceBadges service={service} />
        </span>
      }
      meta={
        <span className={styles.meta}>
          <Performers service={service} staff={context.staff} />
          <span className={clsx(styles.price, !service.isActive && styles.muted)}>
            {varies(prices) ? t('services:from', { value: price }) : price}
          </span>
        </span>
      }
      onClick={() => {
        actions.editService(service);
      }}
      actions={
        <Menu
          label={t('services:serviceMenu.label', { name: service.name })}
          actions={menu}
          soft={false}
        />
      }
    />
  );
}

function CategorySection({
  category,
  index,
  count,
  context,
}: {
  readonly category: CategoryAdmin;
  readonly index: number;
  readonly count: number;
  readonly context: RowContext;
}) {
  const { t } = useTranslation();
  const { actions } = context;
  const headingId = `category-${category.id}`;
  return (
    <section className={styles.category} aria-labelledby={headingId}>
      <div className={styles.categoryHeader}>
        <h2 id={headingId} className={styles.categoryTitle}>
          {category.name}
          <span className={styles.categoryCount}>
            {t('services:count', { count: category.services.length })}
          </span>
        </h2>
        <Menu
          soft={false}
          label={t('services:categoryMenu.label', { name: category.name })}
          actions={[
            {
              key: 'add',
              label: t('services:categoryMenu.addService'),
              icon: <Plus />,
              onSelect: () => {
                actions.addService(category.id);
              },
            },
            {
              key: 'rename',
              label: t('services:categoryMenu.rename'),
              icon: <Pencil />,
              onSelect: () => {
                actions.renameCategory(category);
              },
            },
            {
              key: 'up',
              label: t('services:categoryMenu.moveUp'),
              icon: <ArrowUp />,
              disabled: index === 0,
              onSelect: () => {
                actions.moveCategory(category, index - 1);
              },
            },
            {
              key: 'down',
              label: t('services:categoryMenu.moveDown'),
              icon: <ArrowDown />,
              disabled: index === count - 1,
              onSelect: () => {
                actions.moveCategory(category, index + 1);
              },
            },
          ]}
        />
      </div>
      {category.services.length > 0 ? (
        <ListGroup>
          {category.services.map((service, serviceIndex) => (
            <ServiceRow
              key={service.id}
              service={service}
              index={serviceIndex}
              count={category.services.length}
              context={context}
            />
          ))}
        </ListGroup>
      ) : (
        <div className={styles.emptyCategory}>
          <p>{t('services:emptyCategory')}</p>
          <Button
            variant="secondary"
            size="sm"
            icon={<Plus />}
            onClick={() => {
              actions.addService(category.id);
            }}
          >
            {t('services:categoryMenu.addService')}
          </Button>
        </div>
      )}
    </section>
  );
}

/** Categories in their order, each with its services, prices and booking hints. */
export function CatalogList({ catalog, ...context }: CatalogListProps) {
  return (
    <div className={styles.categories}>
      {catalog.categories.map((category, index) => (
        <CategorySection
          key={category.id}
          category={category}
          index={index}
          count={catalog.categories.length}
          context={context}
        />
      ))}
    </div>
  );
}
