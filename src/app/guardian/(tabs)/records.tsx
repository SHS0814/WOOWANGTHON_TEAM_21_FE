import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type ScrollViewInstance } from 'react-native';

import { api, type DoseEvent, type DoseEventFilter, type HandoffReason, type Summary } from '@/api';
import { DatePickerSheet } from '@/components/guardian/DatePicker';
import { dayLevel, hasException, Heatmap } from '@/components/guardian/Heatmap';
import { Icon } from '@/components/guardian/Icon';
import {
  ChoiceChips,
  ErrorText,
  GButton,
  GJudgeBadge,
  GScreen,
  GText,
  ListGroup,
  ListRow,
  MockTag,
  Section,
  SectionTitle,
  StatusChip,
} from '@/components/guardian/ui';
import { doseName } from '@/lib/doseLabel';
import { doseStatus, takenCount } from '@/lib/doseStatus';
import { REASON_TITLE, reasonTitle } from '@/lib/handoff';
import { addDaysKey, dateKey, dateLabelOfKey, daysBetweenKeys, shortDateOfKey, spokenTime, TIME_OF_DAY_LABELS } from '@/lib/time';
import { useApiData } from '@/lib/useApiData';
import { guardian } from '@/theme';

const C = guardian.color;

const PAGE_DAYS = 7;
/** 검색(filter·reason) 결과는 한 번에 받아 이 개수씩 나눠 보여 준다 */
const PAGE_ITEMS = 15;
/** 검색 기간 최대 (3.19: filter·reason 이 있으면 366일) */
const MAX_SEARCH_DAYS = 366;

type Tab = 'list' | 'stats';
type StatPeriod = 'week' | 'month' | 'year' | 'total';
type FilterKey = 'all' | DoseEventFilter | 'reason';

interface Search {
  from: string;
  to: string;
  filter?: DoseEventFilter;
  reason?: HandoffReason;
}

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'exceptions', label: '특이사항 모두' },
  { key: 'handoff', label: '인계 있었음' },
  { key: 'not_taken', label: '안 드심' },
  { key: 'reason', label: '사유별' },
];
const REASONS = Object.keys(REASON_TITLE) as HandoffReason[];

/**
 * G6 기록 (R-051, api.md 3.19·3.25). 전체 기록을 최신순으로, 7일씩 넘겨 본다 (맨 위가 오늘).
 * 날짜·기간·특이사항으로 검색하고, 통계는 1주·1달·1년·전체 중 골라 숫자와 잔디맵으로 본다.
 * 문장은 앱이 만들고 서버는 숫자만 준다
 */
