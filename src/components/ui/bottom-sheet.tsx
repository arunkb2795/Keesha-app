import { type PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function BottomSheet({ label, busy = false, onClose, children }: PropsWithChildren<{
  label: string; busy?: boolean; onClose: () => void;
}>) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const close = () => { if (!busy) onClose(); };
  return (
    <Modal transparent animationType="slide" onRequestClose={close} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView style={styles.modal} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Dismiss ${label.toLowerCase()}`}
          disabled={busy} onPress={close} style={styles.backdrop} />
        <View role="dialog" accessibilityViewIsModal accessibilityLabel={label}
          style={[styles.sheet, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Close ${label.toLowerCase()}`}
            disabled={busy} onPress={close} style={styles.grabButton}>
            <View style={[styles.handle, { backgroundColor: colors.placeholder }]} />
          </Pressable>
          <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets
            style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, Spacing.four) }]}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(10, 18, 13, 0.48)' },
  sheet: { width: '100%', maxWidth: 480, maxHeight: '94%', borderTopLeftRadius: Radii.large,
    borderTopRightRadius: Radii.large, borderWidth: 1, borderBottomWidth: 0 },
  grabButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 42, height: 4, borderRadius: Radii.pill },
  scroll: { flexGrow: 0, flexShrink: 1 },
  content: { paddingHorizontal: Spacing.four, gap: Spacing.three },
});
