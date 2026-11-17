import { useId, useState } from 'react';
import { Pressable, StyleSheet, TextInput, type TextInputProps, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Radii, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type TextFieldProps = Omit<TextInputProps, 'secureTextEntry'> & {
  label: string;
  password?: boolean;
  error?: string;
};

export function TextField({ label, password = false, error, style, onFocus, onBlur, ...props }: TextFieldProps) {
  const { colors, colorScheme } = useTheme();
  const labelId = useId();
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.field}>
      <ThemedText nativeID={labelId} type="smallBold">{label}</ThemedText>
      <View style={[
        styles.control,
        { backgroundColor: colors.backgroundElement, borderColor: error ? colors.error : focused ? colors.accent : colors.border },
      ]}>
        <TextInput
          {...props}
          accessibilityLabel={error ? label + '. ' + error : label}
          accessibilityLabelledBy={labelId}
          autoCapitalize={props.autoCapitalize ?? 'none'}
          autoCorrect={false}
          secureTextEntry={password && !visible}
          placeholderTextColor={colors.placeholder}
          selectionColor={colors.accent}
          keyboardAppearance={colorScheme}
          onFocus={(event) => { setFocused(true); onFocus?.(event); }}
          onBlur={(event) => { setFocused(false); onBlur?.(event); }}
          style={[styles.input, { color: colors.text }, style]}
        />
        {password ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Hide ' + label.toLowerCase() : 'Show ' + label.toLowerCase()}
            accessibilityState={{ selected: visible, disabled: props.editable === false }}
            disabled={props.editable === false}
            onPress={() => setVisible(!visible)}
            style={styles.visibility}>
            <ThemedText type="smallBold" themeColor="accent">{visible ? 'Hide' : 'Show'}</ThemedText>
          </Pressable>
        ) : null}
      </View>
      {error ? <ThemedText type="small" themeColor="error" accessibilityLiveRegion="polite">{error}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: Spacing.two },
  control: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radii.medium,
    borderCurve: 'continuous',
    minHeight: 54,
  },
  input: {
    ...Typography.body,
    fontFamily: Fonts.sans,
    flex: 1,
    minWidth: 0,
    paddingHorizontal: Spacing.three,
    paddingVertical: 15,
  },
  visibility: { minHeight: 52, minWidth: 60, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.two },
});
