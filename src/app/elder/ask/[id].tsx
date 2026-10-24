import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { api } from '@/api';
import { BigButton } from '@/components/BigButton';
import { SimulationTag } from '@/components/MockBanner';
import { Screen } from '@/components/Screen';
import { T } from '@/components/Text';
import { TIME_OF_DAY_LABELS } from '@/lib/time';
import { POLL_MS, useApiData } from '@/lib/useApiData';
import { useMe } from '@/lib/useMe';

const OPEN_STATES = ['scheduled', 'asked', 'retake_requested', 'reminded'];

/** E4 복약 시간 질문. 행동은 [사진 찍기] 하나 */
export default function Ask() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: me } = useMe();
  // 무응답 인계는 서버 예약 작업이 최대 1분 늦게 반영한다 → 주기적으로 다시 읽어서 홈으로 돌아간다
  const { data: today } = useApiData(() => api.today(), [], { pollMs: POLL_MS });
  const ev = today?.items.find((e) => e.id === id);

  // 서버가 인계했거나(무응답) 이미 끝난 건이면 홈으로
  useEffect(() => {
    if (today && (!ev || !OPEN_STATES.includes(ev.state))) router.dismissTo('/elder');
  }, [today, ev]);

  if (!ev || !me) return null;
  const tod = TIME_OF_DAY_LABELS[ev.slot.time_of_day];
  // ask_times = [복약 시각, 재질문1, 재질문2] (3.17). 재질문 시각이 지났으면 "다시 여쭤봐요"
  const reasked = ev.ask_times.slice(1).some((t) => Date.now() >= new Date(t).getTime());

  return (
    <Screen center footer={<BigButton label="사진 찍기" onPress={() => router.replace({ pathname: '/elder/camera/[id]', params: { id } })} />}>
      {ev.is_simulated ? <SimulationTag /> : null}
      {reasked ? <T variant="elderBody">다시 여쭤봐요.</T> : null}
      <T variant="elderTitle">
        {me.family.elder_display_name}, {tod} 약 드실 시간이에요.
      </T>
      <T variant="elderBody">드시고 약통 사진 한 장 찍어주실래요?</T>
    </Screen>
  );
}
