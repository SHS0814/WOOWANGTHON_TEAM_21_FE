import type { Layout, SlotInput, TimeOfDay } from '@/api';

const ORDER: TimeOfDay[] = ['morning', 'noon', 'evening', 'bedtime'];

export function timeOfDayFromLabel(label: string): TimeOfDay | null {
  if (label.includes('아침')) return 'morning';
  if (label.includes('점심')) return 'noon';
  if (label.includes('저녁')) return 'evening';
  if (label.includes('취침') || label.includes('자기')) return 'bedtime';
  return null;
}

const WEEKDAY = ['월', '화', '수', '목', '금', '토', '일'];
const isWeekdays = (labels: string[]) => labels.length === 7 && labels.every((l, i) => l.startsWith(WEEKDAY[i]));

/** 약통의 요일 방향과 시간대 줄 이름. 요일이 열이면 행이 시간대, 요일이 행이면(세로 약통, 2.2) 열이 시간대다 */
function orient(layout: Layout) {
  const weekdayIsCol = isWeekdays(layout.col_labels) || (layout.cols === 7 && !isWeekdays(layout.row_labels));
  const weekdayIsRow = !weekdayIsCol && (isWeekdays(layout.row_labels) || layout.rows === 7);
  if (!weekdayIsCol && !weekdayIsRow) return null;
  return { weekdayIsCol, todLabels: weekdayIsCol ? layout.row_labels : layout.col_labels };
}

export interface TimeRow {
  /** 시간대 줄 번호 (0부터) */
  index: number;
  label: string;
  cells: { cell_id: string; weekday: number }[];
}

/** 약통의 시간대 줄들. 일정은 약통 칸과 1:1이라 줄 하나가 한 시간대의 7일 칸이다. 요일을 못 읽으면 null */
export function timeRows(layout: Layout): TimeRow[] | null {
  const o = orient(layout);
  if (!o) return null;
  return o.todLabels.map((label, index) => ({
    index,
    label,
    cells: layout.cells
      .filter((c) => (o.weekdayIsCol ? c.row : c.col) === index)
      .map((c) => ({ cell_id: c.id, weekday: o.weekdayIsCol ? c.col : c.row })),
  }));
}

/** 약통 칸 → (요일, 시간대) 연결의 시간대 부분 (G2 칸 매핑, api.md 3.14).
 * 줄 이름에서 읽은 시간대 (못 읽은 줄은 남은 시간대를 순서대로). 줄이 4개를 넘거나 겹치면 null */
export function suggestedTimesOfDay(layout: Layout): TimeOfDay[] | null {
  const o = orient(layout);
  if (!o) return null;
  const used = new Set<TimeOfDay>();
  const tods = o.todLabels.map((l) => {
    const t = timeOfDayFromLabel(l);
    if (!t || used.has(t)) return null;
    used.add(t);
    return t;
  });
  const fill = ORDER.filter((t) => !tods.includes(t));
  const resolved = tods.map((t) => t ?? fill.shift() ?? null);
  if (resolved.some((t) => !t) || new Set(resolved).size !== resolved.length) return null;
  return resolved as TimeOfDay[];
}

/** 복약 시간대 하나 = 약통의 한 줄 + 시간대 + 시각 (G3, R-051) */
export interface RowEntry {
  row: number;
  time_of_day: TimeOfDay;
  dose_time: string;
}

/** 시간대 줄 단위 일정 → PUT /schedule 전체 교체 본문 (그 줄의 7칸 모두) */
export function slotsFromRows(layout: Layout, entries: RowEntry[]): SlotInput[] | null {
  const rows = timeRows(layout);
  if (!rows) return null;
  return entries.flatMap((e) =>
    (rows[e.row]?.cells ?? []).map((c) => ({ cell_id: c.cell_id, weekday: c.weekday, time_of_day: e.time_of_day, dose_time: e.dose_time })),
  );
}

/** 저장된 일정 → 시간대 줄 단위. 줄마다 첫 일정의 시간대·시각을 쓴다 */
export function rowsFromSlots(layout: Layout, slots: SlotInput[]): RowEntry[] {
  const rows = timeRows(layout) ?? [];
  const out: RowEntry[] = [];
  for (const r of rows) {
    const s = slots.find((x) => r.cells.some((c) => c.cell_id === x.cell_id));
    if (s) out.push({ row: r.index, time_of_day: s.time_of_day, dose_time: s.dose_time });
  }
  return out;
}
