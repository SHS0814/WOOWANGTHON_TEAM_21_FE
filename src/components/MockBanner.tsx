import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/api';
import { onPendingScenario, pendingScenario, SCENARIO_LABELS } from '@/lib/devScenario';
import { useRole } from '@/lib/role';
import { colors } from '@/theme';

interface ServerFlags {
  readerIsMock: boolean;
  demo: boolean;
}

/** 서버가 모의 판독 중인지 (3.6 reader_is_mock, 토큰 전에는 3.1 health) */
async function loadFlags(): Promise<ServerFlags> {
  try {
    const me = await api.me();
    return { readerIsMock: me.server.reader_is_mock, demo: me.family.is_demo && me.server.demo_mode };
  } catch {
    try {
      return { readerIsMock: (await api.health()).reader.is_mock, demo: false };
    } catch {
      // 서버에 닿지 못하면 판독 결과도 없다
      return { readerIsMock: false, demo: false };
    }
  }
}

/** 모의 판독일 때만 모든 화면 맨 위에 항상 보이는 띠 (헌장 6장, R-008 5절, api.md 3.6) */
export function MockBanner() {
  const insets = useSafeAreaInsets();
  const { role } = useRole();
  const mockServer = api.mode === 'mock';
  const [flags, setFlags] = useState<ServerFlags>({ readerIsMock: mockServer, demo: mockServer });
  const [scenario, setScenario] = useState(pendingScenario());
  useEffect(() => onPendingScenario(() => setScenario(pendingScenario())), []);

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      void loadFlags().then((f) => alive && setFlags(mockServer ? { readerIsMock: true, demo: true } : f));
    };
    refresh();
    const off = api.subscribe(refresh);
    return () => {
      alive = false;
      off();
    };
  }, [role, mockServer]);

  // 실제 AI 판독이면 띠를 그리지 않는다 (시연 가족이어도). 시연 도구는 보호자 설정의 '시연 도구',
  // 어르신 홈의 날짜를 길게 눌러 연다. 시뮬레이션으로 연 건에는 화면마다 '시뮬레이션' 표시가 따로 붙는다
  if (!flags.readerIsMock) {
    return (
      <View style={{ height: insets.top, backgroundColor: colors.bg }}>
        {/* 밝은 배경이므로 시계·배터리 글자를 어둡게 */}
        <StatusBar style="dark" />
      </View>
    );
  }
  const showDev = mockServer || flags.demo;

  return (
    <View style={[styles.bar, { paddingTop: insets.top + 6 }]} accessibilityRole="header">
      <StatusBar style="light" />
      <Text style={styles.text}>
        모의 판독 (실제 AI 아님)
        {mockServer ? ' · 모의 서버' : ''}
        {scenario ? ` · 다음 사진: ${SCENARIO_LABELS[scenario]}` : ''}
      </Text>
      {showDev ? (
        <Pressable accessibilityRole="button" accessibilityLabel="개발 도구 열기" onPress={() => router.push('/dev')} style={styles.devBtn} hitSlop={8}>
          <Text style={styles.devText}>개발</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** 시연 트리거로 앞당긴 복약 건 표시 (api.md 3.27 is_simulated) */
export function SimulationTag() {
  return (
    <View style={styles.sim} accessibilityLabel="시뮬레이션. 실제 복약 시각 알림이 아니에요">
      <Text style={styles.simText}>시뮬레이션 · 실제 복약 시각 알림 아님</Text>
    </View>
  );
}

/** 판독 결과가 모의일 때 결과 화면에 붙는 배지 (api.md 3.18 is_mock) */
export function MockResultTag() {
  return (
    <View style={styles.mockTag}>
      <Text style={styles.mockTagText}>모의 결과</Text>
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
  devText: { color: colors.mockText, fontSize: 18, fontWeight: '700' },
  sim: { backgroundColor: colors.simBg, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, alignSelf: 'stretch' },
  simText: { color: colors.simText, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  mockTag: { alignSelf: 'center', backgroundColor: colors.mockBg, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4 },
  mockTagText: { color: colors.mockText, fontSize: 20, fontWeight: '700' },
});
