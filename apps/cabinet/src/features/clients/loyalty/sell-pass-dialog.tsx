import { useFormat } from '@slotwise/booking-ui';
import type { PassPlan } from '@slotwise/contracts/client';
import { passValidUntil, Temporal } from '@slotwise/domain';
import {
  Button,
  Dialog,
  EmptyIllustration,
  Select,
  Skeleton,
  StatePanel,
  useToast,
} from '@slotwise/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { usePassPlans, useSellClientPass } from '../../../platform/api/clients-queries';
import { errorMessage } from '../../common/error-message';
import { FormFailure } from '../form-failure';
import { QueryErrorState } from '../../common/states';
import { useClientDates } from '../client-dates';
import styles from './loyalty.module.css';

export interface SellPassDialogProps {
  readonly businessId: string;
  readonly clientId: string;
  readonly timeZone: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

/** The last day of a pass sold today, by the same rule the API applies. */
function validUntilOf(plan: PassPlan, today: string): string {
  return passValidUntil(
    {
      visits: plan.visits,
      validityDays: plan.validityDays,
      priceMinor: plan.price.amountMinor,
      serviceIds: plan.serviceIds,
    },
    Temporal.PlainDate.from(today),
  ).toString();
}

/**
 * A pass from the ones on sale, paid at the front desk. The price is on the button;
 * a retry of the same sale reuses its idempotency key, so it never charges twice.
 */
export function SellPassDialog({
  businessId,
  clientId,
  timeZone,
  open,
  onOpenChange,
}: SellPassDialogProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const format = useFormat();
  const dates = useClientDates(timeZone);
  const plans = usePassPlans(businessId, open);
  const [planId, setPlanId] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const sell = useSellClientPass(businessId, clientId);
  const onSale = plans.data ?? [];
  const plan = onSale.find((candidate) => candidate.id === planId) ?? onSale[0];

  const close = () => {
    onOpenChange(false);
  };
  const submit = () => {
    if (!plan) {
      return;
    }
    sell.mutate(
      { planId: plan.id, idempotencyKey },
      {
        onSuccess: () => {
          toast.show({ title: t('clients:sellPass.sold', { name: plan.name }) });
          close();
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('clients:sellPass.title')}
      description={plan ? t('clients:sellPass.description') : undefined}
      closeLabel={t('common:actions.close')}
      footer={
        plan ? (
          <>
            <Button variant="secondary" onClick={close}>
              {t('common:actions.cancel')}
            </Button>
            <Button loading={sell.isPending} onClick={submit}>
              {t('clients:sellPass.submit', { price: format.money(plan.price) })}
            </Button>
          </>
        ) : undefined
      }
    >
      {plans.isPending ? (
        <div className={styles.form} aria-busy="true">
          <Skeleton height="var(--size-control-md)" />
          <Skeleton height="calc(var(--size-control-lg) * 3)" />
        </div>
      ) : null}
      {plans.isError ? (
        <QueryErrorState error={plans.error} onRetry={() => void plans.refetch()} />
      ) : null}
      {plans.data && !plan ? (
        <StatePanel
          compact
          illustration={<EmptyIllustration />}
          title={t('clients:sellPass.noPlansTitle')}
          description={t('clients:sellPass.noPlansDescription')}
          action={
            <Link className={styles.link} to={`/b/${businessId}/loyalty`}>
              {t('clients:sellPass.openLoyalty')}
            </Link>
          }
        />
      ) : null}
      {plan ? (
        <div className={styles.form}>
          <Select
            label={t('clients:sellPass.plan')}
            value={plan.id}
            options={onSale.map((candidate) => ({
              value: candidate.id,
              label: t('clients:sellPass.planOption', {
                name: candidate.name,
                price: format.money(candidate.price),
              }),
            }))}
            onChange={(id) => {
              setPlanId(id);
              setIdempotencyKey(crypto.randomUUID());
              sell.reset();
            }}
          />
          <dl className={styles.terms}>
            <div className={styles.term}>
              <dt>{t('clients:sellPass.visits')}</dt>
              <dd>{plan.visits}</dd>
            </div>
            <div className={styles.term}>
              <dt>{t('clients:sellPass.validityLabel')}</dt>
              <dd>
                {t('clients:sellPass.validity', {
                  count: plan.validityDays,
                  date: dates.date(validUntilOf(plan, dates.today)),
                })}
              </dd>
            </div>
            <div className={styles.term}>
              <dt>{t('clients:sellPass.price')}</dt>
              <dd>{format.money(plan.price)}</dd>
            </div>
          </dl>
          {sell.isError ? <FormFailure>{errorMessage(t, sell.error)}</FormFailure> : null}
        </div>
      ) : null}
    </Dialog>
  );
}
