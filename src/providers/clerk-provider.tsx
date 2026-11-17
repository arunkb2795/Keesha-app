import { ClerkProvider } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { isPublishableKey } from '@clerk/shared/keys';
import { Component, createContext, type PropsWithChildren, useState } from 'react';
import { StatusScreen } from '@/components/auth/status-screen';
import { Button } from '@/components/ui/button';

export const AuthRetryContext = createContext<() => void>(() => {});

class ClerkBoundary extends Component<PropsWithChildren<{ onRetry: () => void }>, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) {
      return (
        <StatusScreen title="Sign-in is unavailable" message="We could not connect to your account. Please try again.">
          <Button label="Try again" onPress={this.props.onRetry} />
        </StatusScreen>
      );
    }
    return this.props.children;
  }
}

export function AppClerkProvider({ children }: PropsWithChildren) {
  const [attempt, setAttempt] = useState(0);
  const retry = () => setAttempt(value => value + 1);
  const key = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
  if (!key || !isPublishableKey(key)) {
    return <StatusScreen title="Keesha is getting ready"
      message="Sign-in is not available until app setup is complete. Please contact the app owner." />;
  }
  return (
    <AuthRetryContext.Provider value={retry}>
    <ClerkBoundary key={key + attempt} onRetry={retry}>
      <ClerkProvider publishableKey={key} tokenCache={tokenCache}>{children}</ClerkProvider>
    </ClerkBoundary>
    </AuthRetryContext.Provider>
  );
}
