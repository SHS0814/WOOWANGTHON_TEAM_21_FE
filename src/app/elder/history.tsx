import { StyleSheet, View } from 'react-native';

import { api, type DoseEvent } from '@/api';
import { JudgeBadge } from '@/components/AiBadge';
import { BigButton } from '@/components/BigButton';
import { RemotePhoto } from '@/components/RemotePhoto';
import { Screen } from '@/components/Screen';
import { T } from '@/components/Text';
import { goBackOr } from '@/lib/nav';
import { spokenHHMM, spokenTime, TIME_OF_DAY_LABELS } from '@/lib/time';
import { useApiData } from '@/lib/useApiData';
import { colors } from '@/theme';

/** E8 "나 약 먹었나?" — 오늘 기록을 시각과 사진으로 (MVP #3, api.md 2.5 elder_status) */
export default function History() {
  const { data: today } = useApiData(() => api.today());

  return (
    <Screen scroll footer={<BigButton label="돌아가기" onPress={() => goBackOr('/elder')} />}>
      <T variant="elderTitle">오늘 약 기록</T>
      {today?.items.map((ev) => <Row key={ev.id} ev={ev} />)}
      <T variant="elderBody" style={{ color: colors.subtle }}>
        사진으로 약 칸이 빈 것만 확인해요.
      </T>
    </Screen>
  );
}

function Row({ ev }: { ev: DoseEvent }) {
  const tod = TIME_OF_DAY_LABELS[ev.slot.time_of_day];
  const photo = ev.photos[ev.photos.length - 1];
  // 어르신 화면에는 "안 드셨어요"나 인계 사유를 보여주지 않는다 (2.5 표, 원칙 6)
  if (ev.elder_status === 'recorded' && ev.taken_at) {
    return (
      <View style={styles.row} accessible accessibilityLabel={`${tod}, 기록 있음`}>
        <T variant="elderTitle">✓ {tod}</T>
        <T variant="elderBody">{spokenTime(new Date(ev.taken_at))}</T>
        {ev.outcome_source === 'ai' && photo ? <RemotePhoto photo={photo} style={styles.photo} label={`${tod} 약통 사진`} /> : null}
        {ev.outcome_source === 'guardian' ? (
          <JudgeBadge kind="guardian" guardianName={ev.decided_by?.display_name} />
        ) : (
          <JudgeBadge kind="ai" isMock={ev.is_mock} />
        )}
        {ev.is_simulated ? <T variant="elderBody">시뮬레이션</T> : null}
      </View>
    );
  }
  return (
    <View style={styles.row} accessible accessibilityLabel={`${tod}, 아직 기록이 없어요`}>
      <T variant="elderTitle">– {tod}</T>
      <T variant="elderBody">{ev.elder_status === 'upcoming' ? `${spokenHHMM(ev.slot.dose_time)} 예정` : '아직 기록이 없어요'}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { borderWidth: 2, borderColor: colors.border, borderRadius: 16, padding: 16, gap: 8 },
  photo: { width: '100%', aspectRatio: 2.4, borderRadius: 8 },
});
