import { useAuth } from '@clerk/expo';
import { Redirect, router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { StatusScreen } from '@/components/auth/status-screen';
import { Button } from '@/components/ui/button';

WebBrowser.maybeCompleteAuthSession();

export default function SSOCallbackScreen() {
  const { isSignedIn } = useAuth({ treatPendingAsSignedOut: false });
  const [waiting, setWaiting] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setWaiting(false), 10_000);
    return () => clearTimeout(timer);
  }, []);
  if (isSignedIn) return <Redirect href="/" />;
  return (
    <StatusScreen title={waiting ? 'Finishing sign-in' : 'Return to sign-in'} loading={waiting}
      message={waiting ? 'Returning securely to Keesha.' : 'The sign-in window could not finish. Return to Keesha and try again.'}>
      {!waiting ? <Button label="Back to sign in" onPress={() => router.replace('/sign-in')} /> : null}
    </StatusScreen>
  );
}
