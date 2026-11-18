import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { DashboardIcon } from '@/components/dashboard/dashboard-ui';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { type CategoryId, type ExpenseCategory } from '@/domain/expenses';
import { useTheme } from '@/hooks/use-theme';

export function TransactionCategoryFilter({ categories, selectedId, onSelect }: {
  categories: readonly ExpenseCategory[]; selectedId?: CategoryId; onSelect: (id?: CategoryId) => void;
}) {
  const { colors } = useTheme();
  const options = [{ id: undefined, name: 'All' }, ...categories];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="normal"
      testID="transaction-category-filters" accessibilityRole="radiogroup" accessibilityLabel="Filter transactions by category"
      contentContainerStyle={styles.options}>
      {options.map(option => {
        const selected = selectedId === option.id;
        return (
          <Pressable key={option.id ?? 'all'} accessibilityRole="radio"
            accessibilityLabel={option.id ? `Filter transactions: ${option.name}` : 'All categories'}
            accessibilityState={{ checked: selected }} aria-checked={selected} onPress={() => onSelect(option.id)}
            style={({ pressed }) => [styles.option, { borderColor: selected ? colors.accent : colors.border,
              backgroundColor: selected ? colors.accent : colors.backgroundElement, opacity: pressed ? 0.75 : 1 }]}>
            {option.id === undefined && <DashboardIcon name="filter" size={17}
              color={selected ? colors.onAccent : colors.textSecondary} />}
            <ThemedText type="smallBold" style={{ color: selected ? colors.onAccent : colors.textSecondary }}>{option.name}</ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  options: { flexDirection: 'row', gap: Spacing.two, paddingVertical: Spacing.one },
  option: { minHeight: 44, borderWidth: 1, borderRadius: Radii.small, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three },
});
