import { useFormat } from '@mestechko/booking-ui';
import type { CabinetBookingDetails } from '@mestechko/contracts/client';
import { MINOR_PER_POINT, settleVisit } from '@mestechko/domain';
import { Button, Dialog, NumberField, Select, Skeleton, Switch, useToast } from '@mestechko/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCompleteVisit, useSettlementOptions } from '../../platform/api/desk-queries';
import { errorMessage } from '../common/error-message';
import { QueryErrorState } from '../common/states';
import styles from './desk.module.css';

const NO_PASS = 'none';

export interface CompleteVisitDialogProps {
  readonly businessId: string;
  readonly booking: CabinetBookingDetails;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

/**
 * Closing a visit: paid with a pass, or with points and money; the summary is the
 * same settlement the server applies, so what the desk sees is what is recorded.
 */
export function CompleteVisitDialog({
  businessId,
  booking,
  open,
  onOpenChange,
}: CompleteVisitDialogProps) {
  const { t } = useTranslation('desk');
  const format = useFormat();
  const toast = useToast();
  const options = useSettlementOptions(businessId, open ? booking.id : null);
  const complete = useCompleteVisit(businessId);
  const [passId, setPassId] = useState(NO_PASS);
  const [usePoints, setUsePoints] = useState(false);
  const [points, setPoints] = useState<number | null>(null);
  const data = options.data;
  const money = (amountMinor: number) =>
    format.money({ amountMinor, currency: booking.total.currency });
  const settlement = data
    ? settleVisit({
        totalMinor: data.total.amountMinor,
        prepaidMinor: data.prepaid.amountMinor,
        passId: passId === NO_PASS ? null : passId,
        pointsRequested: usePoints ? (points ?? data.pointsRedeemable) : 0,
        pointsBalance: data.pointsBalance,
        loyalty: data.loyalty,
      })
    : null;
  const earned =
    settlement?.entries.find((entry) => entry.reason === 'points_accrual')?.amount ?? 0;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('complete.title')}
      description={booking.client.displayName}
      closeLabel={t('common:actions.close')}
      footer={
        <Button
          block
          loading={complete.isPending}
          disabled={!settlement}
          onClick={() => {
            complete.mutate(
              {
                booking,
                passId: passId === NO_PASS ? null : passId,
                points: settlement?.pointsRedeemed ?? 0,
              },
              {
                onSuccess: () => {
                  toast.show({ title: t('complete.done') });
                  onOpenChange(false);
                },
                onError: (error) => {
                  toast.show({ title: errorMessage(t, error), tone: 'error' });
                },
              },
            );
          }}
        >
          {t('complete.confirm')}
        </Button>
      }
    >
      {options.isPending ? <Skeleton height="var(--size-illustration-sm)" /> : null}
      {options.isError ? (
        <QueryErrorState error={options.error} onRetry={() => void options.refetch()} />
      ) : null}
      {data && settlement ? (
        <div className={styles.form}>
          {data.passes.length > 0 ? (
            <Select
              label={t('complete.pass')}
              value={passId}
              options={[
                { value: NO_PASS, label: t('complete.noPass') },
                ...data.passes.map((pass) => ({
                  value: pass.id,
                  label: t('complete.passOption', { name: pass.name, left: pass.visitsLeft }),
                })),
              ]}
              onChange={setPassId}
            />
          ) : null}
          {passId === NO_PASS && data.pointsRedeemable > 0 ? (
            <>
              <Switch
                checked={usePoints}
                onCheckedChange={setUsePoints}
                label={t('complete.points')}
                description={t('complete.pointsBalance', {
                  count: data.pointsBalance,
                  points: format.number(data.pointsBalance),
                  max: format.number(data.pointsRedeemable),
                })}
              />
              {usePoints ? (
                <NumberField
                  label={t('complete.pointsAmount')}
                  value={points ?? data.pointsRedeemable}
                  min={1}
                  max={data.pointsRedeemable}
                  onChange={setPoints}
                />
              ) : null}
            </>
          ) : null}
          <div className={styles.summary}>
            <div className={styles.summaryRow}>
              <span>{t('complete.total')}</span>
              <span className={styles.summaryValue}>{money(data.total.amountMinor)}</span>
            </div>
            {passId !== NO_PASS ? (
              <div className={styles.summaryRow}>
                <span>{t('complete.passCovers')}</span>
              </div>
            ) : null}
            {passId === NO_PASS && data.prepaid.amountMinor > 0 ? (
              <div className={styles.summaryRow}>
                <span>{t('complete.prepaid')}</span>
                <span className={styles.summaryValue}>
                  −{money(Math.min(data.prepaid.amountMinor, data.total.amountMinor))}
                </span>
              </div>
            ) : null}
            {settlement.pointsRedeemed > 0 ? (
              <div className={styles.summaryRow}>
                <span>{t('complete.points')}</span>
                <span className={styles.summaryValue}>
                  −{money(settlement.pointsRedeemed * MINOR_PER_POINT)}
                </span>
              </div>
            ) : null}
            <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
              <span>{t('complete.due')}</span>
              <span className={styles.summaryValue}>{money(settlement.dueMinor)}</span>
            </div>
            {earned > 0 ? (
              <span className={styles.hint}>
                {t('complete.earned', { count: earned, points: format.number(earned) })}
              </span>
            ) : null}
            {settlement.prepaymentRefundMinor > 0 ? (
              <span className={styles.hint}>
                {t('complete.refund', { amount: money(settlement.prepaymentRefundMinor) })}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
