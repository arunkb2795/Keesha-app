import { useClerk, useUser } from '@clerk/expo';
import { StyleSheet, View } from 'react-native';

import { AuthMessage } from '@/components/auth/auth-message';
import { DashboardHeading, DashboardScreen, ProfileAvatar } from '@/components/dashboard/dashboard-ui';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Radii, Spacing } from '@/constants/theme';
import { useAuthAction } from '@/hooks/use-auth-action';
import { useTheme } from '@/hooks/use-theme';

export default function SettingsScreen() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const { colors } = useTheme();
  const action = useAuthAction();
  const surface = { backgroundColor: colors.backgroundElement, borderColor: colors.border };

  return (
    <DashboardScreen>
      <DashboardHeading title="Settings" subtitle="Your account and appearance." />
      <View style={[styles.card, surface]}>
        <ThemedText type="smallBold" accessibilityRole="header" themeColor="textSecondary">Profile</ThemedText>
        <View style={styles.profile}>
          <ProfileAvatar imageUrl={user?.hasImage ? user.imageUrl : undefined} name={user?.fullName} />
          <View style={styles.identity}>
            <ThemedText type="smallBold">{user?.fullName || 'Keesha account'}</ThemedText>
            {user?.primaryEmailAddress && <ThemedText type="small" themeColor="textSecondary">
              {user.primaryEmailAddress.emailAddress}
            </ThemedText>}
          </View>
        </View>
      </View>
      <View style={[styles.card, styles.appearance, surface]}>
        <ThemedText type="smallBold">Appearance</ThemedText>
        <ThemeToggle />
      </View>
      <AuthMessage message={action.issue?.message} />
      <Button label="Sign out" variant="secondary" loading={action.pending} onPress={() => void action.run(() => signOut())} />
    </DashboardScreen>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.three, borderWidth: 1, borderRadius: Radii.medium, gap: 12 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  identity: { flex: 1, minWidth: 0 },
  appearance: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
