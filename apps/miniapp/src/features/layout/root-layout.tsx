import { LockedIllustration, StatePanel } from '@mestechko/ui';
import { useTranslation } from 'react-i18next';
import { Navigate, Outlet, ScrollRestoration } from 'react-router';
import { useHost } from '../../platform/telegram/host-context';
import { EmulatorFrame } from '../../platform/telegram/emulator-frame';
import { LauncherPage } from '../launcher/launcher-page';
import styles from './layout.module.css';

export function RootLayout() {
  const { t } = useTranslation();
  const { status } = useHost();
  if (status.status === 'launcher') {
    return <LauncherPage />;
  }
  if (status.status === 'unsupported') {
    return (
      <div className={styles.container}>
        <StatePanel
          illustration={<LockedIllustration />}
          title={t('unsupported.title')}
          description={t('unsupported.description')}
        />
      </div>
    );
  }
  const content = (
    <div className={styles.app}>
      <ScrollRestoration />
      <Outlet />
    </div>
  );
  return status.host.kind === 'emulated' ? <EmulatorFrame>{content}</EmulatorFrame> : content;
}

/** The app opens on the business it was launched for. */
export function StartRedirect() {
  const { t } = useTranslation();
  const { status } = useHost();
  const slug = status.status === 'ready' ? status.host.startParam : null;
  if (slug) {
    return <Navigate to={`/b/${encodeURIComponent(slug)}`} replace />;
  }
  return (
    <div className={styles.container}>
      <StatePanel
        illustration={<LockedIllustration />}
        title={t('business.missingTitle')}
        description={t('business.missingDescription')}
      />
    </div>
  );
}
