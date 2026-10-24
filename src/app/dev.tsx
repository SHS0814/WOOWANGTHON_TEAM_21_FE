import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { api, type MockScenario } from '@/api';
import { SCENARIO_LABELS } from '@/components/MockBanner';
import { useRole } from '@/lib/role';
import { colors } from '@/theme';

/** 개발용 도구. 모의 구현일 때만 열린다. 시연 영상에서는 "모의·시뮬레이션" 표시가 같이 보인다 */
export default function DevPanel() {
  const { role, setRole } = useRole();
  const dev = api.dev;
  const [scenario, setScenario] = useState<MockScenario | undefined>(dev?.getScenario());
  const [msg, setMsg] = useState('');

  if (!dev) return null;

  const pick = (s: MockScenario) => {
    dev.setScenario(s);
    setScenario(s);
  };

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <Text style={styles.h}>개발 도구 (모의)</Text>

      <Text style={styles.label}>다음 판독 결과 (모의 판독)</Text>
      <View style={styles.wrap}>
        {(Object.keys(SCENARIO_LABELS) as MockScenario[]).map((s) => (
          <Pressable key={s} onPress={() => pick(s)} style={[styles.chip, scenario === s && styles.chipOn]} accessibilityRole="radio" accessibilityState={{ selected: scenario === s }}>
            <Text style={[styles.chipText, scenario === s && styles.chipTextOn]}>
              {scenario === s ? '● ' : '○ '}
              {SCENARIO_LABELS[s]}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>복약 시간</Text>
      <Btn
        label="지금 약 시간 시뮬레이션"
        onPress={async () => {
          const ev = await dev.simulateDoseTime();
          if (!ev) return setMsg('오늘 남은 복약 건이 없어요. 아래에서 오늘 기록을 초기화하세요.');
          if (role === 'elder') {
            router.dismissAll();
            router.push({ pathname: '/elder/ask/[id]', params: { id: ev.id } });
          } else setMsg('어르신 폰에서 질문 화면이 열린 상태가 됐어요.');
        }}
      />
      <Btn
        label="무응답 한 단계 (재질문 → 인계)"
        onPress={async () => {
          const ev = await dev.simulateNoResponseStep();
          if (!ev) return setMsg('열려 있는 질문이 없어요.');
          setMsg(ev.state === 'handed_off' ? '보호자에게 인계됐어요 (무응답 / 칸 그대로).' : `재질문 ${ev.reask_count}회째`);
        }}
      />

      <Text style={styles.label}>데이터</Text>
      <Btn
        label="오늘 기록 초기화"
        onPress={async () => {
          await dev.reset();
          setMsg('초기화했어요. 가족 연결은 유지돼요.');
        }}
      />
      <Btn
        label={`역할 바꾸기 (지금: ${role === 'elder' ? '어르신' : role === 'guardian' ? '보호자' : '없음'})`}
        onPress={async () => {
          await setRole(null);
          router.dismissAll();
          router.replace('/role');
        }}
      />
      {msg ? <Text style={styles.msg}>{msg}</Text> : null}
      <Btn label="닫기" onPress={() => router.back()} />
    </ScrollView>
  );
}

function Btn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.btn} accessibilityRole="button">
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { padding: 20, gap: 12, backgroundColor: colors.bg },
  h: { fontSize: 26, fontWeight: '700', color: colors.mockBg },
  label: { fontSize: 18, fontWeight: '700', marginTop: 8, color: colors.text },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 2, borderColor: colors.mockBg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  chipOn: { backgroundColor: colors.mockBg },
  chipText: { fontSize: 18, color: colors.mockBg, fontWeight: '700' },
  chipTextOn: { color: colors.mockText },
  btn: { borderWidth: 2, borderColor: colors.border, borderRadius: 10, minHeight: 56, justifyContent: 'center', paddingHorizontal: 14 },
  btnText: { fontSize: 18, color: colors.text, fontWeight: '600' },
  msg: { fontSize: 18, color: colors.attention },
});
