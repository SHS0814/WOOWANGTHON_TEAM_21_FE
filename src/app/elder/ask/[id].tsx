import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { api, type DoseEvent } from '@/api';
import { BigButton } from '@/components/BigButton';
import { SimulationTag } from '@/components/MockBanner';
import { Screen } from '@/components/Screen';
import { T } from '@/components/Text';
import { doseName } from '@/lib/doseLabel';
import { POLL_MS, useApiData } from '@/lib/useApiData';
import { useMe } from '@/lib/useMe';

const OPEN_STATES = ['scheduled', 'asked', 'retake_requested', 'reminded'];

/** 사진을 받을 수 있는 건인지 (3.18). 전날 건은 사진 없이 무응답 인계된 건도 받는다 (3.17, R-021 Q-007) */
function canTakePhoto(ev: DoseEvent) {
  if (OPEN_STATES.includes(ev.state)) return true;
  return ev.carried_over && ev.state === 'handed_off' && ev.photos.length === 0;
}

/** E4 복약 시간 질문. 행동은 [사진 찍기] 하나 */
export default function Ask() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: me } = useMe();
  // 무응답 인계는 서버 예약 작업이 최대 1분 늦게 반영한다 → 주기적으로 다시 읽어서 홈으로 돌아간다
  const { data: today } = useApiData(() => api.today(), [], { pollMs: POLL_MS });
  const ev = today?.items.find((e) => e.id === id);

  // 서버가 인계했거나(무응답) 이미 끝난 건이면 홈으로
  useEffect(() => {
    if (today && (!ev || !canTakePhoto(ev))) router.dismissTo('/elder');
  }, [today, ev]);

  if (!ev || !me) return null;
  const name = doseName(ev);
  // ask_times = [복약 시각, 재질문1, 재질문2] (3.17). 재질문 시각이 지났으면 "다시 여쭤봐요"
  const reasked = ev.ask_times.slice(1).some((t) => Date.now() >= new Date(t).getTime());

  return (
    <Screen center footer={<BigButton label="사진 찍기" onPress={() => router.replace({ pathname: '/elder/camera/[id]', params: { id } })} />}>
      {ev.is_simulated ? <SimulationTag /> : null}
      {ev.carried_over ? (
        // 전날 건: 시간이 지났으므로 "드실 시간이에요", "드시고" 같은 말은 하지 않는다 (원칙 6, R-007 C3)
        <>
          <T variant="elderTitle">
            {me.family.elder_display_name}, {name} 약이에요.
          </T>
          <T variant="elderBody">약통 사진 한 장 찍어주실래요?</T>
        </>
      ) : (
        <>
          {reasked ? <T variant="elderBody">다시 여쭤봐요.</T> : null}
          <T variant="elderTitle">
            {me.family.elder_display_name}, {name} 약 드실 시간이에요.
          </T>
          <T variant="elderBody">드시고 약통 사진 한 장 찍어주실래요?</T>
        </>
      )}
    </Screen>
  );
}
