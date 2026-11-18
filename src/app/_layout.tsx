import '@/global.css';
import { useAuth } from '@clerk/expo';
import { type PropsWithChildren } from 'react';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SessionLoading } from '@/components/auth/session-loading';
import { useTheme } from '@/hooks/use-theme';
import { useSessionAccess } from '@/hooks/use-session-access';
import { AppClerkProvider } from '@/providers/clerk-provider';
import { AppThemeProvider } from '@/providers/theme-provider';
import { CategoriesProvider } from '@/providers/categories-provider';

function AppNavigator() {
  const { colors, colorScheme } = useTheme();
  const navigationTheme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
  const access = useSessionAccess();
  return (
    <ThemeProvider value={{ ...navigationTheme, colors: { ...navigationTheme.colors,
      background: colors.background, card: colors.backgroundElement, text: colors.text, border: colors.border, primary: colors.accent } }}>
      {access === 'loading' ? (
        <SessionLoading />
      ) : (
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="sso-callback" options={{ title: 'Completing sign-in' }} />
          <Stack.Protected guard={access === 'signed-out'}><Stack.Screen name="(auth)" /></Stack.Protected>
          <Stack.Protected guard={access === 'active'}>
            <Stack.Screen name="(dashboard)" />
            <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
            <Stack.Screen name="transactions/[id]" options={{ title: 'Edit Transaction' }} />
            <Stack.Screen name="categories/[id]" options={{ title: 'Edit Category' }} />
          </Stack.Protected>
        </Stack>
      )}
    </ThemeProvider>
  );
}
function ThemeStatusBar() {
  const { colorScheme } = useTheme();
  return <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />;
}

export default function RootLayout() {
  return <AppThemeProvider><ThemeStatusBar /><AppClerkProvider>
    <AccountCategories><AppNavigator /></AccountCategories>
  </AppClerkProvider></AppThemeProvider>;
}

function AccountCategories({ children }: PropsWithChildren) {
  const { userId } = useAuth();
  return userId ? <CategoriesProvider key={userId}>{children}</CategoriesProvider> : children;
}
