import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { api, type Verdict } from '@/api';
import { JudgeBadge } from '@/components/AiBadge';
import { BigButton } from '@/components/BigButton';
import { PhotoWithGrid } from '@/components/PhotoWithGrid';
import { PillboxGrid } from '@/components/PillboxGrid';
import { Screen } from '@/components/Screen';
import { T } from '@/components/Text';
import { REASON_TITLE, reasonDetail } from '@/lib/handoff';
import { pillboxAspect } from '@/lib/pillboxAspect';
import { useApiData } from '@/lib/useApiData';
import { useFamily } from '@/lib/useFamily';
import { spokenTime, TIME_OF_DAY_LABELS } from '@/lib/time';
import { colors } from '@/theme';
import { goBackOr } from '@/lib/nav';

/** G5 인계 상세. 판독 애매 건은 [드심] / [안 드심] 판정 (MVP #5) */
export default function HandoffDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const family = useFamily();
  const { data: ev } = useApiData(() => api.getEvent(id), [id]);
  const { data: pillbox } = useApiData(() => api.getPillbox());
  const [busy, setBusy] = useState(false);

  if (!ev || !ev.handoff || !family || pillbox === undefined) return null;
  const h = ev.handoff;
  const photo = ev.photos[ev.photos.length - 1];
  const reading = ev.readings[ev.readings.length - 1];
  const tod = TIME_OF_DAY_LABELS[ev.time_of_day];
  const resolved = !!h.verdict || !!h.acknowledged_at;

  const verdict = async (v: Verdict) => {
    setBusy(true);
    await api.submitVerdict(h.id, v);
    goBackOr('/guardian');
  };
  const acknowledge = async () => {
    setBusy(true);
    await api.acknowledgeHandoff(h.id);
    goBackOr('/guardian');
  };

  return (
    <Screen scroll>
      <T variant="title">! {REASON_TITLE[h.reason]}</T>
      <T>
        {tod} 약 · {spokenTime(new Date(h.notified_at))} 알림
      </T>
      <T>{reasonDetail(h.reason, family.elder_display_name, ev.reask_count, !!ev.reminded_at)}</T>

      {photo && pillbox ? (
        <View style={{ gap: 12 }}>
          <View style={styles.badges}>
            <JudgeBadge kind="ai" isMock={reading?.is_mock} />
            <T variant="small">{spokenTime(new Date(photo.taken_at))} 사진</T>
          </View>
          <PhotoWithGrid
            uri={photo.uri}
            layout={pillbox.layout}
            readings={reading?.cells}
            flaggedCellIds={reading?.flagged_cell_ids}
            aspect={pillboxAspect(pillbox.layout)}
          />
          {reading ? (
            <PillboxGrid layout={pillbox.layout} readings={reading.cells} targetCellId={ev.cell_id} flaggedCellIds={reading.flagged_cell_ids} />
          ) : null}
        </View>
      ) : (
        <T style={{ color: colors.subtle }}>사진이 없어요.</T>
      )}

      <View style={styles.limit}>
        <T>칸이 빈 것만 확인했어요. 드셨는지는 직접 확인해 주세요.</T>
      </View>

      <View style={{ gap: 12 }}>
        <BigButton size="guardian" label={`${family.elder_display_name}께 전화하기`} onPress={() => Linking.openURL('tel:')} />
        {resolved ? (
          <T style={{ fontWeight: '700' }}>
            {h.verdict ? `${family.guardian_display_name} 판정: ${h.verdict === 'taken' ? '✓ 드심' : '✕ 안 드심'}` : '✓ 확인했어요'}
          </T>
        ) : h.reason === 'unclear' ? (
          <>
            <BigButton size="guardian" variant="secondary" label="✓ 드심" onPress={() => verdict('taken')} busy={busy} />
            <BigButton size="guardian" variant="secondary" label="✕ 안 드심" onPress={() => verdict('not_taken')} busy={busy} />
          </>
        ) : (
          <BigButton size="guardian" variant="secondary" label="확인했어요" onPress={acknowledge} busy={busy} />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  badges: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  limit: { borderLeftWidth: 6, borderColor: colors.border, paddingLeft: 12 },
});
