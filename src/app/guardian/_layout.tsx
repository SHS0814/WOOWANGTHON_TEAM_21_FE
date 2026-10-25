import { Stack } from 'expo-router';
import { useEffect } from 'react';

import { api } from '@/api';
import { pushStatus, registerGuardianPush, watchPushToken } from '@/notify/guardianPush';

const pushStatusIsUnknown = () => pushStatus() === 'unknown';

import { colors } from '@/theme';

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
        headerTitleStyle: { fontSize: 24, fontWeight: '700' },
        headerBackTitle: '뒤로',
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: '오늘' }} />
      <Stack.Screen name="connect" options={{ title: '어르신 폰 연결' }} />
      <Stack.Screen name="handoff/[id]" options={{ title: '처리할 일' }} />
      <Stack.Screen name="pillbox" options={{ title: '약통 등록' }} />
      <Stack.Screen name="schedule" options={{ title: '복약 시각' }} />
      <Stack.Screen name="records" options={{ title: '기록' }} />
      <Stack.Screen name="refill" options={{ title: '약통 채우기' }} />
      <Stack.Screen name="settings" options={{ title: '설정' }} />
    </Stack>
  );
}
