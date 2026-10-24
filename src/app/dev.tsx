import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { api, isApiError, type DoseEvent, type MockScenario } from '@/api';
import { onPendingScenario, pendingScenario, SCENARIO_LABELS, setPendingScenario } from '@/lib/devScenario';
import { goBackOr } from '@/lib/nav';
import { useRole } from '@/lib/role';
import { TIME_OF_DAY_LABELS } from '@/lib/time';
import { useApiData } from '@/lib/useApiData';
import { useMe } from '@/lib/useMe';
import { colors } from '@/theme';

/**
 * 개발·시연 도구. 모의 서버이거나, 실제 서버의 시연 가족(is_demo + demo_mode)일 때만 열린다.
 * 시연 영상에서는 "모의 판독"·"시뮬레이션" 표시가 같이 보인다.
 */
export default function DevPanel() {
  const { role, setRole } = useRole();
  const dev = api.dev;
  const [scenario, setScenario] = useState<MockScenario | null>(pendingScenario());
  const [msg, setMsg] = useState('');
  const { data: today } = useApiData(() => api.today().catch(() => null));
  const { data: me } = useMe();
  useEffect(() => onPendingScenario(() => setScenario(pendingScenario())), []);

  // 3.28 은 데모 가족 + DEMO_MODE + mock 판독기일 때만 된다. 아니면 숨긴다
  const canPickScenario = api.mode === 'mock' || (!!me && me.family.is_demo && me.server.demo_mode && me.server.reader_is_mock);

  const pick = async (s: MockScenario | null) => {
    try {
      await api.setMockScenario(s);
      setPendingScenario(s);
      setMsg(s ? `다음 사진 1장을 "${SCENARIO_LABELS[s]}"(으)로 판독해요 (모의).` : '시나리오를 지웠어요.');
    } catch (e) {
      setMsg(isApiError(e, 'not_found') ? '모의 판독 시나리오를 쓸 수 없는 서버예요.' : '시나리오를 정하지 못했어요.');
    }
  };

  // 3.27: 오늘 그 칸의 건이 아직 scheduled 이면 지금 시각으로 앞당긴다
  const simulate = async (ev: DoseEvent) => {
    try {
      const opened = await api.simulateDose(ev.slot.id);
      if (role === 'elder') {
        router.dismissAll();
        router.push({ pathname: '/elder/ask/[id]', params: { id: opened.id } });
      } else setMsg('어르신 폰에 질문 화면이 열린 상태가 됐어요.');
    } catch (e) {
      setMsg(isApiError(e, 'event_already_started') ? '이 시간의 약은 이미 진행 중이에요.' : isApiError(e, 'not_found') ? '시연 가족이 아니에요.' : '시뮬레이션을 열지 못했어요.');
    }
  };

  const scheduled = today?.items.filter((e) => e.state === 'scheduled') ?? [];

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <Text style={styles.h}>{dev ? '개발 도구 (모의 서버)' : '시연 도구'}</Text>

      {canPickScenario ? (
        <>
          <Text style={styles.label}>모의 판독 시나리오 (다음 사진 1장)</Text>
          <Text style={styles.note}>실제 AI 판독이 아니에요. 다음에 올리는 복약 사진 1장의 판독 결과만 정해요. 재촬영·안내·인계는 서버 규칙대로 진행돼요.</Text>
          <View style={styles.wrap}>
            {(Object.keys(SCENARIO_LABELS) as MockScenario[]).map((s) => (
              <Pressable
                key={s}
                onPress={() => pick(s)}
                style={[styles.chip, scenario === s && styles.chipOn]}
                accessibilityRole="radio"
                accessibilityState={{ selected: scenario === s }}
              >
                <Text style={[styles.chipText, scenario === s && styles.chipTextOn]}>
                  {scenario === s ? '● ' : '○ '}
                  {SCENARIO_LABELS[s]}
                </Text>
              </Pressable>
            ))}
            {scenario ? (
              <Pressable onPress={() => pick(null)} style={styles.chip} accessibilityRole="button">
                <Text style={styles.chipText}>지우기</Text>
              </Pressable>
            ) : null}
          </View>
        </>
      ) : null}

      <Text style={styles.label}>지금 약 시간 시뮬레이션</Text>
      {scheduled.length ? (
        scheduled.map((ev) => <Btn key={ev.id} label={`${TIME_OF_DAY_LABELS[ev.slot.time_of_day]} 약 시간 시뮬레이션`} onPress={() => simulate(ev)} />)
      ) : (
        <Text style={styles.msg}>{today === null ? '오늘 일정을 읽지 못했어요.' : '오늘 아직 시작하지 않은 약 시간이 없어요.'}</Text>
      )}

      {dev ? (
        <>
          <Btn
            label="시간 흘려보내기 (재질문 → 무응답 인계)"
            onPress={async () => {
              const ev = await dev.advanceTime();
              if (!ev) return setMsg('열려 있는 질문이 없어요.');
              setMsg(ev.state === 'handed_off' ? '보호자에게 인계됐어요.' : '다음 재질문 시각이 됐어요.');
            }}
          />
          <Text style={styles.label}>데이터</Text>
          <Btn
            label="오늘 기록 초기화"
            onPress={async () => {
              await dev.resetToday();
              setMsg('오늘 기록을 초기화했어요. 연결과 설정은 유지돼요.');
            }}
          />
        </>
      ) : null}

      <Btn
        label={`역할 바꾸기 (지금: ${role === 'elder' ? '어르신' : role === 'guardian' ? '보호자' : '없음'})`}
        onPress={async () => {
          // 실제 서버에서는 이 기기의 토큰을 지운다. 서버의 기기 연결은 G8 에서 해제한다
          if (!dev) await api.forgetToken();
          await setRole(null);
          router.dismissAll();
          router.replace('/role');
        }}
      />
      {msg ? <Text style={styles.msg}>{msg}</Text> : null}
      <Btn label="닫기" onPress={() => goBackOr('/')} />
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
  note: { fontSize: 16, color: colors.subtle, lineHeight: 22 },
});
