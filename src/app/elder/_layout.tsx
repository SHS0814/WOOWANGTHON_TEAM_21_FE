import { Stack } from 'expo-router';

import { colors } from '@/theme';

// 어르신 모드에는 보호자 화면으로 가는 길이 없다 (R-008 1절)
export default function ElderLayout() {
  return <Stack screenOptions={{ headerShown: false, gestureEnabled: false, contentStyle: { backgroundColor: colors.bg } }} />;
}
