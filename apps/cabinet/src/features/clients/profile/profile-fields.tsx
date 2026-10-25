import { TextField } from '@mestechko/ui';
import { ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { ProfileField, ProfileForm } from './use-profile-form';
import styles from './profile.module.css';

/** Name, phone and e-mail of a client card. */
export function ProfileFields({
  form,
  businessId,
}: {
  readonly form: ProfileForm;
  readonly businessId: string;
}) {
  const { t } = useTranslation();
  const errorOf = (field: ProfileField) => {
    const key = form.errors[field];
    return key ? t(key, { example: form.phoneHint?.example ?? '' }) : null;
  };
  const bind = (field: ProfileField) => ({
    value: form.draft[field],
    error: errorOf(field),
    autoComplete: 'off',
    onChange: (event: { readonly target: { readonly value: string } }) => {
      form.change(field, event.target.value);
    },
    onBlur: () => {
      form.leave(field);
    },
  });
  return (
    <>
      <TextField
        label={t('clients:form.name')}
        placeholder={t('clients:form.namePlaceholder')}
        {...bind('name')}
      />
      <div className={styles.phone}>
        <TextField
          label={t('clients:form.phone')}
          type="tel"
          inputMode="tel"
          placeholder={form.phoneHint?.placeholder}
          {...bind('phone')}
        />
        {form.phoneOwner ? (
          <Link className={styles.ownerLink} to={`/b/${businessId}/clients/${form.phoneOwner}`}>
            {t('clients:form.openTaken')}
            <ArrowRight aria-hidden="true" />
          </Link>
        ) : null}
      </div>
      <TextField
        label={t('clients:form.email')}
        type="email"
        inputMode="email"
        placeholder={t('clients:form.emailPlaceholder')}
        {...bind('email')}
      />
    </>
  );
}
