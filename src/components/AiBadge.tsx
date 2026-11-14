import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme';

interface Props {
  kind: 'ai' | 'guardian';
  isMock?: boolean;
  guardianName?: string;
  /** 어르신 화면이면 정보 부분을 28pt 로 (R-021 Q-003) */
  size?: 'elder' | 'guardian';
}

/**
 * 판독 결과 옆에 붙는 표시. 누가 판단했는지 구분한다 (원칙 1, 헌장 6장).
 * 정보 부분(어르신 "사진으로 확인", 보호자 "AI 판독", "○○ 판정")과 모의 표시 부분("모의 결과")을 나눈다 (R-021 Q-003).
 * 어르신 화면의 정보 부분은 28pt 이상, 모의 표시는 18pt 이상이다
 */
export function JudgeBadge({ kind, isMock, guardianName, size = 'guardian' }: Props) {
  const elder = size === 'elder';
  const info = kind === 'ai' ? (elder ? '사진으로 확인' : 'AI 판독') : `${guardianName ?? '보호자'} 판정`;
  return (
    <View style={styles.row}>
      <View style={styles.badge}>
        <Text style={[styles.text, { fontSize: elder ? 28 : 18 }]}>{info}</Text>
      </View>
      {kind === 'ai' && isMock ? (
        <View style={[styles.badge, styles.mock]} accessibilityLabel="모의 결과, 실제 AI 아님">
          <Text style={[styles.text, styles.mockText]}>모의 결과</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, alignSelf: 'flex-start' },
  badge: { borderWidth: 2, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  text: { fontSize: 18, fontWeight: '700', color: colors.text },
  mock: { backgroundColor: colors.mockBg, borderColor: colors.mockBg },
  mockText: { color: colors.mockText, fontSize: 18 },
});
