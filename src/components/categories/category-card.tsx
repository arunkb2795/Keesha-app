import { StyleSheet, View } from 'react-native';

import { DashboardIcon } from '@/components/dashboard/dashboard-ui';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { formatPaise, type ExpenseCategory } from '@/domain/expenses';
import { useTheme } from '@/hooks/use-theme';

export function CategoryCard({ category, amountPaise }: { category: ExpenseCategory; amountPaise?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.category}>
      <View style={[styles.card, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
        <View style={styles.icon}><DashboardIcon name={category.icon} size={24} color={colors.accent} /></View>
        {amountPaise !== undefined && <View style={[styles.amount, { backgroundColor: colors.accentSoft }]}>
          <ThemedText themeColor="accent" type="smallBold" numberOfLines={1} adjustsFontSizeToFit>
            {formatPaise(amountPaise)}
          </ThemedText>
        </View>}
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.label}>{category.name}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  category: { width: 94, gap: Spacing.one },
  card: { borderRadius: Radii.medium, borderWidth: 1, overflow: 'hidden' },
  icon: { minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  amount: { minHeight: 27, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.one },
  label: { textAlign: 'center', fontSize: 12, lineHeight: 17 },
});
