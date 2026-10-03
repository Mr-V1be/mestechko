import { useFormat } from '@mestechko/booking-ui';
import type { CategoryAdmin, PassPlan } from '@mestechko/contracts/client';
import type { CurrencyCode } from '@mestechko/domain';
import {
  Button,
  ConfirmDialog,
  ListGroup,
  ListItem,
  NumberField,
  Sheet,
  Skeleton,
  Switch,
  TextField,
  useToast,
} from '@mestechko/ui';
import { CircleAlert, Lock } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCreatePassPlan, useUpdatePassPlan } from '../../platform/api/loyalty-queries';
import { ServiceChecklist } from '../catalog/service-checklist';
import { errorMessage } from '../common/error-message';
import { problemText, revealFirstProblem } from '../common/field-checks';
import { minorDigits, toMinor } from '../common/money';
import { loyaltyLimits } from './limits';
import {
  newPlanDraft,
  planBodyFromDraft,
  planDraftOf,
  planProblemsOf,
  samePlanDraft,
  type PlanDraft,
} from './plan-draft';
import styles from './loyalty.module.css';

/** One opening of the editor: a plan to change, or `null` for a new one. */
export interface PlanEditorSession {
  readonly id: number;
  readonly plan: PassPlan | null;
  readonly open: boolean;
}

/** The catalog's services to choose from, or why they are not there. */
export type PlanServicesSource =
  | { readonly state: 'ready'; readonly categories: readonly CategoryAdmin[] }
  | { readonly state: 'loading' }
  | { readonly state: 'failed'; readonly error: unknown; readonly retry: () => void }
  | { readonly state: 'forbidden' };

export interface PlanEditorProps {
  readonly businessId: string;
  readonly session: PlanEditorSession;
  readonly services: PlanServicesSource;
  readonly currency: CurrencyCode;
  readonly onClose: () => void;
}

