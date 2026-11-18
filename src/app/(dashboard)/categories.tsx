import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { CreateCategorySheet } from '@/components/categories/create-category-sheet';
import { DashboardHeading, DashboardIcon, DashboardScreen } from '@/components/dashboard/dashboard-ui';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Radii, Spacing } from '@/constants/theme';
import { formatPaise } from '@/domain/expenses';
import { useMonthlyCategoryTotals } from '@/hooks/use-monthly-category-totals';
import { useTheme } from '@/hooks/use-theme';
import { useCategories } from '@/providers/categories-provider';

export default function ManageCategoriesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const catalog = useCategories();
  const spending = useMonthlyCategoryTotals();
  const [creating, setCreating] = useState(false);
  return <DashboardScreen>
    <DashboardHeading title="Manage Categories" subtitle="Customize your expense categories" />
    <View style={styles.sectionHeader}>
      <ThemedText type="smallBold">Your Categories</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">{catalog.categories.length} categories</ThemedText>
    </View>
    {catalog.loading && <ActivityIndicator accessibilityLabel="Loading categories" color={colors.accent} />}
    {catalog.error && <View style={styles.message}>
      <ThemedText type="small" accessibilityLiveRegion="polite">{catalog.error}</ThemedText>
      <Button label="Retry categories" variant="secondary" onPress={catalog.reload} />
    </View>}
    {spending.failed && <View style={styles.message}>
      <ThemedText type="small">Couldn’t load this month’s spending.</ThemedText>
      <Button label="Retry spending" variant="secondary" onPress={spending.reload} />
    </View>}
    <View style={styles.list}>
      {catalog.categories.map(category => <Pressable key={category.id} accessibilityRole="button"
        accessibilityLabel={`Edit ${category.name} category`} disabled={catalog.loading || Boolean(catalog.error)}
        onPress={() => router.push({ pathname: '/categories/[id]', params: { id: category.id } })}
        style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.backgroundSelected : colors.backgroundElement,
          borderColor: colors.border,
          opacity: catalog.loading ? 0.5 : 1 }]}>
        <View style={[styles.icon, { backgroundColor: colors.accentSoft }]}>
          <DashboardIcon name={category.icon} color={colors.accent} />
        </View>
        <View style={styles.copy}>
          <ThemedText type="smallBold">{category.name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {spending.totals ? `${formatPaise(spending.totals.get(category.id) ?? '0')} spent this month`
              : spending.failed ? 'Spending unavailable' : 'Loading spending…'}
          </ThemedText>
        </View>
        <DashboardIcon name="edit" color={colors.textSecondary} size={20} />
      </Pressable>)}
    </View>
    <Button label="Create category" disabled={catalog.loading || Boolean(catalog.error)} onPress={() => setCreating(true)} />
    {creating && <CreateCategorySheet categories={catalog.categories} onCreate={catalog.create} onClose={() => setCreating(false)} />}
  </DashboardScreen>;
}

const styles = StyleSheet.create({
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  list: { gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12,
    borderRadius: Radii.medium, borderWidth: 1 },
  icon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0 },
  message: { gap: Spacing.two },
});
