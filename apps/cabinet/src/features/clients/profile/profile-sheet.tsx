import { Button, Sheet } from '@slotwise/ui';
import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { errorMessage } from '../../common/error-message';
import { FormFailure } from '../form-failure';
import styles from './profile.module.css';

export interface ProfileSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly submitLabel: string;
  readonly pending: boolean;
  /** Fields that cannot be checked yet keep the submit button disabled. */
  readonly ready: boolean;
  readonly onSubmit: () => void;
  /** A refusal that concerns no single field. */
  readonly failure: unknown;
  readonly children: ReactNode;
}

/** The sheet a client's profile is added or edited in; Enter submits it. */
export function ProfileSheet({
  open,
  onOpenChange,
  title,
  submitLabel,
  pending,
  ready,
  onSubmit,
  failure,
  children,
}: ProfileSheetProps) {
  const { t } = useTranslation();
  const formId = useId();
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      closeLabel={t('common:actions.close')}
      footer={
        <>
          <Button
            variant="ghost"
            block
            onClick={() => {
              onOpenChange(false);
            }}
          >
            {t('common:actions.cancel')}
          </Button>
          <Button type="submit" form={formId} block loading={pending} disabled={!ready}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className={styles.form}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        {children}
        {failure ? <FormFailure>{errorMessage(t, failure)}</FormFailure> : null}
      </form>
    </Sheet>
  );
}
