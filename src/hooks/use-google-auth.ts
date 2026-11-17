import { useSSO } from '@clerk/expo/experimental';
import * as AuthSession from 'expo-auth-session';
import { router } from 'expo-router';
import { oauthOutcome, requireSuccess, signInStep, signUpStep, unsupportedStep } from '@/lib/auth';

export function useGoogleAuth() {
  const { startSSOFlow } = useSSO();
  async function authenticate() {
    const result = await startSSOFlow({
      strategy: 'oauth_google',
      redirectUrl: AuthSession.makeRedirectUri({ scheme: 'keesha', path: 'sso-callback' }),
    });
    const outcome = oauthOutcome({ ...result,
      existingSession: Boolean(result.signIn?.existingSession || result.signUp?.existingSession) });
    if (outcome !== 'continue') return;
    if (result.signIn && signInStep(result.signIn) === 'verify') {
      requireSuccess(await result.signIn.mfa.sendEmailCode()); router.replace('/sign-in');
    } else if (result.signUp && signUpStep(result.signUp) === 'verify') {
      requireSuccess(await result.signUp.verifications.sendEmailCode()); router.replace('/sign-up');
    } else unsupportedStep();
  }
  return { authenticate };
}
