import type { TeamMember } from '@slotwise/contracts/client';
import { Button, Dialog, TextField, useToast } from '@slotwise/ui';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useCreateTeamMember,
  useUpdateTeamMember,
  type ProfileInput,
} from '../../platform/api/team-queries';
import { errorMessage, fieldErrorsOf } from '../common/error-message';
import styles from './team.module.css';

/** Longest name and job title the API accepts. */
const MAX_NAME_LENGTH = 120;

interface ProfileDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly submitLabel: string;
  readonly initial: ProfileInput;
  readonly pending: boolean;
  readonly failure: unknown;
  readonly onSubmit: (profile: ProfileInput) => void;
}

/** Name and job title of a staff member, for adding someone or editing them. */
function ProfileDialog({
  open,
  onOpenChange,
  title,
  submitLabel,
  initial,
  pending,
  failure,
  onSubmit,
}: ProfileDialogProps) {
  const { t } = useTranslation('team');
  const formId = useId();
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [jobTitle, setJobTitle] = useState(initial.title ?? '');
  const [attempted, setAttempted] = useState(false);
  const fieldErrors = fieldErrorsOf(failure);
  const nameMissing = displayName.trim() === '';
  const nameError =
    attempted && nameMissing
      ? t('profile.nameRequired')
      : fieldErrors.displayName
        ? errorMessage(t, failure)
        : null;
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
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
          <Button type="submit" form={formId} loading={pending}>
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
          setAttempted(true);
          if (!nameMissing) {
            onSubmit({ displayName: displayName.trim(), title: jobTitle.trim() || null });
          }
        }}
      >
        <TextField
          label={t('profile.name')}
          value={displayName}
          maxLength={MAX_NAME_LENGTH}
          autoComplete="off"
          error={nameError}
          onChange={(event) => {
            setDisplayName(event.currentTarget.value);
          }}
        />
        <TextField
          label={t('profile.jobTitle')}
          placeholder={t('profile.jobTitlePlaceholder')}
          value={jobTitle}
          maxLength={MAX_NAME_LENGTH}
          autoComplete="off"
          onChange={(event) => {
            setJobTitle(event.currentTarget.value);
          }}
        />
        {failure && !fieldErrors.displayName ? (
          <p className={styles.formError} role="alert">
            {errorMessage(t, failure)}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}

const emptyProfile: ProfileInput = { displayName: '', title: null };

export function AddMemberDialog({
  businessId,
  open,
  onOpenChange,
  onCreated,
}: {
  readonly businessId: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onCreated: (member: TeamMember) => void;
}) {
  const { t } = useTranslation('team');
  const toast = useToast();
  const create = useCreateTeamMember(businessId);
  return (
    <ProfileDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('profile.createTitle')}
      submitLabel={t('profile.create')}
      initial={emptyProfile}
      pending={create.isPending}
      failure={create.error}
      onSubmit={(profile) => {
        create.mutate(profile, {
          onSuccess: (member) => {
            toast.show({
              title: t('profile.created', { name: member.displayName }),
              description: t('profile.createdHint'),
            });
            onCreated(member);
          },
        });
      }}
    />
  );
}

export function EditProfileDialog({
  businessId,
  member,
  open,
  onOpenChange,
  onSaved,
}: {
  readonly businessId: string;
  readonly member: TeamMember;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSaved: () => void;
}) {
  const { t } = useTranslation('team');
  const toast = useToast();
  const update = useUpdateTeamMember(businessId, member.id);
  return (
    <ProfileDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('profile.editTitle')}
      submitLabel={t('common:actions.save')}
      initial={member}
      pending={update.isPending}
      failure={update.error}
      onSubmit={(profile) => {
        update.mutate(profile, {
          onSuccess: () => {
            toast.show({ title: t('profile.saved') });
            onSaved();
          },
        });
      }}
    />
  );
}
