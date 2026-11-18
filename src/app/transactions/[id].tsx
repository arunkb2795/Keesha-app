import { useAuth } from '@clerk/expo';
import { randomUUID } from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native';

import { CategoryCard } from '@/components/categories/category-card';
import { DashboardIcon, DashboardScreen } from '@/components/dashboard/dashboard-ui';
import { ExpenseDate } from '@/components/dashboard/expense-date';
import { ThemedText } from '@/components/themed-text';
import { BackButton } from '@/components/ui/back-button';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Radii, Spacing } from '@/constants/theme';
import { accountToday, expenseDateKey, expenseMonthBounds, maxExpenseTextLength, parseExpensePaise, previewCategoryTotals,
  type Expense, type ExpenseCategory } from '@/domain/expenses';
import { useTheme } from '@/hooks/use-theme';
import { ExpenseApiError, getExpense, getExpenseSummary, listCategories, updateExpense } from '@/lib/expenses-api';

export default function EditTransactionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <LoadTransaction key={id} id={id} />;
}

function LoadTransaction({ id }: { id: string }) {
  const { getToken } = useAuth();
  const router = useRouter();
  const [loaded, setLoaded] = useState<{ expense: Expense; categories: ExpenseCategory[] }>();
  const [error, setError] = useState<string>();
  const [retry, setRetry] = useState(0);
  const close = () => { if (router.canGoBack()) router.back(); else router.replace('/history'); };

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([getExpense(getToken, id, controller.signal), listCategories(getToken, controller.signal)])
      .then(([expense, categories]) => { if (!controller.signal.aborted) setLoaded({ expense, categories }); })
      .catch(failure => {
        if (!controller.signal.aborted) setError(failure instanceof ExpenseApiError ? failure.message : 'Couldn’t load this transaction. Try again.');
      });
    return () => controller.abort();
  }, [getToken, id, retry]);

  if (loaded) return <TransactionEditor key={loaded.expense.id} {...loaded} onClose={close} />;
  return <DashboardScreen>
    <TransactionHeading onBack={close} />
    {error ? <View style={styles.form}>
      <ThemedText accessibilityLiveRegion="polite">{error}</ThemedText>
      <Button label="Retry" onPress={() => { setError(undefined); setRetry(value => value + 1); }} />
    </View> : <ActivityIndicator accessibilityLabel="Loading transaction" />}
  </DashboardScreen>;
}

