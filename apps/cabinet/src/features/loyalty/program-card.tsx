import { useFormat } from '@slotwise/booking-ui';
import type { LoyaltyProgram } from '@slotwise/contracts/client';
import {
  MINOR_PER_POINT,
  pointsEarned,
  pointsRedeemable,
  type CurrencyCode,
  type LoyaltyKind,
} from '@slotwise/domain';
import { Button, ConfirmDialog, NumberField, Select, Switch, useToast } from '@slotwise/ui';
import { Coins, ReceiptText, Wallet } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUpdateLoyaltyProgram } from '../../platform/api/loyalty-queries';
import { errorMessage } from '../common/error-message';
import { checkNumber, problemText, type FieldProblem } from '../common/field-checks';
import { toMinor } from '../common/money';
import { EXAMPLE_VISIT_MAJOR, loyaltyLimits } from './limits';
import { loyaltyKindViews, NO_PROGRAM, programKinds, type ProgramSetting } from './loyalty-kinds';
import styles from './loyalty.module.css';

/** The program as it is being edited; a cleared field is `null`. */
type ProgramDraft = { readonly kind: LoyaltyKind } & Readonly<
  Record<ProgramSetting, number | null>
>;

function sameProgram(draft: ProgramDraft, program: LoyaltyProgram): boolean {
  return (
    draft.kind === program.kind &&
    draft.accrualPercent === program.accrualPercent &&
    draft.maxRedeemPercent === program.maxRedeemPercent
  );
}

function programOf(draft: ProgramDraft): LoyaltyProgram {
  return {
    kind: draft.kind,
    accrualPercent: draft.accrualPercent ?? 0,
    maxRedeemPercent: draft.maxRedeemPercent ?? 0,
  };
}

