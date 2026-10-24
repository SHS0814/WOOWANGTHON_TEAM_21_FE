import { router, useLocalSearchParams } from 'expo-router';

import { api } from '@/api';
import { PillboxCamera } from '@/components/PillboxCamera';
import { pillboxAspect } from '@/lib/pillboxAspect';
import { useApiData } from '@/lib/useApiData';

/** E5 촬영. 가이드 틀과 셔터 하나 */
export default function ElderCamera() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: pillbox } = useApiData(() => api.getPillbox());
  if (pillbox === undefined) return null;
  return (
    <PillboxCamera
      instruction="약통이 다 보이게 찍어주세요"
      aspect={pillboxAspect(pillbox?.layout)}
      onCapture={(uri) => router.replace({ pathname: '/elder/reading/[id]', params: { id, uri: uri ?? '' } })}
    />
  );
}
