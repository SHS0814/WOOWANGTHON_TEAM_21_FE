import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { api } from '@/api';
import { BigButton } from '@/components/BigButton';
import { Screen } from '@/components/Screen';
import { T } from '@/components/Text';
import { useApiData } from '@/lib/useApiData';
import { useFamily } from '@/lib/useFamily';
import { TIME_OF_DAY_LABELS } from '@/lib/time';

type Kind = 'done' | 'retake' | 'remind' | 'handoff' | 'error';

const AUTO_HOME_MS = 5000;

/**
 * E7 결과
 * - done    (E7a) 정상 → 몇 초 뒤 홈
 * - retake  (E7b) 애매 → [다시 찍기]
 * - remind  (E7d) 칸 그대로 1차, 안내 모드(R-009 기본)이고 복약 시간 안일 때만 → [사진 찍기]
 * - handoff (E7c) 칸 그대로 2차 / 바로 인계 모드 / 이중 의심 / 시간 지남 → 보호자에게 알렸다고만 말함
 * 어떤 경우에도 "더 드세요", "드시지 마세요" 같은 지시는 하지 않는다 (원칙 6)
 */
export default function Result() {
  const { id, kind } = useLocalSearchParams<{ id: string; kind: Kind }>();
  const family = useFamily();
  const { data: ev } = useApiData(() => api.getEvent(id), [id]);

  const autoHome = kind === 'done' || kind === 'handoff';
  useEffect(() => {
    if (!autoHome) return;
    const t = setTimeout(() => router.dismissTo('/elder'), AUTO_HOME_MS);
    return () => clearTimeout(t);
  }, [autoHome]);

  if (!family || !ev) return null;
  const retake = () => router.replace({ pathname: '/elder/camera/[id]', params: { id } });
  const tod = TIME_OF_DAY_LABELS[ev.time_of_day];

  switch (kind) {
    case 'done':
      return (
        <Screen center>
          <T variant="elderHuge" style={{ textAlign: 'center' }} accessibilityLabel="완료">
            ✓
          </T>
          <T variant="elderTitle" style={{ textAlign: 'center' }}>
            고마워요.{'\n'}
            {tod} 약 기록해 뒀어요.
          </T>
        </Screen>
      );
    case 'retake':
      return (
        <Screen center footer={<BigButton label="다시 찍기" onPress={retake} />}>
          <T variant="elderTitle">사진이 잘 안 보여요.</T>
          <T variant="elderBody">한 번만 더 찍어주실래요?</T>
        </Screen>
      );
    case 'error':
      return (
        <Screen center footer={<BigButton label="다시 찍기" onPress={retake} />}>
          <T variant="elderTitle">사진을 보내지 못했어요.</T>
          <T variant="elderBody">한 번만 더 찍어주실래요?</T>
        </Screen>
      );
    case 'remind':
      return (
        <Screen center footer={<BigButton label="사진 찍기" onPress={retake} />}>
          <T variant="elderTitle">약 드실 시간이에요.</T>
          <T variant="elderBody">드시고 한 번만 더 찍어주실래요?</T>
        </Screen>
      );
    case 'handoff':
    default:
      return (
        <Screen center>
          <T variant="elderTitle" style={{ textAlign: 'center' }}>
            {family.guardian_display_name}님께{'\n'}알려드렸어요.
          </T>
        </Screen>
      );
  }
}
