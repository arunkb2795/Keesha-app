import { Platform, Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { DashboardIcon } from './dashboard-ui';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { accountToday, categoryIds, categoryNames, compareMonthlySpend, formatPaise, groupExpenses,
  type CategoryId, type ExpensePeriod } from '@/domain/expenses';
import { useTheme } from '@/hooks/use-theme';
import { type HistoryEntry } from '@/lib/expenses-api';

function SkeletonBlock({ style }: { style: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return <View style={[styles.skeletonBlock, { backgroundColor: colors.border }, style]} />;
}

export function SpendingCard({ label, totalPaise, previousMonthTotalPaise, loadingPeriod }: {
  label: string; totalPaise?: string; previousMonthTotalPaise?: string; loadingPeriod?: ExpensePeriod['kind'];
}) {
  const { colors } = useTheme();
  const comparison = totalPaise === undefined || previousMonthTotalPaise === undefined
    ? undefined : compareMonthlySpend(totalPaise, previousMonthTotalPaise);

  return (
    <View style={[styles.summary, { backgroundColor: colors.backgroundElement, borderColor: colors.border,
      boxShadow: '0 8px 32px ' + colors.shadow }]}>
      <ThemedText type="smallBold" themeColor="textSecondary">{label}</ThemedText>
      {loadingPeriod ? (
        <View accessible accessibilityRole="progressbar" accessibilityLabel="Loading spending total" style={styles.summarySkeleton}>
          <View style={styles.totalSkeletonFrame}><SkeletonBlock style={styles.totalSkeleton} /></View>
          {loadingPeriod === 'month' && <SkeletonBlock style={styles.comparisonSkeleton} />}
        </View>
      ) : (
        <ThemedText style={styles.total} numberOfLines={1} adjustsFontSizeToFit>
          {totalPaise === undefined ? '—' : formatPaise(totalPaise)}
        </ThemedText>
      )}
      {comparison && (
        <View style={[styles.comparison, { backgroundColor: colors.accentSoft }]}>
          {comparison.above !== undefined && (
            <DashboardIcon name={comparison.above ? 'trendUp' : 'trendDown'} size={16} color={colors.accent} />
          )}
          <ThemedText type="smallBold" themeColor="accent" style={styles.comparisonLabel}>{comparison.label}</ThemedText>
        </View>
      )}
    </View>
  );
}

export function SpendingCategories({ totals, onSelect, loading = false }: {
  totals?: ReadonlyMap<CategoryId, string>;
  onSelect: (category: CategoryId, amountPaise?: string) => void;
  loading?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <ThemedText accessibilityRole="header" style={styles.sectionTitle}>Categories</ThemedText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        accessible={loading || undefined} accessibilityRole={loading ? 'progressbar' : undefined}
        accessibilityLabel={loading ? 'Loading category totals' : 'Spending categories'}
        tabIndex={Platform.OS === 'web' && !loading ? 0 : undefined} scrollEnabled={!loading}
        contentContainerStyle={styles.categories}>
        {loading ? categoryIds.slice(0, 5).map(id => (
          <View key={id} style={styles.category}>
            <View style={[styles.categoryCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
              <View style={styles.categoryIcon}><SkeletonBlock style={styles.categoryIconSkeleton} /></View>
              <View style={styles.categoryAmount}><SkeletonBlock style={styles.categoryAmountSkeleton} /></View>
            </View>
            <View style={styles.categoryLabelSkeletonFrame}><SkeletonBlock style={styles.categoryLabelSkeleton} /></View>
          </View>
        )) : categoryIds.map(id => {
          const amount = totals ? totals.get(id) ?? '0' : undefined;
          return (
            <Pressable key={id} accessibilityRole="button"
              accessibilityLabel={`Add expense in ${categoryNames[id]}${amount === undefined ? '' : `, ${formatPaise(amount)} spent`}`}
              onPress={() => onSelect(id, amount)} style={({ pressed }) => pressed && styles.pressed}>
              <CategoryCard category={id} amountPaise={amount} />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function CategoryCard({ category, amountPaise }: { category: CategoryId; amountPaise?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.category}>
      <View style={[styles.categoryCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
        <View style={styles.categoryIcon}><DashboardIcon name={category} size={24} color={colors.accent} /></View>
        {amountPaise !== undefined && (
          <View style={[styles.categoryAmount, { backgroundColor: colors.accentSoft }]}>
            <ThemedText themeColor="accent" type="smallBold" numberOfLines={1} adjustsFontSizeToFit>
              {formatPaise(amountPaise)}
            </ThemedText>
          </View>
        )}
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.categoryLabel}>{categoryNames[category]}</ThemedText>
    </View>
  );
}

export function TransactionSkeleton() {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel="Loading recent transactions" style={styles.transactionGroup}>
      <View style={styles.transactionHeadingSkeletonFrame}><SkeletonBlock style={styles.transactionHeadingSkeleton} /></View>
      {['first', 'second'].map(row => (
        <View key={row} style={[styles.transaction, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
          <SkeletonBlock style={styles.transactionIcon} />
          <View style={[styles.transactionCopy, styles.transactionCopySkeleton]}>
            <SkeletonBlock style={styles.transactionTitleSkeleton} />
            <SkeletonBlock style={styles.transactionCategorySkeleton} />
          </View>
          <SkeletonBlock style={styles.transactionAmountSkeleton} />
        </View>
      ))}
    </View>
  );
}

export function TransactionList({ transactions }: { transactions: readonly HistoryEntry[] }) {
  const { colors } = useTheme();
  const groups = groupExpenses(transactions, accountToday());
  const sections = groups.map(group => (
    <View key={group.key} style={styles.transactionGroup}>
      <ThemedText accessibilityRole="header" type="smallBold" themeColor="textSecondary">{group.label}</ThemedText>
      <View style={styles.transactionCards}>
        {group.expenses.map(transaction => (
          <View key={transaction.id} style={[styles.transaction, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
            <View style={[styles.transactionIcon, { backgroundColor: colors.accentSoft }]}>
              <DashboardIcon name={transaction.categoryId} color={colors.accent} />
            </View>
            <View style={styles.transactionCopy}>
              <ThemedText type="smallBold">{transaction.title ?? transaction.categoryName}</ThemedText>
              {transaction.title && <ThemedText type="small" themeColor="textSecondary">{transaction.categoryName}</ThemedText>}
            </View>
            <ThemedText type="smallBold" style={styles.amount}>{formatPaise(transaction.amountPaise)}</ThemedText>
          </View>
        ))}
      </View>
    </View>
  ));
  return <View style={styles.transactions}>{sections}</View>;
}

const styles = StyleSheet.create({
  summary: { alignItems: 'center', gap: Spacing.two, padding: Spacing.four,
    borderWidth: 1, borderRadius: Radii.large, borderCurve: 'continuous' },
  total: { width: '100%', textAlign: 'center', fontSize: 46, lineHeight: 55, fontWeight: '700', letterSpacing: -1.5,
    fontVariant: ['tabular-nums'] },
  comparison: { maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: Spacing.one,
    paddingVertical: Spacing.one, paddingHorizontal: 10, borderRadius: Radii.pill },
  comparisonLabel: { flexShrink: 1 },
  skeletonBlock: { borderRadius: Radii.small },
  summarySkeleton: { alignItems: 'center', gap: Spacing.two, width: '100%' },
  totalSkeletonFrame: { height: 55, width: '100%', justifyContent: 'center', alignItems: 'center' },
  totalSkeleton: { width: '56%', maxWidth: 192, height: 38 },
  comparisonSkeleton: { width: 168, maxWidth: '100%', height: 29, borderRadius: Radii.pill },
  section: { gap: Spacing.two },
  sectionTitle: { fontSize: 18, lineHeight: 25, fontWeight: '600' },
  categories: { gap: 10 },
  category: { width: 94, gap: Spacing.one },
  pressed: { opacity: 0.7 },
  categoryCard: { borderRadius: Radii.medium, borderWidth: 1, overflow: 'hidden' },
  categoryIcon: { minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  categoryAmount: { minHeight: 27, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.one },
  categoryLabel: { textAlign: 'center', fontSize: 12, lineHeight: 17 },
  categoryIconSkeleton: { width: 26, height: 26, borderRadius: 7 },
  categoryAmountSkeleton: { width: 52, height: 12 },
  categoryLabelSkeletonFrame: { height: 17, justifyContent: 'center', alignItems: 'center' },
  categoryLabelSkeleton: { width: 64, height: 9 },
  transactions: { gap: Spacing.three },
  transactionGroup: { gap: Spacing.two },
  transactionCards: { gap: Spacing.two },
  transaction: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12,
    borderRadius: Radii.medium, borderWidth: 1 },
  transactionIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  transactionCopy: { flex: 1, minWidth: 0 },
  transactionHeadingSkeletonFrame: { height: 21, justifyContent: 'center' },
  transactionHeadingSkeleton: { width: 58, height: 12 },
  transactionCopySkeleton: { gap: Spacing.two },
  transactionTitleSkeleton: { width: '62%', maxWidth: 124, height: 13 },
  transactionCategorySkeleton: { width: '45%', maxWidth: 88, height: 10 },
  transactionAmountSkeleton: { width: 58, height: 12 },
  amount: { fontVariant: ['tabular-nums'] },
});
