import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/guardian/Icon';
import { guardian } from '@/theme';

const C = guardian.color;

const tabIcon =
  (name: IconName) =>
  ({ color, focused }: { color: ColorValue; focused: boolean }) => <Icon name={name} size={24} color={color} strokeWidth={focused ? 2.4 : 2} />;

/** 보호자 하단 탭: 홈(G4) · 기록(G6) · 통계(G6 통계, R-056) · 설정(G8). 탭 이름은 아이콘과 글자를 함께 쓴다 */
export default function GuardianTabs() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.muted,
        tabBarLabelStyle: { fontSize: 16, lineHeight: 20, fontWeight: '700', marginTop: 2 },
        tabBarItemStyle: { minHeight: 56 },
        tabBarStyle: {
          backgroundColor: C.card,
          borderTopColor: C.border,
          height: 74 + Math.max(insets.bottom, 8),
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 8),
        },
        sceneStyle: { backgroundColor: C.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: '홈', tabBarAccessibilityLabel: '홈, 오늘 상태', tabBarIcon: tabIcon('home') }} />
      <Tabs.Screen name="records" options={{ title: '기록', tabBarAccessibilityLabel: '기록', tabBarIcon: tabIcon('records') }} />
      <Tabs.Screen name="stats" options={{ title: '통계', tabBarAccessibilityLabel: '통계', tabBarIcon: tabIcon('chart') }} />
      <Tabs.Screen name="settings" options={{ title: '설정', tabBarAccessibilityLabel: '설정', tabBarIcon: tabIcon('settings') }} />
    </Tabs>
  );
}
