import { useClerk } from '@clerk/expo';
import { AuthMessage } from '@/components/auth/auth-message';
import { StatusScreen } from '@/components/auth/status-screen';
import { Button } from '@/components/ui/button';
import { useAuthAction } from '@/hooks/use-auth-action';

export function AuthRequired() {
  const { signOut } = useClerk();
  const action = useAuthAction();
  return (
    <StatusScreen title="One more account step"
      message="Your account needs an additional verification or setup step that Keesha cannot complete yet. Start over or contact the app owner.">
      <AuthMessage message={action.issue?.message} />
      <Button label="Sign out and start over" loading={action.pending} onPress={() => void action.run(() => signOut())} />
    </StatusScreen>
  );
}
