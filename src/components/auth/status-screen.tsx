import { type ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { BackButton } from '@/components/ui/back-button';
import { AuthContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function StatusScreen({ title, message, loading = false, showBack = false, children }: {
  title: string; message: string; loading?: boolean; showBack?: boolean; children?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <ThemedText type="brand" themeColor="accent">keesha</ThemedText>
          <ThemeToggle />
        </View>
        {showBack && <BackButton />}
        {loading ? <ActivityIndicator color={colors.accent} size="large" accessibilityLabel="Loading account" /> : null}
        <ThemedText type="title" accessibilityRole="header">{title}</ThemedText>
        <ThemedText themeColor="textSecondary">{message}</ThemedText>
        {children}
      </View>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.four },
  content: { width: '100%', maxWidth: AuthContentWidth, gap: Spacing.four },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
});
