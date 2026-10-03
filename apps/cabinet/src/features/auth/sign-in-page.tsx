import { DemoLinks } from '@mestechko/booking-ui';
import { Badge, Button, Logo, TextField } from '@mestechko/ui';
import { useState, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { appConfig } from '../../app/config';
import { useMe, useSignIn } from '../../platform/api/queries';
import { errorMessage } from '../common/error-message';
import { DemoAccess } from './demo-access';
import { ProductShowcase } from './product-showcase';
import styles from './sign-in.module.css';

export function SignInPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const me = useMe();
  const signIn = useSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  if (me.isSuccess) {
    return <Navigate to="/" replace />;
  }
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    const nextErrors = {
      ...(email.trim() ? {} : { email: t('signIn.emailRequired') }),
      ...(password ? {} : { password: t('signIn.passwordRequired') }),
    };
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) {
      signIn.mutate(
        { email: email.trim(), password },
        { onSuccess: () => void navigate(from, { replace: true }) },
      );
    }
  };

  return (
    <div className={styles.page}>
      <aside className={styles.brandPanel}>
        <Logo name={t('common:brand.name')} tone="inverse" />
        <ProductShowcase />
        <div className={styles.brandText}>
          <p className={styles.brandTitle}>{t('common:brand.tagline')}</p>
          <p className={styles.brandCaption}>{t('signIn.showcase.caption')}</p>
        </div>
      </aside>
      <main className={styles.formPanel}>
        <div className={styles.formColumn}>
          <div className={styles.mobileBrand}>
            <Logo name={t('common:brand.name')} />
            {appConfig.demoMode ? <Badge tone="outline">{t('common:brand.demo')}</Badge> : null}
          </div>
          <div className={styles.heading}>
            <h1 className={styles.title}>{t('signIn.title')}</h1>
            <p className={styles.lead}>{t('signIn.lead')}</p>
          </div>
          <form className={styles.form} onSubmit={submit} noValidate>
            <TextField
              label={t('signIn.email')}
              type="email"
              autoComplete="username"
              value={email}
              error={errors.email ?? null}
              onChange={(event) => {
                setEmail(event.target.value);
              }}
            />
            <TextField
              label={t('signIn.password')}
              type="password"
              autoComplete="current-password"
              value={password}
              error={errors.password ?? null}
              onChange={(event) => {
                setPassword(event.target.value);
              }}
            />
            {signIn.isError ? (
              <p className={styles.formError} role="alert">
                {errorMessage(t, signIn.error)}
              </p>
            ) : null}
            <Button type="submit" size="lg" block loading={signIn.isPending}>
              {t('signIn.submit')}
            </Button>
          </form>
          {appConfig.demoMode ? <DemoAccess /> : null}
          {appConfig.demoMode ? <DemoLinks links={appConfig.demoLinks} /> : null}
        </div>
      </main>
    </div>
  );
}
