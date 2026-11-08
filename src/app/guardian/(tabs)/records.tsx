import { router, useLocalSearchParams } from 'expo-router';
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';

import { api, type DoseEvent, type DoseEventFilter, type HandoffReason } from '@/api';
import { DatePickerSheet } from '@/components/guardian/DatePicker';
import { Icon, type IconName } from '@/components/guardian/Icon';
import { ChoiceChips, ErrorText, GButton, GScreen, GText, ListGroup, MockTag, Section, TONE } from '@/components/guardian/ui';
import { doseStatus } from '@/lib/doseStatus';
import { REASON_TITLE, reasonTitle } from '@/lib/handoff';
import { addDaysKey, dateKey, dateLabelOfKey, daysBetweenKeys, shortDateOfKey, spokenTime, TIME_OF_DAY_LABELS } from '@/lib/time';
import { useApiData } from '@/lib/useApiData';
import { seoulClock } from '@/lib/seoulTime';
import { guardian, type GuardianTone } from '@/theme';

const C = guardian.color;

const PAGE_DAYS = 7;
/** 검색(filter·reason) 결과는 한 번에 받아 이 개수씩 나눠 보여 준다 */
const PAGE_ITEMS = 15;
/** 검색 기간 최대 (3.19: filter·reason 이 있으면 366일) */
const MAX_SEARCH_DAYS = 366;

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
 * G6 기록 (R-051, R-056, api.md 3.19). 전체 기록을 최신순으로, 7일씩 넘겨 본다 (맨 위가 오늘).
 * 날짜·기간·특이사항으로 검색한다. 통계는 별도 탭(stats.tsx)이다
 */
