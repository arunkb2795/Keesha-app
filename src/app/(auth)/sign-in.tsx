import { useSignIn } from '@clerk/expo';
import { useState } from 'react';
import { AuthDivider } from '@/components/auth/auth-divider';
import { AuthMessage } from '@/components/auth/auth-message';
import { AuthShell } from '@/components/auth/auth-shell';
import { GoogleButton } from '@/components/auth/google-button';
import { PasswordRecovery } from '@/components/auth/password-recovery';
import { VerificationForm } from '@/components/auth/verification-form';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { useAuthAction } from '@/hooks/use-auth-action';
import { useGoogleAuth } from '@/hooks/use-google-auth';
import { login, requireSuccess, signInStep, validateCredentials, verifySignIn, type FieldErrors } from '@/lib/auth';

export default function SignInScreen() {
  const { signIn } = useSignIn();
  const google = useGoogleAuth();
  const action = useAuthAction();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [sentAt, setSentAt] = useState(() => signInStep(signIn) === 'verify' ? Date.now() : 0);
  const [recovering, setRecovering] = useState(false);
  const verifying = signInStep(signIn) === 'verify';
  function submit() {
    const validation = validateCredentials(email, password);
    setErrors(validation);
    if (Object.keys(validation).length) return;
    const submitted = password;
    void action.run(async () => {
      try {
        const next = await login(signIn, email, submitted);
        if (next === 'verify') setSentAt(Date.now());
      } finally { setPassword(''); }
    });
  }
  if (recovering) return <PasswordRecovery initialEmail={email} onCancel={() => setRecovering(false)} />;

  return (
    <AuthShell busy={action.pending} title={verifying ? 'Check your email.' : 'Welcome back.'}
      description={verifying ? 'One more step to keep your account safe.' : 'Sign in to your Keesha account.'}
      footer={{ text: 'New to Keesha?', linkLabel: 'Create an account', href: '/sign-up' }}>
      {verifying ? <VerificationForm sentAt={sentAt} pending={action.pending} issue={action.issue}
        onVerify={(code) => action.run(() => verifySignIn(signIn, code))}
        onResend={() => action.run(async () => { requireSuccess(await signIn.mfa.sendEmailCode()); setSentAt(Date.now()); })}
        onRestart={() => action.run(async () => { requireSuccess(await signIn.reset()); setPassword(''); setErrors({}); setSentAt(0); })} />
      : <>
        <GoogleButton loading={action.pending} onPress={() => { setPassword(''); void action.run(google.authenticate); }} />
        <AuthDivider />
        <TextField label="Email address" placeholder="you@example.com" keyboardType="email-address"
          autoComplete="email" textContentType="emailAddress" value={email} onChangeText={setEmail}
          editable={!action.pending} error={errors.email} />
        <TextField label="Password" placeholder="Enter your password" password
          autoComplete="current-password" textContentType="password" value={password} onChangeText={setPassword}
          editable={!action.pending} error={errors.password ?? (action.issue?.field === 'password' ? action.issue.message : undefined)}
          onSubmitEditing={submit} />
        <AuthMessage message={action.issue?.message} />
        <Button label="Sign in" loading={action.pending} onPress={submit} />
        <Button label="Forgot password?" variant="secondary" disabled={action.pending}
          onPress={() => { setPassword(''); setErrors({}); action.clearIssue(); setRecovering(true); }} />
      </>}
    </AuthShell>
  );
}
