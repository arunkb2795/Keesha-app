import { useAuth, useUser } from '@clerk/expo';
import { Link, useIsFocused, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DashboardEmptyState, DashboardIcon, DashboardScreen, ProfileAvatar } from '@/components/dashboard/dashboard-ui';
import { useExpenseActions } from '@/components/dashboard/expense-actions';
import { ExpensePeriodPicker } from '@/components/dashboard/expense-period-picker';
import { SpendingCard, SpendingCategories, TransactionList, TransactionSkeleton } from '@/components/dashboard/spending-preview';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { CreateCategorySheet } from '@/components/categories/create-category-sheet';
import { Radii, Spacing } from '@/constants/theme';
import { accountToday, expenseMonthBounds, shiftExpenseDay, type ExpensePeriod } from '@/domain/expenses';
import { useTheme } from '@/hooks/use-theme';
import { getExpenseSummary, listExpenses, type HistoryEntry } from '@/lib/expenses-api';
import { useCategories } from '@/providers/categories-provider';

type HomeData = {
  periodKey: string;
  summary: Awaited<ReturnType<typeof getExpenseSummary>>;
  recent: HistoryEntry[];
};

export default function HomeScreen() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const isFocused = useIsFocused();
  const router = useRouter();
  const { colors } = useTheme();
  const { openExpense, expenseRevision } = useExpenseActions();
  const catalog = useCategories();
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [createdCategoryId, setCreatedCategoryId] = useState<string>();
  const today = accountToday();
  const currentMonth = expenseMonthBounds(today).start;
  const [selection, setSelection] = useState<ExpensePeriod>();
  const { kind, date } = selection ?? { kind: 'month', date: currentMonth };
  const periodKey = kind + ':' + date;
  const [loaded, setLoaded] = useState<HomeData>();
  const [failedPeriod, setFailedPeriod] = useState<string>();
  const [retry, setRetry] = useState(0);
  const data = loaded?.periodKey === periodKey ? loaded : undefined;
  const failed = failedPeriod === periodKey;
  const loading = !data && !failed;

  useEffect(() => {
    if (!isFocused) return;
    const request = new AbortController();
    const range = kind === 'day' ? { start: date, end: shiftExpenseDay(date, 1) } : expenseMonthBounds(date);
    void Promise.all([
      getExpenseSummary(getToken, { kind, date }, request.signal),
      listExpenses(getToken, undefined, request.signal, 5, range),
    ]).then(([summary, page]) => {
      if (!request.signal.aborted) {
        setLoaded({ periodKey, summary, recent: page.expenses });
        setFailedPeriod(undefined);
      }
    }).catch(() => {
      if (!request.signal.aborted) setFailedPeriod(periodKey);
    });
    return () => request.abort();
  }, [date, getToken, isFocused, kind, periodKey, expenseRevision, retry]);

  const totals = data && new Map(data.summary.categoryTotals.map(({ categoryId, amountPaise }) => [categoryId, amountPaise]));
  const isCurrentMonth = kind === 'month' && date === currentMonth;

  return (
    <DashboardScreen header={
      <View style={styles.header}>
        <Link href="/settings" asChild>
          <Pressable accessibilityRole="link" accessibilityLabel="Open profile settings">
            <ProfileAvatar imageUrl={user?.hasImage ? user.imageUrl : undefined} name={user?.fullName} />
          </Pressable>
        </Link>
        <ExpensePeriodPicker period={{ kind, date }} today={today} onSelect={setSelection} />
        <Pressable accessibilityRole="button" accessibilityLabel="Notifications"
          onPress={() => router.push('/notifications')}
          style={({ pressed }) => [styles.notification, { borderColor: colors.border,
            backgroundColor: pressed ? colors.backgroundSelected : colors.backgroundElement }]}>
          <DashboardIcon name="bell" color={colors.accent} size={22} />
        </Pressable>
      </View>
    }>
      <SpendingCard label={kind === 'day' ? 'Daily spend' : isCurrentMonth ? 'This month’s spend' : 'Monthly spend'}
        totalPaise={data?.summary.totalPaise} previousMonthTotalPaise={data?.summary.previousMonthTotalPaise}
        loadingPeriod={loading ? kind : undefined} />
      <SpendingCategories categories={catalog.categories} totals={totals} onSelect={openExpense}
        loading={loading || catalog.loading} onAdd={() => setCreatingCategory(true)} addDisabled={catalog.loading || !!catalog.error}
        revealCategoryId={createdCategoryId} />
      {catalog.error && <View style={{ gap: Spacing.two }}>
        <ThemedText type="small" accessibilityLiveRegion="polite">{catalog.error}</ThemedText>
        <Button label="Retry categories" variant="secondary" onPress={catalog.reload} />
      </View>}
      {creatingCategory && <CreateCategorySheet categories={catalog.categories} onCreate={async input => {
        const category = await catalog.create(input);
        setCreatedCategoryId(category.id);
        return category;
      }}
        onClose={() => setCreatingCategory(false)} />}

      <View style={styles.recent}>
        <View style={styles.recentHeader}>
          <ThemedText accessibilityRole="header" style={styles.sectionTitle}>
            {kind === 'day' ? 'Transactions for this day' : 'Recent transactions'}
          </ThemedText>
          <Link href="/history" asChild>
            <ThemedText type="linkPrimary" style={styles.historyLink}>Your history</ThemedText>
          </Link>
        </View>
        {data && data.recent.length > 0 && <TransactionList transactions={data.recent} />}
        {data?.recent.length === 0 && !failed && (
          <DashboardEmptyState icon="bills" title={isCurrentMonth ? 'No recent transactions' : 'No transactions'}
            message={isCurrentMonth ? 'Use the + button to add your first expense. It’ll show up here.'
              : 'No expenses were recorded for this period.'} />
        )}
        {loading && <TransactionSkeleton />}
        {failed && <>
          <ThemedText accessibilityLiveRegion="polite">Couldn’t refresh your expenses.</ThemedText>
          <Button label="Retry" variant="secondary" onPress={() => {
            setFailedPeriod(undefined);
            setRetry(value => value + 1);
          }} />
        </>}
      </View>
    </DashboardScreen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  notification: { width: 46, height: 46, borderWidth: 1, borderRadius: Radii.pill,
    alignItems: 'center', justifyContent: 'center' },
  recent: { gap: Spacing.two },
  recentHeader: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  sectionTitle: { fontSize: 18, lineHeight: 25, fontWeight: '600' },
  historyLink: { paddingVertical: Spacing.one },
});
