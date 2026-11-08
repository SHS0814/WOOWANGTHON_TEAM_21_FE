import type { Layout, SlotInput, TimeOfDay } from '@/api';

export const TOD_ORDER: TimeOfDay[] = ['morning', 'noon', 'evening', 'bedtime'];
const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

export function timeOfDayFromLabel(label: string): TimeOfDay | null {
  if (label.includes('아침')) return 'morning';
  if (label.includes('점심')) return 'noon';
  if (label.includes('저녁')) return 'evening';
  if (label.includes('취침') || label.includes('자기')) return 'bedtime';
  return null;
}

const WEEKDAY = ['월', '화', '수', '목', '금', '토', '일'];
const isWeekdays = (labels: string[]) => labels.length === 7 && labels.every((l, i) => l.startsWith(WEEKDAY[i]));

/** 하루 약통으로 볼 수 있는 최대 칸 수 (시간대가 아침·점심·저녁·자기 전 넷이라서) */
export const DAILY_MAX_CELLS = 4;

/** 약통의 요일 방향과 시간대 줄 이름. 요일이 열이면 행이 시간대, 요일이 행이면(세로 약통, 2.2) 열이 시간대다 */
function orient(layout: Layout) {
  const weekdayIsCol = isWeekdays(layout.col_labels) || (layout.cols === 7 && !isWeekdays(layout.row_labels));
  const weekdayIsRow = !weekdayIsCol && (isWeekdays(layout.row_labels) || layout.rows === 7);
  if (!weekdayIsCol && !weekdayIsRow) return null;
  return { weekdayIsCol, todLabels: weekdayIsCol ? layout.row_labels : layout.col_labels };
}

/**
 * 약통 종류 (R-054).
 * - weekly: 요일 7칸이 있는 일주일 약통. 시간대 하나 = 한 줄의 7칸
 * - daily: 요일을 못 읽었고 칸이 4개 이하인 하루 약통. 시간대 하나 = 칸 하나를 월~일 매일 쓴다 (api.md 3.14, 드신 뒤 다시 채움)
 * - null: 요일도 못 읽고 칸도 많아 시간대로 이을 수 없음
 */
export type PillboxKind = 'weekly' | 'daily';

export function pillboxKind(layout: Layout): PillboxKind | null {
  if (orient(layout)) return 'weekly';
  if (layout.cells.length >= 1 && layout.cells.length <= DAILY_MAX_CELLS) return 'daily';
  return null;
}

/** 하루 약통 칸들을 읽는 순서 (위→아래, 왼쪽→오른쪽) */
const cellOrder = (layout: Layout) => [...layout.cells].sort((a, b) => a.row - b.row || a.col - b.col);

/** 하루 약통 칸의 이름. 한 줄이면 열 이름, 한 열이면 행 이름, 격자면 둘을 붙인다 */
export function dailyCellLabel(layout: Layout, cell: { row: number; col: number }): string {
  const r = layout.row_labels[cell.row] ?? '';
  const c = layout.col_labels[cell.col] ?? '';
  if (layout.rows === 1) return c || r;
  if (layout.cols === 1) return r || c;
  return [r, c].filter(Boolean).join(' ');
}

export interface TimeRow {
  /** 시간대 단위 번호 (0부터). 일주일 약통은 줄, 하루 약통은 칸 */
  index: number;
  label: string;
  /** 이 시간대가 쓰는 (칸, 요일). 하루 약통은 같은 칸이 7번 나온다 */
  cells: { cell_id: string; weekday: number }[];
}

/** 약통의 시간대 단위들. 일주일 약통은 줄마다 7칸, 하루 약통은 칸마다 월~일. 시간대로 이을 수 없으면 null */
export function timeRows(layout: Layout): TimeRow[] | null {
  const o = orient(layout);
  if (o) {
    return o.todLabels.map((label, index) => ({
      index,
      label,
      cells: layout.cells.filter((c) => (o.weekdayIsCol ? c.row : c.col) === index).map((c) => ({ cell_id: c.id, weekday: o.weekdayIsCol ? c.col : c.row })),
    }));
  }
  if (pillboxKind(layout) !== 'daily') return null;
  return cellOrder(layout).map((c, index) => ({ index, label: dailyCellLabel(layout, c), cells: ALL_WEEKDAYS.map((weekday) => ({ cell_id: c.id, weekday })) }));
}

