import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, Typography, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code' | 'brand';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const { colors } = useTheme();
  const color = colors[themeColor ?? (type === 'linkPrimary' ? 'accent' : 'text')];
  return <Text {...rest} style={[styles.base, styles[type], { color }, style]} />;
}

const styles = StyleSheet.create({
  base: { fontFamily: Fonts.sans },
  default: Typography.body,
  title: Typography.heading,
  subtitle: Typography.heading,
  brand: Typography.brand,
  small: Typography.small,
  smallBold: Typography.label,
  link: Typography.label,
  linkPrimary: Typography.label,
  code: { ...Typography.small, fontFamily: Fonts.mono },
});
