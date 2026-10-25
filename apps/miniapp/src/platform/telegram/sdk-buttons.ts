import { backButton, mainButton, settingsButton } from '@tma.js/sdk-react';
import { useEffect, useEffectEvent } from 'react';

function tokenColor(name: string): `#${string}` | undefined {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return /^#[0-9a-f]{6}$/i.test(value) ? (value as `#${string}`) : undefined;
}

export interface MainButtonOptions {
  readonly text: string;
  readonly visible?: boolean;
  readonly enabled?: boolean;
  readonly loading?: boolean;
  readonly onClick: () => void;
}

/**
 * The screen's one primary action, drawn by Telegram (or the demo emulator) under the
 * app in the brand accent. Hidden again when the screen unmounts.
 */
export function useMainButton({
  text,
  visible = true,
  enabled = true,
  loading = false,
  onClick,
}: MainButtonOptions): void {
  const handleClick = useEffectEvent(() => {
    if (enabled && !loading) {
      onClick();
    }
  });

  useEffect(() => {
    const bgColor = tokenColor('--color-accent');
    const textColor = tokenColor('--color-on-accent');
    mainButton.setParams.ifAvailable({
      text,
      isVisible: visible,
      isEnabled: enabled,
      isLoaderVisible: loading,
      ...(bgColor ? { bgColor } : {}),
      ...(textColor ? { textColor } : {}),
    });
  }, [text, visible, enabled, loading]);

  useEffect(() => {
    const off = mainButton.onClick.ifAvailable(() => {
      handleClick();
    });
    return () => {
      if (off.ok) {
        off.data();
      }
    };
  }, []);

  useEffect(
    () => () => {
      mainButton.setParams.ifAvailable({ isVisible: false, isLoaderVisible: false });
    },
    [],
  );
}

/** Telegram's back button; `null` hides it (e.g. on the first screen). */
export function useBackButton(onBack: (() => void) | null): void {
  const handleBack = useEffectEvent(() => {
    onBack?.();
  });
  const visible = onBack !== null;

  useEffect(() => {
    if (!visible) {
      backButton.hide.ifAvailable();
      return undefined;
    }
    backButton.show.ifAvailable();
    const off = backButton.onClick.ifAvailable(() => {
      handleBack();
    });
    return () => {
      if (off.ok) {
        off.data();
      }
      backButton.hide.ifAvailable();
    };
  }, [visible]);
}

/** «Settings» in Telegram's menu of the app, opening the app's own settings. */
export function useSettingsButton(onOpen: () => void): void {
  const handleOpen = useEffectEvent(() => {
    onOpen();
  });

  useEffect(() => {
    settingsButton.show.ifAvailable();
    const off = settingsButton.onClick.ifAvailable(() => {
      handleOpen();
    });
    return () => {
      if (off.ok) {
        off.data();
      }
      settingsButton.hide.ifAvailable();
    };
  }, []);
}
