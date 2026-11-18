import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, StyleSheet, View } from 'react-native';

import { CategoryCard } from '@/components/categories/category-card';
import { CategoryIconPicker } from '@/components/categories/category-icon-picker';
import { DashboardScreen } from '@/components/dashboard/dashboard-ui';
import { ThemedText } from '@/components/themed-text';
import { BackButton } from '@/components/ui/back-button';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Radii, Spacing } from '@/constants/theme';
import { formatPaise, maxCategoryNameLength, type CategoryIcon, type ExpenseCategory } from '@/domain/expenses';
import { useMonthlyCategoryTotals } from '@/hooks/use-monthly-category-totals';
import { useTheme } from '@/hooks/use-theme';
import { ExpenseApiError } from '@/lib/expenses-api';
import { useCategories } from '@/providers/categories-provider';

export default function EditCategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const catalog = useCategories();
  const category = catalog.categories.find(item => item.id === id);
  const close = () => { if (router.canGoBack()) router.back(); else router.replace('/categories'); };
  if (!catalog.loading && !catalog.error && category) return <CategoryEditor key={id} category={category} onClose={close} />;
  return <DashboardScreen>
    <View style={styles.heading}><BackButton onPress={close} /><ThemedText style={styles.title}>Edit Category</ThemedText></View>
    {catalog.loading ? <ActivityIndicator accessibilityLabel="Loading category" /> : <>
      <ThemedText accessibilityLiveRegion="polite">{catalog.error ?? 'This category is no longer available.'}</ThemedText>
      <Button label="Retry categories" variant="secondary" onPress={catalog.reload} />
    </>}
  </DashboardScreen>;
}

function CategoryEditor({ category, onClose }: { category: ExpenseCategory; onClose: () => void }) {
  const catalog = useCategories();
  const { colors } = useTheme();
  const spending = useMonthlyCategoryTotals();
  // Preserve the loaded values as the expected state for conflict detection and retries.
  const [original] = useState(category);
  const [name, setName] = useState(category.name);
  const [icon, setIcon] = useState<CategoryIcon>(category.icon);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string>();
  const [error, setError] = useState<string>();
  const pending = useRef(false);
  const amount = spending.totals?.get(category.id) ?? (spending.totals ? '0' : undefined);
  const close = () => { if (!pending.current) { Keyboard.dismiss(); onClose(); } };
  async function save() {
    if (pending.current) return;
    const title = name.trim();
    if (!title || (title.length > maxCategoryNameLength && title !== original.name) || /[\u0000-\u001f\u007f]/.test(title)) {
      setNameError('Choose a name of 1–12 characters.'); return;
    }
    if (catalog.categories.some(item => item.id !== category.id && item.name.toLowerCase() === title.toLowerCase())) {
      setNameError('A category with this name already exists.'); return;
    }
    pending.current = true; setSaving(true); setError(undefined); setNameError(undefined); Keyboard.dismiss();
    try {
      await catalog.update({ id: category.id, name: title, icon, previousName: original.name, previousIcon: original.icon });
      onClose();
    } catch (failure) {
      setError(failure instanceof ExpenseApiError ? failure.message : 'Couldn’t save your category. Try again.');
    } finally { pending.current = false; setSaving(false); }
  }
  return <DashboardScreen>
    <View style={styles.heading}>
      <BackButton onPress={close} disabled={saving} />
      <View style={{ flex: 1 }}>
        <ThemedText accessibilityRole="header" style={styles.title}>Edit Category</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">Update your category details</ThemedText>
      </View>
    </View>
    <View style={styles.preview}>
      <CategoryCard category={{ ...category, name: name.trim() || 'Category', icon }} amountPaise={amount} />
    </View>
    <View style={styles.intro}>
      <ThemedText type="smallBold" style={styles.center}>Update your category</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.center}>Select the icon and title for your category</ThemedText>
    </View>
    <CategoryIconPicker value={icon} onChange={setIcon} disabled={saving} />
    <View style={{ gap: Spacing.two }}>
      <TextField label="Category Name" value={name} maxLength={Math.max(maxCategoryNameLength, original.name.length)}
        editable={!saving} autoCapitalize="words" error={nameError}
        onChangeText={value => { setName(value); setNameError(undefined); setError(undefined); }} />
      <ThemedText type="small" themeColor="textSecondary">Choose a short, recognizable name</ThemedText>
    </View>
    <View style={[styles.spending, { borderColor: colors.border, backgroundColor: colors.backgroundElement }]}>
      <ThemedText type="small" themeColor="textSecondary">Spending this month</ThemedText>
      <ThemedText style={styles.total}>{amount === undefined ? '—' : formatPaise(amount)}</ThemedText>
      <View style={{ height: 1, backgroundColor: colors.border }} />
      <ThemedText type="small" themeColor="textSecondary">Renaming this category won’t affect your existing expenses.</ThemedText>
      {spending.failed && <Button label="Retry spending" variant="secondary" onPress={spending.reload} />}
    </View>
    {error && <ThemedText type="small" accessibilityLiveRegion="polite" themeColor="error">{error}</ThemedText>}
    <View style={styles.actions}>
      <Button label="Save Changes" loading={saving} onPress={() => void save()} />
      <Button label="Cancel" variant="secondary" disabled={saving} onPress={close} />
    </View>
  </DashboardScreen>;
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  title: { fontSize: 22, lineHeight: 30, fontWeight: '600' },
  preview: { alignItems: 'center', marginTop: Spacing.two },
  intro: { gap: Spacing.one },
  center: { textAlign: 'center' },
  spending: { padding: Spacing.four, gap: Spacing.three, borderWidth: 1, borderRadius: Radii.large },
  total: { fontSize: 28, lineHeight: 36, fontWeight: '600', fontVariant: ['tabular-nums'] },
  actions: { gap: Spacing.two },
});
