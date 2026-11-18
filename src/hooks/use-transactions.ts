import { useAuth } from '@clerk/expo';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { type CategoryId } from '@/domain/expenses';
import { listExpenses } from '@/lib/expenses-api';

type Page = Awaited<ReturnType<typeof listExpenses>>;

export function useTransactions({ categoryId, start, end, limit = 30, revision = 0 }: {
  categoryId?: CategoryId; start?: string; end?: string; limit?: number; revision?: number;
} = {}) {
  const { getToken } = useAuth();
  const key = JSON.stringify([categoryId ?? null, start ?? null, end ?? null, limit, revision]);
  const [result, setResult] = useState<{ key: string; page: Page }>();
  const [status, setStatus] = useState<{ key: string; loading: boolean; more: boolean; failed: boolean }>();
  const request = useRef<AbortController | null>(null);

  const load = useCallback(async (cursor?: string) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setStatus({ key, loading: true, more: Boolean(cursor), failed: false });
    try {
      const page = await listExpenses(getToken, cursor, controller.signal, limit,
        start && end ? { start, end } : undefined, categoryId);
      if (controller.signal.aborted) return;
      setResult(previous => {
        if (!cursor || previous?.key !== key) return { key, page };
        const totals = new Map([...previous.page.dateTotals, ...page.dateTotals].map(item => [item.date, item]));
        return { key, page: { ...page, expenses: [...previous.page.expenses, ...page.expenses], dateTotals: [...totals.values()] } };
      });
      setStatus({ key, loading: false, more: false, failed: false });
    } catch {
      if (!controller.signal.aborted) setStatus({ key, loading: false, more: false, failed: true });
    }
  }, [categoryId, end, getToken, key, limit, start]);

  useFocusEffect(useCallback(() => {
    void load();
    return () => request.current?.abort();
  }, [load]));

  const page = result?.key === key ? result.page : undefined;
  return {
    page,
    loading: status?.key !== key || status.loading,
    loadingMore: status?.key === key && status.more,
    failed: status?.key === key && status.failed,
    reload: () => void load(),
    loadMore: () => { if (page?.nextCursor && !status?.loading) void load(page.nextCursor); },
  };
}
