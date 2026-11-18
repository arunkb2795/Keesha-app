import { useState } from 'react';

import { TransactionCategoryFilter } from '@/components/categories/transaction-category-filter';
import { DashboardHeading, DashboardScreen } from '@/components/dashboard/dashboard-ui';
import { TransactionList, TransactionSkeleton } from '@/components/dashboard/spending-preview';
import { useExpenseActions } from '@/components/dashboard/expense-actions';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { type CategoryId } from '@/domain/expenses';
import { useTransactions } from '@/hooks/use-transactions';
import { useCategories } from '@/providers/categories-provider';

export default function HistoryScreen() {
  const [categoryId, setCategoryId] = useState<CategoryId>();
  const catalog = useCategories();
  const { expenseRevision } = useExpenseActions();
  const transactions = useTransactions({ categoryId, revision: expenseRevision });
  const { page, loading, loadingMore, failed } = transactions;

  return (
    <DashboardScreen>
      <DashboardHeading title="History" subtitle="Your saved expenses" />
      <TransactionCategoryFilter categories={catalog.categories} selectedId={categoryId} onSelect={setCategoryId} />
      {catalog.error && <>
        <ThemedText type="small" accessibilityLiveRegion="polite">{catalog.error}</ThemedText>
        <Button label="Retry categories" variant="secondary" onPress={catalog.reload} />
      </>}
      {page && (!loading || loadingMore) && <TransactionList transactions={page.expenses}
        dateTotals={new Map(page.dateTotals.map(item => [item.date, item.totalPaise]))} />}
      {loading && <TransactionSkeleton count={loadingMore ? 2 : 6}
        label={loadingMore ? 'Loading more expenses' : 'Loading expense history'} />}
      {failed && <ThemedText accessibilityLiveRegion="polite">Couldn’t load your expenses.</ThemedText>}
      {failed && <Button label="Retry" variant="secondary" onPress={transactions.reload} />}
      {!loading && !failed && page?.expenses.length === 0 &&
        <ThemedText>{categoryId ? 'No expenses in this category yet.' : 'Your first expense starts here.'}</ThemedText>}
      {!loading && !failed && page?.nextCursor && (
        <Button label="Load more" variant="secondary" onPress={transactions.loadMore} />
      )}
    </DashboardScreen>
  );
}
