import { useEffect, useRef, useState } from 'react';
import { authIssue, createActionGate, type AuthIssue } from '@/lib/auth';

export function useAuthAction() {
  const [gate] = useState(createActionGate);
  const [pending, setPending] = useState(false);
  const [issue, setIssue] = useState<AuthIssue | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  async function run(action: () => Promise<void>) {
    try {
      return await gate.run(async () => {
        if (mounted.current) { setPending(true); setIssue(null); }
        try { await action(); } finally { if (mounted.current) setPending(false); }
      });
    } catch (error) {
      if (mounted.current) setIssue(authIssue(error));
      return false;
    }
  }
  return { run, pending, issue, clearIssue: () => setIssue(null) };
}
