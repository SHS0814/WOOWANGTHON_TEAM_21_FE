import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useState } from 'react';

import { api, type HandoffReason, type Summary } from '@/api';
import { dayLevel, hasException, Heatmap } from '@/components/guardian/Heatmap';
import { ChoiceChips, ErrorText, GScreen, GText, MockTag, Section, SectionTitle } from '@/components/guardian/ui';
import { takenCount } from '@/lib/doseStatus';
import { REASON_TITLE } from '@/lib/handoff';
import { addDaysKey, dateKey, daysBetweenKeys, shortDateOfKey } from '@/lib/time';
import { useApiData } from '@/lib/useApiData';
import { guardian } from '@/theme';

const C = guardian.color;

type StatPeriod = 'week' | 'month' | 'year' | 'total';
const REASONS = Object.keys(REASON_TITLE) as HandoffReason[];

/**
 * G6 통계 탭 (R-051, R-056, api.md 3.25). 1주·1달(기본)·1년·전체 중 골라 숫자 요약과 잔디맵으로 본다.
 * 잔디맵 칸을 누르면 기록 탭으로 가서 그날 날짜 검색을 연다. 문장은 앱이 만들고 서버는 숫자만 준다
 */
export default function StatsTab() {
  const today = dateKey(new Date());
  return (
    <GScreen inTabs title="통계">
      {api.mode === 'mock' ? <MockTag label="지난 날 기록은 모의 데이터예요." /> : null}
      <Stats today={today} onPick={(date) => router.navigate({ pathname: '/guardian/records', params: { date, at: `${Date.now()}` } })} />
    </GScreen>
  );
}

const PERIODS: { key: StatPeriod; label: string }[] = [
  { key: 'week', label: '1주' },
  { key: 'month', label: '1달' },
  { key: 'year', label: '1년' },
  { key: 'total', label: '전체' },
];

function Stats({ today, onPick }: { today: string; onPick: (key: string) => void }) {
  const [period, setPeriod] = useState<StatPeriod>('month');
  // 1주·1달은 그 기간만, 1년·전체는 하루 요약 366일을 한 번에 받는다 (3.25). 전체 합계는 period=total
  const days = period === 'week' ? 7 : period === 'month' ? 30 : 366;
  const from = addDaysKey(today, -(days - 1));
  const { data: daily, error } = useApiData(() => api.summaries('day', from, today), [from, today]);
  const { data: total } = useApiData(() => (period === 'total' ? api.summaries('total') : Promise.resolve(null)), [period]);

  const sum = period === 'total' ? (total?.[0] ?? null) : daily ? sumDays(daily) : null;
  // 1년·전체 잔디맵은 기록이 시작된 날부터 그린다 (비어 있는 앞쪽을 줄인다)
  const firstDay = daily?.find((d) => d.counts.scheduled > 0)?.period_start;
  const mapFrom = period === 'week' || period === 'month' ? from : firstDay && firstDay > from ? firstDay : from;
  const c = sum?.counts;
  const handoffs = sum ? Object.values(sum.handoffs_by_reason).reduce((a, b) => a + b, 0) : 0;
  const exceptionDays = daily?.filter((d) => d.period_start >= mapFrom && hasException(d)).length ?? 0;
  const fullDays = daily?.filter((d) => d.period_start >= mapFrom && dayLevel(d) === 3).length ?? 0;

  return (
    <>
      <ChoiceChips label="통계 기간" value={period} onChange={setPeriod} options={PERIODS} />
      {error ? <ErrorText>통계를 불러오지 못했어요.</ErrorText> : null}
      {sum && c ? (
        <Section>
          <GText variant="label" color={C.sub}>
            {period === 'total'
              ? `전체 (${sum.period_start.slice(0, 4)}년 ${shortDateOfKey(sum.period_start)}부터)`
              : period === 'year'
                ? '최근 1년'
                : `${shortDateOfKey(from)} ~ 오늘`}
          </GText>
          <View
            style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}
            accessible
            accessibilityLabel={`${c.scheduled}번 중 ${takenCount(sum)}번 기록${c.scheduled ? `, ${Math.round((takenCount(sum) / c.scheduled) * 100)}퍼센트` : ''}`}
          >
            <GText variant="stat">{takenCount(sum)}</GText>
            <GText variant="section" color={C.sub}>
              / {c.scheduled}번 기록
              {c.scheduled ? ` (${Math.round((takenCount(sum) / c.scheduled) * 100)}%)` : ''}
            </GText>
          </View>
          <View style={styles.statRow}>
            <StatItem label="AI 확인" value={`${c.taken_ai}번`} />
            <StatItem label="보호자 판정 드심" value={`${c.taken_guardian}번`} />
            <StatItem label="안 드심" value={`${c.not_taken}번`} tone={c.not_taken ? C.danger : undefined} />
            <StatItem label="인계" value={`${handoffs}건`} tone={handoffs ? C.warn : undefined} />
          </View>
          {handoffs ? (
            <GText variant="sub" color={C.sub}>
              {REASONS.filter((r) => sum.handoffs_by_reason[r])
                .map((r) => `${REASON_TITLE[r]} ${sum.handoffs_by_reason[r]}`)
                .join(' · ')}
            </GText>
          ) : null}
          {sum.includes_mock || sum.includes_simulated ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {sum.includes_mock ? <MockTag label="모의 결과 포함" /> : null}
              {sum.includes_simulated ? <MockTag label="시뮬레이션 포함" /> : null}
            </View>
          ) : null}
        </Section>
      ) : null}
      {daily ? (
        <View style={{ gap: 8 }}>
          <SectionTitle>날마다 복용</SectionTitle>
          <GText variant="sub" color={C.sub}>
            다 드신 날 {fullDays}일 · 특이사항 있던 날 {exceptionDays}일. 칸을 누르면 그날 기록으로 가요.
          </GText>
          <Heatmap days={daily} from={mapFrom} to={today} big={period === 'week' || period === 'month'} onPick={onPick} />
          {period === 'total' && total?.[0] && daysBetweenKeys(total[0].period_start, today) >= 366 ? (
            <GText variant="sub" color={C.sub}>
              잔디맵은 최근 1년만 보여요. 위 숫자는 전체 기간이에요.
            </GText>
          ) : null}
        </View>
      ) : null}
    </>
  );
}

function StatItem({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={styles.statItem}>
      <GText variant="bodyStrong" color={tone}>
        {value}
      </GText>
      <GText variant="sub" color={C.sub}>
        {label}
      </GText>
    </View>
  );
}

function sumDays(days: Summary[]): Summary {
  const sum = (k: keyof Summary['counts']) => days.reduce((n, d) => n + d.counts[k], 0);
  const reasons = { ...days[0]?.handoffs_by_reason };
  for (const r of REASONS) reasons[r] = days.reduce((n, d) => n + (d.handoffs_by_reason[r] ?? 0), 0);
  return {
    ...days[days.length - 1],
    period_start: days[0]?.period_start ?? '',
    counts: {
      scheduled: sum('scheduled'),
      taken_ai: sum('taken_ai'),
      taken_guardian: sum('taken_guardian'),
      not_taken: sum('not_taken'),
      acknowledged: sum('acknowledged'),
      open_handoffs: sum('open_handoffs'),
      pending: sum('pending'),
    },
    handoffs_by_reason: reasons,
    includes_mock: days.some((d) => d.includes_mock),
    includes_simulated: days.some((d) => d.includes_simulated),
  };
}

const styles = StyleSheet.create({
  statRow: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10 },
  statItem: { width: '50%', gap: 0 },
});
