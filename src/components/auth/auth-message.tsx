import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function AuthMessage({ message, error = true }: { message?: string; error?: boolean }) {
  const { colors } = useTheme();
  if (!message) return null;
  return (
    <View accessibilityRole={error ? 'alert' : undefined} accessibilityLiveRegion="polite"
      style={[styles.message, { backgroundColor: error ? colors.errorSoft : colors.accentSoft }]}>
      <ThemedText type="small" themeColor={error ? 'error' : 'accent'}>{message}</ThemedText>
    </View>
  );
}
const styles = StyleSheet.create({
  message: { padding: Spacing.three, borderRadius: Radii.small, borderCurve: 'continuous' },
});
