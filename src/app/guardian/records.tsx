import { StyleSheet, View } from 'react-native';

import { api, type DoseEvent, type Summary } from '@/api';
import { JudgeBadge } from '@/components/AiBadge';
import { Screen } from '@/components/Screen';
import { T } from '@/components/Text';
import { reasonTitle, VERDICT_LABEL } from '@/lib/handoff';
import { dateKey, mondayIndex, spokenTime, TIME_OF_DAY_LABELS, WEEKDAY_LABELS } from '@/lib/time';
import { useApiData } from '@/lib/useApiData';
import { colors } from '@/theme';

/** G6 기록. 하루·주간 요약 (MVP #6, api.md 3.19·3.25). 문장은 앱이 만들고 서버는 숫자만 준다 */
export default function Records() {
  const today = dateKey(new Date());
  const { data: events } = useApiData(() => api.doseEvents(today, today).catch(() => null));
  const { data: days } = useApiData(() => api.summaries('day').catch(() => null));
  const { data: weeks } = useApiData(() => api.summaries('week').catch(() => null));
  const week = weeks?.[weeks.length - 1];

  return (
    <Screen scroll>
      <T variant="title">오늘</T>
      {events === null ? <T style={{ color: colors.subtle }}>기록을 불러오지 못했어요.</T> : null}
      {events?.map((ev) => <EventRow key={ev.id} ev={ev} />)}

      <T variant="title" style={{ marginTop: 12 }}>
        이번 주
      </T>
      {week ? <T>{weekLine(week)}</T> : null}
      {week ? <Flags s={week} /> : null}

      <T variant="title" style={{ marginTop: 12 }}>
        최근 7일
      </T>
      {api.mode === 'mock' ? (
        <T variant="small" style={{ color: colors.mockBg }}>
          지난 날 기록은 모의 데이터예요.
        </T>
      ) : null}
      {days?.map((d) => <DayRow key={d.period_start} s={d} />)}
    </Screen>
  );
}

function taken(s: Summary) {
  return s.counts.taken_ai + s.counts.taken_guardian;
}

function weekLine(s: Summary) {
  return s.all_normal ? `✓ 이번 주 ${s.counts.scheduled}번 중 ${s.counts.scheduled}번 정상` : `이번 주 ${s.counts.scheduled}번 중 ${taken(s)}번 기록`;
}

function Flags({ s }: { s: Summary }) {
  const parts = [s.includes_mock && '모의 결과 포함', s.includes_simulated && '시뮬레이션 포함'].filter(Boolean);
  return (
    <>
      {parts.length ? (
        <T variant="small" style={{ color: colors.mockBg }}>
          {parts.join(' · ')}
        </T>
      ) : null}
      {s.pillbox_mismatch ? <T style={{ color: colors.attention }}>! 약통 상태가 기록과 달라요</T> : null}
    </>
  );
}

function DayRow({ s }: { s: Summary }) {
  const date = new Date(`${s.period_start}T00:00:00`);
  const c = s.counts;
  return (
    <View style={styles.row}>
      <T>
        {s.all_normal ? '✓' : '!'} {date.getMonth() + 1}/{date.getDate()} ({WEEKDAY_LABELS[mondayIndex(date)]}) {taken(s)}/{c.scheduled}
        {c.taken_guardian ? ` · 보호자 판정 ${c.taken_guardian}` : ''}
        {c.not_taken ? ` · 안 드심 ${c.not_taken}` : ''}
        {c.open_handoffs ? ` · 처리할 일 ${c.open_handoffs}` : ''}
        {c.pending ? ` · 남음 ${c.pending}` : ''}
      </T>
      <Flags s={s} />
    </View>
  );
}

function EventRow({ ev }: { ev: DoseEvent }) {
  const tod = TIME_OF_DAY_LABELS[ev.slot.time_of_day];
  let status: string;
  if (ev.outcome && ev.outcome_source === 'guardian') status = VERDICT_LABEL[ev.outcome];
  else if (ev.outcome === 'taken') status = '✓ 정상';
  else if (ev.handoff) status = `! ${reasonTitle(ev.handoff.reason)}`;
  else if (ev.state === 'scheduled') status = '– 예정';
  else status = '– 진행 중';
  return (
    <View style={styles.row}>
      <T style={{ fontWeight: '700' }}>
        {tod} · {spokenTime(new Date(ev.scheduled_at))}
        {ev.is_simulated ? ' · 시뮬레이션' : ''}
      </T>
      <T>{status}</T>
      {ev.outcome_source === 'guardian' ? (
        <JudgeBadge kind="guardian" guardianName={ev.decided_by?.display_name} />
      ) : ev.latest_reading ? (
        <JudgeBadge kind="ai" isMock={ev.latest_reading.is_mock} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { borderBottomWidth: 1, borderColor: colors.border, paddingVertical: 10, gap: 4 },
});
