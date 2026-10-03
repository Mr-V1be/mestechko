import type { BusinessSettings } from '@mestechko/contracts/client';
import { Button, ConfirmDialog, TextField, useToast } from '@mestechko/ui';
import { Store, type LucideIcon } from 'lucide-react';
import { useId, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useUpdateBusinessSettings } from '../../platform/api/settings-queries';
import { errorMessage } from '../common/error-message';
import { RuleFieldControl } from './rule-field';
import { isNumberRule, ruleSections, type RuleKey } from './rule-fields';
import {
  changedFields,
  changeOf,
  draftOf,
  problemsOf,
  validateDraft,
  type FieldProblems,
  type RulesDraft,
  type TypedFieldKey,
} from './settings-draft';
import { useLeaveGuard } from './use-leave-guard';
import styles from './settings.module.css';

interface SubmitFeedback {
  readonly fields: FieldProblems;
  readonly general: string | null;
}

const noFeedback: SubmitFeedback = { fields: new Map(), general: null };

function SettingsSection({
  title,
  icon: Icon,
  children,
}: {
  readonly title: string;
  readonly icon: LucideIcon;
  readonly children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.sectionTitle}>
        <Icon aria-hidden="true" />
        {title}
      </h2>
      <div className={styles.sectionFields}>{children}</div>
    </section>
  );
}

/**
 * The business's name and booking rules. What is typed stays until it is saved or
 * discarded, also when saving fails; leaving with changes asks first.
 */
export function SettingsForm({
  businessId,
  settings,
  staffAny,
}: {
  readonly businessId: string;
  readonly settings: BusinessSettings;
  readonly staffAny: string;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const update = useUpdateBusinessSettings(businessId);
  const form = useRef<HTMLFormElement>(null);
  const [draft, setDraft] = useState(() => draftOf(settings));
  const [touched, setTouched] = useState<ReadonlySet<TypedFieldKey>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState<SubmitFeedback>(noFeedback);

  const changed = changedFields(draft, settings);
  const dirty = changed.length > 0;
  const local = validateDraft(draft);
  const blocker = useLeaveGuard(dirty);
  const problemOf = (key: TypedFieldKey) =>
    feedback.fields.get(key) ?? (submitted || touched.has(key) ? local.get(key) : undefined);

  /** A field the API refused is judged afresh once it changes. */
  const forget = (key: TypedFieldKey) => {
    if (feedback.fields.has(key)) {
      const fields = new Map(feedback.fields);
      fields.delete(key);
      setFeedback({ fields, general: feedback.general });
    }
  };
  const touch = (key: TypedFieldKey) => {
    if (!touched.has(key)) {
      setTouched(new Set([...touched, key]));
    }
  };
  const setRule = <K extends RuleKey>(key: K, value: RulesDraft[K]) => {
    setDraft((current) => ({ ...current, rules: { ...current.rules, [key]: value } }));
    if (isNumberRule(key)) {
      forget(key);
    }
  };
  const restart = (next: BusinessSettings) => {
    setDraft(draftOf(next));
    setTouched(new Set());
    setSubmitted(false);
    setFeedback(noFeedback);
  };
  const save = () => {
    setSubmitted(true);
    const change = changeOf(draft);
    if (!change) {
      // The first field to fix comes into the middle of the screen, clear of the save bar.
      requestAnimationFrame(() => {
        const invalid = form.current?.querySelector<HTMLElement>('input[data-invalid]');
        invalid?.focus({ preventScroll: true });
        invalid?.scrollIntoView({ block: 'center' });
      });
      return;
    }
    update.mutate(change, {
      onSuccess: (next) => {
        restart(next);
        toast.show({ title: t('settings:saved') });
      },
      onError: (error) => {
        const problems = problemsOf(error, draft);
        setFeedback({
          fields: problems.fields,
          general: problems.general ? errorMessage(t, error) : null,
        });
        if (problems.general) {
          toast.show({ title: t('settings:notSaved'), tone: 'error' });
        }
      },
    });
  };

  const nameProblem = problemOf('name');
  return (
    <form
      ref={form}
      className={styles.form}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <SettingsSection title={t('settings:sections.name')} icon={Store}>
        <div
          className={styles.rule}
          onBlur={() => {
            touch('name');
          }}
        >
          <TextField
            label={t('settings:name.label')}
            value={draft.name}
            autoComplete="organization"
            error={
              nameProblem
                ? t(
                    nameProblem.kind === 'rejected'
                      ? 'settings:errors.nameRejected'
                      : 'settings:errors.nameRequired',
                  )
                : null
            }
            onChange={(event) => {
              const name = event.target.value;
              setDraft((current) => ({ ...current, name }));
              forget('name');
            }}
          />
        </div>
      </SettingsSection>
      {ruleSections.map((section) => (
        <SettingsSection
          key={section.id}
          title={t(`settings:sections.${section.id}`)}
          icon={section.icon}
        >
          {section.fields.map((field) => (
            <RuleFieldControl
              key={field.key}
              field={field}
              rules={draft.rules}
              defaults={settings.defaults}
              problem={field.kind === 'number' ? problemOf(field.key) : undefined}
              staffAny={staffAny}
              onChange={setRule}
              onTouched={() => {
                if (field.kind === 'number') {
                  touch(field.key);
                }
              }}
            />
          ))}
        </SettingsSection>
      ))}
      <div className={styles.saveBar}>
        {feedback.general ? (
          <p className={styles.saveError} role="alert">
            {feedback.general}
          </p>
        ) : null}
        <div className={styles.saveActions}>
          {dirty ? (
            <Button
              variant="ghost"
              disabled={update.isPending}
              onClick={() => {
                restart(settings);
              }}
            >
              {t('settings:discard')}
            </Button>
          ) : null}
          <Button type="submit" disabled={!dirty} loading={update.isPending}>
            {t('common:actions.save')}
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open && blocker.state === 'blocked') {
            blocker.reset();
          }
        }}
        title={t('settings:leave.title')}
        consequence={t('settings:leave.consequence', { count: changed.length })}
        confirmLabel={t('settings:leave.confirm')}
        cancelLabel={t('settings:leave.stay')}
        closeLabel={t('common:actions.close')}
        tone="danger"
        onConfirm={() => {
          if (blocker.state === 'blocked') {
            blocker.proceed();
          }
        }}
      />
    </form>
  );
}