/** 시간대 단위 이름에서 시간대를 읽는다 (못 읽은 것은 남은 시간대를 순서대로). 4개를 넘거나 겹치면 null */
export function suggestedTimesOfDay(layout: Layout): TimeOfDay[] | null {
  const rows = timeRows(layout);
  if (!rows) return null;
  const used = new Set<TimeOfDay>();
  const tods = rows.map((r) => {
    const t = timeOfDayFromLabel(r.label);
    if (!t || used.has(t)) return null;
    used.add(t);
    return t;
  });
  const fill = TOD_ORDER.filter((t) => !tods.includes(t));
  const resolved = tods.map((t) => t ?? fill.shift() ?? null);
  if (resolved.some((t) => !t) || new Set(resolved).size !== resolved.length) return null;
  return resolved as TimeOfDay[];
}

/** 복약 시간대 하나 = 약통의 한 줄(일주일 약통) 또는 한 칸(하루 약통) + 시간대 + 시각 (G3, R-051·R-054) */
export interface RowEntry {
  row: number;
  time_of_day: TimeOfDay;
  /** 매일 같은 시각. 요일별 모드에서는 대표값(월요일 시각)으로만 쓴다 */
  dose_time: string;
  /** 요일별 시각 (월=0 … 일=6). null 이면 매일 같은 시각 */
  by_day: string[] | null;
}

export const timeOn = (e: RowEntry, weekday: number) => e.by_day?.[weekday] ?? e.dose_time;

/** 시간대 단위 일정 → PUT /schedule 전체 교체 본문 (그 시간대의 모든 요일) */
export function slotsFromRows(layout: Layout, entries: RowEntry[]): SlotInput[] | null {
  const rows = timeRows(layout);
  if (!rows) return null;
  return entries.flatMap((e) =>
    (rows[e.row]?.cells ?? []).map((c) => ({ cell_id: c.cell_id, weekday: c.weekday, time_of_day: e.time_of_day, dose_time: timeOn(e, c.weekday) })),
  );
}

/** 가장 많이 쓰인 시각 (같으면 이른 요일 것) */
function mostCommon(times: string[]): string {
  const n = new Map<string, number>();
  times.forEach((t) => n.set(t, (n.get(t) ?? 0) + 1));
  return [...n.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * 저장된 일정 → 시간대 단위. 요일마다 시각이 다르면 요일별 모드(by_day)로 연다 (R-053 후속 1: 저장해도 덮어쓰지 않게).
 * 일정이 없는 요일은 그 시간대의 가장 흔한 시각으로 채운다 (저장하면 그 요일도 생긴다)
 */
export function rowsFromSlots(layout: Layout, slots: SlotInput[]): RowEntry[] {
  const rows = timeRows(layout) ?? [];
  const out: RowEntry[] = [];
  for (const r of rows) {
    const mine = r.cells.map((c) => slots.find((x) => x.cell_id === c.cell_id && x.weekday === c.weekday));
    const found = mine.filter((x): x is SlotInput => !!x);
    if (!found.length) continue;
    const common = mostCommon(found.map((x) => x.dose_time));
    const days = ALL_WEEKDAYS.map((d) => {
      const i = r.cells.findIndex((c) => c.weekday === d);
      return (i >= 0 ? mine[i]?.dose_time : undefined) ?? common;
    });
    const differs = new Set(days).size > 1;
    out.push({ row: r.index, time_of_day: found[0].time_of_day, dose_time: differs ? days[0] : common, by_day: differs ? days : null });
  }
  return out;
}

/** 시간대 단위 중 일정이 없는 요일이 있는지 (저장하면 그 요일도 생긴다는 안내용) */
export function missingWeekdays(layout: Layout, slots: SlotInput[]): boolean {
  const rows = timeRows(layout) ?? [];
  return rows.some((r) => {
    const has = r.cells.filter((c) => slots.some((x) => x.cell_id === c.cell_id && x.weekday === c.weekday));
    return has.length > 0 && has.length < r.cells.length;
  });
}
