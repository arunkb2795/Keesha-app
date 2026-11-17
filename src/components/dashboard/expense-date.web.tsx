import { useState } from 'react';
import { View } from 'react-native';

import { DashboardIcon } from './dashboard-ui';
import { type ExpenseDateProps } from './expense-date';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Radii, Spacing } from '@/constants/theme';
import { expenseDateKey, formatExpenseDate } from '@/domain/expenses';
import { useTheme } from '@/hooks/use-theme';

export function ExpenseDate({ value, onChange }: ExpenseDateProps) {
  const { colors, colorScheme } = useTheme();
  const [focused, setFocused] = useState(false);
  const [editing, setEditing] = useState(false);
  const dateLabel = formatExpenseDate(value);

  function openPicker(input: HTMLInputElement) {
    try {
      if (typeof input.showPicker === 'function') {
        input.showPicker();
        return;
      }
    } catch {
      // Some embedded browsers allow date entry but restrict the picker API.
    }
    setEditing(true);
  }

  return (
    <View style={{ gap: Spacing.two }}>
      <ThemedText type="smallBold">Date</ThemedText>
      <div style={{ position: 'relative', minHeight: 54, boxSizing: 'border-box', borderRadius: Radii.medium,
        border: `1px solid ${focused ? colors.accent : colors.border}`, padding: '0 15px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.backgroundElement }}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <ThemedText>{dateLabel}</ThemedText>
          <DashboardIcon name="calendar" color={colors.textSecondary} />
        </View>
        <input type="date" aria-label={`Date, ${dateLabel}`} value={expenseDateKey(value)}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); setEditing(false); }}
          onClick={event => openPicker(event.currentTarget)}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              openPicker(event.currentTarget);
            } else if (event.key.length === 1 || event.key.startsWith('Arrow')) {
              setEditing(true);
            }
          }}
          onChange={event => {
            const next = new Date(`${event.target.value}T12:00:00`);
            if (!Number.isNaN(next.getTime())) onChange(next);
          }}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', boxSizing: 'border-box',
            border: 0, borderRadius: Radii.medium, opacity: editing ? 1 : 0, cursor: 'pointer',
            padding: '0 15px', fontFamily: Fonts.sans, fontSize: 16, backgroundColor: colors.backgroundElement,
            color: colors.text, colorScheme }} />
      </div>
    </View>
  );
}
