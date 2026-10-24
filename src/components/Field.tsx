import { StyleSheet, TextInput, View } from 'react-native';

import { T } from '@/components/Text';
import { colors } from '@/theme';

export function Field({ label, value, onChangeText, placeholder }: { label: string; value: string; onChangeText: (t: string) => void; placeholder?: string }) {
  return (
    <View style={{ gap: 6 }}>
      <T style={{ fontWeight: '700' }}>{label}</T>
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} accessibilityLabel={label} style={styles.input} />
    </View>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 2, borderColor: colors.border, borderRadius: 12, fontSize: 24, padding: 14, color: colors.text, minHeight: 64 },
});
