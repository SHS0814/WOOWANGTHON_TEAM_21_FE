import { Stack } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DEMO_BUILD } from '@/api';
import { DemoBar } from '@/components/DemoBar';
import { MockBanner } from '@/components/MockBanner';
import { RoleProvider } from '@/lib/role';
import { notificationsSupported, setupNotifications } from '@/notify/channels';
import { NotificationRouter } from '@/notify/NotificationRouter';
import { colors } from '@/theme';

void setupNotifications();

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <RoleProvider>
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          {notificationsSupported ? <NotificationRouter /> : null}
          <MockBanner />
          {DEMO_BUILD ? <DemoBar /> : null}
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
            <Stack.Screen name="dev" options={{ presentation: 'modal' }} />
          </Stack>
        </View>
      </RoleProvider>
    </SafeAreaProvider>
  );
}
