import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator } from 'react-native';

import { api } from '@/api';
import { Screen } from '@/components/Screen';
import { T } from '@/components/Text';
import { colors } from '@/theme';

/** E6 판독 중. 행동 없음. 서버가 정한 다음 상태로 넘어간다 */
export default function Reading() {
  const { id, uri } = useLocalSearchParams<{ id: string; uri?: string }>();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    api
      .uploadPhoto(id, uri || null)
      .then((res) => {
        const kind = res.next === 'done' ? 'done' : res.next === 'retake_requested' ? 'retake' : res.next === 'reminded' ? 'remind' : 'handoff';
        router.replace({ pathname: '/elder/result/[id]', params: { id, kind } });
      })
      .catch(() => router.replace({ pathname: '/elder/result/[id]', params: { id, kind: 'error' } }));
  }, [id, uri]);

  return (
    <Screen center>
      <ActivityIndicator size="large" color={colors.primary} />
      <T variant="elderTitle" style={{ textAlign: 'center' }}>
        확인하고 있어요
      </T>
    </Screen>
  );
}
