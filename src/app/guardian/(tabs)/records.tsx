import { View } from 'react-native';

import { api, type DoseEvent, type Summary } from '@/api';
import { Card, GJudgeBadge, GScreen, GText, ListGroup, ListRow, MockTag, SectionTitle, StatusChip } from '@/components/guardian/ui';
import { doseStatus, takenCount } from '@/lib/doseStatus';
import { doseName } from '@/lib/doseLabel';
import { dateKey, shortDateOfKey, spokenTime } from '@/lib/time';
import { useApiData } from '@/lib/useApiData';
import { guardian } from '@/theme';

const C = guardian.color;

/** G6 기록. 하루·주간 요약 (MVP #6, api.md 3.19·3.25). 문장은 앱이 만들고 서버는 숫자만 준다 */
export default function Records() {
  const today = dateKey(new Date());
  const { data: events } = useApiData(() => api.doseEvents(today, today).catch(() => null));
  const { data: days } = useApiData(() => api.summaries('day').catch(() => null));
  const { data: weeks } = useApiData(() => api.summaries('week').catch(() => null));
  const week = weeks?.[weeks.length - 1];

  return (
    <GScreen inTabs title="기록">
      <SectionTitle>오늘</SectionTitle>
      {events === null ? (
        <Card>
          <GText color={C.sub}>기록을 불러오지 못했어요.</GText>
        </Card>
      ) : events?.length ? (
        <ListGroup>
          {events.map((ev) => (
            <EventRow key={ev.id} ev={ev} />
          ))}
        </ListGroup>
      ) : null}

      {week ? (
        <>
          <SectionTitle>이번 주</SectionTitle>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <View style={{ flex: 1 }} accessible accessibilityLabel={weekLine(week)}>
                <GText variant="label" color={C.sub}>
                  기록된 복약
                </GText>
                <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                  <GText variant="stat">{takenCount(week)}</GText>
                  <GText variant="section" color={C.sub}>
                    {' '}
                    / {week.counts.scheduled}번
                  </GText>
                </View>
              </View>
              {week.all_normal ? <StatusChip tone="ok" label="모두 정상" /> : null}
            </View>
            <GText color={C.sub}>{weekLine(week)}</GText>
            <Flags s={week} />
          </Card>
        </>
      ) : null}

      <SectionTitle>최근 7일</SectionTitle>
      {api.mode === 'mock' ? <MockTag label="지난 날 기록은 모의 데이터예요." /> : null}
      {days?.length ? (
        <ListGroup>
          {days.map((d) => (
            <DayRow key={d.period_start} s={d} />
          ))}
        </ListGroup>
      ) : null}
    </GScreen>
  );
}

function weekLine(s: Summary) {
  return s.all_normal ? `✓ 이번 주 ${s.counts.scheduled}번 중 ${s.counts.scheduled}번 정상` : `이번 주 ${s.counts.scheduled}번 중 ${takenCount(s)}번 기록`;
}

function Flags({ s }: { s: Summary }) {
  if (!s.includes_mock && !s.includes_simulated && !s.pillbox_mismatch) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {s.includes_mock ? <MockTag label="모의 결과 포함" /> : null}
      {s.includes_simulated ? <MockTag label="시뮬레이션 포함" /> : null}
      {s.pillbox_mismatch ? <StatusChip tone="warn" label="약통 상태가 기록과 달라요" /> : null}
    </View>
  );
}

function DayRow({ s }: { s: Summary }) {
  const c = s.counts;
  // 서버 날짜(서울)를 기기 시간대로 해석하지 않는다 (R-032 Q-013)
  const label = shortDateOfKey(s.period_start);
  if (c.scheduled === 0) {
    return <ListRow icon="calendar" iconTone="neutral" title={label} subtitle="일정 없음" right={<StatusChip tone="neutral" icon="minus" label="없음" />} />;
  }
  const details = [
    c.taken_guardian ? `보호자 판정 ${c.taken_guardian}` : '',
    c.not_taken ? `안 드심 ${c.not_taken}` : '',
    c.open_handoffs ? `처리할 일 ${c.open_handoffs}` : '',
    c.pending ? `남음 ${c.pending}` : '',
  ].filter(Boolean);
  return (
    <ListRow
      icon="calendar"
      iconTone={s.all_normal ? 'ok' : 'warn'}
      title={`${label}  ${takenCount(s)}/${c.scheduled}`}
      subtitle={details.length ? details.join(' · ') : undefined}
      right={s.all_normal ? <StatusChip tone="ok" label="정상" /> : <StatusChip tone="warn" label="확인" />}
    >
      <Flags s={s} />
    </ListRow>
  );
}

function EventRow({ ev }: { ev: DoseEvent }) {
  const st = doseStatus(ev);
  return (
    <ListRow icon="pill" iconTone={st.tone === 'neutral' ? 'neutral' : st.tone} title={`${doseName(ev)} · ${spokenTime(new Date(ev.scheduled_at))}`}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
        <StatusChip tone={st.tone} label={st.label} icon={st.icon} />
        {ev.is_simulated ? <MockTag label="시뮬레이션" /> : null}
        {ev.outcome_source === 'guardian' ? (
          <GJudgeBadge kind="guardian" guardianName={ev.decided_by?.display_name} />
        ) : ev.latest_reading ? (
          <GJudgeBadge kind="ai" isMock={ev.latest_reading.is_mock} />
        ) : null}
      </View>
    </ListRow>
  );
}
