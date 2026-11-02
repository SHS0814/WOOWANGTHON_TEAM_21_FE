import { StyleSheet, TextInput, View } from 'react-native';

import { T } from '@/components/Text';
import { colors } from '@/theme';

interface Props {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  /** 코드처럼 대소문자를 구분하는 값: 자동 대문자·자동 고침을 끈다 */
  verbatim?: boolean;
}

export function Field({ label, value, onChangeText, placeholder, verbatim }: Props) {
  return (
    <View style={{ gap: 6 }}>
      <T style={{ fontWeight: '700' }}>{label}</T>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        accessibilityLabel={label}
        style={styles.input}
        {...(verbatim ? { autoCapitalize: 'none' as const, autoCorrect: false, spellCheck: false } : {})}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 2, borderColor: colors.border, borderRadius: 12, fontSize: 24, padding: 14, color: colors.text, minHeight: 64 },
});