/** What the program gives on one visit, worked out by the domain's own rules. */
function ProgramExample({
  program,
  currency,
}: {
  readonly program: LoyaltyProgram;
  readonly currency: CurrencyCode;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const visitMinor = toMinor(EXAMPLE_VISIT_MAJOR, currency);
  const earned = pointsEarned(program, visitMinor);
  const redeemable = pointsRedeemable(program, visitMinor, Number.MAX_SAFE_INTEGER);
  return (
    <div className={styles.example}>
      <p className={styles.exampleTitle}>
        <ReceiptText aria-hidden="true" />
        {t('loyalty:program.example', {
          price: format.money({ amountMinor: visitMinor, currency }),
        })}
      </p>
      <dl className={styles.outcomes} aria-live="polite">
        <div className={styles.outcome}>
          <dt>
            <Coins aria-hidden="true" />
            {t('loyalty:outcomes.earned')}
          </dt>
          <dd>{t('loyalty:outcomes.earnedValue', { count: earned })}</dd>
        </div>
        <div className={styles.outcome}>
          <dt>
            <Wallet aria-hidden="true" />
            {t('loyalty:outcomes.redeemable')}
          </dt>
          <dd>
            {t('loyalty:outcomes.redeemableValue', {
              amount: format.money({ amountMinor: redeemable * MINOR_PER_POINT, currency }),
            })}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export interface ProgramCardProps {
  readonly businessId: string;
  readonly program: LoyaltyProgram;
  readonly currency: CurrencyCode;
}

/** The loyalty program: on or off, its percentages and what they mean for a visit. */
export function ProgramCard({ businessId, program, currency }: ProgramCardProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const toast = useToast();
  const save = useUpdateLoyaltyProgram(businessId);
  // `null` while nothing is edited: the card follows the saved program.
  const [draft, setDraft] = useState<ProgramDraft | null>(null);
  const [checked, setChecked] = useState(false);
  const [confirmingOff, setConfirmingOff] = useState(false);
  const shown: ProgramDraft = draft ?? program;
  const dirty = draft !== null && !sameProgram(draft, program);
  const on = shown.kind !== NO_PROGRAM;
  const view = loyaltyKindViews[shown.kind];
  const problems: Partial<Record<ProgramSetting, FieldProblem | null>> = Object.fromEntries(
    view.settings.map((setting) => [
      setting,
      checkNumber(shown[setting], { required: true, min: 0, max: loyaltyLimits.percentMax }),
    ]),
  );

  const edit = (patch: Partial<ProgramDraft>) => {
    setDraft({ ...shown, ...patch });
  };
  const switchProgram = (next: boolean) => {
    if (!next) {
      edit({ kind: NO_PROGRAM });
      return;
    }
    const kind = program.kind === NO_PROGRAM ? programKinds[0] : program.kind;
    if (!kind) {
      return;
    }
    const neverSet = !shown.accrualPercent && !shown.maxRedeemPercent;
    edit({ kind, ...(neverSet ? loyaltyKindViews[kind].suggested : {}) });
  };
  const persist = (typed: ProgramDraft) => {
    const next = programOf(typed);
    setDraft(null);
    setChecked(false);
    save.mutate(next, {
      onSuccess: () => {
        toast.show({
          title: t(
            next.kind === NO_PROGRAM ? 'loyalty:program.turnedOff' : 'loyalty:program.saved',
          ),
        });
      },
      onError: (error) => {
        setDraft(typed);
        toast.show({
          tone: 'error',
          title: t('loyalty:program.failed'),
          description: errorMessage(t, error),
        });
      },
    });
  };
  const submit = () => {
    setChecked(true);
    if (!draft || Object.values(problems).some(Boolean)) {
      return;
    }
    if (draft.kind === NO_PROGRAM && program.kind !== NO_PROGRAM) {
      setConfirmingOff(true);
      return;
    }
    persist(draft);
  };

  return (
    <section className={styles.column} aria-labelledby="loyalty-program">
      <div className={styles.columnHeader}>
        <h2 id="loyalty-program" className={styles.columnTitle}>
          {t('loyalty:program.title')}
        </h2>
      </div>
      <div className={styles.card}>
        <Switch
          checked={on}
          label={t(`loyalty:kinds.${on ? shown.kind : (programKinds[0] ?? shown.kind)}.title`)}
          description={
            on
              ? t(`loyalty:kinds.${shown.kind}.rule`, {
                  value: format.money({ amountMinor: MINOR_PER_POINT, currency }),
                })
              : t('loyalty:program.off')
          }
          onCheckedChange={switchProgram}
        />
        {on && programKinds.length > 1 ? (
          <Select
            label={t('loyalty:program.kind')}
            value={shown.kind}
            options={programKinds.map((kind) => ({
              value: kind,
              label: t(`loyalty:kinds.${kind}.title`),
            }))}
            onChange={(kind) => {
              edit({ kind });
            }}
          />
        ) : null}
        {on ? (
          <>
            <div className={styles.settings}>
              {view.settings.map((setting) => (
                <NumberField
                  key={setting}
                  label={t(`loyalty:settings.${setting}`)}
                  value={shown[setting]}
                  min={0}
                  max={loyaltyLimits.percentMax}
                  suffix={t('loyalty:settings.percent')}
                  error={checked ? problemText(t, problems[setting]) : null}
                  onChange={(value) => {
                    edit({ [setting]: value });
                  }}
                />
              ))}
            </div>
            <ProgramExample program={programOf(shown)} currency={currency} />
          </>
        ) : null}
        {dirty ? (
          <div className={styles.cardActions}>
            <Button
              variant="secondary"
              onClick={() => {
                setDraft(null);
                setChecked(false);
              }}
            >
              {t('loyalty:program.reset')}
            </Button>
            <Button loading={save.isPending} onClick={submit}>
              {t('loyalty:program.save')}
            </Button>
          </div>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirmingOff}
        onOpenChange={setConfirmingOff}
        title={t('loyalty:program.turnOff.title')}
        consequence={t('loyalty:program.turnOff.consequence')}
        confirmLabel={t('loyalty:program.turnOff.confirm')}
        cancelLabel={t('common:actions.cancel')}
        closeLabel={t('common:actions.close')}
        tone="danger"
        onConfirm={() => {
          setConfirmingOff(false);
          if (draft) {
            persist(draft);
          }
        }}
      />
    </section>
  );
}
