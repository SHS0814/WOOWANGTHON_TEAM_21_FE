import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme';

/** 판독 결과 옆에 붙는 표시. 누가 판단했는지 구분한다 (원칙 1, 헌장 6장) */
export function JudgeBadge({ kind, isMock, guardianName }: { kind: 'ai' | 'guardian'; isMock?: boolean; guardianName?: string }) {
  const text = kind === 'ai' ? (isMock ? 'AI 판독 · 모의 결과' : 'AI 판독') : `${guardianName ?? '보호자'} 판정`;
  return (
    <View style={[styles.badge, kind === 'ai' && isMock && styles.mock]}>
      <Text style={[styles.text, kind === 'ai' && isMock && styles.mockText]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', borderWidth: 2, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  text: { fontSize: 16, fontWeight: '700', color: colors.text },
  mock: { backgroundColor: colors.mockBg, borderColor: colors.mockBg },
  mockText: { color: colors.mockText },
});
