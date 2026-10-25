import type { TimeOfDay } from '@/api';
import { seoulClock, seoulDay, seoulDayOfKey } from '@/lib/seoulTime';

export const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

export const TIME_OF_DAY_LABELS: Record<TimeOfDay, string> = {
  morning: '아침',
  noon: '점심',
  evening: '저녁',
  bedtime: '자기 전',
};

/** 월 = 0 ... 일 = 6. 서울 기준 (R-032 Q-013) */
export function mondayIndex(d: Date): number {
  return seoulDay(d).weekday;
}

/**
 * "오전 8시 12분", "오후 7시" 같은 말하기 좋은 시각. 서울 시각으로 읽는다 (R-032 Q-013).
 * 0시는 "밤 12시", 12시는 "낮 12시" (R-026 Q-010)
 */
export function spokenTime(d: Date): string {
  const { h, min } = seoulClock(d);
  return spokenHM(h, min);
}

/** 일정의 "HH:MM"(서울 시각)을 그대로 읽는다 */
export function spokenHHMM(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return spokenHM(h, m);
}

function spokenHM(h: number, m: number): string {
  const half = h === 0 ? '밤' : h === 12 ? '낮' : h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${half} ${h12}시` : `${half} ${h12}시 ${m}분`;
}

/** "10월 25일" (서울 날짜) */
export function longDate(d: Date): string {
  const day = seoulDay(d);
  return `${day.m + 1}월 ${day.d}일`;
}

export function weekdayLong(d: Date): string {
  return `${WEEKDAY_LABELS[mondayIndex(d)]}요일`;
}

/** 서울 기준 "YYYY-MM-DD" (api.md 1.3) */
export function dateKey(d: Date): string {
  return seoulDay(d).key;
}

/** 서버가 준 "YYYY-MM-DD" 를 "10/25 (일)" 로 */
export function shortDateOfKey(key: string): string {
  const day = seoulDayOfKey(key);
  return `${day.m + 1}/${day.d} (${WEEKDAY_LABELS[day.weekday]})`;
}
