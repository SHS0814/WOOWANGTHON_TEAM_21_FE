import { Redirect, router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { api } from '@/api';
import { BigButton } from '@/components/BigButton';
import { Screen } from '@/components/Screen';
import { T } from '@/components/Text';
import { REASON_TITLE } from '@/lib/handoff';
import { useApiData } from '@/lib/useApiData';
import { useFamily } from '@/lib/useFamily';
import { spokenTime, TIME_OF_DAY_LABELS } from '@/lib/time';
import { colors } from '@/theme';

// 남은 칸이 이 값 이하이면 홈에 리필 안내를 한 줄 보인다
const REFILL_HINT_AT = 2;

/** G4 홈. 정상인 날은 거의 비어 있는 화면이 정상이다 (원칙 2) */
export default function GuardianHome() {
  const family = useFamily();
  const { data: open } = useApiData(() => api.getOpenHandoffs());
  const { data: today } = useApiData(() => api.getToday());
  const { data: refill } = useApiData(() => api.getRefillStatus());

  if (family === undefined) return null;
  if (family === null) return <Redirect href="/guardian/connect" />;

  const total = today?.length ?? 0;
  const taken = today?.filter((e) => e.outcome === 'taken').length ?? 0;
  const handed = today?.filter((e) => e.handoff).length ?? 0;
  const pending = today?.filter((e) => e.state !== 'done' && !e.handoff).length ?? 0;
  const statusLine =
    total > 0 && taken === total
      ? `✓ 오늘 ${total}번 모두 정상`
      : `오늘 ${total}번 중 ${taken}번 기록${handed ? `, ${handed}번 알림` : ''}${pending ? `, ${pending}번 남음` : ''}`;

  return (
    <Screen scroll>
      {open && open.length > 0 ? (
        <View style={{ gap: 12 }}>
          <T variant="title">처리할 일 {open.length}건</T>
          {open.map((ev) => (
            <Pressable
              key={ev.id}
              accessibilityRole="button"
              accessibilityLabel={`${TIME_OF_DAY_LABELS[ev.time_of_day]} 약, ${REASON_TITLE[ev.handoff!.reason]}. 자세히 보기`}
              onPress={() => router.push({ pathname: '/guardian/handoff/[id]', params: { id: ev.id } })}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
            >
              <T variant="title">! {REASON_TITLE[ev.handoff!.reason]}</T>
              <T>
                {TIME_OF_DAY_LABELS[ev.time_of_day]} 약 · {spokenTime(new Date(ev.handoff!.notified_at))} 알림
              </T>
              <T style={{ fontWeight: '700' }}>자세히 보기 ›</T>
            </Pressable>
          ))}
        </View>
      ) : null}

      <T variant="title">{statusLine}</T>
      {refill && refill.remaining_cells <= REFILL_HINT_AT ? (
        <T style={{ color: colors.attention }}>약통에 남은 칸이 {refill.remaining_cells}칸이에요.</T>
      ) : null}

      <View style={{ flex: 1 }} />
      <View style={{ gap: 12 }}>
        <BigButton size="guardian" variant="secondary" label="기록 보기" onPress={() => router.push('/guardian/records')} />
        <BigButton size="guardian" variant="secondary" label="약통 채우기" onPress={() => router.push('/guardian/refill')} />
        <BigButton size="guardian" variant="secondary" label="설정" onPress={() => router.push('/guardian/settings')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 3,
    borderColor: colors.attention,
    backgroundColor: colors.attentionBg,
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
});
