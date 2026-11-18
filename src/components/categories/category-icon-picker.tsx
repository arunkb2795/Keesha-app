import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { DashboardIcon } from '@/components/dashboard/dashboard-ui';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { categoryIconIds, type CategoryIcon } from '@/domain/expenses';
import { useTheme } from '@/hooks/use-theme';

const labels: Record<CategoryIcon, string> = {
  food: 'Food', grocery: 'Groceries', transport: 'Transport', shopping: 'Shopping', bills: 'Bills',
  medical: 'Health', entertainment: 'Entertainment', travel: 'Travel', education: 'Education', other: 'Other',
  home: 'Home', person: 'Personal', fitness: 'Fitness', gift: 'Gifts', work: 'Work', pet: 'Pets',
  coffee: 'Coffee', car: 'Car', bicycle: 'Bicycle', fuel: 'Fuel', parking: 'Parking', bank: 'Banking',
  savings: 'Savings', phone: 'Phone', internet: 'Internet', music: 'Music', game: 'Gaming',
  beauty: 'Beauty', clothing: 'Clothing', baby: 'Baby', plants: 'Plants', tools: 'Tools',
};

export function CategoryIconPicker({ value, onChange, disabled = false }: {
  value: CategoryIcon; onChange: (icon: CategoryIcon) => void; disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">Icon</ThemedText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="normal"
        testID="category-icon-picker" contentContainerStyle={styles.options}
        accessibilityLabel="Category icons">
        {categoryIconIds.map(icon => {
          const selected = value === icon;
          return (
            <Pressable key={icon} accessibilityRole="button" accessibilityLabel={`${labels[icon]} icon`}
              accessibilityState={{ selected, disabled }} disabled={disabled} onPress={() => onChange(icon)}
              style={({ pressed }) => [styles.option, { borderColor: selected ? colors.accent : colors.border,
                backgroundColor: selected ? colors.accentSoft : colors.backgroundElement, opacity: pressed ? 0.7 : 1 }]}>
              <DashboardIcon name={icon} size={25} color={colors.accent} />
              {selected && <View style={[styles.check, { backgroundColor: colors.accent }]}>
                <DashboardIcon name="check" size={11} color={colors.onAccent} />
              </View>}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: Spacing.two },
  options: { gap: Spacing.two, paddingVertical: Spacing.one, paddingHorizontal: 2 },
  option: { width: 52, height: 52, borderRadius: Radii.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  check: { position: 'absolute', top: -2, right: -2, width: 18, height: 18, borderRadius: Radii.pill,
    alignItems: 'center', justifyContent: 'center' },
});