function TransactionEditor({ expense, categories, onClose }: {
  expense: Expense; categories: ExpenseCategory[]; onClose: () => void;
}) {
  const { colors } = useTheme();
  const { getToken } = useAuth();
  const [title, setTitle] = useState(expense.title ?? '');
  const [amount, setAmount] = useState((expense.amountPaise / 100).toFixed(2));
  const [date, setDate] = useState(() => new Date(expense.expenseDate + 'T12:00:00'));
  const [categoryId, setCategoryId] = useState(expense.categoryId);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [summary, setSummary] = useState<{ monthStart: string; totals: ReadonlyMap<string, string> }>();
  const pending = useRef(false);
  const attempt = useRef<{ payload: string; mutationId: string } | null>(null);
  const scroll = useRef<ScrollViewInstance>(null);
  const revealed = useRef(false);
  const amountPaise = parseExpensePaise(amount);
  const trimmedTitle = title.trim();
  const expenseDate = expenseDateKey(date);
  const invalidDate = expenseDate > accountToday() || expenseDate < '0001-01-01';
  const monthStart = expenseMonthBounds(invalidDate ? expense.expenseDate : expenseDate).start;
  const totals = summary?.monthStart === monthStart ? previewCategoryTotals(summary.totals, monthStart, expense,
    { amountPaise, categoryId, expenseDate }) : undefined;

  useEffect(() => {
    const controller = new AbortController();
    void getExpenseSummary(getToken, { kind: 'month', date: monthStart }, controller.signal)
      .then(summary => {
        if (!controller.signal.aborted) setSummary({ monthStart,
          totals: new Map(summary.categoryTotals.map(item => [item.categoryId, item.amountPaise])) });
      }).catch(() => { /* Category selection remains available if totals cannot load. */ });
    return () => controller.abort();
  }, [monthStart, getToken]);

  const close = () => { if (!pending.current) { Keyboard.dismiss(); onClose(); } };
  async function save() {
    if (pending.current) return;
    setSubmitted(true);
    setError(undefined);
    if (!trimmedTitle || amountPaise === null || invalidDate || !categories.some(category => category.id === categoryId)) return;
    const changes = { id: expense.id, version: expense.version, title: trimmedTitle, amountPaise, categoryId, expenseDate };
    const payload = JSON.stringify(changes);
    if (attempt.current?.payload !== payload) attempt.current = { payload, mutationId: randomUUID() };
    pending.current = true;
    setSaving(true);
    Keyboard.dismiss();
    try {
      await updateExpense(getToken, attempt.current.mutationId, changes);
      onClose();
    } catch (failure) {
      setError(failure instanceof ExpenseApiError ? failure.message : 'Couldn’t save your changes. Try again.');
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  return <DashboardScreen>
    <TransactionHeading onBack={close} disabled={saving} />
    <View style={styles.form}>
      <View style={{ gap: Spacing.two }}>
        <ThemedText type="smallBold">Categories</ThemedText>
        <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false}
          accessibilityLabel="Transaction categories" contentContainerStyle={styles.categories}
          onContentSizeChange={() => {
            if (!revealed.current) {
              revealed.current = true;
              scroll.current?.scrollTo({ x: Math.max(0, categories.findIndex(category => category.id === expense.categoryId)) * 104,
                animated: false });
            }
          }}>
          {categories.map(category => <Pressable key={category.id} accessibilityRole="button"
            accessibilityLabel={category.name} accessibilityState={{ selected: category.id === categoryId, disabled: saving }}
            disabled={saving} onPress={() => setCategoryId(category.id)}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
            <CategoryCard category={category} amountPaise={totals ? totals.get(category.id) ?? '0' : undefined} />
            {category.id === categoryId && <View style={[styles.check, { backgroundColor: colors.accent }]}>
              <DashboardIcon name="check" size={14} color={colors.onAccent} />
            </View>}
          </Pressable>)}
        </ScrollView>
      </View>
      <TextField label="Title" value={title} onChangeText={setTitle} maxLength={maxExpenseTextLength}
        editable={!saving} autoCapitalize="sentences" error={submitted && !trimmedTitle ? 'Enter an expense title.' : undefined} />
      <TextField label="Expenses (₹)" value={amount} inputMode="decimal" maxLength={12} editable={!saving}
        onChangeText={value => { const normalized = value.replace(',', '.'); if (/^\d*(?:\.\d{0,2})?$/.test(normalized)) setAmount(normalized); }}
        error={submitted && amountPaise === null ? 'Enter ₹0.01 to ₹99,99,999.99 with up to two decimals.' : undefined} />
      <ExpenseDate value={date} onChange={value => { if (!pending.current) setDate(value); }} />
      {submitted && invalidDate && <ThemedText type="small" accessibilityLiveRegion="polite">Choose today or an earlier date.</ThemedText>}
      {error && <ThemedText type="small" accessibilityLiveRegion="polite">{error}</ThemedText>}
      <View style={styles.actions}>
        <View style={{ flex: 1 }}><Button label="Save Changes" loading={saving} onPress={() => void save()} /></View>
        <View style={{ flex: 1 }}><Button label="Cancel" variant="secondary" disabled={saving} onPress={close} /></View>
      </View>
    </View>
  </DashboardScreen>;
}

function TransactionHeading({ onBack, disabled = false }: { onBack: () => void; disabled?: boolean }) {
  return <View style={styles.heading}>
    <BackButton onPress={onBack} disabled={disabled} />
    <View style={styles.headingCopy}>
      <ThemedText accessibilityRole="header" style={styles.title}>Edit Transaction</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">Update your transaction details</ThemedText>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  headingCopy: { flex: 1 },
  title: { fontSize: 22, lineHeight: 30, fontWeight: '600' },
  form: { gap: Spacing.four },
  categories: { gap: 10, paddingTop: Spacing.two, paddingRight: Spacing.two },
  check: { position: 'absolute', right: 0, top: -4, width: 22, height: 22, borderRadius: Radii.pill,
    alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
});
