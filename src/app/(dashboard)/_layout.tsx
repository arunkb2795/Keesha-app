import { useAuth } from '@clerk/expo';
import { usePathname } from 'expo-router';
import { TabList, TabSlot, Tabs, TabTrigger } from 'expo-router/ui';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View, type ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DashboardIcon, dashboardTabHeight } from '@/components/dashboard/dashboard-ui';
import { ExpenseActionsContext } from '@/components/dashboard/expense-actions';
import { ExpenseDrawer } from '@/components/dashboard/expense-drawer';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { type CategoryId } from '@/domain/expenses';
import { useTheme } from '@/hooks/use-theme';

const tabs = [
  { name: 'home', title: 'Home', href: '/home' },
  { name: 'history', title: 'History', href: '/history' },
  { name: 'settings', title: 'Settings', href: '/settings' },
] as const;

export default function DashboardLayout() {
  const { userId } = useAuth();
  return userId ? <DashboardTabs key={userId} /> : null;
}

function DashboardTabs() {
  const { colors } = useTheme();
  const path = usePathname();
  const [draft, setDraft] = useState<{ category?: CategoryId; amountPaise?: string } | null>(null);
  const [expenseRevision, setExpenseRevision] = useState(0);
  const openExpense = useCallback((category?: CategoryId, amountPaise?: string) => {
    setDraft({ category, amountPaise });
  }, []);

  return (
    <ExpenseActionsContext.Provider value={{ openExpense, expenseRevision }}>
      <Tabs style={[styles.layout, { backgroundColor: colors.background }]}>
        <TabSlot style={styles.slot} />
        <TabList asChild>
          <DashboardTabBar onAddExpense={path === '/home' ? () => openExpense() : undefined}>
            {tabs.map(tab => {
              const selected = path === tab.href;
              return (
                <TabTrigger key={tab.name} name={tab.name} href={tab.href} accessibilityRole="tab"
                  accessibilityLabel={tab.title} accessibilityState={{ selected }}
                  style={[styles.tab, selected && { backgroundColor: colors.accent }]}>
                  <DashboardIcon name={tab.name} color={selected ? colors.onAccent : colors.textSecondary} size={21} />
                  {selected && <ThemedText type="smallBold" themeColor="onAccent">{tab.title}</ThemedText>}
                </TabTrigger>
              );
            })}
          </DashboardTabBar>
        </TabList>
      </Tabs>
      {draft && (
        <ExpenseDrawer category={draft.category} categoryAmountPaise={draft.amountPaise}
          onSaved={() => setExpenseRevision(revision => revision + 1)} onClose={() => setDraft(null)} />
      )}
    </ExpenseActionsContext.Provider>
  );
}

function DashboardTabBar({ children, style, onAddExpense, ...props }: ViewProps & { onAddExpense?: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View {...props} style={[style, styles.footer, { bottom: Math.max(insets.bottom, Spacing.three) }]} pointerEvents="box-none">
      <View style={[styles.bar, {
        backgroundColor: `${colors.backgroundElement}E8`, borderColor: colors.border, boxShadow: '0 8px 32px ' + colors.shadow,
      }]}>
        {children}
      </View>
      {onAddExpense && (
        <Pressable accessibilityRole="button" accessibilityLabel="Add expense" onPress={onAddExpense}
          style={({ pressed }) => [styles.add, { backgroundColor: colors.accent,
            boxShadow: '0 8px 32px ' + colors.shadow, opacity: pressed ? 0.8 : 1 }]}>
          <DashboardIcon name="add" color={colors.onAccent} size={26} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  layout: { flex: 1 },
  slot: { flex: 1 },
  footer: { position: 'absolute', zIndex: 1, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  bar: { flexDirection: 'row', gap: Spacing.one, padding: Spacing.one, borderRadius: Radii.pill, borderWidth: 1 },
  add: { width: 54, height: 54, borderRadius: Radii.pill, alignItems: 'center', justifyContent: 'center' },
  tab: { minHeight: dashboardTabHeight, minWidth: 56, paddingHorizontal: 15, borderRadius: Radii.pill,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
});
