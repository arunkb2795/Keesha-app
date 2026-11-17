import Constants from 'expo-constants';
import { SymbolView } from 'expo-symbols';
import { useContext, useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { AuthRetryContext } from '@/providers/clerk-provider';

export function SessionLoading() {
  const retry = useContext(AuthRetryContext);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [slow, setSlow] = useState(false);
  const [canAnimate, setCanAnimate] = useState(false);
  const [lift] = useState(() => new Animated.Value(0));
  const version = Constants.expoConfig?.version;

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 15_000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let active = true;
    const update = (reduceMotion: boolean) => { if (active) setCanAnimate(!reduceMotion); };
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', update);
    void AccessibilityInfo.isReduceMotionEnabled().then(update).catch(() => {});
    return () => { active = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    if (!canAnimate || slow) return;
    const options = { duration: 850, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' };
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(lift, { ...options, toValue: -6 }),
      Animated.timing(lift, { ...options, toValue: 0 }),
    ]));
    animation.start();
    return () => { animation.stop(); lift.setValue(0); };
  }, [canAnimate, lift, slow]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentInsetAdjustmentBehavior="never"
      contentContainerStyle={[styles.screen, {
        paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + Spacing.four,
      }]}>
      <View style={styles.brand}>
        <View style={[styles.walletTile, { backgroundColor: colors.accentSoft, borderColor: colors.border }]}>
          <Animated.View style={{ transform: [{ translateY: lift }] }}>
            <SymbolView name={{ ios: 'wallet.pass', android: 'account_balance_wallet', web: 'account_balance_wallet' }}
              size={48} tintColor={colors.accent} accessible={false} />
          </Animated.View>
        </View>
        <ThemedText accessibilityRole="header" type="title" style={styles.name}>Keesha</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.centered}>Let’s see where your money goes!</ThemedText>
      </View>

      <View style={styles.footer}>
        <ThemedText accessibilityLiveRegion="polite" type="smallBold" style={styles.centered}>
          {slow ? 'Unable to connect yet' : 'Connecting securely…'}
        </ThemedText>
        {slow && <>
          <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
            Check your internet connection and try again.
          </ThemedText>
          <View style={styles.retry}><Button label="Try again" onPress={retry} /></View>
        </>}
        {version && <ThemedText type="small" themeColor="textSecondary">Keesha {version}</ThemedText>}
        <ThemedText type="small" themeColor="textSecondary" style={styles.credit}>Created by Arun</ThemedText>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, paddingHorizontal: Spacing.four },
  brand: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, paddingVertical: Spacing.four },
  walletTile: { width: 104, height: 104, borderWidth: 1, borderRadius: Radii.large + Spacing.one,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.two },
  name: { fontSize: 38, lineHeight: 46, fontWeight: '700', letterSpacing: -1 },
  centered: { textAlign: 'center' },
  footer: { alignItems: 'center', gap: Spacing.one, paddingBottom: Spacing.three },
  retry: { width: '100%', maxWidth: 240, marginVertical: Spacing.two },
  credit: { marginTop: Spacing.two },
});
