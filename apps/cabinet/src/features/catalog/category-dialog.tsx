import type { CategoryAdmin } from '@mestechko/contracts/client';
import { Button, Dialog, TextField, useToast } from '@mestechko/ui';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCreateCategory, useUpdateCategory } from '../../platform/api/catalog-queries';
import { errorMessage } from '../common/error-message';
import { checkText, problemText } from '../common/field-checks';
import { serviceLimits } from './limits';

/** A new category, or the one being renamed. */
export type CategoryTarget =
  { readonly kind: 'new' } | { readonly kind: 'rename'; readonly category: CategoryAdmin };

export interface CategoryDialogProps {
  readonly businessId: string;
  readonly target: CategoryTarget;
  readonly open: boolean;
  readonly onClose: () => void;
}

/** Name a new category or rename one; mount it per opening so the field starts fresh. */
export function CategoryDialog({ businessId, target, open, onClose }: CategoryDialogProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const formId = useId();
  const create = useCreateCategory(businessId);
  const update = useUpdateCategory(businessId);
  const [name, setName] = useState(target.kind === 'rename' ? target.category.name : '');
  const [checked, setChecked] = useState(false);
  const problem = checkText(name, { required: true, max: serviceLimits.nameMax });
  const pending = create.isPending || update.isPending;

  const fail = (error: unknown) => {
    toast.show({
      tone: 'error',
      title: t('services:category.failed'),
      description: errorMessage(t, error),
    });
  };
  const submit = () => {
    setChecked(true);
    if (problem) {
      return;
    }
    const trimmed = name.trim();
    if (target.kind === 'new') {
      create.mutate(trimmed, {
        onSuccess: (category) => {
          toast.show({ title: t('services:category.created', { name: category.name }) });
          onClose();
        },
        onError: fail,
      });
      return;
    }
    if (trimmed === target.category.name) {
      onClose();
      return;
    }
    update.mutate(
      { categoryId: target.category.id, changes: { name: trimmed } },
      {
        onSuccess: () => {
          toast.show({ title: t('services:category.renamed') });
        },
        onError: fail,
      },
    );
    onClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
      title={t(
        target.kind === 'new' ? 'services:category.newTitle' : 'services:category.renameTitle',
      )}
      closeLabel={t('common:actions.close')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common:actions.cancel')}
          </Button>
          <Button type="submit" form={formId} loading={pending}>
            {t(target.kind === 'new' ? 'services:category.create' : 'services:category.save')}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <TextField
          label={t('services:category.name')}
          placeholder={t('services:category.placeholder')}
          value={name}
          autoFocus
          maxLength={serviceLimits.nameMax}
          error={checked ? problemText(t, problem) : null}
          onChange={(event) => {
            setName(event.currentTarget.value);
          }}
        />
      </form>
    </Dialog>
  );
}
