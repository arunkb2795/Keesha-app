import { useCanGoBack, useRouter, type Href } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet } from 'react-native';

import { Radii } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function BackButton({ fallback, onPress, disabled = false }: {
  fallback?: Href; onPress?: () => void; disabled?: boolean;
}) {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const { colors } = useTheme();
  const unavailable = disabled || (!canGoBack && !fallback && !onPress);

  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Go back"
      disabled={unavailable} accessibilityState={{ disabled: unavailable }}
      onPress={() => {
        if (onPress) onPress();
        else if (canGoBack) router.back();
        else if (fallback) router.replace(fallback);
      }}
      style={({ pressed }) => [styles.back, { borderColor: colors.border,
        backgroundColor: pressed ? colors.backgroundSelected : colors.backgroundElement,
        opacity: unavailable ? 0.55 : 1 }]}>
      <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
        tintColor={colors.accent} size={20} accessible={false} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  back: { width: 46, height: 46, flexShrink: 0, borderRadius: Radii.pill, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center' },
});
