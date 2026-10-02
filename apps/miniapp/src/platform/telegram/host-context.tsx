import { themeParams, useSignal } from '@tma.js/sdk-react';
import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  endEmulatedHost,
  startEmulatedHost,
  type EmulatedLaunch,
  type HostStatus,
} from './telegram-host';
import {
  colorsFromLaunchTheme,
  hostThemeFrom,
  telegramDefaultThemes,
  type HostTheme,
  type TelegramDefaultTheme,
} from './telegram-palette';

const DEMO_TELEGRAM_THEME_KEY = 'mst-demo-telegram-theme';

interface HostContextValue {
  readonly status: HostStatus;
  /** Colors dictated by Telegram (or the emulated Telegram theme), if any. */
  readonly hostTheme: HostTheme | null;
  readonly demoTelegramTheme: TelegramDefaultTheme | null;
  readonly setDemoTelegramTheme: (theme: TelegramDefaultTheme | null) => void;
  readonly launch: (launch: EmulatedLaunch) => void;
  readonly leave: () => void;
}

const HostContext = createContext<HostContextValue | null>(null);

function readDemoTelegramTheme(): TelegramDefaultTheme | null {
  try {
    const value = window.localStorage.getItem(DEMO_TELEGRAM_THEME_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

function useNativeHostTheme(enabled: boolean): HostTheme | null {
  const params = useSignal(themeParams.state);
  return useMemo(() => (enabled ? hostThemeFrom(params) : null), [enabled, params]);
}

export function HostProvider({
  initial,
  children,
}: {
  readonly initial: HostStatus;
  readonly children: ReactNode;
}) {
  const [status, setStatus] = useState(initial);
  const [demoTelegramTheme, setDemoTelegramThemeState] = useState(readDemoTelegramTheme);
  const isNative = status.status === 'ready' && status.host.kind === 'native';
  const nativeTheme = useNativeHostTheme(isNative);

  const hostTheme = useMemo(() => {
    if (isNative) {
      return nativeTheme;
    }
    return demoTelegramTheme
      ? hostThemeFrom(colorsFromLaunchTheme(telegramDefaultThemes[demoTelegramTheme]))
      : null;
  }, [isNative, nativeTheme, demoTelegramTheme]);

  const setDemoTelegramTheme = useCallback((theme: TelegramDefaultTheme | null) => {
    try {
      if (theme) {
        window.localStorage.setItem(DEMO_TELEGRAM_THEME_KEY, theme);
      } else {
        window.localStorage.removeItem(DEMO_TELEGRAM_THEME_KEY);
      }
    } catch {
      // The choice still applies for this visit.
    }
    setDemoTelegramThemeState(theme);
  }, []);

  const value = useMemo<HostContextValue>(
    () => ({
      status,
      hostTheme,
      demoTelegramTheme,
      setDemoTelegramTheme,
      launch: (launch) => {
        setStatus({ status: 'ready', host: startEmulatedHost(launch) });
      },
      leave: () => {
        endEmulatedHost();
        setStatus({ status: 'launcher' });
      },
    }),
    [status, hostTheme, demoTelegramTheme, setDemoTelegramTheme],
  );

  return <HostContext value={value}>{children}</HostContext>;
}

export function useHost(): HostContextValue {
  const context = use(HostContext);
  if (!context) {
    throw new Error('useHost() must be used inside <HostProvider>');
  }
  return context;
}
