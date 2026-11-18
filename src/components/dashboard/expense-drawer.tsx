import { useAuth } from '@clerk/expo';
import { randomUUID } from 'expo-crypto';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Keyboard, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, ScrollView,
  StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExpenseDate } from './expense-date';
import { CategoryCard } from '@/components/categories/category-card';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Radii, Spacing } from '@/constants/theme';
import { accountToday, expenseDateKey, parseExpensePaise, type CategoryId } from '@/domain/expenses';
import { useCategories } from '@/providers/categories-provider';
import { useTheme } from '@/hooks/use-theme';
import { ExpenseApiError, saveExpense } from '@/lib/expenses-api';

const useNativeDriver = Platform.OS !== 'web';

export function ExpenseDrawer({ category, categoryAmountPaise, onSaved, onClose }: {
  category?: CategoryId;
  categoryAmountPaise?: string;
  onSaved: () => void;
  onClose: () => void;
}) {
  const { getToken } = useAuth();
  const { colors } = useTheme();
  const { categories } = useCategories();
  const selectedCategory = categories.find(item => item.id === category);
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [translateY] = useState(() => new Animated.Value(height));
  const [closing, setClosing] = useState(false);
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(() => new Date(accountToday() + 'T12:00:00'));
  const [categoryId, setCategoryId] = useState<CategoryId>('other');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const pending = useRef(false);
  const attempt = useRef<{ payload: string; id: string; mutationId: string }>(null);
  const amountPaise = parseExpensePaise(amount);
  const trimmedTitle = title.trim();

  useEffect(() => {
    const entrance = Animated.timing(translateY, { toValue: 0, duration: 240, useNativeDriver });
    entrance.start();
    return () => { entrance.stop(); };
  }, [translateY]);

  const close = useCallback(() => {
    if (closing || saving) return;
    setClosing(true);
    Keyboard.dismiss();
    Animated.timing(translateY, { toValue: height, duration: 180, useNativeDriver }).start(({ finished }) => {
      if (finished) onClose();
    });
  }, [closing, height, onClose, saving, translateY]);

  async function submit() {
    if (pending.current || closing) return;
    setSubmitted(true);
    setError(undefined);
    if (amountPaise === null || !trimmedTitle) return;
    const expenseDate = expenseDateKey(date);
    if (expenseDate > accountToday()) {
      setError('Choose today or an earlier date.');
      return;
    }

    const expense = { amountPaise, title: trimmedTitle, expenseDate, categoryId: category ?? categoryId };
    const payload = JSON.stringify(expense);
    pending.current = true;
    setSaving(true);
    Keyboard.dismiss();
    try {
      if (attempt.current?.payload !== payload) {
        attempt.current = { payload, id: randomUUID(), mutationId: randomUUID() };
      }
      const { id, mutationId } = attempt.current;
      await saveExpense(getToken, mutationId, { id, ...expense });
      onSaved();
      pending.current = false;
      close();
    } catch (failure) {
      setError(failure instanceof ExpenseApiError ? failure.message : 'Couldn’t save your expense. Try again.');
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  const drag = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, gesture) =>
      !closing && !saving && gesture.dy > 8 && gesture.dy > Math.abs(gesture.dx),
    onPanResponderMove: (_, gesture) => translateY.setValue(Math.max(0, gesture.dy)),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dy > 80 || (gesture.dy > 25 && gesture.vy > 0.8)) close();
      else Animated.spring(translateY, { toValue: 0, useNativeDriver }).start();
    },
    onPanResponderTerminate: () => Animated.spring(translateY, { toValue: 0, useNativeDriver }).start(),
  }), [close, closing, saving, translateY]);

  return (
    <Modal transparent onRequestClose={close} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView style={styles.modal} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss expense drawer" onPress={close} style={styles.backdrop} />
        <Animated.View role="dialog" accessibilityViewIsModal accessibilityLabel="Add expense"
          style={[styles.sheet, { backgroundColor: colors.backgroundElement, borderColor: colors.border, transform: [{ translateY }] }]}>
          <View {...drag.panHandlers} style={styles.grabArea}>
            <Pressable accessibilityRole="button" accessibilityLabel="Close expense drawer" onPress={close} style={styles.grabButton}>
              <View style={[styles.handle, { backgroundColor: colors.placeholder }]} />
            </Pressable>
          </View>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.intro}>
              {selectedCategory && <CategoryCard category={selectedCategory} amountPaise={categoryAmountPaise} />}
              <View style={styles.introCopy}>
                <ThemedText accessibilityRole="header" style={styles.heading}>Enter your expense</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
                  Enter the amount you spent on your expense
                </ThemedText>
              </View>
            </View>
            <TextField label="Amount (₹)" value={amount} placeholder="Enter your expense amount" inputMode="decimal" maxLength={12}
              autoFocus editable={!saving}
              error={submitted && amountPaise === null ? 'Enter ₹0.01 to ₹99,99,999.99 with up to two decimals.' : undefined}
              onChangeText={text => {
                const normalized = text.replace(',', '.');
                if (!/^\d*(?:\.\d{0,2})?$/.test(normalized)) return;
                setAmount(normalized);
              }} />
            <TextField label="Title" value={title} placeholder="Title of your expense" autoCapitalize="sentences" maxLength={200}
              editable={!saving}
              error={submitted && !trimmedTitle ? 'Enter an expense title.' : undefined}
              onChangeText={setTitle} />
            {!category && <>
              <ThemedText type="smallBold">Category</ThemedText>
              <View style={styles.categories}>
                {categories.map(item => (
                  <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: item.id === categoryId }}
                    disabled={saving} onPress={() => setCategoryId(item.id)}
                    style={[styles.category, { borderColor: item.id === categoryId ? colors.accent : colors.border,
                      backgroundColor: item.id === categoryId ? colors.accentSoft : colors.backgroundElement }]}>
                    <ThemedText type="small">{item.name}</ThemedText>
                  </Pressable>
                ))}
              </View>
            </>}
            <ExpenseDate value={date} onChange={next => { if (!pending.current) { setDate(next); setError(undefined); } }} />
          </ScrollView>
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.three) }]}>
            <Button label="Add expense" loading={saving} disabled={closing} onPress={() => void submit()} />
            {error && <ThemedText type="small" accessibilityLiveRegion="polite">{error}</ThemedText>}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(10, 18, 13, 0.48)' },
  sheet: { width: '100%', maxWidth: 480, maxHeight: '94%', borderTopLeftRadius: Radii.large, borderTopRightRadius: Radii.large,
    borderWidth: 1, borderBottomWidth: 0 },
  grabArea: { alignItems: 'center' },
  grabButton: { width: '100%', minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 42, height: 4, borderRadius: Radii.pill },
  scroll: { flexGrow: 0, flexShrink: 1 },
  content: { gap: Spacing.three, paddingHorizontal: Spacing.four, paddingBottom: Spacing.two },
  intro: { alignItems: 'center', gap: Spacing.three, marginBottom: Spacing.two },
  introCopy: { gap: Spacing.one },
  heading: { fontSize: 22, lineHeight: 30, fontWeight: '600', textAlign: 'center' },
  subtitle: { textAlign: 'center' },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  category: { minHeight: 48, justifyContent: 'center', borderWidth: 1, borderRadius: Radii.pill, paddingHorizontal: Spacing.three },
  footer: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three, gap: Spacing.two },
});
