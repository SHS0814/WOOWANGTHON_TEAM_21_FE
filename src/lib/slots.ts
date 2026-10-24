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

/**
 * 약통 칸 → (요일, 시간대) 연결 (G2 칸 매핑, api.md 3.14).
 * 요일이 열이면 행이 시간대, 요일이 행이면(세로 약통, 2.2) 열이 시간대다.
 * 시간대 이름을 못 읽은 줄은 순서대로 채운다. 연결할 수 없으면 null
 */
export function cellMapping(layout: Layout): { cell_id: string; weekday: number; time_of_day: TimeOfDay }[] | null {
  const weekdayIsCol = isWeekdays(layout.col_labels) || (layout.cols === 7 && !isWeekdays(layout.row_labels));
  const weekdayIsRow = !weekdayIsCol && (isWeekdays(layout.row_labels) || layout.rows === 7);
  if (!weekdayIsCol && !weekdayIsRow) return null;
  const todLabels = weekdayIsCol ? layout.row_labels : layout.col_labels;
  const used = new Set<TimeOfDay>();
  const tods = todLabels.map((l) => {
    const t = timeOfDayFromLabel(l);
    if (!t || used.has(t)) return null;
    used.add(t);
    return t;
  });
  const fill = ORDER.filter((t) => !tods.includes(t));
  const resolved = tods.map((t) => t ?? fill.shift() ?? null);
  if (resolved.some((t) => !t) || new Set(resolved).size !== resolved.length) return null;
  return layout.cells.map((c) => ({
    cell_id: c.id,
    weekday: weekdayIsCol ? c.col : c.row,
    time_of_day: resolved[weekdayIsCol ? c.row : c.col]!,
  }));
}

export function buildSlots(layout: Layout, times: Partial<Record<TimeOfDay, string>>): SlotInput[] | null {
  const map = cellMapping(layout);
  if (!map) return null;
  return map.filter((m) => times[m.time_of_day]).map((m) => ({ ...m, dose_time: times[m.time_of_day]! }));
}
