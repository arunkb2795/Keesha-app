import { Redirect } from 'expo-router';
import { AuthRequired } from '@/components/auth/auth-required';
import { useSessionAccess } from '@/hooks/use-session-access';

export default function IndexScreen() {
  const access = useSessionAccess();
  if (access === 'loading') return null;
  if (access === 'blocked') return <AuthRequired />;
  return <Redirect href={access === 'active' ? '/home' : '/sign-in'} />;
}
