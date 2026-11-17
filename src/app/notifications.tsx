import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { DashboardEmptyState, DashboardIcon, DashboardScreen } from '@/components/dashboard/dashboard-ui';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function NotificationsScreen() {
  const { colors } = useTheme();
  return (
    <DashboardScreen>
      <View style={styles.header}>
        <Link href="/home" dismissTo asChild>
          <Pressable accessibilityRole="link" accessibilityLabel="Back to Home"
            style={({ pressed }) => [styles.back, { borderColor: colors.border,
              backgroundColor: pressed ? colors.backgroundSelected : colors.backgroundElement }]}>
            <DashboardIcon name="back" color={colors.accent} size={20} />
          </Pressable>
        </Link>
        <ThemedText accessibilityRole="header" type="title">Notifications</ThemedText>
      </View>
      <DashboardEmptyState icon="bell" title="No new notifications"
        message="You’re all caught up. Check back here for new notifications." />
    </DashboardScreen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  back: { width: 46, height: 46, borderRadius: Radii.pill, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center' },
});
