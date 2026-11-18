import { randomUUID } from 'expo-crypto';
import { useRef, useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';

import { CategoryCard } from './category-card';
import { CategoryIconPicker } from './category-icon-picker';
import { AuthMessage } from '@/components/auth/auth-message';
import { ThemedText } from '@/components/themed-text';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { maxCategoryNameLength, type CategoryIcon, type ExpenseCategory, type NewCategory } from '@/domain/expenses';
import { ExpenseApiError } from '@/lib/expenses-api';

export function CreateCategorySheet({ categories, onCreate, onClose }: {
  categories: readonly ExpenseCategory[];
  onCreate: (input: NewCategory) => Promise<ExpenseCategory>;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<CategoryIcon>('grocery');
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string>();
  const [error, setError] = useState<string>();
  const pending = useRef(false);
  const attempt = useRef<{ payload: string; id: string }>(null);

  async function submit() {
    if (pending.current) return;
    const title = name.trim();
    if (!title || title.length > maxCategoryNameLength || /[\u0000-\u001f\u007f]/.test(title)) {
      setNameError('Enter a name of 1–12 characters.');
      return;
    }
    if (categories.some(category => category.name.toLocaleLowerCase() === title.toLocaleLowerCase())) {
      setNameError('A category with this name already exists.');
      return;
    }
    pending.current = true;
    setSaving(true); setNameError(undefined); setError(undefined);
    Keyboard.dismiss();
    try {
      const payload = JSON.stringify({ name: title, icon });
      if (attempt.current?.payload !== payload) attempt.current = { payload, id: randomUUID() };
      await onCreate({ id: attempt.current.id, name: title, icon });
      onClose();
    } catch (failure) {
      setError(failure instanceof ExpenseApiError ? failure.message : 'Couldn’t create your category. Try again.');
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  return (
    <BottomSheet label="Create category" busy={saving} onClose={onClose}>
      <View style={styles.preview}>
        <CategoryCard category={{ id: 'preview', name: name.trim() || 'New category', icon, isDefault: false }} amountPaise="0" />
      </View>
      <View style={styles.intro}>
        <ThemedText accessibilityRole="header" style={styles.title}>Create your category</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          Select an icon and a title for your new category.
        </ThemedText>
      </View>
      <CategoryIconPicker value={icon} onChange={setIcon} disabled={saving} />
      <TextField label="Title" placeholder="Title of your category" value={name} maxLength={maxCategoryNameLength}
        autoCapitalize="words" editable={!saving} error={nameError}
        onChangeText={value => { setName(value); setNameError(undefined); setError(undefined); }}
        onSubmitEditing={() => void submit()} returnKeyType="done" />
      <ThemedText type="small" themeColor="textSecondary" style={styles.counter}>{name.length}/{maxCategoryNameLength}</ThemedText>
      <AuthMessage message={error} />
      <Button label="Create category" loading={saving} disabled={!name.trim()} onPress={() => void submit()} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  preview: { alignItems: 'center', marginBottom: Spacing.one },
  intro: { gap: Spacing.one },
  title: { fontSize: 22, lineHeight: 30, fontWeight: '600', textAlign: 'center' },
  center: { textAlign: 'center' },
  counter: { textAlign: 'right', marginTop: -Spacing.two },
});
