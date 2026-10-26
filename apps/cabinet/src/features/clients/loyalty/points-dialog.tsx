import { Button, Dialog, NumberField, SegmentedControl, TextField, useToast } from '@slotwise/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdjustClientPoints } from '../../../platform/api/clients-queries';
import { errorMessage } from '../../common/error-message';
import { FormFailure } from '../form-failure';
import { useLedgerFormat } from './ledger-list';
import styles from './loyalty.module.css';

/** Ways points change by hand; the sign of the amount follows the direction. */
const pointsDirections = {
  credit: { sign: 1 },
  debit: { sign: -1 },
} as const;
type PointsDirection = keyof typeof pointsDirections;
const directionIds = Object.keys(pointsDirections) as PointsDirection[];

export interface PointsDialogProps {
  readonly businessId: string;
  readonly clientId: string;
  readonly balance: number;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

/**
 * Points added or taken by hand, always with a reason that stays in the history. A
 * retry of the same change reuses its idempotency key, so it never applies twice.
 */
export function PointsDialog({
  businessId,
  clientId,
  balance,
  open,
  onOpenChange,
}: PointsDialogProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const ledger = useLedgerFormat();
  const [direction, setDirection] = useState<PointsDirection>('credit');
  const [amount, setAmount] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const adjust = useAdjustClientPoints(businessId, clientId);

  const change = <T,>(set: (value: T) => void) => {
    return (value: T) => {
      set(value);
      setIdempotencyKey(crypto.randomUUID());
      adjust.reset();
    };
  };
  const points = amount !== null && Number.isInteger(amount) && amount > 0 ? amount : null;
  const signed = points === null ? 0 : points * pointsDirections[direction].sign;
  const after = balance + signed;
  const amountError =
    points === null
      ? t('clients:points.amountRequired')
      : after < 0
        ? t('clients:points.notEnough', { balance: ledger.points(balance) })
        : null;
  const noteError = note.trim() ? null : t('clients:points.noteRequired');

  const submit = () => {
    setSubmitted(true);
    if (amountError || noteError || points === null) {
      return;
    }
    adjust.mutate(
      { amount: signed, note: note.trim(), idempotencyKey },
      {
        onSuccess: () => {
          toast.show({
            title: t(`clients:points.done.${direction}`, { value: ledger.points(points) }),
          });
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('clients:points.title')}
      description={t('clients:points.description', { balance: ledger.points(balance) })}
      closeLabel={t('common:actions.close')}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            {t('common:actions.cancel')}
          </Button>
          <Button loading={adjust.isPending} onClick={submit}>
            {points === null
              ? t(`clients:points.directions.${direction}`)
              : t(`clients:points.submit.${direction}`, { value: ledger.points(points) })}
          </Button>
        </>
      }
    >
      <form
        className={styles.form}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <SegmentedControl<PointsDirection>
          label={t('clients:points.direction')}
          value={direction}
          block
          segments={directionIds.map((id) => ({
            value: id,
            label: t(`clients:points.directions.${id}`),
          }))}
          onChange={change(setDirection)}
        />
        <NumberField
          label={t('clients:points.amount')}
          value={amount}
          min={1}
          onChange={change(setAmount)}
          description={
            points === null ? null : t('clients:points.after', { balance: ledger.points(after) })
          }
          error={submitted ? amountError : null}
        />
        <TextField
          label={t('clients:points.note')}
          placeholder={t('clients:points.notePlaceholder')}
          value={note}
          onChange={(event) => {
            change(setNote)(event.target.value);
          }}
          error={submitted ? noteError : null}
        />
        {adjust.isError ? <FormFailure>{errorMessage(t, adjust.error)}</FormFailure> : null}
      </form>
    </Dialog>
  );
}
