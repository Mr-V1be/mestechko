import { VerticalIcon } from '@mestechko/booking-ui';
import type { Membership } from '@mestechko/contracts/client';
import {
  Avatar,
  Badge,
  Button,
  IconButton,
  ListGroup,
  ListItem,
  Logo,
  LogoMark,
  Select,
  Sheet,
  themePreferences,
  useTheme,
} from '@mestechko/ui';
import { clsx } from 'clsx';
import { Check, Ellipsis, LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { appConfig } from '../../app/config';
import { useSignOut } from '../../platform/api/queries';
import {
  canOpen,
  rememberBusiness,
  useActiveMembership,
} from '../../platform/session/active-business';
import { useSession } from '../../platform/session/session-context';
import { navigationSections } from './navigation';
import styles from './shell.module.css';

function BusinessSwitcher({ membership }: { readonly membership: Membership }) {
  const { t } = useTranslation();
  const me = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const section = location.pathname.split('/')[3] ?? 'schedule';
  return (
    <Select
      label={t('nav.business')}
      hideLabel
      value={membership.business.id}
      options={me.memberships.map((candidate) => ({
        value: candidate.business.id,
        label: candidate.business.name,
        leading: <VerticalIcon name={candidate.business.vertical.icon} />,
      }))}
      onChange={(businessId) => {
        void navigate(`/b/${businessId}/${section}`);
      }}
    />
  );
}

function AccountSheet({
  open,
  onOpenChange,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const me = useSession();
  const navigate = useNavigate();
  const { preference, setPreference } = useTheme();
  const signOut = useSignOut();
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={me.user.displayName}
      description={me.user.email}
      closeLabel={t('common:actions.close')}
      footer={
        <Button
          variant="danger"
          block
          icon={<LogOut />}
          loading={signOut.isPending}
          onClick={() => {
            signOut.mutate(undefined, {
              onSettled: () => void navigate('/sign-in', { replace: true }),
            });
          }}
        >
          {t('account.signOut')}
        </Button>
      }
    >
      <ListGroup title={t('account.theme')}>
        {themePreferences.map((option) => (
          <ListItem
            key={option}
            title={t(`common:theme.${option}`)}
            selected={preference === option}
            trailing={preference === option ? <Check /> : undefined}
            onClick={() => {
              setPreference(option);
            }}
          />
        ))}
      </ListGroup>
    </Sheet>
  );
}

function NavigationLinks({ membership }: { readonly membership: Membership }) {
  const { t } = useTranslation();
  return navigationSections
    .filter((section) => canOpen(membership, section.area))
    .map((section) => (
      <NavLink
        key={section.path}
        to={`/b/${membership.business.id}/${section.path}`}
        className={({ isActive }) => clsx(styles.navItem, isActive && styles.navItemActive)}
      >
        <section.icon aria-hidden="true" />
        {t(section.labelKey)}
      </NavLink>
    ));
}

/** Navigation around every cabinet screen: sidebar, rail or bottom bar by screen size. */
export function AppShell() {
  const { t } = useTranslation();
  const me = useSession();
  const membership = useActiveMembership(me);
  const [accountOpen, setAccountOpen] = useState(false);

  useEffect(() => {
    if (membership) {
      rememberBusiness(membership.business.id);
    }
  }, [membership]);

  if (!membership) {
    return <Navigate to="/" replace />;
  }
  const openAccount = () => {
    setAccountOpen(true);
  };
  const demoBadge = appConfig.demoMode ? (
    <Badge tone="outline" className={styles.demoBadge}>
      {t('common:brand.demo')}
    </Badge>
  ) : null;

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.wordmark}>
            <Logo name={t('common:brand.name')} />
          </span>
          <span className={styles.markOnly}>
            <LogoMark />
          </span>
          <span className={styles.wordmark}>{demoBadge}</span>
        </div>
        <div className={styles.switcher}>
          <BusinessSwitcher membership={membership} />
        </div>
        <nav className={styles.nav} aria-label={t('nav.label')}>
          <NavigationLinks membership={membership} />
        </nav>
        <div className={styles.sidebarFooter}>
          <div className={styles.account}>
            <Avatar name={me.user.displayName} size="sm" />
            <div className={styles.accountText}>
              <p className={styles.accountName}>{me.user.displayName}</p>
              <p className={styles.accountEmail}>{me.user.email}</p>
            </div>
          </div>
          <IconButton label={t('nav.account')} icon={<Ellipsis />} onClick={openAccount} />
        </div>
      </aside>
      <div className={styles.main}>
        <header className={styles.topBar}>
          <div className={styles.topBarBusiness}>
            <BusinessSwitcher membership={membership} />
          </div>
          {demoBadge}
          <IconButton label={t('nav.account')} icon={<Ellipsis />} onClick={openAccount} />
        </header>
        <Outlet />
      </div>
      <nav className={styles.bottomNav} aria-label={t('nav.label')}>
        <NavigationLinks membership={membership} />
      </nav>
      <AccountSheet open={accountOpen} onOpenChange={setAccountOpen} />
    </div>
  );
}
