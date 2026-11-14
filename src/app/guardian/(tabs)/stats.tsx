import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';

import { api, type HandoffReason, type Summary } from '@/api';
import { dayLevel, hasException, Heatmap } from '@/components/guardian/Heatmap';
import { Icon } from '@/components/guardian/Icon';
import { ErrorText, GScreen, GText, MockTag, Section } from '@/components/guardian/ui';
import { takenCount } from '@/lib/doseStatus';
import { REASON_TITLE } from '@/lib/handoff';
import { addDaysKey, dateKey, daysBetweenKeys, shortDateOfKey } from '@/lib/time';
import { useApiData } from '@/lib/useApiData';
import { guardian } from '@/theme';

const C = guardian.color;

type StatPeriod = 'week' | 'month' | 'year' | 'total';
const REASONS = Object.keys(REASON_TITLE) as HandoffReason[];

/**
 * G6 통계 탭 (R-051, R-056, R-062, api.md 3.25). 1주·1달(기본)·1년·전체 중 골라 숫자 요약과 잔디맵으로 본다.
 * 412×883 에서 1주·1달은 스크롤 없이 한 화면에 들어가게 줄였다 (R-062).
 * 잔디맵 칸을 누르면 기록 탭으로 가서 그날 날짜 검색을 연다. 문장은 앱이 만들고 서버는 숫자만 준다
 */
export default function StatsTab() {
  const today = dateKey(new Date());
  return (
    <GScreen inTabs dense>
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
  const [reasonsOpen, setReasonsOpen] = useState(false);
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
  const pct = c && c.scheduled ? Math.round((takenCount(sum!) / c.scheduled) * 100) : null;
  const range =
    period === 'total' && sum
      ? `전체 · ${sum.period_start.slice(0, 4)}년 ${shortDateOfKey(sum.period_start)}부터`
      : period === 'year'
        ? '최근 1년'
        : `${shortDateOfKey(from)} ~ 오늘`;
  const reasons = sum ? REASONS.filter((r) => sum.handoffs_by_reason[r]) : [];

  return (
    <>
      {/* 제목 줄: 제목 + 기간 칩 */}
      <View style={styles.titleRow}>
        <GText variant="title" accessibilityRole="header" style={{ flex: 1 }}>
          통계
        </GText>
        <View style={styles.periods} accessibilityRole="radiogroup" accessibilityLabel="통계 기간">
          {PERIODS.map((p) => {
            const on = p.key === period;
            return (
              <Pressable
                key={p.key}
                accessibilityRole="radio"
                accessibilityState={{ selected: on, checked: on }}
                accessibilityLabel={p.label}
                onPress={() => setPeriod(p.key)}
                style={({ pressed }) => [styles.period, on && styles.periodOn, pressed && !on && { backgroundColor: C.neutralSoft }]}
              >
                <Text style={[styles.periodText, on && { color: C.onPrimary }]}>{p.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      {/* 기간 범위 + 모의·시뮬레이션 표시 (작은 칩 한 줄, 숨기지 않는다) */}
      <View style={styles.metaRow}>
        <GText variant="sub" color={C.sub}>
          {range}
        </GText>
        {api.mode === 'mock' ? (
          <MockTag label="모의 데이터" a11y="지난 날 기록은 모의 데이터, 판독은 모의 결과예요" />
        ) : sum?.includes_mock ? (
          <MockTag label="모의 결과 포함" />
        ) : null}
        {sum?.includes_simulated ? <MockTag label="시뮬레이션 포함" /> : null}
      </View>
      {error ? <ErrorText>통계를 불러오지 못했어요.</ErrorText> : null}

      {sum && c ? (
        <Section style={{ gap: 8, paddingBottom: 10 }}>
          <View
            style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}
            accessible
            accessibilityLabel={`${c.scheduled}번 중 ${takenCount(sum)}번 기록${pct !== null ? `, ${pct}퍼센트` : ''}`}
          >
            <GText variant="title">{takenCount(sum)}</GText>
            <GText variant="bodyStrong" color={C.sub}>
              / {c.scheduled}번 기록
            </GText>
            {pct !== null ? (
              <GText variant="title" color={C.ok} style={{ marginLeft: 'auto' }}>
                {pct}%
              </GText>
            ) : null}
          </View>
          <View style={styles.statRow}>
            <StatItem label="AI 확인" value={c.taken_ai} />
            <StatItem label="판정 정상" value={c.taken_guardian} />
            <StatItem label="미복용" value={c.not_taken} tone={c.not_taken ? C.warn : undefined} />
            <StatItem label="인계" value={handoffs} unit="건" tone={handoffs ? C.warn : undefined} />
          </View>
          {reasons.length ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: reasonsOpen }}
              accessibilityLabel={reasonsOpen ? '인계 사유 접기' : `인계 사유 ${reasons.length}가지 보기`}
              onPress={() => setReasonsOpen((v) => !v)}
              style={({ pressed }) => [styles.reasonToggle, pressed && { backgroundColor: C.neutralSoft }]}
            >
              <GText variant="sub" color={C.primaryStrong} style={{ fontWeight: '700' }}>
                인계 사유 {reasons.length}가지 {reasonsOpen ? '접기' : '보기'}
              </GText>
              <Icon name={reasonsOpen ? 'chevronUp' : 'chevronDown'} size={18} color={C.primaryStrong} strokeWidth={2.4} />
            </Pressable>
          ) : null}
          {reasonsOpen
            ? reasons.map((r) => (
                <View key={r} style={styles.reasonRow}>
                  <GText variant="sub" style={{ flex: 1 }}>
                    {REASON_TITLE[r]}
                  </GText>
                  <GText variant="bodyStrong" color={C.warn}>
                    {sum.handoffs_by_reason[r]}건
                  </GText>
                </View>
              ))
            : null}
        </Section>
      ) : null}

      {daily ? (
        <View style={{ gap: 6 }}>
          <View style={styles.mapHead}>
            <GText variant="section" accessibilityRole="header">
              날마다 복용
            </GText>
            <GText variant="sub" color={C.sub}>
              칸을 누르면 그날 기록
            </GText>
          </View>
          <GText variant="sub" color={C.sub}>
            다 드신 날 {fullDays}일 · 특이사항 {exceptionDays}일
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

function StatItem({ label, value, unit = '번', tone }: { label: string; value: number; unit?: string; tone?: string }) {
  return (
    <View style={styles.statItem} accessible accessibilityLabel={`${label} ${value}${unit}`}>
      <GText variant="bodyStrong" color={tone}>
        {value}
        {unit}
      </GText>
      <GText variant="sub" color={C.sub} numberOfLines={1}>
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
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  periods: { flexDirection: 'row', gap: 6 },
  period: {
    minWidth: 48,
    minHeight: 44,
    paddingHorizontal: 10,
    borderRadius: guardian.radius.chip,
    borderWidth: 1.5,
    borderColor: '#C5CEDA',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.card,
  },
  periodOn: { backgroundColor: C.primary, borderColor: C.primary },
  periodText: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: C.text },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 4, marginTop: -4 },
  statRow: { flexDirection: 'row' },
  statItem: { flex: 1 },
  reasonToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, alignSelf: 'flex-start', paddingHorizontal: 8, marginHorizontal: -8 },
  reasonRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mapHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
});
