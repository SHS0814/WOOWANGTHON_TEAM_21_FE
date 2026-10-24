import { Redirect, router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { api } from '@/api';
import { BigButton } from '@/components/BigButton';
import { SimulationTag } from '@/components/MockBanner';
import { Screen } from '@/components/Screen';
import { T } from '@/components/Text';
import { reasonTitle } from '@/lib/handoff';
import { dateKey, spokenTime, TIME_OF_DAY_LABELS } from '@/lib/time';
import { useApiData } from '@/lib/useApiData';
import { useMe } from '@/lib/useMe';
import { colors } from '@/theme';

/** G4 홈. 정상인 날은 거의 비어 있는 화면이 정상이다 (원칙 2) */
export default function GuardianHome() {
  const { data: hasToken } = useApiData(() => api.hasToken());
  const { data: me } = useMe();
  // 아래 셋은 서버가 아직 구현 중이거나 약통이 없으면 실패할 수 있다 → 실패하면 그 줄만 숨긴다
  const { data: open } = useApiData(() => api.handoffs('open').catch(() => null));
  const { data: day } = useApiData(() => api.summaries('day', dateKey(new Date()), dateKey(new Date())).catch(() => null));
  const { data: box } = useApiData(() => api.currentPillbox().catch(() => null));

  if (hasToken === undefined) return null;
  if (!hasToken) return <Redirect href="/guardian/connect" />;
  if (!me) return null;

  const today = day?.[day.length - 1];
  const c = today?.counts;
  const taken = c ? c.taken_ai + c.taken_guardian : 0;
  const statusLine = !today
    ? null
    : today.all_normal
      ? `✓ 오늘 ${c!.scheduled}번 모두 정상`
      : `오늘 ${c!.scheduled}번 중 ${taken}번 기록${c!.open_handoffs ? `, 처리할 일 ${c!.open_handoffs}건` : ''}${c!.pending ? `, ${c!.pending}번 남음` : ''}`;

  return (
    <Screen scroll>
      {!me.family.has_pillbox ? (
        <BigButton size="guardian" label="약통 등록하기" onPress={() => router.push('/guardian/pillbox')} />
      ) : !me.family.has_schedule ? (
        <BigButton size="guardian" label="복약 시각 정하기" onPress={() => router.push('/guardian/schedule')} />
      ) : null}

      {open && open.length > 0 ? (
        <View style={{ gap: 12 }}>
          <T variant="title">처리할 일 {open.length}건</T>
          {open.map((h) => (
            <Pressable
              key={h.id}
              accessibilityRole="button"
              accessibilityLabel={`${TIME_OF_DAY_LABELS[h.dose_event.slot.time_of_day]} 약, ${reasonTitle(h.reason)}. 자세히 보기`}
              onPress={() => router.push({ pathname: '/guardian/handoff/[id]', params: { id: h.id } })}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
            >
              {h.dose_event.is_simulated ? <SimulationTag /> : null}
              <T variant="title">! {reasonTitle(h.reason)}</T>
              <T>
                {TIME_OF_DAY_LABELS[h.dose_event.slot.time_of_day]} 약 · {spokenTime(new Date(h.notified_at))} 알림
              </T>
              <T style={{ fontWeight: '700' }}>자세히 보기 ›</T>
            </Pressable>
          ))}
        </View>
      ) : null}

      {statusLine ? <T variant="title">{statusLine}</T> : null}
      {today?.includes_mock || today?.includes_simulated ? (
        <T variant="small" style={{ color: colors.mockBg }}>
          {[today.includes_mock && '모의 결과 포함', today.includes_simulated && '시뮬레이션 포함'].filter(Boolean).join(' · ')}
        </T>
      ) : null}
      {box?.refill_status.needs_refill ? (
        <T style={{ color: colors.attention }}>! 약통에 남은 칸이 {box.refill_status.remaining_cells}칸이에요.</T>
      ) : null}
      {box?.pillbox_mismatch.detected ? <T style={{ color: colors.attention }}>! 약통 상태가 기록과 달라요.</T> : null}

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
  card: { borderWidth: 3, borderColor: colors.attention, backgroundColor: colors.attentionBg, borderRadius: 16, padding: 16, gap: 6 },
});
