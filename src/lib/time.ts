import type { TimeOfDay } from '@/api';

export const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

export const TIME_OF_DAY_LABELS: Record<TimeOfDay, string> = {
  morning: '아침',
  noon: '점심',
  evening: '저녁',
  bedtime: '자기 전',
};

/** 월 = 0 ... 일 = 6 */
export function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/** "8시 12분", "오후 7시" 같은 말하기 좋은 시각 */
export function spokenTime(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  const half = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${half} ${h12}시` : `${half} ${h12}시 ${m}분`;
}

export function spokenHHMM(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return spokenTime(d);
}

export function longDate(d: Date): string {
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export function weekdayLong(d: Date): string {
  return `${WEEKDAY_LABELS[mondayIndex(d)]}요일`;
}

/** 서울 기준 "YYYY-MM-DD" (api.md 1.3). 기기 시간대가 서울이라고 본다 */
export function dateKey(d: Date): string {
  const pad = (n: number) => `${n}`.padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
