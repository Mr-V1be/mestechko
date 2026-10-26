import { useFormat } from '@slotwise/booking-ui';
import type { PassPlan } from '@slotwise/contracts/client';
import { Badge, ListGroup, ListItem, Menu } from '@slotwise/ui';
import { clsx } from 'clsx';
import { CircleOff, Pencil, PowerOff, Power, ShoppingBag } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import styles from './loyalty.module.css';

export interface PlanListProps {
  readonly plans: readonly PassPlan[];
  /** Names of services by id, or `null` while the catalog is not at hand. */
  readonly serviceNames: ReadonlyMap<string, string> | null;
  readonly onEdit: (plan: PassPlan) => void;
  readonly onSetActive: (plan: PassPlan, isActive: boolean) => void;
}

/** Passes on offer: what they include, their price and how many were sold. */
export function PlanList({ plans, serviceNames, onEdit, onSetActive }: PlanListProps) {
  const { t } = useTranslation();
  const format = useFormat();
  return (
    <ListGroup>
      {plans.map((plan) => {
        const names = serviceNames
          ? plan.serviceIds.flatMap((id) => serviceNames.get(id) ?? [])
          : [];
        return (
          <ListItem
            key={plan.id}
            title={<span className={clsx(!plan.isActive && styles.muted)}>{plan.name}</span>}
            description={
              <span className={styles.planSummary}>
                <span className={clsx(styles.facts, !plan.isActive && styles.muted)}>
                  {t('loyalty:plans.visits', { count: plan.visits })} ·{' '}
                  {t('loyalty:plans.days', { count: plan.validityDays })}
                </span>
                <span className={styles.planServices}>
                  {names.length > 0
                    ? names.join(', ')
                    : t('loyalty:plans.services', { count: plan.serviceIds.length })}
                </span>
                <span className={styles.badges}>
                  {plan.isActive ? null : (
                    <Badge tone="neutral" className={styles.badge}>
                      <CircleOff aria-hidden="true" />
                      {t('loyalty:plans.inactive')}
                    </Badge>
                  )}
                  <Badge tone="outline" className={styles.badge}>
                    <ShoppingBag aria-hidden="true" />
                    {t('loyalty:plans.sold', { count: plan.sold })}
                  </Badge>
                </span>
              </span>
            }
            meta={
              <span className={clsx(!plan.isActive && styles.muted)}>
                {format.money(plan.price)}
              </span>
            }
            onClick={() => {
              onEdit(plan);
            }}
            actions={
              <Menu
                soft={false}
                label={t('loyalty:plans.menu.label', { name: plan.name })}
                actions={[
                  {
                    key: 'edit',
                    label: t('loyalty:plans.menu.edit'),
                    icon: <Pencil />,
                    onSelect: () => {
                      onEdit(plan);
                    },
                  },
                  plan.isActive
                    ? {
                        key: 'stop',
                        label: t('loyalty:plans.menu.stop'),
                        icon: <PowerOff />,
                        tone: 'danger',
                        onSelect: () => {
                          onSetActive(plan, false);
                        },
                      }
                    : {
                        key: 'resume',
                        label: t('loyalty:plans.menu.resume'),
                        icon: <Power />,
                        onSelect: () => {
                          onSetActive(plan, true);
                        },
                      },
                ]}
              />
            }
          />
        );
      })}
    </ListGroup>
  );
}
