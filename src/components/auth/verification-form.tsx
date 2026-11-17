import { useEffect, useState } from 'react';
import { AuthMessage } from '@/components/auth/auth-message';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { resendSeconds, validateCode, type AuthIssue } from '@/lib/auth';

type Props = {
  sentAt: number; pending: boolean; issue: AuthIssue | null;
  onVerify: (code: string) => Promise<unknown>;
  onResend: () => Promise<unknown>;
  onRestart: () => Promise<unknown>;
};

export function VerificationForm({ sentAt, pending, issue, onVerify, onResend, onRestart }: Props) {
  const [code, setCode] = useState('');
  const [fieldError, setFieldError] = useState<string>();
  const [now, setNow] = useState(Date.now);
  const seconds = resendSeconds(sentAt, now);
  useEffect(() => {
    if (!sentAt) return;
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (resendSeconds(sentAt, current) === 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [sentAt]);
  async function verify() {
    const error = validateCode(code);
    setFieldError(error);
    if (!error) { const submitted = code; setCode(''); await onVerify(submitted); }
  }
  return (
    <>
      <ThemedText themeColor="textSecondary">Enter the six-digit code from your email.</ThemedText>
      <TextField label="Verification code" value={code}
        onChangeText={(value) => { setCode(value.replace(/\D/g, '').slice(0, 6)); setFieldError(undefined); }}
        error={fieldError ?? (issue?.field === 'code' ? issue.message : undefined)}
        placeholder="000000" keyboardType="number-pad" autoComplete="one-time-code"
        textContentType="oneTimeCode" maxLength={6} editable={!pending} onSubmitEditing={() => void verify()} />
      <AuthMessage message={issue?.field !== 'code' ? issue?.message : undefined} />
      <Button label="Verify code" loading={pending} onPress={() => void verify()} />
      <Button variant="secondary" label={seconds > 0 ? 'Resend code in ' + seconds + 's' : 'Resend code'}
        disabled={pending || seconds > 0} onPress={() => { setCode(''); void onResend(); }} />
      <Button variant="secondary" label="Start over / change email" disabled={pending} onPress={() => void onRestart()} />
    </>
  );
}
