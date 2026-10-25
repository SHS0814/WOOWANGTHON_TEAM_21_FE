import { Redirect, router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { api } from '@/api';
import { BigButton } from '@/components/BigButton';
import { SimulationTag } from '@/components/MockBanner';
import { Screen } from '@/components/Screen';
import { T } from '@/components/Text';
import { reasonTitle } from '@/lib/handoff';
import { doseName } from '@/lib/doseLabel';
import { dateKey, spokenTime } from '@/lib/time';
import { POLL_MS, useApiData } from '@/lib/useApiData';
import { useMe } from '@/lib/useMe';
import { colors } from '@/theme';

/** G4 홈. 정상인 날은 거의 비어 있는 화면이 정상이다 (원칙 2) */
export default function GuardianHome() {
  const { data: hasToken } = useApiData(() => api.hasToken());
  const { data: me } = useMe();
  // 인계는 다른 기기(어르신 폰)나 서버 예약 작업(최대 1분 지연)에서 생기므로 주기적으로 다시 읽는다.
  // 아래 셋은 서버가 아직 구현 중이거나 약통이 없으면 실패할 수 있다 → 실패하면 그 줄만 숨긴다
  const { data: open } = useApiData(() => api.handoffs('open').catch(() => null), [], { pollMs: POLL_MS });
  const { data: day } = useApiData(() => api.summaries('day', dateKey(new Date()), dateKey(new Date())).catch(() => null), [], { pollMs: POLL_MS });
  const { data: box } = useApiData(() => api.currentPillbox().catch(() => null));
  // 어르신 폰 알림 준비가 안 됐을 때만 한 줄 (R-032, 원칙 2: 정상이면 아무것도 안 보인다)
  const { data: today } = useApiData(() => api.today().catch(() => null), [], { pollMs: POLL_MS });

  if (hasToken === undefined) return null;
  if (!hasToken) return <Redirect href="/guardian/connect" />;
  if (!me) return null;

  const summary = day?.[day.length - 1];
  const c = summary?.counts;
  const taken = c ? c.taken_ai + c.taken_guardian : 0;
  const statusLine = !summary
    ? null
    : summary.all_normal
      ? `✓ 오늘 ${c!.scheduled}번 모두 정상`
      : `오늘 ${c!.scheduled}번 중 ${taken}번 기록${c!.open_handoffs ? `, 처리할 일 ${c!.open_handoffs}건` : ''}${c!.pending ? `, ${c!.pending}번 남음` : ''}`;

  return (
    <Screen scroll>
      {today?.elder_notification_warning ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="어르신 폰 알림 설정이 꺼져 있어 알림이 늦을 수 있어요. 무엇을 켜야 하는지 보기"
          onPress={() => router.push('/guardian/settings')}
          style={({ pressed }) => [styles.warn, pressed && { opacity: 0.7 }]}
        >
          <T style={{ fontWeight: '700' }}>! 어르신 폰 알림 설정이 꺼져 있어 알림이 늦을 수 있어요</T>
          <T variant="small">무엇을 켜야 하는지 보기 ›</T>
        </Pressable>
      ) : null}
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
              accessibilityLabel={`${doseName(h.dose_event)} 약, ${reasonTitle(h.reason)}. 자세히 보기`}
              onPress={() => router.push({ pathname: '/guardian/handoff/[id]', params: { id: h.id } })}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
            >
              {h.dose_event.is_simulated ? <SimulationTag /> : null}
              <T variant="title">! {reasonTitle(h.reason)}</T>
              <T>
                {doseName(h.dose_event)} 약 · {spokenTime(new Date(h.notified_at))} 알림
              </T>
              <T style={{ fontWeight: '700' }}>자세히 보기 ›</T>
            </Pressable>
          ))}
        </View>
      ) : null}

      {statusLine ? <T variant="title">{statusLine}</T> : null}
      {summary?.includes_mock || summary?.includes_simulated ? (
        <T variant="small" style={{ color: colors.mockBg }}>
          {[summary.includes_mock && '모의 결과 포함', summary.includes_simulated && '시뮬레이션 포함'].filter(Boolean).join(' · ')}
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
  warn: { borderWidth: 2, borderColor: colors.attention, backgroundColor: colors.attentionBg, borderRadius: 12, padding: 12, gap: 4 },
  card: { borderWidth: 3, borderColor: colors.attention, backgroundColor: colors.attentionBg, borderRadius: 16, padding: 16, gap: 6 },
});
