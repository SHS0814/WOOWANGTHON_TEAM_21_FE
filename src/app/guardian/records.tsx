import { StyleSheet, View } from 'react-native';

import { api, type DoseEvent } from '@/api';
import { JudgeBadge } from '@/components/AiBadge';
import { Screen } from '@/components/Screen';
import { T } from '@/components/Text';
import { REASON_TITLE } from '@/lib/handoff';
import { useApiData } from '@/lib/useApiData';
import { useFamily } from '@/lib/useFamily';
import { spokenTime, TIME_OF_DAY_LABELS, WEEKDAY_LABELS, mondayIndex } from '@/lib/time';
import { colors } from '@/theme';

/** G6 기록. 하루·주간 요약 (MVP #6). 정상 주간은 한 줄 */
export default function Records() {
  const family = useFamily();
  const { data: today } = useApiData(() => api.getToday());
  const { data: week } = useApiData(() => api.getWeekSummary());

  const total = week?.reduce((n, d) => n + d.total, 0) ?? 0;
  const taken = week?.reduce((n, d) => n + d.taken, 0) ?? 0;
  const allNormal = !!week && week.every((d) => d.taken === d.total);

  return (
    <Screen scroll>
      <T variant="title">오늘</T>
      {today?.map((ev) => (
        <EventRow key={ev.id} ev={ev} guardianName={family?.guardian_display_name} />
      ))}

      <T variant="title" style={{ marginTop: 12 }}>
        최근 7일
      </T>
      {api.isMock ? <T variant="small" style={{ color: colors.mockBg }}>지난 날 기록은 모의 데이터예요.</T> : null}
      {allNormal ? (
        <T>✓ 7일 동안 {total}번 중 {taken}번 정상</T>
      ) : (
        <>
          <T>
            {total}번 중 {taken}번 기록
          </T>
          {week?.map((d) => {
            const date = new Date(`${d.date}T00:00:00`);
            const ok = d.taken === d.total;
            return (
              <T key={d.date}>
                {ok ? '✓' : '!'} {date.getMonth() + 1}/{date.getDate()} ({WEEKDAY_LABELS[mondayIndex(date)]}) {d.taken}/{d.total}
                {d.handed_off ? ` · 알림 ${d.handed_off}번` : ''}
                {d.pending ? ` · 남음 ${d.pending}번` : ''}
              </T>
            );
          })}
        </>
      )}
    </Screen>
  );
}

function EventRow({ ev, guardianName }: { ev: DoseEvent; guardianName?: string }) {
  const tod = TIME_OF_DAY_LABELS[ev.time_of_day];
  const reading = ev.readings[ev.readings.length - 1];
  let status: string;
  let judge: 'ai' | 'guardian' | null = null;
  if (ev.handoff?.verdict) {
    status = ev.handoff.verdict === 'taken' ? '✓ 드심' : '✕ 안 드심';
    judge = 'guardian';
  } else if (ev.outcome === 'taken') {
    status = '✓ 정상';
    judge = 'ai';
  } else if (ev.handoff) {
    status = `! ${REASON_TITLE[ev.handoff.reason]}${ev.handoff.acknowledged_at ? ' (확인함)' : ''}`;
    judge = ev.readings.length ? 'ai' : null;
  } else {
    status = '– 아직';
  }
  return (
    <View style={styles.row}>
      <T style={{ fontWeight: '700' }}>
        {tod} · {spokenTime(new Date(ev.scheduled_at))}
      </T>
      <T>{status}</T>
      {judge ? <JudgeBadge kind={judge} isMock={reading?.is_mock} guardianName={guardianName} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { borderBottomWidth: 1, borderColor: colors.border, paddingVertical: 10, gap: 4 },
});