export default function Records() {
  const today = dateKey(new Date());
  const [tab, setTab] = useState<Tab>('list');
  const [search, setSearch] = useState<Search | null>(null);
  const [page, setPage] = useState(0);
  const scroll = useRef<ScrollViewInstance>(null);

  const showDay = (key: string) => {
    setSearch({ from: key, to: key });
    setPage(0);
    setTab('list');
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  return (
    <GScreen inTabs title="기록" scrollRef={scroll}>
      <ChoiceChips
        label="보기"
        value={tab}
        onChange={setTab}
        options={[
          { key: 'list', label: '기록' },
          { key: 'stats', label: '통계' },
        ]}
      />
      {api.mode === 'mock' ? <MockTag label="지난 날 기록은 모의 데이터예요." /> : null}
      {tab === 'list' ? (
        <RecordList
          today={today}
          search={search}
          page={page}
          setPage={(p) => {
            setPage(p);
            scroll.current?.scrollTo({ y: 0, animated: false });
          }}
          onSearch={(q) => {
            setSearch(q);
            setPage(0);
          }}
        />
      ) : (
        <Stats today={today} onPick={showDay} />
      )}
    </GScreen>
  );
}

// ── 기록 목록 ─────────────────────────────────────────

function RecordList({
  today,
  search,
  page,
  setPage,
  onSearch,
}: {
  today: string;
  search: Search | null;
  page: number;
  setPage: (p: number) => void;
  onSearch: (q: Search | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const filtered = !!(search?.filter || search?.reason);

  // 페이지 범위: 검색이 없으면 오늘부터 7일씩, 기간 검색(필터 없음)은 그 기간 안에서 7일씩, 필터 검색은 한 번에 받아 나눈다
  const end = search ? search.to : today;
  const start = search ? search.from : null;
  const winTo = filtered ? end : addDaysKey(end, -PAGE_DAYS * page);
  let winFrom = filtered ? (start as string) : addDaysKey(winTo, -(PAGE_DAYS - 1));
  if (start && winFrom < start) winFrom = start;
  const { data: events, error } = useApiData(
    () =>
      api.doseEvents(winFrom, winTo, {
        order: 'desc',
        filter: search?.filter,
        reason: search?.reason,
      }),
    [winFrom, winTo, search?.filter, search?.reason],
  );

  const items = events ?? [];
  const shown = filtered ? items.slice(page * PAGE_ITEMS, (page + 1) * PAGE_ITEMS) : items;
  const hasOlder = filtered ? (page + 1) * PAGE_ITEMS < items.length : !start || winFrom > start;
  const hasNewer = page > 0;
  const pageCount = filtered ? Math.max(1, Math.ceil(items.length / PAGE_ITEMS)) : null;

  // 날짜별로 묶는다 (최신순). 필터 없는 보기는 기록이 없는 날도 보여 준다
  const groups: { key: string; items: DoseEvent[] }[] = [];
  if (filtered) {
    for (const ev of shown) {
      const g = groups[groups.length - 1];
      if (g && g.key === ev.date) g.items.push(ev);
      else groups.push({ key: ev.date, items: [ev] });
    }
  } else {
    for (let k = winTo; k >= winFrom; k = addDaysKey(k, -1)) groups.push({ key: k, items: items.filter((e) => e.date === k) });
  }

  return (
    <>
      {open ? (
        <SearchPanel
          today={today}
          initial={search}
          onCancel={() => setOpen(false)}
          onApply={(q) => {
            onSearch(q);
            setOpen(false);
          }}
        />
      ) : search ? (
        <View style={styles.searchBar}>
          <View style={{ flex: 1 }}>
            <GText variant="label" color={C.sub}>
              검색 결과
            </GText>
            <GText variant="bodyStrong">{searchLabel(search)}</GText>
          </View>
          <View style={{ gap: 6 }}>
            <GButton compact variant="secondary" icon="calendar" label="바꾸기" accessibilityLabel="검색 바꾸기" onPress={() => setOpen(true)} />
            <GButton compact variant="ghost" icon="x" label="지우기" accessibilityLabel="검색 지우기" onPress={() => onSearch(null)} />
          </View>
        </View>
      ) : (
        <GButton variant="secondary" icon="calendar" label="날짜·기간·특이사항으로 찾기" onPress={() => setOpen(true)} />
      )}

      {!filtered && winFrom === winTo ? null : (
        <View style={styles.pageHead} accessibilityLiveRegion="polite">
          <GText variant="section" accessibilityRole="header">
            {filtered
              ? `${items.length}건${pageCount && pageCount > 1 ? ` · ${page + 1}/${pageCount}쪽` : ''}`
              : winFrom === winTo
                ? dateLabelOfKey(winTo)
                : `${shortDateOfKey(winFrom)} ~ ${shortDateOfKey(winTo)}`}
          </GText>
        </View>
      )}

      {error ? <ErrorText>기록을 불러오지 못했어요.</ErrorText> : null}
      {events && filtered && !items.length ? <GText color={C.sub}>찾는 기록이 없어요.</GText> : null}

      {groups.map((g) => (
        <View key={g.key}>
          <View style={styles.dayHead}>
            <GText variant="label" color={g.key === today ? C.primaryStrong : C.sub}>
              {dateLabelOfKey(g.key)}
              {g.key === today ? ' · 오늘' : ''}
            </GText>
          </View>
          {g.items.length ? (
            <ListGroup style={{ marginTop: 0 }}>
              {g.items.map((ev) => (
                <EventRow key={ev.id} ev={ev} search={search} />
              ))}
            </ListGroup>
          ) : (
            <GText variant="sub" color={C.sub} style={styles.empty}>
              {events ? '기록 없음' : '불러오는 중'}
            </GText>
          )}
        </View>
      ))}

      {hasOlder || hasNewer ? (
        <View style={styles.pager}>
          <View style={{ flex: 1 }}>
            <GButton
              variant="secondary"
              icon="chevronLeft"
              label={filtered ? '이전 쪽' : '이전 7일'}
              accessibilityLabel={filtered ? '이전 쪽 (더 오래된 기록)' : '이전 7일 (더 오래된 기록)'}
              disabled={!hasOlder}
              onPress={() => setPage(page + 1)}
            />
          </View>
          <View style={{ flex: 1 }}>
            <GButton
              variant="secondary"
              icon="chevronRight"
              label={filtered ? '다음 쪽' : '다음 7일'}
              accessibilityLabel={filtered ? '다음 쪽 (더 최근 기록)' : '다음 7일 (더 최근 기록)'}
              disabled={!hasNewer}
              onPress={() => setPage(page - 1)}
            />
          </View>
        </View>
      ) : null}
    </>
  );
}

function searchLabel(q: Search) {
  const range = q.from === q.to ? dateLabelOfKey(q.from) : `${shortDateOfKey(q.from)} ~ ${shortDateOfKey(q.to)}`;
  const f = q.reason ? reasonTitle(q.reason) : q.filter ? FILTERS.find((x) => x.key === q.filter)?.label : null;
  return f ? `${range} · ${f}` : range;
}

/** 검색 조건: 날짜 하나 또는 기간 + 특이사항 */
function SearchPanel({ today, initial, onCancel, onApply }: { today: string; initial: Search | null; onCancel: () => void; onApply: (q: Search) => void }) {
  const [mode, setMode] = useState<'day' | 'range'>(initial && initial.from !== initial.to ? 'range' : 'day');
  const [from, setFrom] = useState(initial?.from ?? addDaysKey(today, -29));
  const [to, setTo] = useState(initial?.to ?? today);
  const [day, setDay] = useState(initial && initial.from === initial.to ? initial.from : today);
  const [filter, setFilter] = useState<FilterKey>(initial?.reason ? 'reason' : (initial?.filter ?? 'all'));
  const [reason, setReason] = useState<HandoffReason>(initial?.reason ?? 'no_response');
  const [picking, setPicking] = useState<'day' | 'from' | 'to' | null>(null);

  const span = daysBetweenKeys(from, to) + 1;
  const tooLong = mode === 'range' && filter !== 'all' && span > MAX_SEARCH_DAYS;
  const bad = mode === 'range' && from > to;

  const apply = () => {
    const [f, t] = mode === 'day' ? [day, day] : [from, to];
    onApply({
      from: f,
      to: t,
      filter: filter === 'all' || filter === 'reason' ? undefined : filter,
      reason: filter === 'reason' ? reason : undefined,
    });
  };

  return (
    <Section>
      <GText variant="section" accessibilityRole="header">
        기록 찾기
      </GText>
      <ChoiceChips
        label="날짜 고르는 방법"
        value={mode}
        onChange={setMode}
        options={[
          { key: 'day', label: '날짜 하나' },
          { key: 'range', label: '기간' },
        ]}
      />
      {mode === 'day' ? (
        <DateRow label="날짜" value={day} onPress={() => setPicking('day')} />
      ) : (
        <ListGroup style={{ marginTop: 0 }}>
          <DateRow label="시작" value={from} onPress={() => setPicking('from')} />
          <DateRow label="끝" value={to} onPress={() => setPicking('to')} />
        </ListGroup>
      )}
      <GText variant="label">특이사항</GText>
      <ChoiceChips label="특이사항" value={filter} onChange={setFilter} options={FILTERS} />
      {filter === 'reason' ? (
        <ChoiceChips label="인계 사유" value={reason} onChange={setReason} options={REASONS.map((r) => ({ key: r, label: REASON_TITLE[r] }))} />
      ) : null}
      {bad ? <ErrorText>시작 날짜가 끝 날짜보다 늦어요.</ErrorText> : null}
      {tooLong ? <ErrorText>특이사항 검색은 1년(366일)까지 찾을 수 있어요.</ErrorText> : null}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <GButton variant="secondary" label="취소" onPress={onCancel} />
        </View>
        <View style={{ flex: 2 }}>
          <GButton icon="check" label="찾기" disabled={bad || tooLong} onPress={apply} />
        </View>
      </View>
      <DatePickerSheet
        visible={!!picking}
        title={picking === 'from' ? '시작 날짜' : picking === 'to' ? '끝 날짜' : '날짜'}
        value={picking === 'from' ? from : picking === 'to' ? to : day}
        max={today}
        onCancel={() => setPicking(null)}
        onConfirm={(k) => {
          if (picking === 'from') setFrom(k);
          else if (picking === 'to') setTo(k);
          else setDay(k);
          setPicking(null);
        }}
      />
    </Section>
  );
}

function DateRow({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} ${dateLabelOfKey(value)}. 바꾸기`}
      onPress={onPress}
      style={({ pressed }) => [styles.dateRow, pressed && { backgroundColor: C.neutralSoft }]}
    >
      <Icon name="calendar" size={22} color={C.primaryStrong} />
      <GText variant="label" color={C.sub} style={{ width: 40 }}>
        {label}
      </GText>
      <GText variant="bodyStrong" style={{ flex: 1 }}>
        {dateLabelOfKey(value)}
      </GText>
      <GText variant="label" color={C.primaryStrong}>
        바꾸기
      </GText>
    </Pressable>
  );
}

/**
 * 복약 건 한 줄. 특이사항 검색 결과에는 리필 확인 요청(refill_unconfirmed)만 있는 건이 handoff 없이 들어올 수 있다 (R-052).
 * 그런 건은 검색한 사유로, 사유를 고르지 않았으면 "약통 확인 요청"으로 표시한다
 */
function EventRow({ ev, search }: { ev: DoseEvent; search: Search | null }) {
  const st = doseStatus(ev);
  const extra = search?.reason
    ? ev.handoff?.reason === search.reason
      ? null
      : reasonTitle(search.reason)
    : !ev.handoff && (search?.filter === 'handoff' || (search?.filter === 'exceptions' && ev.outcome !== 'not_taken'))
      ? '약통 확인 요청'
      : null;
  const handoffNote = ev.handoff && ev.outcome_source === 'guardian' ? reasonTitle(ev.handoff.reason) : null;
  return (
    <ListRow
      icon="pill"
      iconTone={st.tone === 'neutral' ? 'neutral' : st.tone}
      title={`${TIME_OF_DAY_LABELS[ev.slot.time_of_day]} · ${spokenTime(new Date(ev.scheduled_at))}`}
      subtitle={ev.taken_at && ev.outcome === 'taken' ? `${spokenTime(new Date(ev.taken_at))} 기록` : undefined}
      accessibilityLabel={`${dateLabelOfKey(ev.date)} ${doseName(ev)}, ${st.label}${handoffNote ? `, ${handoffNote}` : ''}${extra ? `, ${extra}` : ''}${ev.handoff ? '. 인계 자세히 보기' : ''}`}
      onPress={
        ev.handoff
          ? () =>
              router.push({
                pathname: '/guardian/handoff/[id]',
                params: { id: ev.handoff!.id },
              })
          : undefined
      }
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
        <StatusChip tone={st.tone} label={st.label} icon={st.icon} />
        {handoffNote ? <StatusChip tone="warn" icon="alert" label={handoffNote} /> : null}
        {extra ? <StatusChip tone="warn" icon="pillbox" label={extra} /> : null}
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

// ── 통계 ──────────────────────────────────────────────

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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
  },
  pageHead: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  dayHead: { paddingTop: 4, paddingBottom: 2 },
  empty: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
  },
  pager: { flexDirection: 'row', gap: 10, marginTop: 4 },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 56,
    paddingHorizontal: 8,
    marginHorizontal: -8,
  },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10 },
  statItem: { width: '50%', gap: 0 },
});
