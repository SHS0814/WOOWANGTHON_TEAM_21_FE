import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { api, DEMO_BUILD } from '@/api';
import { BigButton } from '@/components/BigButton';
import { ExitButton } from '@/components/ExitButton';
import { Screen } from '@/components/Screen';
import { T } from '@/components/Text';
import { AskView } from '@/components/AskView';
import { doseName } from '@/lib/doseLabel';
import { canSendLatePhoto, firstOpenDose } from '@/lib/openDose';
import { longDate, spokenTime, TIME_OF_DAY_LABELS, weekdayLong } from '@/lib/time';
import { POLL_MS, useApiData } from '@/lib/useApiData';
import { useMe } from '@/lib/useMe';
import { colors } from '@/theme';

/**
 * 어르신 홈. 열린 복약 건이 있으면 E3 대신 E4(사진 찍기 질문)를 바로 보여준다. 여러 개면 가장 이른 건부터 (R-022).
 * 열린 건이 없으면 E3 대기 홈. 어느 쪽이든 행동은 하나다
 */
export default function ElderHome() {
  const { data: hasToken } = useApiData(() => api.hasToken());
  const { data: me } = useMe();
  // 동의 전에는 today 가 403 consent_required 라서 결과를 무시한다
  const { data: today } = useApiData(() => api.today().catch(() => null), [], { pollMs: POLL_MS });

  // 지금 시각. 분이 바뀌면 다시 그린다
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(t);
  }, []);

  if (hasToken === undefined) return null;
  if (!hasToken) return <Redirect href="/elder/connect" />;
  if (!me) return null;
  if (me.consent_required) return <Redirect href="/elder/consent" />;

  const open = today ? firstOpenDose(today.items) : undefined;
  if (open) {
    return (
      <AskView
        ev={open}
        elderName={me.family.elder_display_name}
        onTakePhoto={() => router.push({ pathname: '/elder/camera/[id]', params: { id: open.id } })}
      />
    );
  }

  const demo = DEMO_BUILD && me.family.is_demo && me.server.demo_mode;
  // 3.17 next_event: 아직 scheduled 또는 asked 인 가장 이른 건. 전날 건(carried_over)이면 "다음 약"이 아니므로
  // 오늘 건 중에서 다시 고른다 (R-021 Q-007)
  const items = today?.items ?? [];
  const nextIsCarried = items.some((e) => e.id === today?.next_event?.id && e.carried_over);
  const nextItem = nextIsCarried ? items.find((e) => !e.carried_over && (e.state === 'scheduled' || e.state === 'asked')) : undefined;
  const next = nextIsCarried
    ? nextItem && { id: nextItem.id, scheduled_at: nextItem.scheduled_at, time_of_day: nextItem.slot.time_of_day }
    : today?.next_event;
  // 물어보는 시간이 지났지만 늦은 사진을 받는 건(오늘 무응답 인계, 전날 건)은 E8 에서 올린다고 알려준다 (R-026 Q-009).
  // 복용을 권하지 않는다 (원칙 6)
  const late = items.filter((e) => canSendLatePhoto(e));

  return (
    <Screen
      center
      // 나가기: 앱을 닫고 폰 화면으로 돌아간다 (약 시간 알림은 그대로 울린다). 주 버튼(파랑)과 색으로 구분한다.
      // 앱을 스스로 닫을 수 있는 Android 에서만 보인다. 약 시간 질문 화면(AskView)에도 같은 버튼을 둔다
      header={
        <ExitButton />
      }
      footer={<BigButton label="나 약 먹었나?" onPress={() => router.push('/elder/history')} />}
    >
      {/* 시연 가족이면 날짜를 길게 눌러 시연 도구를 연다 (맨 위 띠를 없앤 대신). 보통 가족에서는 아무 일도 없다 */}
      <Pressable
        accessible={false}
        disabled={!demo}
        delayLongPress={800}
        onLongPress={() => router.push('/dev')}
        style={{ alignItems: 'center', gap: 8 }}
      >
        <T variant="elderHuge" style={{ textAlign: 'center' }}>
          {longDate(now)}
        </T>
        <T variant="elderHuge" style={{ textAlign: 'center' }}>
          {weekdayLong(now)}
        </T>
        <T variant="elderTitle" style={{ textAlign: 'center' }} accessibilityLabel={`지금 ${spokenTime(now)}`}>
          {spokenTime(now)}
        </T>
      </Pressable>
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
        {late.map((e) => (
          <T key={e.id} variant="elderBody" style={{ textAlign: 'center', marginTop: 12 }}>
            {doseName(e)} 약은 아직 기록이 없어요.
          </T>
        ))}
        {late.length ? (
          <T variant="elderBody" style={{ textAlign: 'center', marginTop: 8 }}>
            드셨으면 [나 약 먹었나?]에서 사진을 찍어 주세요.
          </T>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
});
