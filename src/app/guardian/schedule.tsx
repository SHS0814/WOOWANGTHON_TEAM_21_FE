import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, type TimeOfDay } from '@/api';
import { BigButton } from '@/components/BigButton';
import { Screen } from '@/components/Screen';
import { T } from '@/components/Text';
import { useApiData } from '@/lib/useApiData';
import { spokenHHMM, TIME_OF_DAY_LABELS } from '@/lib/time';
import { colors } from '@/theme';
import { goBackOr } from '@/lib/nav';

const ORDER: TimeOfDay[] = ['morning', 'noon', 'evening', 'bedtime'];
const STEP_MIN = 10;

function shift(hhmm: string, delta: number) {
  const [h, m] = hhmm.split(':').map(Number);
  const t = (h * 60 + m + delta + 1440) % 1440;
  return `${`${Math.floor(t / 60)}`.padStart(2, '0')}:${`${t % 60}`.padStart(2, '0')}`;
}

/** G3 복약 시각. 시간대별로 하나씩 */
export default function Schedule() {
  const { data: slots } = useApiData(() => api.getSchedule());
  const { data: config } = useApiData(() => api.getConfig());
  const [times, setTimes] = useState<Partial<Record<TimeOfDay, string>>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!slots) return;
    const t: Partial<Record<TimeOfDay, string>> = {};
    for (const s of slots) t[s.time_of_day] = s.dose_time;
    setTimes(t);
  }, [slots]);

  const present = ORDER.filter((k) => times[k]);

  return (
    <Screen
      scroll
      footer={
        <BigButton
          size="guardian"
          label="저장"
          busy={busy}
          onPress={async () => {
            setBusy(true);
            await api.saveDoseTimes(times);
            goBackOr('/guardian');
          }}
        />
      }
    >
      {present.map((k) => (
        <View key={k} style={styles.row}>
          <T variant="title">{TIME_OF_DAY_LABELS[k]}</T>
          <T variant="title">{spokenHHMM(times[k]!)}</T>
          <View style={styles.steps}>
            <View style={{ flex: 1 }}>
              <BigButton size="guardian" variant="secondary" label={`${STEP_MIN}분 빠르게`} onPress={() => setTimes({ ...times, [k]: shift(times[k]!, -STEP_MIN) })} />
            </View>
            <View style={{ flex: 1 }}>
              <BigButton size="guardian" variant="secondary" label={`${STEP_MIN}분 늦게`} onPress={() => setTimes({ ...times, [k]: shift(times[k]!, STEP_MIN) })} />
            </View>
          </View>
        </View>
      ))}
      {config ? (
        <T variant="small" style={{ color: colors.subtle }}>
          답이 없으면 {config.reask_offsets_min.join('분, ')}분 뒤에 다시 여쭤보고, {config.no_response_handoff_min}분이 지나면 알려드려요.
        </T>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { borderWidth: 2, borderColor: colors.border, borderRadius: 16, padding: 16, gap: 8 },
  steps: { flexDirection: 'row', gap: 12 },
});
