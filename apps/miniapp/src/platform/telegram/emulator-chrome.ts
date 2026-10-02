import { emitEvent } from '@tma.js/sdk-react';

/** What Telegram would draw around the app, as requested by the app through the SDK. */
export interface EmulatorChromeState {
  readonly mainButton: {
    readonly visible: boolean;
    readonly enabled: boolean;
    readonly loading: boolean;
    readonly text: string;
  };
  readonly backButtonVisible: boolean;
}

interface SdkEvent {
  readonly name: string;
  readonly params: unknown;
}

const initialState: EmulatorChromeState = {
  mainButton: { visible: false, enabled: true, loading: false, text: '' },
  backButtonVisible: false,
};

let state = initialState;
const listeners = new Set<() => void>();

function update(next: EmulatorChromeState): void {
  state = next;
  listeners.forEach((listener) => {
    listener();
  });
}

function record(params: unknown): Record<string, unknown> {
  return typeof params === 'object' && params !== null ? (params as Record<string, unknown>) : {};
}

const eventHandlers: Readonly<Record<string, (params: unknown) => void>> = {
  web_app_setup_main_button: (params) => {
    const value = record(params);
    update({
      ...state,
      mainButton: {
        visible: value.is_visible === true,
        enabled: value.is_active !== false,
        loading: value.is_progress_visible === true,
        text: typeof value.text === 'string' ? value.text : state.mainButton.text,
      },
    });
  },
  web_app_setup_back_button: (params) => {
    update({ ...state, backButtonVisible: record(params).is_visible === true });
  },
};

/** Receives Mini Apps method calls that the mocked environment intercepts. */
export function handleEmulatedCall(event: SdkEvent): void {
  eventHandlers[event.name]?.(event.params);
}

export const emulatorChrome = {
  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  snapshot: (): EmulatorChromeState => state,
  /** The user pressed the emulated main button: tell the SDK as Telegram would. */
  pressMainButton: (): void => {
    emitEvent('main_button_pressed');
  },
  pressBackButton: (): void => {
    emitEvent('back_button_pressed');
  },
};
