import type { SignInFutureResource, SignUpFutureResource } from '@clerk/shared/types';

export type AuthIssue = { message: string; field?: 'email' | 'password' | 'confirmation' | 'code' };
export type FieldErrors = Partial<Record<NonNullable<AuthIssue['field']>, string>>;

export function validateCredentials(email: string, password: string, confirmation?: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.trim().length > 254) errors.email = 'Enter a valid email address.';
  if (!password) errors.password = 'Enter your password.';
  if (confirmation !== undefined && password !== confirmation) errors.confirmation = 'Passwords do not match.';
  return errors;
}

export function validateCode(code: string) {
  return /^\d{6}$/.test(code.trim()) ? undefined : 'Enter the six-digit code from your email.';
}

export function authIssue(error: unknown): AuthIssue {
  const value = error as { code?: string; errors?: { code?: string }[] } | null;
  switch (value?.errors?.[0]?.code ?? value?.code) {
    case 'form_password_incorrect':
    case 'form_identifier_not_found':
      return { message: 'The email or password is incorrect.' };
    case 'form_identifier_exists':
      return { field: 'email', message: 'Unable to create an account with this email. Try signing in or resetting your password.' };
    case 'form_password_pwned':
    case 'form_password_length_too_short':
    case 'form_password_not_strong_enough':
    case 'form_password_validation_failed':
      return { field: 'password', message: 'Choose a stronger password that meets the account security requirements.' };
    case 'form_code_incorrect':
    case 'verification_failed':
      return { field: 'code', message: 'That code is incorrect. Check it and try again.' };
    case 'verification_expired':
    case 'form_code_expired':
      return { field: 'code', message: 'That code has expired. Request a new one.' };
    case 'too_many_requests':
    case 'too_many_attempts':
      return { message: 'Too many attempts. Please wait a little before trying again.' };
    case 'network_error':
    case 'network_timeout':
    case 'api_response_timeout':
      return { message: 'Unable to connect. Check your connection and try again.' };
    case 'unsupported_auth_step':
      return { message: 'This account requires an additional sign-in step that Keesha cannot complete yet. Start over or contact support.' };
    default:
      return { message: 'We could not complete that request. Please try again.' };
  }
}

export function requireSuccess(result: { error: unknown }) {
  if (result.error) throw result.error;
}
export function unsupportedStep(): never { throw { code: 'unsupported_auth_step' }; }

export function signInStep(resource: Pick<SignInFutureResource, 'status' | 'supportedSecondFactors'>) {
  if (resource.status === 'complete') return 'complete';
  if (resource.status === 'needs_new_password') return 'new-password';
  if (resource.status === 'needs_client_trust' || resource.status === 'needs_second_factor') {
    return resource.supportedSecondFactors?.some(factor => factor.strategy === 'email_code') ? 'verify' : 'unsupported';
  }
  if (resource.status === null || resource.status === 'needs_identifier' || resource.status === 'needs_first_factor') return 'credentials';
  return 'unsupported';
}

export function signUpStep(resource: Pick<SignUpFutureResource, 'status' | 'unverifiedFields' | 'missingFields' | 'verifications'>) {
  if (resource.status === null) return 'credentials';
  if (resource.status === 'complete' && resource.verifications.emailAddress.status === 'verified') return 'complete';
  if (resource.unverifiedFields.includes('email_address') && resource.missingFields.length === 0) return 'verify';
  return 'unsupported';
}

type SignIn = Pick<SignInFutureResource, 'password' | 'status' | 'supportedSecondFactors' | 'mfa' | 'finalize'>;
type SignUp = Pick<SignUpFutureResource, 'password' | 'status' | 'missingFields' | 'unverifiedFields' | 'verifications' | 'finalize'>;

export async function finishSignIn(resource: SignIn) {
  if (signInStep(resource) !== 'complete') unsupportedStep();
  requireSuccess(await resource.finalize({ navigate: () => {} }));
}
export async function login(resource: SignIn, email: string, password: string) {
  requireSuccess(await resource.password({ emailAddress: email.trim(), password }));
  const next = signInStep(resource);
  if (next === 'complete') await finishSignIn(resource);
  else if (next === 'verify') requireSuccess(await resource.mfa.sendEmailCode());
  else unsupportedStep();
  return next;
}
export async function register(resource: SignUp, email: string, password: string) {
  requireSuccess(await resource.password({ emailAddress: email.trim(), password }));
  const next = signUpStep(resource);
  if (next === 'complete') requireSuccess(await resource.finalize({ navigate: () => {} }));
  else if (next === 'verify') requireSuccess(await resource.verifications.sendEmailCode());
  else unsupportedStep();
  return next;
}
export async function verifyRegistration(resource: SignUp, code: string) {
  requireSuccess(await resource.verifications.verifyEmailCode({ code: code.trim() }));
  if (signUpStep(resource) !== 'complete') unsupportedStep();
  requireSuccess(await resource.finalize({ navigate: () => {} }));
}
export async function verifySignIn(resource: SignIn, code: string) {
  requireSuccess(await resource.mfa.verifyEmailCode({ code: code.trim() }));
  await finishSignIn(resource);
}
export async function requestPasswordReset(resource: Pick<SignInFutureResource, 'create' | 'resetPasswordEmailCode'>, email: string) {
  const result = await resource.create({ identifier: email.trim() });
  const issue = result.error as { code?: string; errors?: { code?: string }[] } | null;
  if ((issue?.errors?.[0]?.code ?? issue?.code) === 'form_identifier_not_found') return;
  requireSuccess(result);
  requireSuccess(await resource.resetPasswordEmailCode.sendCode());
}

export async function verifyPasswordReset(resource: Pick<SignInFutureResource, 'status' | 'resetPasswordEmailCode'>, code: string) {
  requireSuccess(await resource.resetPasswordEmailCode.verifyCode({ code: code.trim() }));
  if (resource.status !== 'needs_new_password') unsupportedStep();
}

export async function updatePassword(resource: SignIn & Pick<SignInFutureResource, 'resetPasswordEmailCode'>, password: string) {
  if (resource.status !== 'needs_new_password') unsupportedStep();
  requireSuccess(await resource.resetPasswordEmailCode.submitPassword({ password, signOutOfOtherSessions: true }));
  const next = signInStep(resource);
  if (next === 'verify') requireSuccess(await resource.mfa.sendEmailCode());
  else if (next !== 'complete') unsupportedStep();
  return next;
}

export function sessionAccess(loaded: boolean, signedIn: boolean | undefined, status?: string, hasTask = false, emailVerified = false) {
  if (!loaded) return 'loading';
  if (!signedIn) return 'signed-out';
  return status === 'active' && !hasTask && emailVerified ? 'active' : 'blocked';
}
export function resendSeconds(sentAt: number, now = Date.now()) {
  return Math.max(0, Math.min(30, Math.ceil((sentAt + 30_000 - now) / 1000)));
}
export function createActionGate() {
  let active = false;
  return {
    async run(action: () => Promise<void>) {
      if (active) return false;
      active = true;
      try { await action(); return true; } finally { active = false; }
    },
  };
}
export function oauthOutcome(result: { createdSessionId: string | null; authSessionResult: { type: string } | null; existingSession?: boolean }) {
  if (result.createdSessionId || result.existingSession) return 'complete';
  if (result.authSessionResult?.type === 'cancel' || result.authSessionResult?.type === 'dismiss') return 'cancelled';
  return 'continue';
}
