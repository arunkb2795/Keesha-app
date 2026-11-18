import { useAuth } from '@clerk/expo';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { DashboardHeading, DashboardScreen } from '@/components/dashboard/dashboard-ui';
import { TransactionList, TransactionSkeleton } from '@/components/dashboard/spending-preview';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { listExpenses } from '@/lib/expenses-api';

type Page = Awaited<ReturnType<typeof listExpenses>>;

export default function HistoryScreen() {
  const { userId } = useAuth();
  return userId ? <ExpenseHistory key={userId} /> : null;
}

function ExpenseHistory() {
  const { getToken } = useAuth();
  const [page, setPage] = useState<Page>();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const request = useRef<AbortController | null>(null);

  const load = useCallback(async (cursor?: string) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setLoadingMore(Boolean(cursor));
    setFailed(false);
    try {
      const result = await listExpenses(getToken, cursor, controller.signal);
      if (!controller.signal.aborted) {
        setPage(previous => cursor && previous
          ? { ...result, expenses: [...previous.expenses, ...result.expenses] }
          : result);
      }
    } catch {
      if (!controller.signal.aborted) setFailed(true);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [getToken]);

  useFocusEffect(useCallback(() => {
    void load();
    return () => request.current?.abort();
  }, [load]));

  return (
    <DashboardScreen>
      <DashboardHeading title="History" subtitle="Your saved expenses" />
      {page && (!loading || loadingMore) && <TransactionList transactions={page.expenses} />}
      {loading && <TransactionSkeleton count={loadingMore ? 2 : 6}
        label={loadingMore ? 'Loading more expenses' : 'Loading expense history'} />}
      {failed && <ThemedText accessibilityLiveRegion="polite">Couldn’t load your expenses.</ThemedText>}
      {failed && <Button label="Retry" variant="secondary" onPress={() => void load()} />}
      {!loading && !failed && page?.expenses.length === 0 && <ThemedText>Your first expense starts here.</ThemedText>}
      {!loading && !failed && page?.nextCursor && (
        <Button label="Load more" variant="secondary"
          onPress={() => void load(page.nextCursor ?? undefined)} />
      )}
    </DashboardScreen>
  );
}
