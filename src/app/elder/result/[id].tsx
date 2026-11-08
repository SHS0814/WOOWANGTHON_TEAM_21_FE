import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { BigButton } from '@/components/BigButton';
import { MockResultTag, SimulationTag } from '@/components/MockBanner';
import { Screen } from '@/components/Screen';
import { T } from '@/components/Text';
import { guardianName, useMe } from '@/lib/useMe';

type Kind = 'done' | 'retake' | 'remind' | 'handoff' | 'error';

const AUTO_HOME_MS = 5000;

/**
 * E7 결과 (api.md 3.18 result 표)
 * - done    (E7a) recorded → 몇 초 뒤 홈
 * - retake  (E7b) retake → [다시 찍기]
 * - remind  (E7d) remind_retake → [사진 찍기]
 * - handoff (E7c) guardian_notified → 보호자에게 알렸다고만 말함
 * 어떤 경우에도 "더 드세요", "드시지 마세요" 같은 지시는 하지 않는다 (원칙 6). 문구는 앱 템플릿이다
 */
export default function Result() {
  const { id, kind, name, mock, sim, refill } = useLocalSearchParams<{ id: string; kind: Kind; name?: string; mock?: string; sim?: string; refill?: string }>();
  const { data: me } = useMe();

  const autoHome = kind === 'done' || kind === 'handoff';
  useEffect(() => {
    if (!autoHome) return;
    const t = setTimeout(() => router.dismissTo('/elder'), AUTO_HOME_MS);
    return () => clearTimeout(t);
  }, [autoHome]);

  if (!me) return null;
  const retake = () => router.replace({ pathname: '/elder/camera/[id]', params: { id } });
  const tags = (
    <>
      {sim ? <SimulationTag /> : null}
      {mock ? <MockResultTag /> : null}
    </>
  );

  switch (kind) {
    case 'done':
      return (
        <Screen center>
          {tags}
          <T variant="elderHuge" style={{ textAlign: 'center' }} accessibilityLabel="완료">
            ✓
          </T>
          <T variant="elderTitle" style={{ textAlign: 'center' }}>
            고마워요.{'\n'}
            {name ? `${name} ` : ''}약 기록해 뒀어요.
          </T>
          {/* R-071: 문장 한 줄만 (버튼 없음) */}
          {refill ? (
            <T variant="elderBody" style={{ textAlign: 'center' }}>
              약통을 채워 주세요.
            </T>
          ) : null}
        </Screen>
      );
    case 'retake':
      return (
        <Screen center footer={<BigButton label="다시 찍기" onPress={retake} />}>
          {tags}
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
          {tags}
          <T variant="elderTitle">약 드실 시간이에요.</T>
          <T variant="elderBody">드시고 한 번만 더 찍어주실래요?</T>
        </Screen>
      );
    case 'handoff':
    default:
      return (
        <Screen center>
          {tags}
          <T variant="elderTitle" style={{ textAlign: 'center' }}>
            {guardianName(me)}님께{'\n'}알려드렸어요.
          </T>
        </Screen>
      );
  }
}
