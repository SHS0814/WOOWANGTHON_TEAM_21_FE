import { Redirect, router } from 'expo-router';
import { View } from 'react-native';

import { api } from '@/api';
import { BigButton } from '@/components/BigButton';
import { Screen } from '@/components/Screen';
import { T } from '@/components/Text';
import { useApiData } from '@/lib/useApiData';
import { useFamily } from '@/lib/useFamily';
import { longDate, spokenTime, TIME_OF_DAY_LABELS, weekdayLong } from '@/lib/time';
import { colors } from '@/theme';

/** E3 대기 홈. 행동은 [나 약 먹었나?] 하나 */
export default function ElderHome() {
  const family = useFamily();
  const { data: events } = useApiData(() => api.getToday());

  if (family === undefined) return null;
  if (family === null) return <Redirect href="/elder/connect" />;
  if (!family.consent_at) return <Redirect href="/elder/consent" />;

  const now = new Date();
  const next = events?.find((e) => e.state === 'scheduled' && new Date(e.scheduled_at) > now);

  return (
    <Screen center footer={<BigButton label="나 약 먹었나?" onPress={() => router.push('/elder/history')} />}>
      <View style={{ alignItems: 'center', gap: 8 }}>
        <T variant="elderHuge" style={{ textAlign: 'center' }}>
          {longDate(now)}
        </T>
        <T variant="elderHuge" style={{ textAlign: 'center' }}>
          {weekdayLong(now)}
        </T>
      </View>
      <View style={{ borderTopWidth: 2, borderColor: colors.border, paddingTop: 20, alignItems: 'center' }}>
        {next ? (
          <T variant="elderTitle" style={{ textAlign: 'center' }}>
            다음 약은 {TIME_OF_DAY_LABELS[next.time_of_day]}{'\n'}
            {spokenTime(new Date(next.scheduled_at))}
          </T>
        ) : events ? (
          <T variant="elderBody" style={{ textAlign: 'center' }}>
            오늘 남은 약 시간은 없어요.
          </T>
        ) : null}
      </View>
    </Screen>
  );
}
