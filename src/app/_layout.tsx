import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { MockBanner } from '@/components/MockBanner';
import { RoleProvider } from '@/lib/role';
import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <RoleProvider>
        <StatusBar style="light" />
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <MockBanner />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
            <Stack.Screen name="dev" options={{ presentation: 'modal' }} />
          </Stack>
        </View>
      </RoleProvider>
    </SafeAreaProvider>
  );
}
