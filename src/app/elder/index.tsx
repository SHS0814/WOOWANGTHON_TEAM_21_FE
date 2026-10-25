import { Redirect, router } from 'expo-router';
import { View } from 'react-native';

import { api } from '@/api';
import { BigButton } from '@/components/BigButton';
import { Screen } from '@/components/Screen';
import { T } from '@/components/Text';
import { doseName } from '@/lib/doseLabel';
import { longDate, spokenTime, TIME_OF_DAY_LABELS, weekdayLong } from '@/lib/time';
import { POLL_MS, useApiData } from '@/lib/useApiData';
import { useMe } from '@/lib/useMe';
import { colors } from '@/theme';

/** E3 대기 홈. 행동은 [나 약 먹었나?] 하나 */
export default function ElderHome() {
  const { data: hasToken } = useApiData(() => api.hasToken());
  const { data: me } = useMe();
  // 동의 전에는 today 가 403 consent_required 라서 결과를 무시한다
  const { data: today } = useApiData(() => api.today().catch(() => null), [], { pollMs: POLL_MS });

  if (hasToken === undefined) return null;
  if (!hasToken) return <Redirect href="/elder/connect" />;
  if (!me) return null;
  if (me.consent_required) return <Redirect href="/elder/consent" />;

  const now = new Date();
  // 3.17 next_event: 아직 scheduled 또는 asked 인 가장 이른 건. 전날 건(carried_over)이면 "다음 약"이 아니므로
  // 오늘 건 중에서 다시 고른다 (R-021 Q-007)
  const items = today?.items ?? [];
  const nextIsCarried = items.some((e) => e.id === today?.next_event?.id && e.carried_over);
  const nextItem = nextIsCarried ? items.find((e) => !e.carried_over && (e.state === 'scheduled' || e.state === 'asked')) : undefined;
  const next = nextIsCarried
    ? nextItem && { id: nextItem.id, scheduled_at: nextItem.scheduled_at, time_of_day: nextItem.slot.time_of_day }
    : today?.next_event;
  // 전날 끝나지 않은 건은 날짜를 붙여 따로 알려준다. 지시하는 말은 하지 않는다 (원칙 6)
  const carried = items.filter((e) => e.carried_over && e.elder_status !== 'recorded');

  return (
    <Screen center footer={<BigButton label="나 약 먹었나?" onPress={() => router.push('/elder/history')} />}>
      <View style={{ alignItems: 'center', gap: 8 }}>
        <T variant="elderHuge" style={{ textAlign: 'center' }}>
          {longDate(now)}
        </T>
        <T variant="elderHuge" style={{ textAlign: 'center' }}>
          {weekdayLong(now)}
        </T>
      </View>
      <View style={{ borderTopWidth: 2, borderColor: colors.border, paddingTop: 20, alignItems: 'center' }}>
        {next ? (
          <T variant="elderTitle" style={{ textAlign: 'center' }}>
            다음 약은 {TIME_OF_DAY_LABELS[next.time_of_day]}
            {'\n'}
            {spokenTime(new Date(next.scheduled_at))}
          </T>
        ) : today ? (
          <T variant="elderBody" style={{ textAlign: 'center' }}>
            오늘 남은 약 시간은 없어요.
          </T>
        ) : null}
        {carried.map((e) => (
          <T key={e.id} variant="elderBody" style={{ textAlign: 'center', marginTop: 12 }}>
            {doseName(e)} 약은 아직 기록이 없어요.
          </T>
        ))}
      </View>
    </Screen>
  );
}
