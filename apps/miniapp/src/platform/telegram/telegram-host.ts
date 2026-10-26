import {
  backButton,
  hapticFeedback,
  init,
  isTMA,
  mainButton,
  miniApp,
  mockTelegramEnv,
  retrieveLaunchParams,
  retrieveRawInitData,
  settingsButton,
  themeParams,
} from '@tma.js/sdk-react';
import { browserLanguages } from '@slotwise/booking-ui';
import { handleEmulatedCall } from './emulator-chrome';
import { telegramDefaultThemes } from './telegram-palette';

/** `native` runs inside Telegram; `emulated` is the demo stand-in built on the SDK mock. */
export type HostKind = 'native' | 'emulated';

export interface TelegramHost {
  readonly kind: HostKind;
  /** Signed launch data, sent to the API with every request. */
  readonly initData: string;
  /** Business the app was opened for (`startapp` parameter). */
  readonly startParam: string | null;
}

export interface EmulatedLaunch {
  readonly initData: string;
  readonly startParam: string;
}

const EMULATED_LAUNCH_KEY = 'slotwise-emulated-launch';
const MINI_APPS_VERSION = '9.1';

function mountFeatures(): void {
  miniApp.mount.ifAvailable();
  themeParams.mount.ifAvailable();
  mainButton.mount.ifAvailable();
  backButton.mount.ifAvailable();
  settingsButton.mount.ifAvailable();
  miniApp.ready.ifAvailable();
}

function currentHost(kind: HostKind): TelegramHost {
  const initData = retrieveRawInitData() ?? '';
  return { kind, initData, startParam: retrieveLaunchParams().tgWebAppStartParam ?? null };
}

function parseLaunch(value: unknown): EmulatedLaunch | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const { initData, startParam } = value as Record<string, unknown>;
  return typeof initData === 'string' && typeof startParam === 'string'
    ? { initData, startParam }
    : null;
}

function readEmulatedLaunch(): EmulatedLaunch | null {
  try {
    const stored = window.sessionStorage.getItem(EMULATED_LAUNCH_KEY);
    return stored ? parseLaunch(JSON.parse(stored)) : null;
  } catch {
    return null;
  }
}

/**
 * Runs the app as if Telegram had opened it: the SDK mock carries genuinely signed
 * launch data and routes every Mini Apps method call to the emulator chrome.
 */
export function startEmulatedHost(launch: EmulatedLaunch): TelegramHost {
  try {
    window.sessionStorage.setItem(EMULATED_LAUNCH_KEY, JSON.stringify(launch));
  } catch {
    // The emulated session simply ends with the tab.
  }
  mockTelegramEnv({
    launchParams: {
      tgWebAppData: launch.initData,
      tgWebAppVersion: MINI_APPS_VERSION,
      tgWebAppPlatform: 'tdesktop',
      tgWebAppStartParam: launch.startParam,
      tgWebAppThemeParams: telegramDefaultThemes.light,
    },
    onEvent: (event) => {
      handleEmulatedCall(event);
    },
    resetPostMessage: true,
  });
  init();
  mountFeatures();
  return currentHost('emulated');
}

export function endEmulatedHost(): void {
  try {
    window.sessionStorage.removeItem(EMULATED_LAUNCH_KEY);
  } catch {
    // Nothing stored.
  }
}

export type HostStatus =
  | { readonly status: 'ready'; readonly host: TelegramHost }
  | { readonly status: 'launcher' }
  | { readonly status: 'unsupported' };

/** Detects where the app runs and initializes the SDK accordingly. */
export function startHost(demoMode: boolean): HostStatus {
  const emulated = demoMode ? readEmulatedLaunch() : null;
  if (emulated) {
    return { status: 'ready', host: startEmulatedHost(emulated) };
  }
  if (isTMA()) {
    init();
    mountFeatures();
    return { status: 'ready', host: currentHost('native') };
  }
  return demoMode ? { status: 'launcher' } : { status: 'unsupported' };
}

/**
 * The languages the host reports for the person: Telegram's app language inside
 * Telegram (and in its emulator), the browser's languages on the demo launcher.
 */
export function hostLanguages(status: HostStatus): readonly string[] {
  if (status.status !== 'ready') {
    return browserLanguages();
  }
  try {
    const language = retrieveLaunchParams().tgWebAppData?.user?.language_code;
    return language ? [language] : [];
  } catch {
    return [];
  }
}

/** Light touches on choices and results; silently absent where unsupported. */
export const haptics = {
  selection(): void {
    hapticFeedback.selectionChanged.ifAvailable();
  },
  success(): void {
    hapticFeedback.notificationOccurred.ifAvailable('success');
  },
  error(): void {
    hapticFeedback.notificationOccurred.ifAvailable('error');
  },
};