function PlanServices({
  source,
  draft,
  initial,
  onChange,
  error,
}: {
  readonly source: PlanServicesSource;
  readonly draft: PlanDraft;
  readonly initial: PlanDraft;
  readonly onChange: (serviceIds: string[]) => void;
  readonly error: string | null;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  if (source.state === 'forbidden') {
    return (
      <ListGroup>
        <ListItem
          leading={<Lock aria-hidden="true" />}
          title={t('access.title')}
          description={t('access.description')}
        />
      </ListGroup>
    );
  }
  if (source.state === 'failed') {
    return (
      <ListGroup>
        <ListItem
          leading={<CircleAlert aria-hidden="true" />}
          title={t('common:states.errorTitle')}
          description={errorMessage(t, source.error)}
          trailing={
            <Button variant="secondary" size="sm" onClick={source.retry}>
              {t('common:actions.retry')}
            </Button>
          }
        />
      </ListGroup>
    );
  }
  if (source.state === 'loading') {
    return (
      <ListGroup>
        {Array.from({ length: 4 }, (_, index) => (
          <ListItem key={index} title={<Skeleton shape="text" width="55%" />} />
        ))}
      </ListGroup>
    );
  }
  // Services off booking are offered only while the plan still covers them.
  const categories = source.categories.map((category) => ({
    ...category,
    services: category.services.filter(
      (service) => service.isActive || initial.serviceIds.includes(service.id),
    ),
  }));
  if (!categories.some((category) => category.services.length > 0)) {
    return (
      <ListGroup>
        <ListItem title={t('loyalty:editor.noServices')} />
      </ListGroup>
    );
  }
  return (
    <>
      {error ? (
        <p className={styles.fieldError} role="alert">
          {error}
        </p>
      ) : null}
      <ServiceChecklist
        categories={categories}
        selected={draft.serviceIds}
        onChange={onChange}
        describe={(service) =>
          service.isActive
            ? format.money(service.price)
            : `${format.money(service.price)} · ${t('loyalty:editor.serviceOff')}`
        }
      />
    </>
  );
}

/** Create a pass offer or change one; sold passes keep the terms they were sold with. */
export function PlanEditorSheet(props: PlanEditorProps) {
  return <PlanEditor key={props.session.id} {...props} />;
}

function PlanEditor({ businessId, session, services, currency, onClose }: PlanEditorProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const toast = useToast();
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const create = useCreatePassPlan(businessId);
  const update = useUpdatePassPlan(businessId);
  const { plan } = session;
  const [initial] = useState(() => (plan ? planDraftOf(plan) : newPlanDraft()));
  const [draft, setDraft] = useState(initial);
  const [checked, setChecked] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const problems = planProblemsOf(draft);
  const shown = (key: keyof typeof problems) => (checked ? problemText(t, problems[key]) : null);
  const pending = create.isPending || update.isPending;
  const dirty = !samePlanDraft(draft, initial);
  const edit = (patch: Partial<PlanDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };
  const perVisit =
    draft.price !== null && draft.visits !== null && draft.visits > 0
      ? format.money({
          amountMinor: Math.round(toMinor(draft.price, currency) / draft.visits),
          currency,
        })
      : null;

  const requestClose = () => {
    if (dirty && !pending) {
      setDiscarding(true);
    } else {
      onClose();
    }
  };
  const fail = (error: unknown) => {
    toast.show({
      tone: 'error',
      title: t('loyalty:editor.failed'),
      description: errorMessage(t, error),
    });
  };
  const submit = () => {
    setChecked(true);
    if (Object.values(problems).some(Boolean)) {
      revealFirstProblem(formRef.current);
      return;
    }
    const body = planBodyFromDraft(draft, currency);
    if (plan) {
      update.mutate(
        { plan, body },
        {
          onSuccess: (saved) => {
            toast.show({ title: t('loyalty:editor.saved', { name: saved.name }) });
            onClose();
          },
          onError: fail,
        },
      );
    } else {
      create.mutate(body, {
        onSuccess: (saved) => {
          toast.show({ title: t('loyalty:editor.created', { name: saved.name }) });
          onClose();
        },
        onError: fail,
      });
    }
  };

  return (
    <Sheet
      open={session.open}
      onOpenChange={(open) => {
        if (!open) {
          requestClose();
        }
      }}
      title={plan?.name ?? t('loyalty:editor.newTitle')}
      description={
        plan && plan.sold > 0 ? t('loyalty:editor.soldNote', { count: plan.sold }) : undefined
      }
      closeLabel={t('common:actions.close')}
      footer={
        <>
          <Button variant="secondary" block onClick={requestClose}>
            {t('common:actions.cancel')}
          </Button>
          <Button type="submit" form={formId} block loading={pending}>
            {t(plan ? 'loyalty:editor.save' : 'loyalty:editor.create')}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        ref={formRef}
        noValidate
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <TextField
          label={t('loyalty:editor.name')}
          placeholder={t('loyalty:editor.namePlaceholder')}
          value={draft.name}
          maxLength={loyaltyLimits.nameMax}
          error={shown('name')}
          onChange={(event) => {
            edit({ name: event.currentTarget.value });
          }}
        />
        <div className={styles.pair}>
          <NumberField
            label={t('loyalty:editor.visits')}
            value={draft.visits}
            min={loyaltyLimits.visitsMin}
            max={loyaltyLimits.visitsMax}
            error={shown('visits')}
            onChange={(visits) => {
              edit({ visits });
            }}
          />
          <NumberField
            label={t('loyalty:editor.validity')}
            value={draft.validityDays}
            min={loyaltyLimits.validityMin}
            max={loyaltyLimits.validityMax}
            error={shown('validityDays')}
            onChange={(validityDays) => {
              edit({ validityDays });
            }}
          />
        </div>
        <NumberField
          className={styles.half}
          label={t('loyalty:editor.price')}
          value={draft.price}
          min={0}
          suffix={format.currencySymbol(currency)}
          fractionDigits={minorDigits(currency)}
          description={perVisit ? t('loyalty:editor.perVisit', { price: perVisit }) : undefined}
          error={shown('price')}
          onChange={(price) => {
            edit({ price });
          }}
        />
        <div className={styles.status}>
          <Switch
            checked={draft.isActive}
            label={t('loyalty:editor.active')}
            description={t(draft.isActive ? 'loyalty:editor.activeOn' : 'loyalty:editor.activeOff')}
            onCheckedChange={(isActive) => {
              edit({ isActive });
            }}
          />
        </div>
        <section className={styles.services} aria-labelledby={`${formId}-services`}>
          <h3 id={`${formId}-services`} className={styles.sectionTitle}>
            {t('loyalty:editor.services')}
          </h3>
          <PlanServices
            source={services}
            draft={draft}
            initial={initial}
            error={shown('serviceIds')}
            onChange={(serviceIds) => {
              edit({ serviceIds });
            }}
          />
        </section>
      </form>
      <ConfirmDialog
        open={discarding}
        onOpenChange={setDiscarding}
        title={t('loyalty:editor.discard.title')}
        consequence={
          plan
            ? t('loyalty:editor.discard.consequence', { name: plan.name })
            : t('loyalty:editor.discard.consequenceNew')
        }
        confirmLabel={t('loyalty:editor.discard.confirm')}
        cancelLabel={t('loyalty:editor.discard.keep')}
        closeLabel={t('common:actions.close')}
        tone="danger"
        onConfirm={() => {
          setDiscarding(false);
          onClose();
        }}
      />
    </Sheet>
  );
}
