import { useSignUp } from '@clerk/expo';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { AuthDivider } from '@/components/auth/auth-divider';
import { AuthMessage } from '@/components/auth/auth-message';
import { AuthShell } from '@/components/auth/auth-shell';
import { GoogleButton } from '@/components/auth/google-button';
import { VerificationForm } from '@/components/auth/verification-form';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { useAuthAction } from '@/hooks/use-auth-action';
import { useGoogleAuth } from '@/hooks/use-google-auth';
import { register, requireSuccess, signUpStep, validateCredentials, verifyRegistration, type FieldErrors } from '@/lib/auth';

export default function SignUpScreen() {
  const { signUp } = useSignUp();
  const google = useGoogleAuth();
  const action = useAuthAction();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [sentAt, setSentAt] = useState(() => signUpStep(signUp) === 'verify' ? Date.now() : 0);
  const verifying = signUpStep(signUp) === 'verify';
  function clearPasswords() { setPassword(''); setConfirmation(''); }
  function submit() {
    const validation = validateCredentials(email, password, confirmation);
    setErrors(validation);
    if (Object.keys(validation).length) return;
    const submitted = password;
    void action.run(async () => {
      try {
        const next = await register(signUp, email, submitted);
        if (next === 'verify') setSentAt(Date.now());
      } finally { clearPasswords(); }
    });
  }
  return (
    <AuthShell busy={action.pending} title={verifying ? 'Verify your email.' : 'Create your account'}
      description={verifying ? 'Confirm your email before opening your private account.' : 'Sign up for Keesha.'}
      footer={{ text: 'Already have an account?', linkLabel: 'Sign in', href: '/sign-in' }}>
      {verifying ? <VerificationForm sentAt={sentAt} pending={action.pending} issue={action.issue}
        onVerify={(code) => action.run(() => verifyRegistration(signUp, code))}
        onResend={() => action.run(async () => { requireSuccess(await signUp.verifications.sendEmailCode()); setSentAt(Date.now()); })}
        onRestart={() => action.run(async () => { requireSuccess(await signUp.reset()); clearPasswords(); setErrors({}); setSentAt(0); })} />
      : <>
        <GoogleButton loading={action.pending} onPress={() => { clearPasswords(); void action.run(google.authenticate); }} />
        <AuthDivider />
        <TextField label="Email address" placeholder="you@example.com" keyboardType="email-address"
          autoComplete="email" textContentType="emailAddress" value={email} onChangeText={setEmail}
          editable={!action.pending} error={errors.email ?? (action.issue?.field === 'email' ? action.issue.message : undefined)} />
        <TextField label="Password" placeholder="Create a password" password autoComplete="new-password"
          textContentType="newPassword" value={password} onChangeText={setPassword} editable={!action.pending}
          error={errors.password ?? (action.issue?.field === 'password' ? action.issue.message : undefined)} />
        <TextField label="Confirm password" placeholder="Re-enter your password" password autoComplete="new-password"
          textContentType="newPassword" value={confirmation} onChangeText={setConfirmation}
          editable={!action.pending} error={errors.confirmation} onSubmitEditing={submit} />
        <AuthMessage message={!action.issue?.field ? action.issue?.message : undefined} />
        <Button label="Create account" loading={action.pending} onPress={submit} />
        {Platform.OS === 'web' ? <View nativeID="clerk-captcha" /> : null}
      </>}
    </AuthShell>
  );
}
