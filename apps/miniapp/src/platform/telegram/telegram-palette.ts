import {
  ensureContrast,
  isDarkColor,
  type ExternalPalette,
  type ResolvedTheme,
} from '@slotwise/ui';

/** Telegram theme colors in the SDK's camel-cased form. */
export interface TelegramThemeColors {
  readonly bgColor?: string | undefined;
  readonly secondaryBgColor?: string | undefined;
  readonly sectionBgColor?: string | undefined;
  readonly textColor?: string | undefined;
  readonly hintColor?: string | undefined;
  readonly subtitleTextColor?: string | undefined;
  readonly sectionSeparatorColor?: string | undefined;
  readonly destructiveTextColor?: string | undefined;
}

export interface HostTheme {
  readonly theme: ResolvedTheme;
  readonly palette: ExternalPalette;
}

/**
 * Surfaces and text follow the Telegram theme; the brand accent stays ours. Secondary
 * text is nudged until it meets WCAG AA on the surface, which some Telegram themes miss.
 */
export function hostThemeFrom(colors: TelegramThemeColors): HostTheme | null {
  const surface = colors.sectionBgColor ?? colors.bgColor;
  const text = colors.textColor;
  if (!surface || !text) {
    return null;
  }
  const canvas = colors.secondaryBgColor ?? surface;
  const secondary = colors.subtitleTextColor ?? colors.hintColor;
  return {
    theme: isDarkColor(surface) ? 'dark' : 'light',
    palette: {
      canvas,
      surface,
      'surface-sunken': canvas,
      text,
      ...(secondary ? { 'text-secondary': ensureContrast(secondary, surface) } : {}),
      ...(colors.sectionSeparatorColor ? { border: colors.sectionSeparatorColor } : {}),
      ...(colors.destructiveTextColor
        ? { danger: ensureContrast(colors.destructiveTextColor, surface) }
        : {}),
    },
  };
}

/** Default Telegram palettes, used by the demo emulator (snake case as in launch params). */
export const telegramDefaultThemes = {
  light: {
    bg_color: '#ffffff',
    secondary_bg_color: '#efeff3',
    section_bg_color: '#ffffff',
    text_color: '#000000',
    hint_color: '#999999',
    subtitle_text_color: '#999999',
    link_color: '#2481cc',
    button_color: '#2481cc',
    button_text_color: '#ffffff',
    section_separator_color: '#e7e7e9',
    destructive_text_color: '#ff3b30',
    header_bg_color: '#ffffff',
    accent_text_color: '#2481cc',
    bottom_bar_bg_color: '#ffffff',
  },
  dark: {
    bg_color: '#17212b',
    secondary_bg_color: '#232e3c',
    section_bg_color: '#17212b',
    text_color: '#f5f5f5',
    hint_color: '#708499',
    subtitle_text_color: '#708499',
    link_color: '#6ab3f3',
    button_color: '#5288c1',
    button_text_color: '#ffffff',
    section_separator_color: '#111921',
    destructive_text_color: '#ec3942',
    header_bg_color: '#17212b',
    accent_text_color: '#6ab2f2',
    bottom_bar_bg_color: '#17212b',
  },
} as const;

export type TelegramDefaultTheme = keyof typeof telegramDefaultThemes;

export function colorsFromLaunchTheme(
  theme: Readonly<Record<string, string>>,
): TelegramThemeColors {
  return {
    bgColor: theme.bg_color,
    secondaryBgColor: theme.secondary_bg_color,
    sectionBgColor: theme.section_bg_color,
    textColor: theme.text_color,
    hintColor: theme.hint_color,
    subtitleTextColor: theme.subtitle_text_color,
    sectionSeparatorColor: theme.section_separator_color,
    destructiveTextColor: theme.destructive_text_color,
  };
}
