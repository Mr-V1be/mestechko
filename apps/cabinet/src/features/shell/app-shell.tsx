import { brandName } from '@slotwise/i18n';
import { DemoLinks, LanguageList, useLocale, VerticalIcon } from '@slotwise/booking-ui';
import { offersMessenger, type Locale } from '@slotwise/domain';
import type { Membership } from '@slotwise/contracts/client';
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
} from '@slotwise/ui';
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
import { useRoleLabel } from '../common/role-label';
import { navigationSections, type NavigationSection } from './navigation';
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
  membership,
  open,
  onOpenChange,
}: {
  readonly membership: Membership;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const me = useSession();
  const roleLabel = useRoleLabel(membership.business.vertical);
  const navigate = useNavigate();
  const { preference, setPreference } = useTheme();
  const signOut = useSignOut();
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={me.user.displayName}
      description={`${roleLabel(membership.role)} · ${me.user.email}`}
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
      <LanguageList />
      {appConfig.demoMode ? <DemoLinks links={appConfig.demoLinks} /> : null}
    </Sheet>
  );
}

function visibleSections(membership: Membership, locale: Locale): NavigationSection[] {
  return navigationSections.filter(
    (section) =>
      canOpen(membership, section.area) &&
      (!section.demoOnly || appConfig.demoMode) &&
      (!section.messenger || offersMessenger(locale, section.messenger)),
  );
}

function NavigationLinks({
  membership,
  sections,
}: {
  readonly membership: Membership;
  readonly sections: readonly NavigationSection[];
}) {
  const { t } = useTranslation();
  return sections.map((section) => (
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

/** The phone's bottom bar: pinned sections and «Ещё» with the rest. */
function BottomNavigation({ membership }: { readonly membership: Membership }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const { locale } = useLocale();
  const sections = visibleSections(membership, locale);
  const pinned = sections.filter((section) => section.pinned);
  const rest = sections.filter((section) => !section.pinned);
  const current = location.pathname.split('/')[3] ?? '';
  return (
    <nav className={styles.bottomNav} aria-label={t('nav.label')}>
      <NavigationLinks membership={membership} sections={pinned} />
      {rest.length > 0 ? (
        <button
          type="button"
          className={clsx(
            styles.navItem,
            rest.some((section) => section.path === current) && styles.navItemActive,
          )}
          aria-haspopup="dialog"
          onClick={() => {
            setOpen(true);
          }}
        >
          <Ellipsis aria-hidden="true" />
          {t('nav.more')}
        </button>
      ) : null}
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={t('nav.more')}
        closeLabel={t('common:actions.close')}
      >
        <ListGroup>
          {rest.map((section) => (
            <ListItem
              key={section.path}
              leading={<section.icon aria-hidden="true" />}
              title={t(section.labelKey)}
              selected={section.path === current}
              onClick={() => {
                setOpen(false);
                void navigate(`/b/${membership.business.id}/${section.path}`);
              }}
            />
          ))}
        </ListGroup>
      </Sheet>
    </nav>
  );
}

/** Navigation around every cabinet screen: sidebar, rail or bottom bar by screen size. */
export function AppShell() {
  const { t } = useTranslation();
  const me = useSession();
  const membership = useActiveMembership(me);
  const [accountOpen, setAccountOpen] = useState(false);
  const roleLabel = useRoleLabel(membership?.business.vertical);
  const { locale } = useLocale();

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
            <Logo name={brandName} />
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
          <NavigationLinks membership={membership} sections={visibleSections(membership, locale)} />
        </nav>
        <div className={styles.sidebarFooter}>
          <div className={styles.account}>
            <Avatar name={me.user.displayName} size="sm" />
            <div className={styles.accountText}>
              <p className={styles.accountName}>{me.user.displayName}</p>
              <p className={styles.accountEmail}>{roleLabel(membership.role)}</p>
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
      <BottomNavigation membership={membership} />
      <AccountSheet membership={membership} open={accountOpen} onOpenChange={setAccountOpen} />
    </div>
  );
}
