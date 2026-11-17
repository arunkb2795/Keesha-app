import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#202E27',
    textSecondary: '#626C64',
    background: '#F7F6F2',
    backgroundElement: '#FFFEFB',
    backgroundSelected: '#E6EEE7',
    border: '#DADFD7',
    accent: '#176346',
    onAccent: '#FFFFFF',
    accentSoft: '#EAF2E9',
    placeholder: '#768077',
    shadow: 'rgba(32, 46, 39, 0.05)',
    error: '#A52828',
    errorSoft: '#FCEDEB',
  },
  dark: {
    text: '#F1F3EB',
    textSecondary: '#B0BBAF',
    background: '#131B16',
    backgroundElement: '#1B261F',
    backgroundSelected: '#34483B',
    border: '#3C4D40',
    accent: '#A5DEC0',
    onAccent: '#163725',
    accentSoft: '#263D2E',
    placeholder: '#A0ACA1',
    shadow: 'rgba(0, 0, 0, 0.12)',
    error: '#FFB4AE',
    errorSoft: '#432A2A',
  },
} as const;

export type ColorScheme = keyof typeof Colors;
export type ThemeColor = keyof typeof Colors.light;
export type AppearancePreference = 'system' | ColorScheme;

export const Fonts = {
  sans: Platform.select({ ios: 'System', android: 'sans-serif', default: 'system-ui' }),
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
};

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radii = { small: 10, medium: 16, large: 24, pill: 999 } as const;
export const Typography = {
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  small: { fontSize: 14, lineHeight: 21, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 21, fontWeight: '600' },
  heading: { fontSize: 32, lineHeight: 40, fontWeight: '600' },
  brand: { fontSize: 26, lineHeight: 34, fontWeight: '600' },
} as const;

export const AuthContentWidth = 440;
