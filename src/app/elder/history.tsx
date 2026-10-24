import { router } from 'expo-router';
import { Image, StyleSheet, View } from 'react-native';

import { api, type DoseEvent } from '@/api';
import { JudgeBadge } from '@/components/AiBadge';
import { BigButton } from '@/components/BigButton';
import { Screen } from '@/components/Screen';
import { T } from '@/components/Text';
import { useApiData } from '@/lib/useApiData';
import { useFamily } from '@/lib/useFamily';
import { spokenTime, TIME_OF_DAY_LABELS } from '@/lib/time';
import { colors } from '@/theme';

/** E8 "나 약 먹었나?" — 오늘 기록을 시각과 사진으로 (MVP #3, 이중 복용 방지) */
export default function History() {
  const family = useFamily();
  const { data: events } = useApiData(() => api.getToday());

  return (
    <Screen scroll footer={<BigButton label="돌아가기" onPress={() => router.back()} />}>
      <T variant="elderTitle">오늘 약 기록</T>
      {events?.map((ev) => (
        <Row key={ev.id} ev={ev} guardianName={family?.guardian_display_name} />
      ))}
      <T variant="elderBody" style={{ color: colors.subtle }}>
        사진으로 약 칸이 빈 것만 확인해요.
      </T>
    </Screen>
  );
}

function Row({ ev, guardianName }: { ev: DoseEvent; guardianName?: string }) {
  const tod = TIME_OF_DAY_LABELS[ev.time_of_day];
  const taken = ev.outcome === 'taken';
  const byGuardian = taken && ev.handoff?.verdict === 'taken';
  const photo = ev.photos[ev.photos.length - 1];
  const reading = ev.readings[ev.readings.length - 1];
  const at = photo ? new Date(photo.taken_at) : ev.resolved_at ? new Date(ev.resolved_at) : null;

  return (
    <View style={styles.row} accessible accessibilityLabel={taken ? `${tod}, 기록 있음` : `${tod}, 아직 기록이 없어요`}>
      <T variant="elderTitle">
        {taken ? '✓' : '–'} {tod}
      </T>
      {taken && at ? (
        <>
          <T variant="elderBody">{spokenTime(at)}</T>
          {photo?.uri ? <Image source={{ uri: photo.uri }} style={styles.photo} accessibilityLabel={`${tod} 약통 사진`} /> : null}
          {byGuardian ? <JudgeBadge kind="guardian" guardianName={guardianName} /> : <JudgeBadge kind="ai" isMock={reading?.is_mock} />}
        </>
      ) : (
        <T variant="elderBody">아직 기록이 없어요</T>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { borderWidth: 2, borderColor: colors.border, borderRadius: 16, padding: 16, gap: 8 },
  photo: { width: '100%', aspectRatio: 2.4, borderRadius: 8 },
});