export default function Records() {
  const today = dateKey(new Date());
  const [search, setSearch] = useState<Search | null>(null);
  const [page, setPage] = useState(0);
  const scroll = useRef<ScrollViewInstance>(null);
  // 통계 탭 잔디맵에서 날짜를 누르면 ?date=YYYY-MM-DD&at=누른 시각 으로 온다 → 그날 날짜 검색을 연다
  const { date, at } = useLocalSearchParams<{ date?: string; at?: string }>();
  useEffect(() => {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    setSearch({ from: date, to: date });
    setPage(0);
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [date, at]);

  return (
    <GScreen inTabs dense scrollRef={scroll}>
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

  const rangeLabel = filtered
    ? `${items.length}건${pageCount && pageCount > 1 ? ` · ${page + 1}/${pageCount}쪽` : ''}`
    : winFrom === winTo
      ? dateLabelOfKey(winTo)
      : `${shortDateOfKey(winFrom)} ~ ${shortDateOfKey(winTo)}`;
  const older = filtered ? '이전 쪽 (더 오래된 기록)' : '이전 7일 (더 오래된 기록)';
  const newer = filtered ? '다음 쪽 (더 최근 기록)' : '다음 7일 (더 최근 기록)';

  return (
    <>
      {/* 머리줄: 제목 + 찾기 */}
      <View style={styles.titleRow}>
        <GText variant="display" accessibilityRole="header" style={{ flex: 1 }}>
          기록
        </GText>
        {open ? null : (
          <GButton compact variant="secondary" icon="calendar" label="찾기" accessibilityLabel="날짜·기간·특이사항으로 찾기" onPress={() => setOpen(true)} />
        )}
      </View>
      {api.mode === 'mock' ? <MockTag label="지난 날 기록은 모의 데이터예요." /> : null}

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
          <Icon name="calendar" size={20} color={C.primaryStrong} />
          <GText variant="bodyStrong" style={{ flex: 1 }} accessibilityLabel={`검색: ${searchLabel(search)}`}>
            {searchLabel(search)}
          </GText>
          <IconButton icon="x" label="검색 지우기" onPress={() => onSearch(null)} />
        </View>
      ) : null}

      {/* 범위 + 넘기기 (위에도 두어 맨 아래까지 내려가지 않아도 된다) */}
      {!filtered && winFrom === winTo ? null : (
        <View style={styles.pageHead}>
          <IconButton icon="chevronLeft" label={older} disabled={!hasOlder} onPress={() => setPage(page + 1)} />
          <GText variant="bodyStrong" accessibilityRole="header" accessibilityLiveRegion="polite" style={{ flex: 1, textAlign: 'center' }}>
            {rangeLabel}
          </GText>
          <IconButton icon="chevronRight" label={newer} disabled={!hasNewer} onPress={() => setPage(page - 1)} />
        </View>
      )}

      {error ? <ErrorText>기록을 불러오지 못했어요.</ErrorText> : null}
      {events && filtered && !items.length ? <GText color={C.sub}>찾는 기록이 없어요.</GText> : null}

      {/* 날짜 머리글 없이 행마다 날짜를 쓴다 (R-060). 같은 날 행은 구분선 없이 이어 붙이고, 날짜가 바뀌는 곳에만 선을 긋는다 */}
      <View>
        {groups.map((g) =>
          g.items.length ? (
            g.items.map((ev, i) => <EventRow key={ev.id} ev={ev} search={search} today={today} first={i === 0} last={i === g.items.length - 1} />)
          ) : (
            <View
              key={g.key}
              style={[styles.emptyRow, styles.rowLine]}
              accessible
              accessibilityLabel={`${dateLabelOfKey(g.key)}, ${events ? '기록 없음' : '불러오는 중'}`}
            >
              <DatePrefix dateKey={g.key} today={today} first />
              <GText variant="sub" color={C.sub}>
                {events ? '기록 없음' : '불러오는 중'}
              </GText>
            </View>
          ),
        )}
      </View>

      {hasOlder || hasNewer ? (
        <View style={styles.pager}>
          <View style={{ flex: 1 }}>
            <GButton
              compact
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
              compact
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
/**
 * 행 앞의 날짜 "11/8 (일)" (+ 오늘). 같은 날 두 번째 행부터는 보통 굵기의 흐린 색으로 둔다:
 * 생략하지 않아 행 하나만 봐도 날짜를 알 수 있고, 흐리게 해서 날이 바뀌는 첫 행이 눈에 먼저 띈다 (R-060)
 */
function DatePrefix({ dateKey: key, today, first }: { dateKey: string; today: string; first: boolean }) {
  const isToday = key === today;
  return (
    <Text style={[styles.date, first ? styles.dateFirst : styles.dateRepeat]}>
      {shortDateOfKey(key)}
      {isToday ? <Text style={first ? styles.todayFirst : styles.dateRepeat}> 오늘</Text> : null}
    </Text>
  );
}

/** 둘째 줄에 쓰는 인계 사유 짧은 이름 (R-069). 화면 낭독에는 긴 이름(REASON_TITLE)을 쓴다 */
const REASON_SHORT: Record<HandoffReason, string> = {
  no_response: '무응답',
  unclear: '애매',
  unchanged: '칸 그대로',
  double_suspected: '이중 의심',
  refill_unconfirmed: '약통 확인',
  refill_overdue: '확인 불가',
};
const reasonShort = (r: string) => REASON_SHORT[r as HandoffReason] ?? '확인 필요';

/** 첫째 줄 오른쪽 상태 (기호 + 짧은 글자). 열린 인계는 사유 대신 "확인 필요", 사유는 둘째 줄에 짧게 */
function shortStatus(ev: DoseEvent): { tone: GuardianTone; label: string; icon: IconName } {
  const st = doseStatus(ev);
  if (ev.handoff && !ev.outcome) return { tone: 'danger', label: '확인 필요', icon: 'alert' };
  if (ev.outcome === 'acknowledged') return { ...st, label: '확인함' };
  return st;
}

/** "HH:MM" (서울) */
const hhmm = (iso: string) => {
  const { h, min } = seoulClock(new Date(iso));
  return `${`${h}`.padStart(2, '0')}:${`${min}`.padStart(2, '0')}`;
};

/**
 * 복약 건 한 항목. 항상 정확히 2줄 (R-069): 넘치면 말줄임하되, 상태와 모의·시뮬 표시는 오른쪽 고정 칸이라 잘리지 않는다.
 * 1줄: 날짜(같은 날 흐리게) · 시간대 · 예정 시각 | 상태. 2줄: 기록 시각 · 판정자 · 사유(짧게) | 모의·시뮬.
 * 특이사항 검색 결과에는 리필 확인 요청만 있는 건이 handoff 없이 들어올 수 있다 (R-052) → 검색 사유나 "약통 확인"으로 표시.
 * 화면 낭독 이름에는 줄이지 않은 전체 문장을 넣는다
 */
function EventRow({ ev, search, today, first, last }: { ev: DoseEvent; search: Search | null; today: string; first: boolean; last: boolean }) {
  const st = shortStatus(ev);
  const fg = TONE[st.tone].fg;
  const extraReason: string | null = search?.reason
    ? ev.handoff?.reason === search.reason
      ? null
      : search.reason
    : !ev.handoff && (search?.filter === 'handoff' || (search?.filter === 'exceptions' && ev.outcome !== 'not_taken'))
      ? 'refill_unconfirmed'
      : null;
  const reason = ev.handoff?.reason ?? null;
  const judgeFull = ev.outcome_source === 'guardian' ? `${ev.decided_by?.display_name ?? '보호자'} 판정` : ev.latest_reading ? 'AI 판독' : null;
  const judgeShort = ev.outcome_source === 'guardian' ? `${ev.decided_by?.display_name ?? '보호자'} 판정` : ev.latest_reading ? 'AI' : null;
  const mock = ev.outcome_source !== 'guardian' && !!ev.latest_reading?.is_mock;
  const recorded = ev.taken_at && ev.outcome === 'taken' ? ev.taken_at : null;

  // 2줄 글자 (짧게)
  const line2: ReactNode[] = [];
  if (recorded) line2.push(`${hhmm(recorded)} 기록`);
  if (judgeShort) line2.push(judgeShort);
  for (const r of new Set([reason, extraReason].filter((x): x is string => !!x))) {
    line2.push(
      <Text key={r} style={{ color: C.warn, fontWeight: '700' }}>
        ⚠ {reasonShort(r)}
      </Text>,
    );
  }
  if (!line2.length) line2.push(ev.state === 'scheduled' ? '아직 복약 시각 전' : ev.outcome === 'not_taken' ? '기록 없음' : '기다리는 중');

  const a11y = [
    `${dateLabelOfKey(ev.date)}${ev.date === today ? ' 오늘' : ''} ${TIME_OF_DAY_LABELS[ev.slot.time_of_day]} ${spokenTime(new Date(ev.scheduled_at))} 예정`,
    doseStatus(ev).label,
    recorded ? `${spokenTime(new Date(recorded))} 기록` : null,
    judgeFull,
    reason ? reasonTitle(reason) : null,
    extraReason ? reasonTitle(extraReason) : null,
    mock ? '모의 결과, 실제 AI 아님' : null,
    ev.is_simulated ? '시뮬레이션, 실제 복약 시각 알림 아님' : null,
  ]
    .filter(Boolean)
    .join(', ');

  const body = (
    <>
      <View style={{ flex: 1, gap: 1 }}>
        <View style={styles.line}>
          <GText variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
            <DatePrefix dateKey={ev.date} today={today} first={first} />
            {'  '}
            {TIME_OF_DAY_LABELS[ev.slot.time_of_day]} {hhmm(ev.scheduled_at)}
          </GText>
          <View style={styles.fixed}>
            <Icon name={st.icon} size={18} color={fg} strokeWidth={2.4} />
            <GText variant="bodyStrong" color={fg}>
              {st.label}
            </GText>
          </View>
        </View>
        <View style={styles.line}>
          <GText variant="sub" color={C.sub} numberOfLines={1} style={{ flex: 1 }}>
            {line2.map((p, i) => (
              <Fragment key={i}>
                {i ? ' · ' : ''}
                {p}
              </Fragment>
            ))}
          </GText>
          {mock || ev.is_simulated ? (
            <View style={[styles.fixed, { gap: 4 }]}>
              {mock ? <Text style={styles.mockMark}>모의</Text> : null}
              {ev.is_simulated ? <Text style={styles.mockMark}>시뮬</Text> : null}
            </View>
          ) : null}
        </View>
      </View>
      {ev.handoff ? <Icon name="chevronRight" size={20} color={C.muted} /> : null}
    </>
  );
  const style = [styles.row, !first && { paddingTop: 2 }, !last && { paddingBottom: 4 }, last && styles.rowLine];
  if (!ev.handoff)
    return (
      <View style={style} accessible accessibilityLabel={a11y}>
        {body}
      </View>
    );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${a11y}. 인계 자세히 보기`}
      onPress={() => router.push({ pathname: '/guardian/handoff/[id]', params: { id: ev.handoff!.id } })}
      style={({ pressed }) => [...style, pressed && { backgroundColor: C.neutralSoft }]}
    >
      {body}
    </Pressable>
  );
}

function IconButton({ icon, label, onPress, disabled }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.iconBtn, pressed && { backgroundColor: C.neutralSoft }]}
    >
      <Icon name={icon} size={24} color={disabled ? '#B8C1CC' : C.primaryStrong} strokeWidth={2.4} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 12, borderLeftWidth: 3, borderColor: C.primary },
  pageHead: { flexDirection: 'row', alignItems: 'center', gap: 4, marginHorizontal: -10 },
  iconBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingVertical: 8 },
  date: { fontSize: 17, lineHeight: 25 },
  dateFirst: { fontWeight: '800', color: C.text },
  dateRepeat: { fontWeight: '400', color: C.muted },
  todayFirst: { fontWeight: '800', color: C.primaryStrong },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, minHeight: 48, paddingHorizontal: 8, marginHorizontal: -8 },
  rowLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  mockText: { color: C.mock, fontWeight: '800' },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fixed: { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 0 },
  mockMark: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
    color: C.onMock,
    backgroundColor: C.mock,
    paddingHorizontal: 6,
    borderRadius: 6,
    overflow: 'hidden',
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
});
