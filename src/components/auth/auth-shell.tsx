import { Link, type Href } from 'expo-router';
import { type PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { AuthContentWidth, Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type AuthShellProps = PropsWithChildren<{
  title: string;
  description: string;
  footer?: { text: string; linkLabel: string; href: Href };
  busy?: boolean;
}>;

export function AuthShell({ title, description, footer, busy = false, children }: AuthShellProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={Platform.OS !== 'ios'}
        contentContainerStyle={[
          styles.scroll,
          Platform.OS === 'android' ? { paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + Spacing.four } : null,
        ]}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.brand}>
              <View style={[styles.brandMark, { backgroundColor: colors.accent }]} accessible={false}>
                <ThemedText type="brand" style={{ color: colors.onAccent }}>k.</ThemedText>
              </View>
              <ThemedText type="brand">keesha</ThemedText>
            </View>
            <ThemeToggle />
          </View>
          <View style={styles.introduction}>
            <ThemedText type="smallBold" themeColor="accent">A LITTLE CLARITY, EVERY DAY</ThemedText>
            <ThemedText accessibilityRole="header" type="title">{title}</ThemedText>
            <ThemedText themeColor="textSecondary">{description}</ThemedText>
          </View>
          <View style={[
            styles.card,
            { backgroundColor: colors.backgroundElement, borderColor: colors.border,
              boxShadow: '0 8px 32px ' + colors.shadow },
          ]}>
            {children}
          </View>
          {footer && <View style={styles.footer}>
            <ThemedText type="small" themeColor="textSecondary">{footer.text}</ThemedText>
            <Link href={footer.href} replace asChild>
              <Pressable disabled={busy} accessibilityState={{ disabled: busy }} style={styles.link} accessibilityRole="link">
                <ThemedText type="smallBold" themeColor="accent">{footer.linkLabel}</ThemedText>
              </Pressable>
            </Link>
          </View>}
          <ThemedText type="small" themeColor="textSecondary" style={styles.tagline}>
            Make room for what matters.
          </ThemedText>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.four, paddingVertical: Spacing.five },
  content: { width: '100%', maxWidth: AuthContentWidth, gap: Spacing.four },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  brand: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  brandMark: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: Radii.medium, borderCurve: 'continuous' },
  introduction: { gap: Spacing.two },
  card: { padding: Spacing.four, gap: Spacing.four, borderWidth: 1, borderRadius: Radii.large, borderCurve: 'continuous' },
  footer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', columnGap: Spacing.one },
  link: { minHeight: 48, paddingHorizontal: Spacing.one, justifyContent: 'center' },
  tagline: { textAlign: 'center' },
});
