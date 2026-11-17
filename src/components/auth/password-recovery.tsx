import { useSignIn } from '@clerk/expo';
import { useState } from 'react';
import { AuthMessage } from '@/components/auth/auth-message';
import { AuthShell } from '@/components/auth/auth-shell';
import { VerificationForm } from '@/components/auth/verification-form';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { useAuthAction } from '@/hooks/use-auth-action';
import { finishSignIn, requestPasswordReset, requireSuccess, updatePassword, verifyPasswordReset,
  validateCredentials, verifySignIn, type FieldErrors } from '@/lib/auth';

export function PasswordRecovery({ initialEmail, onCancel }: { initialEmail: string; onCancel: () => void }) {
  const { signIn } = useSignIn();
  const action = useAuthAction();
  const [step, setStep] = useState<'email' | 'code' | 'password' | 'device' | 'complete'>('email');
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [sentAt, setSentAt] = useState(0);
  function restart() {
    return action.run(async () => {
      requireSuccess(await signIn.reset());
      setStep('email'); setPassword(''); setConfirmation(''); setErrors({}); setSentAt(0);
    });
  }
  function send() {
    const { email: error } = validateCredentials(email, 'validation-only');
    setErrors({ email: error });
    if (error) return;
    void action.run(async () => {
      await requestPasswordReset(signIn, email); setSentAt(Date.now()); setStep('code');
    });
  }
  function savePassword() {
    const validation = validateCredentials(email, password, confirmation);
    setErrors(validation);
    if (Object.keys(validation).length) return;
    const submitted = password;
    void action.run(async () => {
      try {
        const next = await updatePassword(signIn, submitted);
        if (next === 'complete') setStep('complete');
        else if (next === 'verify') {
          setSentAt(Date.now()); setStep('device');
        }
      } finally { setPassword(''); setConfirmation(''); }
    });
  }
  return (
    <AuthShell title={step === 'complete' ? 'Password updated.' : 'Reset your password'}
      description={step === 'complete' ? 'Your new password is ready. Continue to your account.' : 'Recover access to your Keesha account.'}>
      {step === 'email' ? <>
        <TextField label="Email address" placeholder="you@example.com" keyboardType="email-address"
          autoComplete="email" textContentType="emailAddress" value={email} onChangeText={setEmail}
          error={errors.email} editable={!action.pending} onSubmitEditing={send} />
        <AuthMessage message={action.issue?.message} />
        <Button label="Send reset code" loading={action.pending} onPress={send} />
      </> : null}
      {step === 'code' || step === 'device' ? <>
        {step === 'code' ? <AuthMessage error={false} message="If this email has a password account, a reset code has been sent." /> : null}
        <VerificationForm sentAt={sentAt} pending={action.pending} issue={action.issue}
          onVerify={(code) => action.run(async () => {
            if (step === 'device') await verifySignIn(signIn, code);
            else {
              await verifyPasswordReset(signIn, code);
              setStep('password');
            }
          })}
          onResend={() => action.run(async () => {
            if (step === 'device') requireSuccess(await signIn.mfa.sendEmailCode());
            else await requestPasswordReset(signIn, email);
            setSentAt(Date.now());
          })}
          onRestart={restart} />
      </> : null}
      {step === 'password' ? <>
        <TextField label="New password" password autoComplete="new-password" textContentType="newPassword"
          value={password} onChangeText={setPassword} editable={!action.pending}
          error={errors.password ?? (action.issue?.field === 'password' ? action.issue.message : undefined)} />
        <TextField label="Confirm new password" password autoComplete="new-password" textContentType="newPassword"
          value={confirmation} onChangeText={setConfirmation} editable={!action.pending}
          error={errors.confirmation} onSubmitEditing={savePassword} />
        <AuthMessage message={!action.issue?.field ? action.issue?.message : undefined} />
        <Button label="Update password" loading={action.pending} onPress={savePassword} />
      </> : null}
      {step === 'complete' ? <>
        <AuthMessage message={action.issue?.message} />
        <Button label="Continue to Keesha" loading={action.pending} onPress={() => void action.run(() => finishSignIn(signIn))} />
      </> : null}
      <Button label="Back to sign in" variant="secondary" disabled={action.pending}
        onPress={() => void action.run(async () => { requireSuccess(await signIn.reset()); onCancel(); })} />
    </AuthShell>
  );
}
