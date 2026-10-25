import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { api, type DoseEvent } from '@/api';
import { JudgeBadge } from '@/components/AiBadge';
import { BigButton } from '@/components/BigButton';
import { RemotePhoto } from '@/components/RemotePhoto';
import { Screen } from '@/components/Screen';
import { T } from '@/components/Text';
import { goBackOr } from '@/lib/nav';
import { doseName } from '@/lib/doseLabel';
import { canSendLatePhoto } from '@/lib/openDose';
import { spokenHHMM, spokenTime } from '@/lib/time';
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
  // 전날 건은 "어젯밤 자기 전"처럼 날짜를 붙인다 (R-021 Q-007)
  const tod = doseName(ev);
  const photo = ev.photos[ev.photos.length - 1];
  // 기록 여부는 서버의 elder_status 만 따른다 (2.5 표). 늦은 정상 사진도 recorded 로 온다 (R-021 Q-004)
  // 어르신 화면에는 "안 드셨어요"나 인계 사유를 보여주지 않는다 (원칙 6)
  if (ev.elder_status === 'recorded' && ev.taken_at) {
    return (
      <View style={styles.row} accessible accessibilityLabel={`${tod}, 기록 있음`}>
        <T variant="elderTitle">✓ {tod}</T>
        <T variant="elderBody">{spokenTime(new Date(ev.taken_at))}</T>
        {photo ? <RemotePhoto photo={photo} style={styles.photo} label={`${tod} 약통 사진`} size="elder" /> : null}
        {ev.outcome_source === 'guardian' ? (
          <JudgeBadge kind="guardian" guardianName={ev.decided_by?.display_name} size="elder" />
        ) : (
          <JudgeBadge kind="ai" isMock={ev.is_mock} size="elder" />
        )}
        {ev.is_simulated ? <T variant="elderBody">시뮬레이션</T> : null}
      </View>
    );
  }
  // 늦은 사진: 물어보는 시간이 지났지만 서버가 사진을 받는 건은 이 줄에서 올린다 (R-026 Q-009).
  // 복용을 권하지 않고 기록만 요청한다. "약 드실 시간이에요" 같은 말은 쓰지 않는다 (원칙 6, R-007 C3)
  if (canSendLatePhoto(ev)) {
    return (
      <View style={styles.row}>
        <T variant="elderTitle">– {tod}</T>
        <T variant="elderBody">아직 기록이 없어요</T>
        <T variant="elderBody">드셨으면 약통 사진을 찍어 주세요.</T>
        <BigButton
          label="사진 찍기"
          variant="secondary"
          onPress={() => router.push({ pathname: '/elder/camera/[id]', params: { id: ev.id } })}
        />
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
