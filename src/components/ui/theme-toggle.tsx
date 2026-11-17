import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet } from 'react-native';

import { Radii } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function ThemeToggle() {
  const { colors, colorScheme, setPreference } = useTheme();
  const next = colorScheme === 'dark' ? 'light' : 'dark';

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Switch to ${next} mode`}
      onPress={() => setPreference(next)}
      style={({ pressed }) => [styles.button, {
        borderColor: colors.border,
        backgroundColor: pressed ? colors.backgroundSelected : colors.backgroundElement,
      }]}>
      <SymbolView accessible={false} size={22} tintColor={colors.accent}
        name={next === 'light'
          ? { ios: 'sun.max', android: 'light_mode', web: 'light_mode' }
          : { ios: 'moon', android: 'dark_mode', web: 'dark_mode' }} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 46,
    height: 46,
    borderWidth: 1,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
