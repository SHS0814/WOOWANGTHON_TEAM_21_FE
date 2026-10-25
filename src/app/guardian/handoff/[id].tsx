import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { api, guardianMessage, isApiError, type Layout, type Reading, type Verdict } from '@/api';
import { JudgeBadge } from '@/components/AiBadge';
import { BigButton } from '@/components/BigButton';
import { SimulationTag } from '@/components/MockBanner';
import { PhotoWithBoxes } from '@/components/PhotoWithBoxes';
import { PillboxGrid } from '@/components/PillboxGrid';
import { Screen } from '@/components/Screen';
import { T } from '@/components/Text';
import { reasonDetail, reasonTitle, VERDICT_LABEL } from '@/lib/handoff';
import { doseName } from '@/lib/doseLabel';
import { goBackOr } from '@/lib/nav';
import { pillboxAspect } from '@/lib/pillboxAspect';
import { spokenTime } from '@/lib/time';
import { useApiData } from '@/lib/useApiData';
import { useMe } from '@/lib/useMe';
import { colors } from '@/theme';

/**
 * G5 인계 상세 (api.md 3.21). 버튼은 서버가 준 allowed_verdicts 대로 (MVP #5).
 * 강조: bbox 가 있는 칸은 사진 위, 없는 칸은 격자 그림 위. 신뢰도 숫자는 없다 (R-008 C5)
 */
export default function HandoffDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: me } = useMe();
  const { data: h, reload } = useApiData(() => api.handoff(id), [id]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  if (!h || !me) return null;
  const ev = h.dose_event;
  const tod = doseName(ev);
  // 최근 판독을 맨 위에, 이전 판독(첫 촬영)은 아래에
  const readings = h.readings.slice().reverse();

  const decide = async (v: Verdict) => {
    setBusy(true);
    setMsg('');
    try {
      await api.verdict(h.id, v);
      if (v === 'not_refilled') setMsg('약통을 새로 채우면 리필 등록을 해 주세요.');
      else goBackOr('/guardian');
    } catch (e) {
      setMsg(guardianMessage(e));
      if (isApiError(e, 'handoff_already_resolved')) reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      {ev.is_simulated ? <SimulationTag /> : null}
      <T variant="title">! {reasonTitle(h.reason)}</T>
      <T>
        {tod} 약 · {spokenTime(new Date(h.notified_at))} 알림
      </T>
      <T>{reasonDetail(h, me.family.elder_display_name)}</T>
      {h.late_photo ? <T style={{ fontWeight: '700' }}>알려드린 뒤에 사진이 올라왔어요.</T> : null}

      {readings.length ? (
        readings.map((r, i) => (
          <ReadingView key={r.id} reading={r} layout={h.layout} title={readings.length > 1 ? (i === 0 ? '다시 찍은 사진' : '처음 사진') : undefined} />
        ))
      ) : (
        <T style={{ color: colors.subtle }}>사진이 없어요.</T>
      )}

      <View style={styles.limit}>
        <T>칸이 빈 것만 확인했어요. 드셨는지는 직접 확인해 주세요.</T>
      </View>

      <View style={{ gap: 12 }}>
        {/* 전화번호는 서버가 갖지 않는다 (3.21) → 전화 앱을 연다 */}
        <BigButton size="guardian" label={`${me.family.elder_display_name}께 전화하기`} onPress={() => Linking.openURL('tel:')} />
        {h.verdict ? (
          <T style={{ fontWeight: '700' }}>
            {h.verdict_by?.display_name ?? '보호자'} 판정: {VERDICT_LABEL[h.verdict]}
          </T>
        ) : (
          h.allowed_verdicts.map((v) => (
            <BigButton key={v} size="guardian" variant="secondary" label={VERDICT_LABEL[v] ?? v} onPress={() => decide(v)} busy={busy} />
          ))
        )}
        {msg ? <T style={{ color: colors.attention }}>{msg}</T> : null}
      </View>
    </Screen>
  );
}

function ReadingView({ reading, layout, title }: { reading: Reading; layout: Layout; title?: string }) {
  return (
    <View style={{ gap: 10 }}>
      <View style={styles.badges}>
        <JudgeBadge kind="ai" isMock={reading.is_mock} />
        <T variant="small">
          {title ? `${title} · ` : ''}
          {spokenTime(new Date(reading.photo.taken_at))}
        </T>
      </View>
      <PhotoWithBoxes reading={reading} aspect={pillboxAspect(layout)} />
      <PillboxGrid layout={layout} cells={reading.cells} targetCellId={reading.target_cell_id} />
    </View>
  );
}

const styles = StyleSheet.create({
  badges: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  limit: { borderLeftWidth: 6, borderColor: colors.border, paddingLeft: 12 },
});
