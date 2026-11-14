import { StyleSheet, Text, View } from 'react-native';

import { guardian } from '@/theme';

const C = guardian.color;
const STEPS = ['가족 만들기', 'QR로 연결', '약통 등록'];

/** 보호자 폰에서 하는 처음 설정 단계: 1 가족 만들기 → 2 QR 연결 → 3 약통 등록. 어르신 동의는 어르신 폰에서 한다 */
export function SetupSteps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <View style={styles.steps} accessible accessibilityLabel={`3단계 중 ${current}단계: ${STEPS[current - 1]}`}>
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const on = n === current;
        return (
          <View key={label} style={styles.step}>
            <View style={[styles.stepDot, (on || done) && { backgroundColor: C.primary, borderColor: C.primary }]}>
              <Text style={[styles.stepNum, (on || done) && { color: C.onPrimary }]}>{done ? '✓' : n}</Text>
            </View>
            <Text style={[styles.stepLabel, on && { color: C.text, fontWeight: '700' }]}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  steps: { flexDirection: 'row', gap: 8 },
  step: { flex: 1, alignItems: 'center', gap: 6 },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#C5CEDA',
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: { fontSize: 16, fontWeight: '800', color: C.sub },
  stepLabel: { fontSize: 16, color: C.sub, textAlign: 'center' },
});
