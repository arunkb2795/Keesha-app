import { useRef, useState, type ComponentRef } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { DashboardIcon } from './dashboard-ui';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { expenseMonthBounds, expenseMonthLabel, expenseWeekDates, formatExpenseDate,
  shiftExpenseDay, type ExpensePeriod } from '@/domain/expenses';
import { useTheme } from '@/hooks/use-theme';

const weekdays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

function dayLabel(day: string) {
  return formatExpenseDate(new Date(day + 'T12:00:00'));
}

function weekLabel(first: string, last: string) {
  const start = shortDate.format(new Date(first));
  const end = first.slice(0, 7) === last.slice(0, 7) ? Number(last.slice(8)) : shortDate.format(new Date(last));
  const startYear = first.slice(0, 4);
  const endYear = last.slice(0, 4);
  return `${start}${startYear !== endYear ? ', ' + startYear : ''} – ${end}, ${endYear}`;
}

export function ExpensePeriodPicker({ period, today, onSelect }: {
  period: ExpensePeriod; today: string; onSelect: (period: ExpensePeriod) => void;
}) {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const trigger = useRef<ComponentRef<typeof Pressable>>(null);
  const [anchorBottom, setAnchorBottom] = useState<number>();
  const [weekDate, setWeekDate] = useState(today);
  const title = period.kind === 'day' ? dayLabel(period.date) : expenseMonthLabel(period.date);
  const panelWidth = Math.min(340, width - 2 * Spacing.three);
  const week = expenseWeekDates(weekDate);
  const previousDisabled = week[0] === '0001-01-01';
  const nextDisabled = week[6] >= today;
  const month = expenseMonthBounds(weekDate).start;

  function open() {
    trigger.current?.measureInWindow((_x, y, _width, buttonHeight) => {
      const currentMonth = expenseMonthBounds(today).start;
      setWeekDate(period.kind === 'month' && period.date === currentMonth ? today : period.date);
      setAnchorBottom(y + buttonHeight);
    });
  }

  function select(selection: ExpensePeriod) {
    onSelect(selection);
    setAnchorBottom(undefined);
  }

  const top = Math.max(Spacing.two, Math.min((anchorBottom ?? 0) + Spacing.two, height - 184));
  const isOpen = anchorBottom !== undefined;

  return (
    <>
      <Pressable ref={trigger} accessibilityRole="button" accessibilityLabel={`Choose date, ${title}`}
        accessibilityState={{ expanded: isOpen }} onPress={open}
        style={[styles.trigger, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
        <DashboardIcon name="calendar" size={16} color={colors.textSecondary} />
        <ThemedText type="smallBold" numberOfLines={1} adjustsFontSizeToFit style={styles.triggerLabel}>{title}</ThemedText>
        <DashboardIcon name="down" size={14} color={colors.textSecondary} />
      </Pressable>
      {isOpen && (
        <Modal transparent animationType="fade" onRequestClose={() => setAnchorBottom(undefined)}>
          <View style={styles.overlay}>
            <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Close calendar"
              onPress={() => setAnchorBottom(undefined)} />
            <View role="dialog" accessibilityViewIsModal accessibilityLabel="Choose spending date"
              style={[styles.panel, { width: panelWidth, top, maxHeight: height - top - Spacing.two,
                left: (width - panelWidth) / 2,
                backgroundColor: colors.backgroundElement, borderColor: colors.border, boxShadow: '0 8px 28px ' + colors.shadow }]}>
              <ScrollView contentContainerStyle={styles.calendar}>
                <View style={styles.weekBar}>
                  <Pressable accessibilityRole="button" accessibilityLabel="Previous week" disabled={previousDisabled}
                    onPress={() => setWeekDate(value => shiftExpenseDay(value, -7))}
                    style={[styles.navButton, previousDisabled && styles.disabled]}>
                    <DashboardIcon name="previous" size={18} color={colors.accent} />
                  </Pressable>
                  <ThemedText accessibilityRole="header" accessibilityLiveRegion="polite" type="smallBold">
                    {weekLabel(week[0], week[6])}
                  </ThemedText>
                  <Pressable accessibilityRole="button" accessibilityLabel="Next week" disabled={nextDisabled}
                    onPress={() => setWeekDate(value => shiftExpenseDay(value, 7))}
                    style={[styles.navButton, nextDisabled && styles.disabled]}>
                    <DashboardIcon name="next" size={18} color={colors.accent} />
                  </Pressable>
                </View>
                <View style={styles.week} accessible={false}>
                  {weekdays.map((label, index) => (
                    <ThemedText key={index} type="smallBold" themeColor="textSecondary"
                      style={styles.weekday}>{label}</ThemedText>
                  ))}
                </View>
                <View style={styles.week}>
                  {week.map(day => {
                    const selected = period.kind === 'day' && day === period.date;
                    const isToday = day === today;
                    const disabled = day > today;
                    return (
                      <Pressable key={day} accessibilityRole="button"
                        accessibilityLabel={dayLabel(day) + (isToday ? ', today' : '')}
                        accessibilityState={{ selected, disabled }} disabled={disabled}
                        onPress={() => select({ kind: 'day', date: day })}
                        style={({ pressed }) => [styles.day, {
                          borderColor: isToday ? colors.accent : 'transparent',
                          backgroundColor: selected ? colors.accent : isToday || pressed ? colors.accentSoft : 'transparent',
                        }, disabled && styles.disabled]}>
                        <ThemedText type="smallBold" themeColor={selected ? 'onAccent' : isToday ? 'accent' : 'text'}>
                          {Number(day.slice(8))}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={`View month, ${expenseMonthLabel(month)}`}
                  onPress={() => select({ kind: 'month', date: month })}
                  style={styles.monthAction}>
                  <ThemedText type="linkPrimary">View month</ThemedText>
                </Pressable>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: Radii.pill, borderWidth: 1, paddingHorizontal: 10, flexShrink: 1 },
  triggerLabel: { flexShrink: 1 },
  overlay: { flex: 1 },
  panel: { position: 'absolute', borderRadius: Radii.large, borderWidth: 1, overflow: 'hidden' },
  calendar: { padding: Spacing.two, gap: Spacing.half },
  weekBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  week: { flexDirection: 'row', gap: Spacing.half },
  weekday: { flex: 1, textAlign: 'center', paddingVertical: Spacing.one },
  day: { flex: 1, height: 40, borderWidth: 1, borderRadius: Radii.pill, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.38 },
  monthAction: { alignSelf: 'center', paddingHorizontal: Spacing.three, minHeight: 40, justifyContent: 'center' },
});
