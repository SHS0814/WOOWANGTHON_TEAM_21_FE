import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { BUTTON_MIN_HEIGHT, colors } from '@/theme';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  /** 어르신 화면은 32pt, 보호자 화면은 24pt */
  size?: 'elder' | 'guardian';
  disabled?: boolean;
  busy?: boolean;
  accessibilityHint?: string;
}

/** 가로 전체, 높이 72pt 이상인 버튼 */
export function BigButton({ label, onPress, variant = 'primary', size = 'elder', disabled, busy, accessibilityHint }: Props) {
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { minHeight: size === 'elder' ? 96 : BUTTON_MIN_HEIGHT },
        primary ? styles.primary : styles.secondary,
        (pressed || disabled) && { opacity: 0.6 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={primary ? colors.primaryText : colors.text} />
      ) : (
        <Text style={[styles.label, { fontSize: size === 'elder' ? 32 : 24 }, { color: primary ? colors.primaryText : colors.text }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'stretch',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
  },
  primary: { backgroundColor: colors.primary, borderColor: colors.primary },
  secondary: { backgroundColor: colors.secondaryBg, borderColor: colors.border },
  label: { fontWeight: '700', textAlign: 'center' },
});
