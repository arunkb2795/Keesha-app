import { View, type ViewProps } from 'react-native';

import { type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedViewProps = ViewProps & { type?: ThemeColor };

export function ThemedView({ style, type = 'background', ...props }: ThemedViewProps) {
  const { colors } = useTheme();
  return <View {...props} style={[{ backgroundColor: colors[type] }, style]} />;
}
