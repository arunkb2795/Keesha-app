import { useAuth } from '@clerk/expo';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { accountToday, expenseMonthBounds } from '@/domain/expenses';
import { getExpenseSummary } from '@/lib/expenses-api';

export function useMonthlyCategoryTotals() {
  const { getToken } = useAuth();
  const month = expenseMonthBounds(accountToday()).start;
  const [result, setResult] = useState<{ key: string; totals: ReadonlyMap<string, string> }>();
  const [failedMonth, setFailedMonth] = useState<string>();
  const [retry, setRetry] = useState(0);
  const key = `${month}:${retry}`;
  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    void getExpenseSummary(getToken, { kind: 'month', date: month }, controller.signal)
      .then(summary => {
        if (controller.signal.aborted) return;
        setResult({ key, totals: new Map(summary.categoryTotals.map(item => [item.categoryId, item.amountPaise])) });
        setFailedMonth(undefined);
      }).catch(() => { if (!controller.signal.aborted) setFailedMonth(month); });
    return () => controller.abort();
  }, [getToken, key, month]));
  return { totals: result?.key === key ? result.totals : undefined, failed: failedMonth === month,
    reload: () => { setFailedMonth(undefined); setRetry(value => value + 1); } };
}
