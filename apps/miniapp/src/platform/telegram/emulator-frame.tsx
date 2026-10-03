import { DemoLinks } from '@mestechko/booking-ui';
import { appConfig } from '../../app/config';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Ellipsis } from 'lucide-react';
import {
  Badge,
  Button,
  IconButton,
  ListGroup,
  ListItem,
  Logo,
  Sheet,
  useTheme,
  type ThemePreference,
} from '@mestechko/ui';
import { Check } from 'lucide-react';
import { useLayoutEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { emulatorChrome } from './emulator-chrome';
import { useHost } from './host-context';
import type { TelegramDefaultTheme } from './telegram-palette';
import styles from './emulator-frame.module.css';

const TOP_BAR_INSET = 'var(--size-top-bar)';
const BOTTOM_BAR_INSET = 'calc(var(--size-control-md) + var(--space-4) + var(--size-hairline))';

interface ThemeOption {
  readonly id: string;
  readonly labelKey: string;
  readonly preference: ThemePreference | null;
  readonly telegram: TelegramDefaultTheme | null;
}

/** Looks the demo can show: the brand themes and Telegram's own default themes. */
const themeOptions: readonly ThemeOption[] = [
  { id: 'system', labelKey: 'common:theme.system', preference: 'system', telegram: null },
  { id: 'light', labelKey: 'common:theme.light', preference: 'light', telegram: null },
  { id: 'dark', labelKey: 'common:theme.dark', preference: 'dark', telegram: null },
  {
    id: 'telegram-light',
    labelKey: 'common:theme.telegramLight',
    preference: null,
    telegram: 'light',
  },
  {
    id: 'telegram-dark',
    labelKey: 'common:theme.telegramDark',
    preference: null,
    telegram: 'dark',
  },
];

function DemoSettings({
  open,
  onOpenChange,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const { preference, setPreference } = useTheme();
  const { demoTelegramTheme, setDemoTelegramTheme, leave } = useHost();
  const isCurrent = (option: ThemeOption): boolean =>
    option.telegram !== null
      ? option.telegram === demoTelegramTheme
      : demoTelegramTheme === null && option.preference === preference;
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('emulator.settings')}
      description={t('emulator.hint')}
      closeLabel={t('common:actions.close')}
      footer={
        <Button variant="secondary" block onClick={leave}>
          {t('emulator.switchBusiness')}
        </Button>
      }
    >
      <ListGroup title={t('emulator.theme')}>
        {themeOptions.map((option) => (
          <ListItem
            key={option.id}
            title={t(option.labelKey)}
            selected={isCurrent(option)}
            trailing={isCurrent(option) ? <Check /> : undefined}
            onClick={() => {
              setDemoTelegramTheme(option.telegram);
              if (option.preference) {
                setPreference(option.preference);
              }
            }}
          />
        ))}
      </ListGroup>
      <DemoLinks links={appConfig.demoLinks} />
    </Sheet>
  );
}

/**
 * Stand-in for the Telegram client around the app in the demo: header with the back
 * button and the main button, both driven by the app's SDK calls.
 */
export function EmulatorFrame({ children }: { readonly children: ReactNode }) {
  const { t } = useTranslation();
  const chrome = useSyncExternalStore(emulatorChrome.subscribe, emulatorChrome.snapshot);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { mainButton } = chrome;

  useLayoutEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--inset-chrome-top', TOP_BAR_INSET);
    root.setProperty('--inset-chrome-bottom', mainButton.visible ? BOTTOM_BAR_INSET : '0px');
    return () => {
      root.removeProperty('--inset-chrome-top');
      root.removeProperty('--inset-chrome-bottom');
    };
  }, [mainButton.visible]);

  return (
    <>
      <header className={styles.topBar}>
        <span className={styles.slot}>
          {chrome.backButtonVisible ? (
            <IconButton
              label={t('common:actions.back')}
              icon={<ArrowLeft />}
              onClick={emulatorChrome.pressBackButton}
            />
          ) : null}
        </span>
        <div className={styles.topBarCenter}>
          <Logo name={t('common:brand.name')} />
          <Badge tone="outline">{t('common:brand.demo')}</Badge>
        </div>
        <span className={styles.slot}>
          <IconButton
            label={t('emulator.settings')}
            icon={<Ellipsis />}
            onClick={() => {
              setSettingsOpen(true);
            }}
          />
        </span>
      </header>
      <div className={styles.content}>{children}</div>
      {mainButton.visible ? (
        <div className={styles.bottomBar}>
          <Button
            className={styles.mainButton}
            size="lg"
            block
            disabled={!mainButton.enabled}
            loading={mainButton.loading}
            onClick={emulatorChrome.pressMainButton}
          >
            {mainButton.text}
          </Button>
        </div>
      ) : null}
      <DemoSettings open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
