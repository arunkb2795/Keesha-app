import { Image } from 'expo-image';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { type PropsWithChildren, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { BackButton } from '@/components/ui/back-button';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const symbols = {
  categories: { ios: 'square.grid.2x2', android: 'category', web: 'category' },
  edit: { ios: 'pencil', android: 'edit', web: 'edit' },
  home: { ios: 'house', android: 'home', web: 'home' },
  history: { ios: 'clock', android: 'history', web: 'history' },
  settings: { ios: 'gearshape', android: 'settings', web: 'settings' },
  grocery: { ios: 'cart', android: 'shopping_cart', web: 'shopping_cart' },
  food: { ios: 'fork.knife', android: 'restaurant', web: 'restaurant' },
  shopping: { ios: 'bag', android: 'shopping_bag', web: 'shopping_bag' },
  medical: { ios: 'cross.case', android: 'medical_services', web: 'medical_services' },
  transport: { ios: 'tram', android: 'directions_transit', web: 'directions_transit' },
  bills: { ios: 'receipt', android: 'receipt_long', web: 'receipt_long' },
  entertainment: { ios: 'film', android: 'movie', web: 'movie' },
  travel: { ios: 'airplane', android: 'flight', web: 'flight' },
  education: { ios: 'graduationcap', android: 'school', web: 'school' },
  other: { ios: 'square.grid.2x2', android: 'category', web: 'category' },
  add: { ios: 'plus', android: 'add', web: 'add' },
  bell: { ios: 'bell', android: 'notifications', web: 'notifications' },
  back: { ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' },
  trendDown: { ios: 'arrow.down.right', android: 'trending_down', web: 'trending_down' },
  trendUp: { ios: 'arrow.up.right', android: 'trending_up', web: 'trending_up' },
  person: { ios: 'person', android: 'person', web: 'person' },
  calendar: { ios: 'calendar', android: 'calendar_today', web: 'calendar_today' },
  down: { ios: 'chevron.down', android: 'keyboard_arrow_down', web: 'keyboard_arrow_down' },
  previous: { ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' },
  next: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  fitness: { ios: 'dumbbell', android: 'fitness_center', web: 'fitness_center' },
  gift: { ios: 'gift', android: 'redeem', web: 'redeem' },
  work: { ios: 'briefcase', android: 'work', web: 'work' },
  pet: { ios: 'pawprint', android: 'pets', web: 'pets' },
  coffee: { ios: 'cup.and.saucer', android: 'local_cafe', web: 'local_cafe' },
  car: { ios: 'car', android: 'directions_car', web: 'directions_car' },
  bicycle: { ios: 'bicycle', android: 'pedal_bike', web: 'pedal_bike' },
  fuel: { ios: 'fuelpump', android: 'local_gas_station', web: 'local_gas_station' },
  parking: { ios: 'parkingsign', android: 'local_parking', web: 'local_parking' },
  bank: { ios: 'building.columns', android: 'account_balance', web: 'account_balance' },
  savings: { ios: 'banknote', android: 'savings', web: 'savings' },
  phone: { ios: 'iphone', android: 'smartphone', web: 'smartphone' },
  internet: { ios: 'wifi', android: 'wifi', web: 'wifi' },
  music: { ios: 'music.note', android: 'music_note', web: 'music_note' },
  game: { ios: 'gamecontroller', android: 'sports_esports', web: 'sports_esports' },
  beauty: { ios: 'scissors', android: 'content_cut', web: 'content_cut' },
  clothing: { ios: 'tshirt', android: 'checkroom', web: 'checkroom' },
  baby: { ios: 'figure.child', android: 'child_care', web: 'child_care' },
  plants: { ios: 'leaf', android: 'potted_plant', web: 'potted_plant' },
  tools: { ios: 'wrench.and.screwdriver', android: 'construction', web: 'construction' },
  check: { ios: 'checkmark', android: 'check', web: 'check' },
  filter: { ios: 'line.3.horizontal.decrease', android: 'filter_list', web: 'filter_list' },
} as const satisfies Record<string, SymbolViewProps['name']>;

export type DashboardIconName = keyof typeof symbols;
export const dashboardTabHeight = 46;

export function DashboardIcon({ name, color, size = 21 }: { name: DashboardIconName; color: string; size?: number }) {
  return <SymbolView name={symbols[name]} tintColor={color} size={size} accessible={false} />;
}

export function DashboardScreen({ children, header }: PropsWithChildren<{ header?: ReactNode }>) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, Spacing.three) + dashboardTabHeight + 2 * Spacing.one + 2 + Spacing.four;

  const content = (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets contentInsetAdjustmentBehavior={header ? 'never' : 'automatic'}
      contentContainerStyle={[styles.scroll, { paddingBottom: bottomPadding },
        header ? styles.scrollBelowHeader : Platform.OS === 'android' && { paddingTop: insets.top + Spacing.four }]}>
      <View style={styles.content}>{children}</View>
    </ScrollView>
  );
  if (!header) return content;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.fixedHeader, { paddingTop: insets.top + Spacing.four }]}>
        <View style={styles.content}>{header}</View>
      </View>
      {content}
    </View>
  );
}

export function DashboardHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.headingRow}>
      <BackButton fallback="/home" />
      <View style={styles.heading}>
        <ThemedText type="title" accessibilityRole="header">{title}</ThemedText>
        {subtitle && <ThemedText themeColor="textSecondary">{subtitle}</ThemedText>}
      </View>
    </View>
  );
}

export function DashboardEmptyState({ icon, title, message }: { icon: DashboardIconName; title: string; message: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.empty, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.accentSoft }]}>
        <DashboardIcon name={icon} size={28} color={colors.accent} />
      </View>
      <ThemedText accessibilityRole="header" type="smallBold">{title}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.emptyMessage}>{message}</ThemedText>
    </View>
  );
}

export function ProfileAvatar({ imageUrl, name }: { imageUrl?: string; name?: string | null }) {
  const { colors } = useTheme();
  const initials = name?.trim().split(/\s+/).slice(0, 2).map(word => word.charAt(0).toUpperCase()).join('');

  return (
    <View style={[styles.avatar, { backgroundColor: colors.accentSoft, borderColor: colors.border }]}>
      {initials ? <ThemedText type="smallBold" themeColor="accent">{initials}</ThemedText>
        : <DashboardIcon name="person" color={colors.accent} />}
      {imageUrl && <Image source={imageUrl} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, alignItems: 'center', paddingHorizontal: Spacing.three, paddingTop: Spacing.four },
  scrollBelowHeader: { paddingTop: Spacing.two },
  fixedHeader: { alignItems: 'center', paddingHorizontal: Spacing.three, paddingBottom: Spacing.three },
  content: { width: '100%', maxWidth: 480, gap: Spacing.four },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  heading: { flex: 1, minWidth: 0, gap: Spacing.one },
  empty: { alignItems: 'center', gap: Spacing.two, padding: Spacing.four, borderRadius: Radii.large, borderWidth: 1 },
  emptyIcon: { width: 56, height: 56, borderRadius: Radii.pill, alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.one },
  emptyMessage: { textAlign: 'center', maxWidth: 280 },
  avatar: { width: 46, height: 46, borderRadius: Radii.pill, overflow: 'hidden', borderWidth: 1,
    alignItems: 'center', justifyContent: 'center' },
});
