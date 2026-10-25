import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { api } from '@/api';
import { AskView } from '@/components/AskView';
import { canTakePhoto } from '@/lib/openDose';
import { POLL_MS, useApiData } from '@/lib/useApiData';
import { useMe } from '@/lib/useMe';

/** E4 복약 시간 질문 (알림을 누르거나 시연 트리거로 열 때). 행동은 [사진 찍기] 하나 */
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
  return (
    <AskView
      ev={ev}
      elderName={me.family.elder_display_name}
      onTakePhoto={() => router.replace({ pathname: '/elder/camera/[id]', params: { id } })}
    />
  );
}
