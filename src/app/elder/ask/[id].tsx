import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { api } from '@/api';
import { BigButton } from '@/components/BigButton';
import { SimulationTag } from '@/components/MockBanner';
import { Screen } from '@/components/Screen';
import { T } from '@/components/Text';
import { useApiData } from '@/lib/useApiData';
import { useFamily } from '@/lib/useFamily';
import { TIME_OF_DAY_LABELS } from '@/lib/time';

/** E4 복약 시간 질문. 행동은 [사진 찍기] 하나 */
export default function Ask() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const family = useFamily();
  const { data: ev } = useApiData(() => api.getEvent(id), [id]);

  // 서버가 인계했거나(무응답) 이미 끝난 건이면 홈으로
  useEffect(() => {
    if (ev && (ev.state === 'handed_off' || ev.state === 'done')) router.dismissTo('/elder');
  }, [ev]);

  if (!ev || !family) return null;
  const tod = TIME_OF_DAY_LABELS[ev.time_of_day];

  return (
    <Screen center footer={<BigButton label="사진 찍기" onPress={() => router.replace({ pathname: '/elder/camera/[id]', params: { id } })} />}>
      {ev.simulated ? <SimulationTag /> : null}
      {ev.reask_count > 0 ? <T variant="elderBody">다시 여쭤봐요.</T> : null}
      <T variant="elderTitle">
        {family.elder_display_name}, {tod} 약 드실 시간이에요.
      </T>
      <T variant="elderBody">드시고 약통 사진 한 장 찍어주실래요?</T>
    </Screen>
  );
}
