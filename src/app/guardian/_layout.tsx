import { Stack } from 'expo-router';
import { useEffect } from 'react';

import { api } from '@/api';
import { pushStatus, registerGuardianPush, watchPushToken } from '@/notify/guardianPush';
import { guardian } from '@/theme';

const pushStatusIsUnknown = () => pushStatus() === 'unknown';

/**
 * 보호자 영역. 홈·기록·설정은 하단 탭((tabs) 묶음, 주소는 /guardian, /guardian/records, /guardian/settings 그대로),
 * 연결·인계 상세(G5)·약통 등록·복약 시각·약통 채우기는 그 위에 쌓이는 화면이다 (T-FE14)
 */
export default function GuardianLayout() {
  // 인계 푸시를 받으려고 푸시 토큰을 등록한다 (3.9). 가족을 만든 뒤(토큰이 생긴 뒤)부터
  useEffect(() => {
    const tryRegister = () =>
      void api.hasToken().then((t) => {
        if (t) void registerGuardianPush();
      });
    tryRegister();
    const off = api.subscribe(() => {
      // 가족 만들기 직후 한 번 더 시도한다
      if (pushStatusIsUnknown()) tryRegister();
    });
    const offToken = watchPushToken();
    return () => {
      off();
      offToken();
    };
  }, []);

  return (
    <Stack
      screenOptions={{
        headerTitleStyle: { fontSize: 19, fontWeight: '700', color: guardian.color.text },
        headerTintColor: guardian.color.primary,
        headerStyle: { backgroundColor: guardian.color.card },
        headerShadowVisible: false,
        headerBackTitle: '뒤로',
        contentStyle: { backgroundColor: guardian.color.bg },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false, title: '오늘' }} />
      <Stack.Screen name="connect" options={{ title: '어르신 폰 연결' }} />
      <Stack.Screen name="handoff/[id]" options={{ title: '확인할 일' }} />
      <Stack.Screen name="pillbox" options={{ title: '약통 등록' }} />
      <Stack.Screen name="schedule" options={{ title: '복약 시각' }} />
      <Stack.Screen name="refill" options={{ title: '약통 채우기' }} />
    </Stack>
  );
}
