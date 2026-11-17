import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { DashboardIcon } from './dashboard-ui';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { formatExpenseDate } from '@/domain/expenses';
import { useTheme } from '@/hooks/use-theme';

export type ExpenseDateProps = { value: Date; onChange: (date: Date) => void };

export function ExpenseDate({ value, onChange }: ExpenseDateProps) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const dateLabel = formatExpenseDate(value);

  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">Date</ThemedText>
      <Pressable accessibilityRole="button" accessibilityLabel={`Date, ${dateLabel}`}
        accessibilityState={{ expanded: open }} onPress={() => setOpen(visible => !visible)}
        style={[styles.control, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
        <ThemedText>{dateLabel}</ThemedText>
        <DashboardIcon name="down" color={colors.textSecondary} />
      </Pressable>
      {open && <DateTimePicker value={value} mode="date" presentation="dialog" display={Platform.OS === 'ios' ? 'inline' : 'default'}
        onDismiss={() => setOpen(false)} onValueChange={(_, date) => { onChange(date); setOpen(false); }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: Spacing.two },
  control: { minHeight: 54, borderRadius: Radii.medium, borderWidth: 1, paddingHorizontal: Spacing.three,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
