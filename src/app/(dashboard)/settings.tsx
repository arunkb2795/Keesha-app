import { useClerk } from '@clerk/expo';
import { StyleSheet, View } from 'react-native';

import { AuthMessage } from '@/components/auth/auth-message';
import { DashboardHeading, DashboardScreen } from '@/components/dashboard/dashboard-ui';
import { ProfileCard } from '@/components/dashboard/profile-card';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Radii, Spacing } from '@/constants/theme';
import { useAuthAction } from '@/hooks/use-auth-action';
import { useTheme } from '@/hooks/use-theme';

export default function SettingsScreen() {
  const { signOut } = useClerk();
  const { colors } = useTheme();
  const action = useAuthAction();
  const surface = { backgroundColor: colors.backgroundElement, borderColor: colors.border };

  return (
    <DashboardScreen>
      <DashboardHeading title="Settings" subtitle="Your account and appearance." />
      <ProfileCard />
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
  appearance: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
