import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, type MockScenario } from '@/api';
import { colors } from '@/theme';

export const SCENARIO_LABELS: Record<MockScenario, string> = {
  normal: '정상',
  unclear: '애매',
  unchanged: '칸 그대로',
  double_suspected: '이중 의심',
};

/** 모의 구현을 쓰는 동안 모든 화면 맨 위에 항상 보이는 띠 (헌장 6장, R-008 5절) */
export function MockBanner() {
  const insets = useSafeAreaInsets();
  const [scenario, setScenario] = useState(api.dev?.getScenario());
  useEffect(() => api.subscribe(() => setScenario(api.dev?.getScenario())), []);

  if (!api.isMock) return <View style={{ height: insets.top, backgroundColor: colors.bg }} />;

  return (
    <View style={[styles.bar, { paddingTop: insets.top + 6 }]} accessibilityRole="header">
      <Text style={styles.text} accessibilityLabel="모의 판독, 실제 AI 아님">
        모의 판독 (실제 AI 아님){scenario ? ` · ${SCENARIO_LABELS[scenario]}` : ''}
      </Text>
      {api.dev ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="개발 도구 열기"
          onPress={() => router.push('/dev')}
          style={styles.devBtn}
          hitSlop={8}
        >
          <Text style={styles.devText}>개발</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** 개발용 시뮬레이션으로 띄운 화면 표시 */
export function SimulationTag() {
  return (
    <View style={styles.sim} accessibilityLabel="시뮬레이션. 실제 복약 시각 알림이 아니에요">
      <Text style={styles.simText}>시뮬레이션 · 실제 복약 시각 알림 아님</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.mockBg,
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  text: { color: colors.mockText, fontSize: 18, fontWeight: '700', flexShrink: 1 },
  devBtn: { borderWidth: 2, borderColor: colors.mockText, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  devText: { color: colors.mockText, fontSize: 16, fontWeight: '700' },
  sim: { backgroundColor: colors.simBg, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, alignSelf: 'stretch' },
  simText: { color: colors.simText, fontSize: 20, fontWeight: '700', textAlign: 'center' },
});
