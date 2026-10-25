import type { DoseEvent } from '@/api';
import { dateKey, TIME_OF_DAY_LABELS } from '@/lib/time';

/**
 * 복약 건 이름. 전날 건(carried_over)은 date(원래 날짜)로 날짜를 구분한다 (R-021 Q-007).
 * 예: "저녁", "어젯밤 자기 전", "어제 아침"
 */
export function doseName(ev: Pick<DoseEvent, 'date' | 'slot'>, today = new Date()): string {
  const tod = TIME_OF_DAY_LABELS[ev.slot.time_of_day];
  if (ev.date === dateKey(today)) return tod;
  const yesterday = dateKey(new Date(today.getTime() - 86_400_000));
  if (ev.date === yesterday) {
    const night = ev.slot.time_of_day === 'evening' || ev.slot.time_of_day === 'bedtime';
    return `${night ? '어젯밤' : '어제'} ${tod}`;
  }
  const [, m, d] = ev.date.split('-').map(Number);
  return `${m}월 ${d}일 ${tod}`;
}
