import { Stack } from 'expo-router';

import { colors } from '@/theme';

export default function GuardianLayout() {
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
