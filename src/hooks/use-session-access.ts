import { useAuth, useSession, useUser } from '@clerk/expo';
import { sessionAccess } from '@/lib/auth';

export function useSessionAccess() {
  const { isLoaded, isSignedIn } = useAuth({ treatPendingAsSignedOut: false });
  const { session, isLoaded: sessionLoaded } = useSession();
  const { user, isLoaded: userLoaded } = useUser();
  return sessionAccess(isLoaded && sessionLoaded && userLoaded, isSignedIn,
    session?.status, Boolean(session?.currentTask), user?.primaryEmailAddress?.verification.status === 'verified');
}
