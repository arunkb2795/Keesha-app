import { type ReactNode } from 'react';
import { ActivityIndicator, Pressable, type PressableProps, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string; variant?: 'primary' | 'secondary'; leading?: ReactNode; loading?: boolean;
};
export function Button({ label, variant = 'primary', leading, disabled, loading = false, ...props }: ButtonProps) {
  const { colors } = useTheme();
  const primary = variant === 'primary';
  const unavailable = Boolean(disabled || loading);
  return (
    <Pressable {...props} accessibilityRole="button"
      accessibilityState={{ disabled: unavailable, busy: loading }} disabled={unavailable}
      style={({ pressed }) => [styles.button,
        { backgroundColor: primary ? colors.accent : colors.backgroundElement, borderColor: primary ? colors.accent : colors.border },
        unavailable ? styles.disabled : null, pressed ? styles.pressed : null]}>
      <View style={styles.content}>
        {loading ? <ActivityIndicator color={primary ? colors.onAccent : colors.accent} /> : leading}
        <ThemedText type="smallBold" style={{ color: primary ? colors.onAccent : colors.text }}>{label}</ThemedText>
      </View>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  button: { minHeight: 54, paddingHorizontal: Spacing.three, paddingVertical: Spacing.three, borderWidth: 1,
    borderRadius: Radii.medium, borderCurve: 'continuous', justifyContent: 'center' },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.8 },
});
